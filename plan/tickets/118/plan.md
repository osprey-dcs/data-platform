# Plan: Trim script for old PV time-series buckets (#118, phase 1a of epic #117)

- **Ticket**: [osprey-dcs/data-platform#118](https://github.com/osprey-dcs/data-platform/issues/118)
- **Parent epic**: [osprey-dcs/data-platform#117](https://github.com/osprey-dcs/data-platform/issues/117);
  [epic plan](../117/plan.md)
- **Status**: implemented 2026-11-16; the sections below were corrected where building and
  testing the script showed the draft to be wrong (see [Findings from implementation](#findings-from-implementation))
- **Repo**: data-platform only

## Overview

A mongosh script that deletes buckets older than a cutoff from `buckets`, for the SLAC
deployment to free space before its December 2026 evaluation and then hold a rolling window
with a daily run. The epic plan holds the decisions (D1–D16) and the background; this plan
holds the mechanism.

## Background

From the epic plan, the facts the mechanism rests on:

- 1.34 billion buckets, average 42 KiB, on six shards; all of a PV's buckets are on one shard.
  Shard key `dataColumn.columnMetadata.attributes.shardSlot`.
- The shipped index `(pvName, dataTimestamps.firstTime.seconds, .nanos,
  dataTimestamps.lastTime.seconds, .nanos)` is present at SLAC and is the only index the
  script relies on, besides `_id`.
- Percona Server for MongoDB 8.0.19-7. Each shard is two data-bearing members and an arbiter,
  so write concern `majority` needs both data members.
- The first trim is 800 to 900 million deletes; a daily run about 8 million.

## Design

### Files and configuration

| File | Role |
|---|---|
| `bin/mongodb-trim-buckets.js` | The script. Reads its configuration from environment variables. |
| `bin/mongodb-trim-buckets` | Bash wrapper: parses flags, exports the variables, clears the variables the flags stand for, runs `mongosh --nodb --quiet --file`. |

| Flag | Variable | Default |
|---|---|---|
| (none) | `DP_TRIM_MONGODB_URI` | required |
| `--older-than-days N` | `DP_TRIM_OLDER_THAN_DAYS` | one of these two |
| `--before <UTC timestamp>` | `DP_TRIM_BEFORE` | is required |
| `--filter <Extended JSON>` | `DP_TRIM_FILTER` | none |
| `--execute` | `DP_TRIM_EXECUTE=true` | dry run |
| `--batch-size N` | `DP_TRIM_BATCH_SIZE` | 1000 |
| `--pause-ms N` | `DP_TRIM_PAUSE_MS` | 0 |
| `--slice i/n` | `DP_TRIM_SLICE` | whole PV list |
| `--exact-filter-count` | `DP_TRIM_EXACT_FILTER_COUNT=true` | sample |
| `--per-pv`, `--no-per-pv` | `DP_TRIM_PER_PV` | dry run yes, execute no |
| `--database NAME` | `DP_TRIM_DATABASE` | `dp` |
| (none) | `DP_TRIM_WTIMEOUT_MS` | 60000 |
| (none) | `DP_TRIM_RETRY_DELAYS_MS` | `5000,15000,45000,120000`; for the test |

Exit status: 0 completed, 1 failed part-way and safe to repeat, 2 not started and nothing
changed. The batch size, timeout and retry delays are starting values; nothing on the fixture
can tune them, so the first stage at SLAC is where they are judged.

### Start-up checks, before any read of `buckets`

1. Exactly one of the two cutoff settings; a parseable cutoff that is in the past.
2. The filter parses as Extended JSON and is a document.
3. The slice is `i/n` with `0 <= i < n`.
4. `hello` reports `mongos`, or the server is not a member of a sharded cluster
   (`shardingState`, falling back to the `clusterRole` start-up option; if the user may run
   neither, the run is refused, since it cannot tell). A direct connection to a shard is
   refused.
6. No setting is present but empty. A blank filter or slice is refused, not read as none.
5. The shipped compound index exists on `buckets`.

Any failure exits non-zero with no `trimLog` record and nothing deleted.

### Selection

- Cutoff `C` in whole seconds.
- Age predicate for PV `p`:
  `{pvName: p, "dataTimestamps.firstTime.seconds": {$lt: C}, "dataTimestamps.lastTime.seconds": {$lt: C}}`.
  All three fields are in the compound index. The `firstTime` bound is implied by the
  `lastTime` one and is there to bound the index scan.
- With a filter `F`: `{$and: [age, F]}`.
- PV enumeration: `aggregate([{$group: {_id: "$pvName"}}])` on `buckets`, through a cursor so
  the 16 MB limit of `distinct` does not apply. Verified with `explain` on the sharded fixture:
  each shard answers it with `PROJECTION_COVERED > DISTINCT_SCAN`, one index seek per PV and
  no documents read. The script explains the pipeline at start-up and warns when the plan has
  no `DISTINCT_SCAN`. The `pvStats` fallback was not needed.
- Slice: a PV belongs to slice `i` of `n` when a stable hash of its name, modulo `n`, is `i`.

### Deleting

For each PV in the slice, repeat until a batch comes back short:

1. `find(selection, {_id: 1, firstTime.seconds: 1}).sort(index order).limit(batchSize)
   .hint(compound index)`. After the first batch the selection also carries
   `firstTime.seconds >= ` the second the previous batch ended in, so buckets a filter keeps
   at the old end of a PV are not read again for every batch.
2. `deleteMany({_id: {$in: ids}}, {writeConcern: {w: "majority", wtimeout: ...}})`.
   The write concern is fixed. When a secondary is down or too far behind, the batch times
   out, the retries are used up, and the run stops; the error message says that any shard
   can be the one at fault and that the server's message names it.
3. On error in the read or the delete, retry it after 5, 15, 45 and 120 seconds, then mark the run failed in
   `trimLog` and exit 1. A write concern error carries the number of buckets the primary
   removed (`result.n`); that is added to the run's count, because the retry then matches
   nothing.
4. Pause if configured.

Step 1 fetches each candidate: `_id` is not in the compound index, and on a sharded cluster
the shard fetches the document anyway to check it owns it. That is not an extra read, since
step 2 must read the document to delete it and then finds it in cache. A delete by `_id`
through `mongos` is sent to every shard; the ones that do not hold the PV answer from the
`_id` index.

### Dry run

- Per PV: the `count` command on the age predicate, hinted to the compound index, with read
  concern `available`, and the start times of the oldest and the latest-starting candidate
  from covered finds with the same read concern. See the first finding below for why
  `available`.
- The end of the latest-starting bucket over the PVs visited, printed beside the cutoff as a
  lower bound on the newest data.
- With a filter: evaluate it on the server against the oldest and newest candidate of each PV
  (two bucket reads per PV) and report `both / one / neither` match; totals count PVs in each
  class. With `--exact-filter-count`, `countDocuments({$and: [age, F]})` instead.
- The summary states plainly when the filter excluded nothing in the sample.

### `trimLog` record

Inserted before the PV walk, updated at the end and on failure. Both writes use write concern
`majority` with the same timeout as the deletes, so neither can wait without limit. A failed
insert ends the run with exit 1 and nothing deleted; a failed final update ends an otherwise
completed run with exit 1.

```
{ _id, scriptVersion, startedAt, endedAt, host, database,
  cutoffSeconds, cutoffSource: "olderThanDays:60" | "before:<ts>",
  filter: <as given, string>, slice: "i/n" | null, dryRun,
  status: "running" | "completed" | "failed", error,
  pvsVisited, bucketsMatchedByAge (dry run), bucketsDeleted, batches, retries, deletesPerSecond,
  horizonSeconds }   // set only when completed, executed, no filter, no slice
```

## Test

`test/mongodb-trim-buckets/run-test.sh` starts the cluster in `docker-compose.yml`, initiates
it, and runs `test.js` under mongosh. `test.js` seeds a fixture by direct insert of documents
with the stored bucket shape, runs the wrapper as a child process, and compares the buckets
left with an independent statement of the rule. The cluster is the Percona image SLAC runs
(it has an arm64 build): an unsharded one-member replica set, and two shards of a primary, a
secondary and an arbiter with the shard key on the column attribute path, split so each PV is
on one shard.

Cases, run on both the replica set and the sharded cluster unless noted:

- dry run deletes nothing and its count equals what `--execute` then deletes; a repeat run
  deletes nothing;
- buckets older than, newer than, straddling, and ending exactly at the cutoff; a long-span
  bucket; a sub-second cutoff behaves as its whole second;
- batches smaller than a PV's candidates;
- a filter that narrows, with the sample and the exact count; a filter naming `pvName` or
  `dataTimestamps`, or using `$or`, does not widen;
- the dry run flags a filter that excludes nothing;
- two slices together delete exactly what an unsliced run would, and share no PV;
- `--older-than-days`, and an archive left with no buckets;
- `DP_TRIM_` variables left in the environment, `DP_TRIM_EXECUTE=true` among them, do not
  change what the wrapper does;
- rejected with exit 2, no record and nothing deleted: a database with no `buckets`, both cutoffs, neither, zero or
  fractional days, a cutoff without a zone, in the future, or unparseable, a filter that is
  not JSON or not an object, a bad slice, a zero batch size, an unknown flag, a flag missing
  its value, no connection string, a missing compound index;
- exit 1 on an unreachable server;
- a run killed part-way leaves a `running` record; the repeat run finishes the job;
- `horizonSeconds` set only for a completed, unfiltered, unsliced, executed run;
- an empty or blank value for a flag or a variable is rejected with exit 2;
- sharded only: with the secondary of the shard holding `trimLog` stopped, a run and a dry
  run exit 1 within the timeout, delete nothing, and leave a `failed` record;
- sharded only: the fixture spans both shards; a direct connection to a shard is refused; with
  a shard's secondary stopped the run retries, exits 1 with a `failed` record whose count
  matches what is gone, and the repeat run finishes once the secondary is back.

214 checks pass. Each of five deliberate breaks of the script (filter merged instead of
ANDed, `lastTime <= cutoff`, no `lastTime` test, a wrong resume bound, a horizon on a filtered
run) fails the test. The script was also run by hand under mongosh 2.6.0, the version inside
the server image, which is what the Kubernetes examples use. CI is
`.github/workflows/trim-buckets-test.yml`.

Not tested: anything at scale (rates, the cost of listing PVs on 1.3 billion buckets, the
effect on replication lag), and the Kubernetes manifests against a cluster. Authentication is
not in the test; the refusal when the topology cannot be determined was checked by hand
against a standalone server with authentication (a user without `clusterMonitor` is refused,
one with it runs). A failed final update of the record is not tested.

## Findings from implementation

- **A count on the index is not index-only on a sharded cluster.** With the default read
  concern each shard fetches every document a query touches, to test it against the ranges
  the shard owns, because the shard key is not in the bucket index (`COUNT > SHARDING_FILTER >
  FETCH > IXSCAN`, documents examined equal to keys). The age-only dry run count would have
  read every candidate bucket, about 35 TB at SLAC. With read concern `available` the same
  count is `COUNT > IXSCAN` with no documents examined. The script uses `available` for every
  read meant to stay on the index. The cost is that documents orphaned by an interrupted chunk
  migration are counted; SLAC has one static chunk per shard, so there should be none.
- **A shard with an arbiter cannot be added until a cluster-wide default write concern is
  set.** So SLAC's cluster has one set explicitly; whether it is `majority` or `1` does not
  matter to the script, which always states its own.
- **A write concern timeout is an exception in mongosh, and the delete has already happened
  on the primary.** The count is in `result.n`, not `result.deletedCount`.
- **A down secondary on any shard stops every trim (found in review).** The delete by `_id`
  carries no shard key, so `mongos` sends it to every shard, and a shard that deletes nothing
  still waits for a majority to reach its latest operation. With a secondary of one shard
  stopped, a trim of a PV held by the other shard timed out, with the error naming the first
  shard. The message and the runbook say so.
- **The index gives when the latest-starting bucket ends, not the latest end (found in
  review).** The dry run reports bucket start times, and the newest data as a lower bound.
- **`Long(n)` in mongosh keeps only the low 32 bits of `n`** (`Long(4294967296)` is 0). The
  script uses `Long.fromNumber`.
- **The wrapper passed through any `DP_TRIM_` variable already exported (found in review)**,
  so `DP_TRIM_EXECUTE=true` left in a shell made a run without `--execute` delete. The wrapper
  now clears the variables its flags stand for.
- **In mongosh, `return f()` inside `try` does not catch a failure of `f` when `f` makes a
  database call (found in review).** mongosh hands the pending call back to the caller. The
  retry loop assigns the result first and then returns it; the write concern test fails
  without that.
- **With a shard's secondary stopped, more than deletes block.** Dropping or creating a
  collection through `mongos` hung until the secondary returned. On SLAC's layout a down
  secondary stops schema changes and migrations as well as trims.

## Runbook outline (`doc/admin/trim-buckets.md`)

1. What the script does and does not do.
2. Prerequisites: mongosh version, connection through `mongos`, write access to `buckets` and
   `trimLog`, and the three indexes worth dropping first.
3. The dry run and how to read it, including the newest-data line and the filter sample.
4. Writing a filter: delete-only-what-matches, the stored paths, the tested Archiver filter.
5. The staged first trim: a small first stage, reading the delete rate, choosing the number
   of sliced instances and the later stages.
6. The daily run and the example CronJob.
7. Reading `trimLog`.
8. Limits: historical loads, load lag, queries during a trim, space not returned to the OS.
9. When a run stops on a write concern timeout: what it means on a two-member-plus-arbiter
   shard, and that the run is safe to repeat once the secondary has caught up.

Written as `doc/admin/trim-buckets.md`, with the recommendation to drop the three unused
indexes under prerequisites and a section on running several instances. The Kubernetes
examples are `kubernetes/examples/trim-buckets/cronjob.yaml` and `job-sliced.yaml`.

## Out of scope

Everything the epic plan lists, plus: any change to dp-service; trimming other collections;
a checkpoint or resume file.

## Dependencies and sequencing

- Nothing blocks writing and testing the script.
- The tested Archiver filter in the runbook blocks on SLAC's answer, and SLAC's first
  `--execute` run blocks on that filter.
- The CI workflow may land in a following PR.
