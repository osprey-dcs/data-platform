# Data Platform 1.16.0 Release Notes

Changes since rel-1.15.0.  These are the master notes for the release: the MLDP ships as five
repositories tagged in lockstep, and this document describes what changed across all of them,
organized by feature.  Each section links to the repository notes that carry the detail.

| Repository | What it ships | 1.16.0 notes |
|---|---|---|
| [dp-grpc](https://github.com/osprey-dcs/dp-grpc) | gRPC API definition and generated Java stubs | [notes](https://github.com/osprey-dcs/dp-grpc/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md) |
| [dp-service](https://github.com/osprey-dcs/dp-service) | Java service implementations | [notes](https://github.com/osprey-dcs/dp-service/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md) |
| [dp-python-lib](https://github.com/osprey-dcs/dp-python-lib) | Python client library | [notes](https://github.com/osprey-dcs/dp-python-lib/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md) |
| [dp-desktop-app](https://github.com/osprey-dcs/dp-desktop-app) | JavaFX desktop GUI | [notes](https://github.com/osprey-dcs/dp-desktop-app/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md) |
| [data-platform](https://github.com/osprey-dcs/data-platform) | Installation tarball, deployment tooling, documentation | this document |

**1.16.0 is a breaking release, and it is the first one that migrates your database.**  The first
1.16.0 service to start against an existing archive changes stored data, with no downgrade path.
Read [Upgrading from 1.15.0](#upgrading-from-1150) before installing anything.

## Contents

- [Upgrading from 1.15.0](#upgrading-from-1150)
- [Sample Status API](#sample-status-api)
- [DataSet and Annotation API modernization](#dataset-and-annotation-api-modernization)
- [Query performance](#query-performance)
- [Service metrics and observability](#service-metrics-and-observability)
- [Schema migration mechanism](#schema-migration-mechanism)
- [Desktop application: deployment mode and metadata authoring](#desktop-application-deployment-mode-and-metadata-authoring)
- [Python client library](#python-client-library)
- [Correctness fixes worth knowing](#correctness-fixes-worth-knowing)
- [Release process and supply chain](#release-process-and-supply-chain)

## Upgrading from 1.15.0

This upgrade is not a drop-in binary replacement.  Three things are new this release: the database
is migrated in place, each service binds a second port, and two query changes alter results without
raising an error.

**Before you start:**

1. **Free ports 9464–9467 on every service host**, or set the metrics-port variables.  Each
   service now binds a Prometheus endpoint and **refuses to start if it cannot**.  On Kubernetes a
   collision is `CrashLoopBackOff`, not a pod running without metrics.
2. **Take a restorable backup.**  There are no downgrade migrations, and a 1.15.0 binary against a
   migrated database *misreads* it rather than refusing.  Restoring the backup is the only way
   back.
3. **Stop every service** — all of them, on every host.  The migration claim coordinates the
   processes that are *starting*; it does nothing about a 1.15.0 process already running, which
   keeps serving wrong answers against the migrated schema.

**The upgrade itself:**

4. **Start one service and let it migrate.**  Five migrations run in the first upgraded process,
   two of them full scans of the `buckets` collection — minutes to a couple of hours on archives in
   the tens of millions of buckets.  Other services started meanwhile wait five minutes on the
   claim and then exit; restart them once the migration finishes.
5. **Verify** the schema marker (`version: 5`), the `pvStats` count, and the index set before
   starting the rest.

**Then, in client code:**

6. **Rebuild against the 1.16.0 stubs and fix the compile errors.**  `SaveDataSetRequest` is flat,
   `Annotation` moved to the top level, `Annotation.comment` is now `description`, and
   `DataValue.ValueStatus` is gone.  In Python these surface at runtime rather than at build time —
   grep for `valueStatus`.
7. **Audit every query that passes more than one criterion.**  Criteria now combine with **AND**;
   values within one criterion with **OR**.  Two tag criteria used to match *either* tag and now
   match *both*.  **This is silent** — no error, a different result set.
8. **Add paging loops wherever a result was assumed complete.**  An unset `limit` now means a
   server default page size, not an unbounded result.  `queryPvMetadata` in particular was
   previously unbounded.
9. **Check anywhere an empty criteria list was relied on to fail.**  It now matches all records and
   returns the first page of the collection.

Runbooks for the migration, including a rehearsal procedure against a restored copy and the SLAC
sequence with measured numbers:
[`schema-migration.md`](https://github.com/osprey-dcs/dp-service/blob/rel-1.16.0/doc/runbooks/schema-migration.md),
[`schema-migration-rehearsal.md`](https://github.com/osprey-dcs/dp-service/blob/rel-1.16.0/doc/runbooks/schema-migration-rehearsal.md),
[`upgrade-1.16-slac.md`](https://github.com/osprey-dcs/dp-service/blob/rel-1.16.0/doc/runbooks/upgrade-1.16-slac.md).

## Sample Status API

*data-platform [#47](https://github.com/osprey-dcs/data-platform/issues/47) · dp-grpc #121 ·
dp-service #238 · dp-python-lib #8 · dp-desktop-app #37, #38 — all four repos*

The headline feature of 1.16.0.  The Sample Status API assigns status codes to **individual PV
samples at specific timestamps**, supporting automated data cleaning, quality assessment, and MLOps
workflows — an ML model labeling samples as anomalous, a rule engine flagging out-of-range values,
an operator marking a handful of suspect points.

A status is keyed by **(pvName, timestamp, domain, layer)**.  A *domain* names the contract that
gives the int32 status codes their meaning (`data_quality`, `ml_anomaly`); the MLDP neither
validates nor interprets them, following the `EnumColumn` precedent.  A *layer* names the producing
stream (`ml_model_v1`, `rule_engine`, `operator_override`), so several independent interpretations
of the same samples coexist within one domain.

Two properties shape everything built on it.  **Sparse labeling is first-class**: a save supplies
only the timestamps being labeled, and the absence of a status means "no assertion" — there is no
implicit default.  **Matching is by exact timestamp at nanosecond precision**, with no tolerance
window, so producers must label using timestamps taken from query results or exact `SamplingClock`
arithmetic; a recomputed or rounded timestamp silently matches nothing.

Queries can filter on status through `QuerySpec.sampleStatusSelector`, in one of two modes:
`MODE_INCLUDE_MATCHING` returns only samples carrying a matching status ("return only the
anomalies"), `MODE_EXCLUDE_MATCHING` drops them ("drop the bad data").  Because unlabeled samples
have no assertion attached, **the two modes are not complements** over a sparsely labeled archive.
The selector is supported on the sample-oriented query methods only; a bucket query rejects it,
since a storage bucket is returned whole and cannot represent per-sample filtering.

This release also **removes `DataValue.ValueStatus`** and its `StatusCode` / `Severity` enums
(dp-grpc #143), for which the Sample Status API is the designated replacement.  No server path ever
read the removed field, so there is no stored behavior to preserve and no migration is required;
archived values that carried it still parse, and field 15 is reserved permanently so they are never
misread.  Acquisition-time alarm information is now captured in a status domain, where — unlike the
removed field — it is queryable and correctable after ingestion.

Two domain-registry methods (`saveSampleStatusDomain`, `querySampleStatusDomains`) are defined as
deferred stubs and return "not yet implemented"; the registry record shape is deferred to a later
release.

Details: [dp-grpc](https://github.com/osprey-dcs/dp-grpc/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md#sample-status-api-dp-grpc-issue-121) (model, messages, selector semantics) ·
[dp-service](https://github.com/osprey-dcs/dp-service/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md#sample-status-api-issues-dp-grpc-121-dp-service-238) (storage, page sizes, limits) ·
[dp-python-lib](https://github.com/osprey-dcs/dp-python-lib/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md#sample-status-api-issue-8) (client API) ·
[dp-desktop-app](https://github.com/osprey-dcs/dp-desktop-app/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md#sample-status-generation-37-38) (generation and the new Explore view).
Worked examples: [sample status cookbook](https://github.com/osprey-dcs/dp-grpc/blob/rel-1.16.0/doc/cookbook/sample-status.md).

## DataSet and Annotation API modernization

*data-platform [#83](https://github.com/osprey-dcs/data-platform/issues/83) · dp-grpc #132 ·
dp-service #248 · dp-python-lib #6 · dp-desktop-app #42 — all four repos*

The DataSet and Annotation APIs are the oldest generation of `DpAnnotationService`, predating the
conventions established by the PV metadata, machine configuration, and sample status APIs.  1.16.0
brings them into line.  **Method names are unchanged, but message shapes and query semantics
changed incompatibly** — this is the bulk of the compile errors in the upgrade checklist above.

**Message shapes.**  `SaveDataSetRequest` is flat rather than embedding a `DataSet`, which is the
house rule for `Save*Request` messages: the domain message carries server-set audit fields that
must not be accepted as input.  `Annotation` is a top-level message rather than nested inside a
query response, and its `comment` field is renamed `description`, matching every other entity.
Both entities gain server-set `createdTime` / `updatedTime` and a last-writer `modifiedBy`, and
DataSets gain tags and attributes.

**Query results carry references, not content.**  `queryAnnotations` now returns `dataSetIds` and
`calculationsId` rather than embedding the DataSets and Calculations themselves; fetch content by
id with `queryDataSets` or `getCalculations`.  This removes an N+1 fan-out on the server, which
previously issued one dataset lookup per dataset id per annotation, serially and unbatched, then
embedded every frame, column, and value into each returned annotation.

**Criteria combine with AND.**  All query criteria now AND together, values within a single
criterion OR, matching the convention used everywhere else in the API.  The previous scheme ORed
some criteria together with per-method bucket assignments.  **This is the silent one** — two tag
criteria that used to match "either tag" now match "both tags", with no error raised.

**Paging.**  `queryDataSets` and `queryAnnotations` are now paged, and across every paged
`DpAnnotationService` query an unset `limit` means a server-configured default page size rather
than an unbounded result.  Result ordering is now part of the API contract, and a malformed page
token is rejected rather than silently restarting at page one.

**New methods.**  `getDataSet` / `getAnnotation` / `getCalculations` for single-record lookup, and
`deleteDataSet` / `deleteAnnotation`.  Deleting a DataSet is **rejected** while any Annotation
references it; deleting an Annotation is not blocked by incoming references, which are soft
associations and may dangle.  `patchDataSet` / `patchAnnotation` are reserved placeholders that
return "not yet implemented".

**Typed calculations and column provenance.**  `CalculationsDataFrame` now carries a
`common.DataFrame`, so calculation output gets the full set of typed scalar, array, image, struct,
and serialized column types plus per-column metadata.  Alongside it, `ColumnProvenance` gains a
structured `derivedFrom` list naming the columns a derived column was computed from — either an
archived PV or a Calculations column, with an optional source interval, which matters for
aggregations whose input window is not implied by the output's own timestamps.  Links are stored as
supplied and never validated.

**Export** gains inline `dataBlocks` as an ad-hoc source alongside `dataSetId` and
`calculationsSpec`, at least one of which is now required.  Note the documented restriction: the
tabular formats (CSV, XLSX) can represent scalar columns only, so data containing array, image, or
struct columns exports to HDF5 only.

Details: [dp-grpc](https://github.com/osprey-dcs/dp-grpc/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md#modernized-dataset-and-annotation-apis-dp-grpc-issue-132) ·
[dp-service](https://github.com/osprey-dcs/dp-service/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md#modernized-datasets-and-annotations-apis-issues-dp-grpc-132-dp-service-248) ·
[dp-python-lib](https://github.com/osprey-dcs/dp-python-lib/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md#datasets-annotations-and-export-issue-6) ·
[dp-desktop-app](https://github.com/osprey-dcs/dp-desktop-app/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md#annotation-api-modernization-42).
Worked examples: [datasets and annotations cookbook](https://github.com/osprey-dcs/dp-grpc/blob/rel-1.16.0/doc/cookbook/datasets-and-annotations.md).

## Query performance

*dp-service [#232](https://github.com/osprey-dcs/dp-service/issues/232),
[#257](https://github.com/osprey-dcs/dp-service/issues/257),
[#271](https://github.com/osprey-dcs/dp-service/issues/271),
[#274](https://github.com/osprey-dcs/dp-service/issues/274) — primarily dp-service*

A sustained effort against bucket query cost, prompted by query-performance reports from the SLAC
deployment.  Four changes, each independently significant on a large archive.

**The startup full-collection scan is gone (#232).**  Services no longer verify the whole `buckets`
collection against the configured span limit before binding their gRPC port — a scan that took
hours on archives in the tens of millions of buckets, during which the port was unbound and
Kubernetes liveness probes failed.  **Startup cost is now independent of archive size.**

**Query lower bounds are per PV rather than archive-wide (#232).**  Every bucket time-range query
carries a lower bound so the index scan has a floor.  That bound previously had to cover the
longest bucket *anywhere in the archive*, so a handful of over-long buckets on a few PVs imposed
that same lookback on every query for every other PV.  It is now derived from a per-PV statistic
maintained at ingestion.  On an archive where the configured limit had been raised to accommodate
outliers, this is the difference between a lookback measured in weeks and one measured in seconds
for the well-behaved majority.  A consequence worth noting: `Buckets.maxBucketSpanSeconds` is now
**ingestion-only** — raising it no longer widens any query's scan, and a deployment that raised it
to accommodate outliers can lower it back after upgrading.

**Every bucket query is pinned to the compound index and bounded on both sides (#271).**  All
bucket retrieval now hints the shipped compound index.  Previously the planner chose among every
index on the collection, and a long-lived archive still carries `pvName`-led indexes retired in
earlier releases — startup never drops an index — each of which is a planner candidate.  On
recent-window queries the planner was measured choosing a `lastTime`-led index whose plan needs a
blocking in-memory sort.  Separately, the index scan now carries an upper bound as well as a lower
one; before, the scan ran to the end of each PV's history and discarded everything past the window
by filter, which on a historical query against a still-active PV is most of that PV's archive.
**Behavior change:** if the compound index is missing, bucket queries now fail with an error naming
the hint rather than silently degrading to a collection scan.  Operators are encouraged to drop the
leftover `pvName`-led indexes, which still cost a write per ingested bucket.

**Bucket retrieval is partitioned by span class (#274).**  The per-PV bound was initially applied
as one maximum over all PVs in a request, so one long-span PV made every other PV's retrieval fetch
that span's worth of history.  Requests are now partitioned into power-of-two span classes, each
bounded by its own maximum.

Five new query benchmark clients cover `queryTable`, `querySamples`, `querySamplesStream`,
`queryBuckets`, and `queryBucketsStream` (#275), with a loader that takes options for history depth
and long-span PVs.

Details: [dp-service](https://github.com/osprey-dcs/dp-service/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md#per-pv-bucket-span-bound-the-startup-span-scan-is-removed-issue-232).

## Service metrics and observability

*data-platform [#212](https://github.com/osprey-dcs/dp-service/issues/212) — primarily dp-service*

Every service now collects and exports metrics: request rates, error rates, latency histograms, a
per-stage breakdown of query handling, MongoDB command durations, handler queue and worker
saturation, gRPC call metrics, and JVM runtime metrics.  The operator reference, including the
PromQL for diagnosing a slow query, is
[`doc/metrics.md`](https://github.com/osprey-dcs/dp-service/blob/rel-1.16.0/doc/metrics.md).

**Deployment change: each service binds a second port and fails to start if it cannot.**  Metrics
are on by default, on a Prometheus scrape endpoint per service — ingestion 9464, query 9465,
annotation 9466, ingestion stream 9467.  The fail-closed choice is deliberate: the alternative is a
service an operator believes is instrumented and is not.  Each port is configurable, the bind
interface is settable (use `127.0.0.1` on a shared host), and the whole feature switches off with
`DP_TELEMETRY_ENABLED=false`.  To push to an OpenTelemetry collector instead of being scraped, the
standard OTel environment variables apply with no rebuild.

**There is no authentication on the scrape endpoint.**  It exposes no data values and no PV names,
but it does reveal request rates, latencies, and collection names.

**New: slow query log.**  A query whose total handling time reaches a configurable threshold
(default 1000 ms, so this is on by default) writes one WARN line to a dedicated `dp.slowquery`
logger carrying the per-stage breakdown and the shape of the request.  It answers "why was *this*
query slow" without a trace backend.

**Ingestion latency is now measurable.**  `dp.ingest.duration` measures from request arrival
through the end of persistence — the number the gRPC call duration cannot show, since ingestion
acknowledges as soon as a request is validated and enqueued.  An operator watching call duration
alone would see a healthy few milliseconds while the queue behind it fell arbitrarily far behind.

**Two cautions for anyone writing alerts**, both verified against a real MongoDB: the
`db.client.operation.duration` `error.type` label covers only commands the server *refused*, so
duplicate keys and validation failures never appear there; and a total database outage makes the
metric **go silent** rather than raising an error rate, so alert on absence of data.

Details: [dp-service](https://github.com/osprey-dcs/dp-service/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md#service-metrics-issue-212).

## Schema migration mechanism

*dp-service [#254](https://github.com/osprey-dcs/dp-service/issues/254) — dp-service*

1.16.0 is the first release delivered through a schema migration mechanism, and the mechanism
itself is new infrastructure worth understanding before the upgrade.

Every service records the database's schema version and applies pending migrations during startup,
**before its port binds**.  A database whose version the binary cannot establish — newer than the
build, a migration that failed partway, a claim held by a process that did not finish — **stops the
service** rather than being served from.  The choice is deliberate: every migration in this release
exists because the unmigrated shape reads as a *wrong answer* rather than an error — a null
description, an unmatchable tag, an invisible bucket — and a mechanism that logged and continued
would compound one silent failure with another.

Concurrent startup is the normal case: one process wins an atomic claim and migrates, the others
wait and then proceed.  A database with no marker is classified by content, so **restore backups
before the first start**, never underneath a marker.

Five migrations ship in 1.16.0: three on the annotations collection (the `comment` → `description`
rename and its text index, tag normalization, and id canonicalization) and two on buckets, both
full scans, seeding the per-PV statistics the query work above depends on.

Details: [dp-service](https://github.com/osprey-dcs/dp-service/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md#schema-migration-mechanism-issue-254).

## Desktop application: deployment mode and metadata authoring

*data-platform [#88](https://github.com/osprey-dcs/data-platform/issues/88) · dp-desktop-app #4,
#17, #18, #27, #36, #39 — dp-desktop-app*

**The desktop app is no longer demonstration-only.**  Previous releases ran the MLDP services
in-process alongside the GUI, against a local demo database.  It now also runs against
**already-running remote services**, selected with `--mode=deployment` plus four configurable
connect strings.  Deployment mode never constructs a MongoDB client at all, and the status bar,
window title, and startup log all name the query target, so "which archive am I pointed at" is
answerable from the UI.  An absent or unrecognized mode resolves to demo — deliberately, so a
misspelling cannot become a connection attempt against production.

Deployment mode writes no PV time-series data and authors no curated metadata in this release:
ingestion, metadata authoring, and demo-data deletion are disabled.  It is **not** a read-only
mode — dataset save, annotation save, and export remain available, since those are the analysis
workflow.

**Behavior change: the demo database is no longer dropped at launch.**  Every previous release
wiped it at startup, so a demo session always began empty.  This is the first release where a demo
session starts with the previous session's data still present; `Tools → Delete Demo Data` clears it
on request.

**The data query migrated to Query API V2**, bringing several visible changes: missing values
render blank rather than `N/A` (V2 distinguishes "no sample here" from a decode failure), the
1-minute query chopping is gone, results are capped at 50,000 rows and say so, and a running query
can be stopped.  PVs can be selected three ways — name list, name pattern, or metadata criteria —
and two optional filters compose by intersection: machine configuration activations restrict the
time axis, then sample status drops individual samples.

**Three new Explore views** cover PV metadata, machine configurations and their activations, and
sample statuses.  The old `Explore → PVs` is renamed **PV Statistics** to distinguish curated
metadata records from statistics derived by aggregation over ingested buckets — a PV can appear in
one and not the other.  **Two new authoring views**, `Metadata → PV` and
`Metadata → Machine Configuration`, create and update curated metadata records; both saves are
full-replace upserts, so an existing record is confirmed before being overwritten.

The ingestion views' request-level "Request Details" panel is replaced by a **Column Metadata**
panel, attaching tags, attributes, and provenance to every column rather than to the request, which
is where the archive actually stores and queries them.

This release also adds the repo's **first automated test coverage and CI build** — unit tests,
view-load smoke tests enumerated from the classpath, and live integration tests that skip rather
than fail when MongoDB is unreachable.

Details: [dp-desktop-app](https://github.com/osprey-dcs/dp-desktop-app/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md).

## Python client library

*dp-python-lib #6, #8, #14, #40, #41 — dp-python-lib*

**The largest release the library has had.**  It adds three new API areas — sample status,
datasets/annotations/export, and the `DataFrame` builders and conversions both depend on — and
brings `AnnotationClient` to **full coverage of every implemented `DpAnnotationService` feature
area**: PV metadata, machine configuration, sample status, datasets, annotations, and export.

It is a breaking release only narrowly: every hand-written client signature is unchanged or
widened, and both breaking changes are inherited from the protocol — the removal of
`DataValue.valueStatus`, and the AND/OR criteria change underneath an unchanged client API.  Python
has no compile step, so the first surfaces as an `AttributeError` at runtime; grep for it.

Two client-side conveniences worth calling out.  `get_datasets(ids)` is the batch fetch that avoids
the annotation-listing N+1 created by references-not-content, chunking its id list so a full page of
annotation ids does not become an oversized request.  And the `iter_*` methods follow
`next_page_token` for you, which is the migration path for any code that treated an unpaged
`query_*` result as complete.

Details: [dp-python-lib](https://github.com/osprey-dcs/dp-python-lib/blob/rel-1.16.0/doc/release-notes/rel-1.16.0.md).

## Correctness fixes worth knowing

Several fixes in this release closed defects that produced **wrong answers rather than errors**.
They are collected here because each one means results from 1.15.0 and earlier may have been
incomplete in ways nothing reported.

- **Unary `querySamples` silently omitted PVs on large pages** (dp-service #274).  A page was
  assembled by draining the bucket cursor until the message budget tripped; since the cursor is
  ordered by PV, a budget that tripped partway through the first PV emitted every later PV as
  all-unset values with no error, and the page token resumed at the same position — those PVs were
  never returned.  With default settings this affected any request whose first PV in name order had
  more than roughly 455,000 samples in the window: about 7.5 minutes at 1 kHz, or 5 days at 1 Hz.
  Pages are now retrieved in time slices, each covering every selected PV.
- **Annotation edits silently destroyed stored Calculations** (dp-desktop-app #42).  Loading an
  annotation from a query result populated the editor with no calculations, and saving any
  unrelated edit then destroyed the stored object — no error, no warning, nothing in the UI.
- **`querySamplesStream` is now bounded in memory**, emitting as slices are retrieved rather than
  assembling the whole window first, and the streaming methods now apply outbound flow control so a
  slow client no longer causes the server to buffer an entire result.
- **Blank criterion values no longer reach the server** (dp-service #243).  A blank `prefix` or
  `contains` value was a silent match-all.
- **Business-rule failures are now rejections rather than errors** (dp-service #235), so a caller
  can distinguish a client mistake from a service failure without matching on the message text.

## Release process and supply chain

*data-platform [#90](https://github.com/osprey-dcs/data-platform/issues/90)*

**Every GitHub Actions reference in every repository in the organization is now pinned to a full
commit SHA** with a trailing version comment, rather than to a floating tag.  A tag is mutable:
whoever controls an action's repository can repoint it at different code, and every workflow picks
that up on its next run with no diff, no review, and no notification.  Release jobs run with
`contents: write` and publish the artifacts users download, so this is where it matters most.  Each
repository also carries a Dependabot configuration for the `github-actions` ecosystem, since
pinning otherwise trades supply-chain risk for silent staleness.  The convention is documented in
[CLAUDE.md](https://github.com/osprey-dcs/data-platform/blob/rel-1.16.0/CLAUDE.md#github-actions-pin-every-uses-to-a-commit-sha).

Several release workflows gained a **dry-run rehearsal path** (`workflow_dispatch` with a `dry_run`
input defaulting to true), so a workflow whose write side previously could only be exercised by
cutting a real release can now be rehearsed.

**Release notes are now version-controlled**, one document per release under `doc/release-notes/`
in each repository, published as the GitHub release body.  Release jobs verify the notes exist
before building rather than failing at the publish step.  This document is the master set; the
child repositories' notes carry the per-repository detail.

Plan documents for substantial tickets are likewise now version-controlled under `plan/tickets/`,
so a design record gets PR review and a stable cross-repo URL.
