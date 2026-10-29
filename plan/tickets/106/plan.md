# Plan: Remove the V1 query API (epic #106)

- **Ticket**: [osprey-dcs/data-platform#106](https://github.com/osprey-dcs/data-platform/issues/106)
- **Parent epic**: [osprey-dcs/data-platform#104](https://github.com/osprey-dcs/data-platform/issues/104) — 2.0 API modernization
- **Status**: high-level plan, 2026-10-28. Removal agreed with the SLAC deployment and dp-jal
  stakeholders 2026-10-29. Child tickets not yet created.
- **Repos touched**: dp-grpc, dp-service, data-platform, dp-python-lib

Query API V2 (dp-grpc #123) was designed to provide everything the V1 time-series query methods
do, plus PV selection by metadata, configuration and sample-status filtering, paging, and
serialized-column results. This epic removes the four V1 data query methods from the API and
from the service:

- `queryData()`, `queryDataStream()`, `queryDataBidiStream()`, `queryTable()`

Out of scope: the other V1-era query methods (`queryPvStats()`, `queryProviders()`,
`queryProviderStats()`). They have no V2 replacement and stay.

## Contents

1. [V1 to V2 coverage](#v1-to-v2-coverage)
2. [Decisions](#decisions)
3. [Current V1 usage](#current-v1-usage)
4. [Work breakdown](#work-breakdown)
5. [Sequencing](#sequencing)
6. [Open questions](#open-questions)

## V1 to V2 coverage

Reviewed 2026-10-28 against the dp-grpc protos and the dp-service implementation on `main`.

| V1 method | V2 replacement | Notes |
|---|---|---|
| `queryData` (unary, whole result in one message) | `queryBuckets` (unary, paged) | Same bucket overlap filter in dp-service (`MongoQueryFilterBuilder.bucketOverlapsRangeFilter`), same `(pvName, firstTime)` sort, boundary buckets returned whole in both. V2 removes V1's exposure to the gRPC max message size. |
| `queryDataStream` | `queryBucketsStream` | Equivalent, plus a configurable chunk size and serialized columns. |
| `queryDataBidiStream` (client asks for each chunk over a server-held cursor) | unary `queryBuckets` with `pageToken` | Functionally covered by a different model: stateless, resumable keyset paging instead of a per-client server cursor. Streaming responders have had outbound flow control since dp-service #274. |
| `queryTable`, column format | `querySamples` | Same trimming to the half-open time range, same tabular assembly code (`TabularDataUtility`). |
| `queryTable`, row-map format | none | Deliberately not carried forward (see the V2 `ColumnTable` comment in `query.proto`); trivially rebuilt client-side from a `ColumnTable`. |
| PV name list / regex | `PvSelector.pvNameList` / `pvNamePattern` | V2 adds `metadataQuery`. |

V2 is therefore a superset except for the row-map table format and the client-paced cursor
model, both dropped on purpose.

## Decisions

**D1 — Remove outright in a breaking release; no deprecation release first.** There are no
consumers that need a deprecation period (see [Current V1 usage](#current-v1-usage)). The two
consumers in question, the SLAC deployment and dp-jal, were consulted and both stakeholders
agreed to the removal (2026-10-29).

**D2 — Removed RPCs fail with `UNIMPLEMENTED`.** A client built against older stubs that calls a
removed method gets gRPC status `UNIMPLEMENTED` from the server. No shim or redirect to V2. The
breaking-release notes say so in the "Upgrading from" checklist.

**D3 — Compare V1 and V2 performance before anything is removed.** The V1 query benchmarks are
deleted with the V1 handlers, so the comparison has to be run and recorded first. The V2
benchmarks already exist (dp-service #275); what is missing is a recorded side-by-side run. A V2
regression against V1 does not necessarily block removal, but it has to be a known, accepted
quantity rather than something discovered afterwards.

**D4 — Migrate the test framework before removing anything.** dp-service's integration tests use
V1 queries as the general-purpose way to read back and verify ingested data, well beyond the V1
query tests themselves. Moving them to V2 is non-breaking and can land in any release, which
reduces the eventual removal PR to deletions.

**D5 — Keep shared messages.** `PvNameList` and `PvNamePattern` are used by V2 `PvSelector` and
by `queryPvStats()`; `DataBucket` and `DataColumn` are shared across the API. Only the V1
request/response messages go: `QueryDataRequest` / `QueryDataResponse` and `QueryTableRequest` /
`QueryTableResponse`, with their nested types. A side benefit: removing V1's nested
`QueryDataRequest.QuerySpec` ends its name collision with V2's top-level `QuerySpec`.

## Current V1 usage

Surveyed 2026-10-28.

| Where | V1 usage | Impact |
|---|---|---|
| dp-desktop-app | none (V2 only) | none |
| dp-python-lib | none in code (V2 only); README lists `queryData()` / `queryTable()` under low-level API coverage | README fix; stub regeneration on the dp-grpc bump |
| dp-service | handlers, dispatchers, jobs, `QueryDataBidiStreamRequestObserver`, four V1 benchmark clients, `QueryClient.queryTable` wrappers, V1 telemetry, V1 integration tests, and V1 calls in ~20 non-V1 test classes | the bulk of the work |
| data-platform | `bin/app-run-query-benchmark` runs `BenchmarkQueryDataStream`; `bin/app-run-query-bytes-benchmark` runs `BenchmarkQueryDataStreamBytes`, a class that no longer exists in dp-service (already broken); README-dp-support.md describes both | script and doc updates |
| dp-grpc | protos, README, cookbook `query.md` (which includes a V1→V2 migration section) | proto removal and doc updates |
| dp-jal | `queryDataStream`, `queryDataBidiStream`; pinned to dp-grpc 1.9.0, last pushed 2026-03-20 | owner agreed to the removal 2026-10-29; whether dp-jal moves to V2 is the owner's call, outside this epic |
| SLAC deployment | not surveyed directly | stakeholders agreed to the removal 2026-10-29 |

### dp-service test framework

The V1 dependency in the tests is concentrated in `GrpcIntegrationQueryServiceWrapper`:

- The V1 query test classes (`QueryDataIT`, `QueryDataStreamIT`, `QueryDataBidiStreamIT`,
  `QueryTableIT`) are deleted with the methods they test, after confirming each scenario they
  cover (rejections, edge cases) has a V2 equivalent.
- The other ~20 test classes that use V1 to verify ingested data (`v2api/*ColumnIT`,
  `IngestDataTypesTestBase`, `IngestDataColumnMetadataIT`, `QueryAnnotationsIT`,
  `QueryMetricsIT`, `QueryDataStreamStaggeredTimestampIT`, `BenchmarkIntegrationIT`,
  `QueryGrpcTest`) call `queryData()` / `queryDataStream()` / `sendAndVerifyQueryData*()` /
  `sendAndVerifyQueryTable*()`.

Because `queryBuckets` and `queryBucketsStream` return `DataBucket`s with the same filter and
sort as V1, the wrapper's `queryData()` and `queryDataStream()` helpers should be
re-implementable over V2 with their signatures and the bucket-verification logic unchanged. That
keeps the call-site changes mechanical. The `queryTable` column verification needs real
adaptation: V1's table carries a `DataTimestamps`, V2's `ColumnTable` a `TimestampList`. The
detailed approach belongs in the dp-service child ticket's plan.

## Work breakdown

Each item becomes a child ticket in the named repo, created as the epic progresses.

1. **dp-service: record a V1 vs V2 query benchmark comparison (D3).** Run the paired benchmarks
   on the same fixture and record the results somewhere durable: `BenchmarkQueryDataStream` vs
   `BenchmarkQueryBucketsStream` (the direct comparison), `BenchmarkQueryDataUnary` vs
   `BenchmarkQueryBuckets`, `BenchmarkQueryTable` vs `BenchmarkQuerySamples`. The unary V1
   clients need small fixtures to stay under the message size limit, so their pairings use the
   same small fixture for both sides. Include a deep-history run using the loader options.
2. **dp-service: migrate the integration test framework to V2 (D4).** Re-implement the wrapper's
   V1 helpers over V2, migrate the call sites, and audit the V1 query ITs for scenarios lacking
   V2 coverage, adding V2 tests where needed. Non-breaking; no dependency on the dp-grpc change.
3. **dp-grpc: remove the V1 methods and messages.** Remove the four RPCs and the V1
   request/response messages (D5). Update the V2 comments that refer to V1 ("V1 methods above
   remain available", the `ColumnTable` row-format note, the `QueryData` serialized-column
   note), the README query sections, and the cookbook. Decide whether the cookbook's V1→V2
   migration section stays, or moves into the breaking release notes. Add a `NEXT.md` section.
4. **dp-service: remove the V1 implementation.** Handlers, dispatchers, jobs, the bidi request
   observer, the V1 benchmark clients, `QueryClient`'s `queryTable` wrappers and
   `QueryTableApiResult`, V1 telemetry and metrics, the V1 ITs, and the docs (README,
   `doc/benchmark-overview.md`, `doc/metrics.md`, developer notes). Keep code shared with export
   and V2 (`TabularDataUtility`, the bucket filter builder, `executeDataBlockQuery`). Depends on
   1, 2, and 3.
5. **data-platform: update the benchmark scripts and docs.** Point `app-run-query-benchmark` at
   a V2 benchmark (or add a script per V2 benchmark), fix or remove the already-broken
   `app-run-query-bytes-benchmark`, and update README-dp-support.md. Can land with 4, or earlier
   for the broken script.
6. **dp-python-lib: README and stubs.** Remove `queryData()` / `queryTable()` from the
   low-level API coverage list; regenerate stubs on the dp-grpc bump.
7. **Release notes.** Each repo's breaking-release notes lead their "Upgrading from" checklist
   with the removal and the `UNIMPLEMENTED` behavior (D2), pointing at the V1→V2 migration
   guidance.

## Sequencing

```
1 benchmark comparison ──┐
2 test framework → V2 ───┼──> 4 dp-service removal ──> 5 data-platform scripts
3 dp-grpc removal ───────┘                         └──> 6 dp-python-lib
                                                         7 release notes (with each)
```

Items 1, 2, and 3 are independent and can proceed in parallel; 1 and 2 are non-breaking and can
ship before the breaking release. 3 and 4 must ship in the same breaking release. dp-service
builds against a dp-grpc artifact, so 3 merges first and 4 picks it up.

## Open questions

1. **Where benchmark results live.** A dp-service doc, the child ticket, or a new results
   section in `doc/benchmark-overview.md`.

Resolved 2026-10-29: the SLAC deployment and dp-jal stakeholders both agreed to the removal
(D1), and #106 is a sub-issue of #104.
