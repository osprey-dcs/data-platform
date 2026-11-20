# Plan: Data trimming and migration (epic #117)

- **Ticket**: [osprey-dcs/data-platform#117](https://github.com/osprey-dcs/data-platform/issues/117)
- **Status**: epic plan, 2026-11-16. Phase 1a is implemented and waiting on SLAC (see
  [Open questions](#open-questions)); phase 2 is direction only and will be refined in later
  PRs while the epic is open.
- **Child tickets**:
  [#118](https://github.com/osprey-dcs/data-platform/issues/118) phase 1a trim script
  ([plan](../118/plan.md));
  [#119](https://github.com/osprey-dcs/data-platform/issues/119) time-partitioned storage
  decision (phase 2).
- **Repos touched**: data-platform (phase 1a), dp-service (phase 2), dp-grpc (phase 2,
  probably)

The SLAC deployment's MongoDB archive is full: 1.34 billion bucket documents holding 54.6 TiB,
growing by about 10 TB per month, and the newest data cannot be loaded. They have an
evaluation deadline in December 2026. This epic delivers, in order:

1. **Phase 1a** — a script that trims old PV time-series buckets, run by hand or daily, to keep
   a rolling window (for example the newest 60 days). Delivered as soon as possible, with no
   service release.
2. **Phase 2** — retention as an automatic, configured feature of the services: trimming, and
   migration of aged data to lower-cost file storage that stays queryable through the API.

An earlier draft had a phase 1b (the trim logic as a tool in the dp-service jar). It is folded
into phase 2: the script covers the evaluation period, and the service implementation is
designed once, with the retention policy.

## Contents

1. [Background and triage findings](#background-and-triage-findings)
2. [Decisions](#decisions)
3. [Phase 1a: trim script](#phase-1a-trim-script)
4. [Phase 2: automatic retention and migration](#phase-2-automatic-retention-and-migration)
5. [Out of scope](#out-of-scope)
6. [Sequencing](#sequencing)
7. [Open questions](#open-questions)

## Background and triage findings

Checked against dp-service `main` (`fd806c9`) on 2026-11-12 and SLAC's replies of
2026-11-13 to 2026-11-16.

**The stored bucket (dp-service `BucketDocument`)**

- Fields written by ingestion: `_id` (`<pvName>-<firstSeconds>-<firstNanos>`), `pvName`,
  `dataColumn`, `dataTimestamps` (`firstTime`, `lastTime`, each with `seconds`/`nanos`),
  `providerId`, `providerName`, `clientRequestId`.
- Tags and attributes that clients set live per column, at
  `dataColumn.columnMetadata.tags` and `dataColumn.columnMetadata.attributes.<key>`. SLAC's
  buckets carry attributes there such as `source`, `facility`, `instrument`, `file`, and
  `shardSlot`.
- `BucketDocument` inherits top-level `tags`, `attributes`, `createdAt`, and `updatedAt` from
  `DpBsonDocumentBase`, but the ingestion factory never sets them. In particular **a bucket has
  no ingest timestamp**; the only time on it is the time of its samples.

**Indexes on `buckets`**

- dp-service ships one compound index, `(pvName, dataTimestamps.firstTime.seconds, .nanos,
  dataTimestamps.lastTime.seconds, .nanos)`, plus `providerId`. Nothing is led by time, so a
  delete by age alone is a collection scan. A delete per PV, bounded on `firstTime` and
  `lastTime`, runs entirely on the shipped index.
- No metadata path is indexed. A property filter is evaluated on the fetched documents.

**What a trim does to the rest of the system**

- `pvStats.maxBucketSpanSeconds` only has to be an upper bound on a PV's bucket spans
  (dp-service #232), so deleting buckets leaves it valid. A fully trimmed PV keeps its
  `pvStats` document, which is harmless.
- `dataSets` data blocks that reference a trimmed range now select no data; an export over such
  a block reports "data block query returned no data" as an error.
- `sampleStatusBuckets` keeps statuses for deleted samples. Harmless: the status filter is
  applied to samples that were retrieved. SLAC is not using the Sample Status API yet.
- `requestStatus` grows without bound and is not trimmed by this work (see Phase 2).

**MongoDB behaviour**

- WiredTiger reuses the space freed by deletes for new inserts but does not return it to the
  operating system without `compact`. SLAC needs the space for new inserts, not returned to the
  OS (the cluster is MongoDB only), so no compaction step is planned.
- A delete has three costs. The oplog entry carries only the `_id`, so replication cost is per
  bucket. MongoDB reads the document to delete it, so read cost is per byte, and the buckets
  being trimmed are the oldest and not in cache. And every index on the collection loses an
  entry, so write cost is per bucket per index.
- A property filter is evaluated on fetched documents. Counting what a filter matches therefore
  costs the same read as deleting it. Counting by age alone runs on the index.
- On a sharded cluster a query on the bucket index is not index-only by default: each shard
  fetches the document to check it owns it, because the shard key is not in the index. Read
  concern `available` skips that check. Found while building the script (see the #118 plan);
  it applies equally to any phase 2 work that expects to count or scan buckets from the index.

**The SLAC deployment** (figures from `getShardDistribution()`, 2026-11-16)

- Percona Server for MongoDB `8.0.19-7`, sharded, on Kubernetes. dp-service 1.16.0.
- `buckets`: 1,337,433,890 documents, 54,629 GiB of data (uncompressed; the on-disk size is
  smaller), average 42 KiB. Six shards, `rs0`–`rs5`, each holding about 223 million documents
  and 9.1 TiB, in one chunk per shard. Each shard is a replica set of two data-bearing
  members and an arbiter, for lack of space for a third copy.
  The figure of 35 million buckets used in earlier discussion was wrong by a factor of 38.
- Shard key: `{"dataColumn.columnMetadata.attributes.shardSlot": 1}`, confirmed. The ingestion
  driver assigns each PV to a partition (mapping kept in an external SQLite database) and
  writes a random `shardSlot` within that partition's range into the column attributes, so all
  of a PV's buckets sit on one shard. The even distribution shows the scheme works.
- Eight indexes on `buckets`. Needed: `_id`, the shard key index, the shipped five-field
  compound index, `providerId`. SLAC's own: `(shardSlot, firstTime.seconds)`. Not used by
  dp-service 1.16, which hints the shipped compound index: `pvName_1`, the three-field
  `(pvName, firstTime.seconds, lastTime.seconds)`, and `pvName_1_source_1`, whose `source`
  field is not a top-level field of any bucket. Each of those three is maintained on every
  insert and every delete.
- Data is loaded in batches today; live continuous ingestion may start in March 2027.
- A small amount of data ingested from the Archiver for user testing must survive trimming.
  It is identified by its provider (`providerId` or `providerName`); rules on column metadata
  may be wanted later (SLAC, 2026-11-19, on #118).

**Size of the job**

- Keeping 60 days at 10 TB per month keeps roughly 20 TB, so the first trim deletes about two
  thirds of the archive: 800 to 900 million buckets and 35 to 40 TB of reads.
- A daily run deletes about a day's growth: roughly 8 million buckets.
- Arithmetic, not a prediction, for 850 million deletes: at 1,000 per second, 10 days; at
  5,000, 2 days; at 20,000, 12 hours. For a daily 8 million: 2.2 hours, 27 minutes, 7 minutes.
- One data point: the 1.16.0 schema migration, which scanned every bucket, took about 12 hours.
  That scan ran on all shards at once and mostly read. A trim also writes, and a single script
  works on one PV, so one shard, at a time. It suggests the first trim is not shorter than
  many hours even when run in parallel across shards, and is likely several times that. The
  archive's size at the time is not known, so this is a bound, not an estimate.

## Decisions

**D1 — Phase 1a is a mongosh script in data-platform, not a service feature.** It needs no
dp-service release, and SLAC needs it before their December evaluation. Rejected for 1a: a Java
tool in the dp-service jar (needs a release) and a service API (needs a release and a design).

**D2 — The cutoff is data time, and a bucket is trimmed whole.** The cutoff is truncated to
whole seconds, and a bucket is deleted when its `lastTime.seconds` is before it. A bucket that straddles the cutoff is kept until the cutoff
passes its last sample. Nothing is split or rewritten. Rejected: splitting a straddling bucket,
which means rewriting stored data in a script (that belongs with dp-service #258).

**D3 — Trim PV by PV on the shipped index.** PV names are enumerated from `buckets` itself, on
the index, so no PV can be missed and the script does not depend on `pvStats`. If that
enumeration turns out not to run on the index, the fallback is `pvStats` with a reported
comparison against `buckets`. Each PV's delete is bounded on `firstTime` and `lastTime` in the
compound index. Rejected: a single delete by age (a collection scan), and adding a time-led
index to a 1.3-billion-document collection for an interim tool.

**D4 — Delete in place, oldest first, in bounded batches.** A batch is up to N bucket `_id`
values for the PV, found on the compound index in `firstTime` order, then deleted by `_id`.
Deletes use write concern `majority` with a timeout, so the script slows when replication lags
and fails rather than hangs when a majority is unavailable. On SLAC's shards (two data-bearing
members and an arbiter) `majority` means both data members, so a trim stops when a secondary
is down or far behind. That is intended: deleting at volume with only the primary
acknowledging can push a lagging secondary off the oplog, and recovering it means copying
9 TiB again. The write concern is not configurable in this script. A pause between batches is an extra control. A failed batch is retried a bounded
number of times with backoff, then the script exits non-zero; re-running is safe and repeats
no deletes. Space freed is reusable at once, so loading can resume before the first trim
finishes. Rejected: copying survivors to a new collection and dropping the old one, which
rewrites 20 TB and cannot be renamed into place on a sharded cluster.

**D5 — The extra filter is a raw MongoDB filter document, ANDed with the age predicate.** It
covers every case SLAC listed (bucket id, `columnMetadata` properties, any other field) with no
option vocabulary to design. The script builds `{$and: [age, filter]}`, never a merge of the
two documents, so a filter that names `pvName` or `dataTimestamps` cannot replace the age
predicate. The accepted risk is that a
mistyped filter fails silently; D6 is the guard. The runbook recommends writing filters as
"delete only what matches X" rather than "keep what matches Y", because a typo or a bucket
missing the attribute is then kept instead of deleted. SLAC's own examples use
`{"$exists": false}`, which is the risky shape; if the Archiver data can only be identified by
a marker the rest lacks, the runbook says so and relies on the dry run.

**D6 — Dry run is the default; deleting needs an explicit flag.** The dry run reports, per PV
and in total, the buckets matched by age alone (an index count, read with read concern
`available`) and the time range that would
be deleted, and prints the newest data time in the archive beside the cutoff. With a filter it
tests the filter on a sample per PV, the oldest and newest candidate bucket, and labels the
result as a sample; an option requests the exact count at the cost of reading every candidate.
The sample shows whether a filter protects a PV at all. It can mislead when the filter's answer
varies within one PV, and the runbook says so.

**D7 — Each run writes an audit record to a `trimLog` collection.** One document per run,
inserted at the start and updated at the end, so an interrupted run leaves a record marked
incomplete: cutoff, filter as given, slice, start and end time, host, script version, dry run
or not, buckets deleted, delete rate, and whether it completed. A dry run therefore needs write
access to `trimLog`. It answers "why is this data gone". A separate horizon field is set only
by a run that completed with no filter and no slice; for sliced runs the horizon holds once
every slice at that cutoff has completed. Phase 2 can use the horizon to tell trimmed data from
data that never existed.

**D8 — Trimming runs while the services are live; no maintenance window.** For the evaluation
period SLAC will not load data older than the retention window, so the trim and ingestion never
touch the same buckets. A query that reaches into a range being trimmed may see part of it.
The runbook states both.

**D9 — Phase 1a trims `buckets` only.** That is where the space is. `sampleStatusBuckets` and
`requestStatus` are deferred (see Phase 2).

**D10 — Historical loads are truncated during the evaluation period.** With no ingest
timestamp, data loaded with sample times older than the window is deleted by the next run
unless the filter excludes it. The runbook says so. A proper hold mechanism is phase 2 work.
The window is also measured from the wall clock, not from the newest data: if the newest
loaded data is three weeks old, a 60-day window keeps 39 days of data.

**D11 — Validation is our own sharded fixture, then dry run and staged runs at SLAC.** We test
against a throwaway sharded cluster on the Percona image SLAC runs, with the shard key on the
column attribute path as SLAC has it. At SLAC the dry run is the rehearsal. A rehearsal in
SLAC's test environment is welcome if practical but not assumed.

**D12 — The script's test runs in CI when the script changes.** The test is needed to develop
the script anyway. It is its own workflow file with a `paths:` trigger, because `ci.yml`
deliberately has none. CI must not delay delivery: if the job is not green quickly it follows
in a separate PR.

**D13 — The first trim is done in stages, by moving the cutoff forward.** A single run at the
final cutoff works through one PV at a time, so stopping it leaves some PVs trimmed and others
untouched. Stages by cutoff remove the oldest data across all PVs first. The first stage is
small and exists to measure the delete rate, which the script reports; SLAC extrapolates from
it before choosing later stages. Each stage is a complete, audited run, and loading can resume
between stages once enough space is free. SLAC has agreed to this (2026-11-16): the whole
first trim may take a long time as long as each stage is manageable, so there is no target
duration.

**D14 — The script can run as several instances over disjoint slices of the PV list.** Each
PV's data is on one shard, so one instance loads one shard at a time while five sit idle, and
at 800 to 900 million deletes a serial run may take longer than the evaluation allows. A slice
option (`i` of `n`, by a hash of the PV name) lets `n` instances share the work with no
coordination. Built in from the start because it is small and the measured rate will probably
call for it; how many instances to run is decided from the first stage's rate.

**D15 — SLAC takes the script from `main` at a named commit.** No data-platform release is
cut for it. The script carries a version constant, recorded in `trimLog`. It is included in
the next data-platform release in the ordinary way.

**D16 — No index is added for trimming, and the runbook recommends dropping three.** The
delete set is most of the archive and the keep set is tiny, so an index on a filter path would
not reduce the reads, and every index adds a write to each of 1.3 billion inserts and deletes.
The three indexes dp-service 1.16 does not use (`pvName_1`, the three-field compound,
`pvName_1_source_1`) cost about three eighths of the index writes of every delete; the runbook
recommends dropping them before the first trim, as the 1.16 upgrade runbook already did. The
decision is SLAC's.

## Phase 1a: trim script

Child ticket [#118](https://github.com/osprey-dcs/data-platform/issues/118); the mechanism is
in [its plan](../118/plan.md).

Deliverables:

- `bin/mongodb-trim-buckets.js`, one mongosh file configured by environment variables, and
  `bin/mongodb-trim-buckets`, a thin bash wrapper that turns flags into those variables. A
  Kubernetes job sets the variables directly and needs only the one file.
- A test script that seeds a fixture, runs the dry run and the real trim, and asserts what
  survived.
- A runbook, `doc/admin/trim-buckets.md`, for SLAC.
- An example Kubernetes CronJob manifest for the daily run, outside `kubernetes/dp-ecosystem/`
  (which is applied wholesale). Untested against SLAC's cluster and labelled as an example.
- A workflow that runs the test when the script or its test changes.
- The child plan, and an entry in this repo's `CLAUDE.md` command list.

## Phase 2: automatic retention and migration

Direction only; each item needs its own design.

- **The trim logic in the services.** The script's selection, batching, and audit record,
  reimplemented in dp-service with integration tests and `trimLog` declared as a managed
  collection. Formerly phase 1b.
- **Retention policy in the services.** Configured, automatic, running as background work in
  normal operation. A bucket's lifecycle is online → migrated → deleted. The background
  machinery overlaps with data-platform #103 and dp-service #292/#293.
- **Time-partitioned storage.** At the expected 5 PB per year, deleting document by document
  does not scale. Partitioning buckets by time (for example a collection per period) turns a
  trim into a drop, with immediate space reclaim and no oplog load. This is a schema change
  that interacts with shared timestamps (data-platform #111) and bucket resizing
  (dp-service #258), and should be decided before either of those fixes a storage layout. It is
the first phase 2 design task and has its own child ticket, #119. MongoDB's TTL indexes are the
other built-in option and should be compared there: they automate deletion but still delete
document by document, and building one on the existing collection is itself a large job.
- **Retention holds and ingest time.** Attribute-driven "keep this" needs a first-class
  mechanism once historical loads are wanted, and probably an ingest timestamp on buckets so
  retention can distinguish old data from data loaded long ago. Whether retention varies per
  PV or per provider belongs here. If retention is to be driven by a property, it should be a
  dedicated field designed and indexed for the purpose, not an index over client attributes.
- **Migration to file storage.** The bucket document becomes an index entry whose payload is in
  a file. The archival format must be facility-neutral; HDF5 through the existing export code
  is one option, not a requirement.
- **External data without ingestion.** SLAC's buckets record the source file they were loaded
  from (`file` attribute). Data in a facility-specific format could be registered as index
  entries pointing at the existing files instead of being ingested. This has the same shape as
  migrated data, so the two could share one read path with a reader per format. Constraint:
  the source formats are proprietary to the facility, so this is a per-deployment option
  beside the neutral format, not a replacement for it.
- **Value queries.** Filtering on sample values is possible while payloads are in MongoDB and
  is not for externalized payloads, however they got there. Phase 2 has to decide whether that
  matters enough to keep some data online.
- **`requestStatus` and `sampleStatusBuckets`.** `requestStatus` may be redesigned rather than
  trimmed, since it is little used. `sampleStatusBuckets` trimming is harder than buckets (a
  status document has no span limit) and is only needed once the API is in use.
- **Shard routing.** SLAC's routing depends on an external PV-to-partition database and random
  slot values, with one 9 TiB chunk per shard. A backend-managed scheme is wanted eventually
  and interacts with partitioning.

## Out of scope

- Splitting or combining buckets — dp-service #258.
- Event-streaming ingestion — data-platform #113.
- Shared timestamps and the high-repetition-rate schema — data-platform #111.
- Background schema migration — data-platform #103, dp-service #292/#293.
- Returning disk space to the operating system (`compact`).

## Sequencing

- Writing and testing the phase 1a script blocks on nothing.
- **SLAC's first `--execute` run needs the provider filter** from the runbook, with the
  provider ids looked up on the cluster being trimmed, and a dry run that shows the Archiver
  PVs as kept.
- Phase 1a does **not** depend on a dp-service release, and no dp-service change is needed for
  it.
- Phase 2 is planned after 1a is in SLAC's hands. The time-partitioning decision comes before
  design work on #111 or #258 goes far.

## Open questions

1. **Per-PV or per-provider retention** — wanted for the script, or only in phase 2? (Asked
   2026-11-16 and again 2026-11-19.)
2. **Does any PV hold both Archiver and live data, what time range does the Archiver data
   cover, and how long is it kept?** (Asked 2026-11-19.) None of these changes the filter: it
   is correct for a PV with both providers, and it keeps the data for as long as it is passed.

Answered 2026-11-19 (SLAC, on #118): the Archiver data is identified by its provider, so the
runbook's filter selects on `providerId` (section "Keeping one provider's data", with a test
case for both forms of the filter). The provider's id was not given and differs per cluster,
so the runbook shows how to look it up. A rehearsal on SLAC's development cluster is
practical: it will ingest live data continuously with a one-day window, and its older data
must be kept.

Answered since the first draft: the shard key and data distribution (confirmed, see
Background); the archive's size (1.34 billion buckets, not 35 million); phase 1b (folded into
phase 2); a target duration for the first trim (none; staged, see D13); replica set membership
(two data-bearing members and an arbiter per shard, see D4); the PV count (3,008 by
`db.pvStats.estimatedDocumentCount()`, 2026-11-17). That is about 445,000 buckets and 18 GiB per
PV on average and about 500 PVs per shard. It changes no decision: listing the PVs and the
per-PV overhead of a run are negligible at that count, a PV's trim is a few hundred batches, and
hash slices divide the PV names evenly (about 500 per slice at six). Whether slices are even in
*data* depends on how bucket counts vary between PVs, which the dry run's per-PV counts show.
