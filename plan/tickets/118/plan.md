# Plan: Trim script for old PV time-series buckets (#118, phase 1a of epic #117)

- **Ticket**: [osprey-dcs/data-platform#118](https://github.com/osprey-dcs/data-platform/issues/118)
- **Parent epic**: [osprey-dcs/data-platform#117](https://github.com/osprey-dcs/data-platform/issues/117);
  [epic plan](../117/plan.md)
- **Status**: plan, 2026-11-16
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
| `bin/mongodb-trim-buckets` | Bash wrapper: parses flags, exports the variables, runs `mongosh --quiet --file`. |

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
| `--database NAME` | `DP_TRIM_DATABASE` | `dp` |

Defaults for batch size and the retry and timeout constants are starting values, to be tuned
on the fixture and stated in the runbook.

### Start-up checks, before any read of `buckets`

1. Exactly one of the two cutoff settings; a parseable cutoff that is in the past.
2. The filter parses as Extended JSON and is a document.
3. The slice is `i/n` with `0 <= i < n`.
4. `hello` reports `mongos`, or the server is not a member of a sharded cluster. A direct
   connection to a shard is refused.
5. The shipped compound index exists on `buckets`.

Any failure exits non-zero with no `trimLog` record and nothing deleted.

### Selection

- Cutoff `C` in whole seconds.
- Age predicate for PV `p`:
  `{pvName: p, "dataTimestamps.firstTime.seconds": {$lt: C}, "dataTimestamps.lastTime.seconds": {$lt: C}}`.
  All three fields are in the compound index. The `firstTime` bound is implied by the
  `lastTime` one and is there to bound the index scan.
- With a filter `F`: `{$and: [age, F]}`.
- PV enumeration: distinct `pvName` values from `buckets`. To verify during development with
  `explain` that this is an index scan that skips between values, on the sharded fixture; if
  it is not, fall back to `pvStats` and report its count against `buckets`.
- Slice: a PV belongs to slice `i` of `n` when a stable hash of its name, modulo `n`, is `i`.

### Deleting

For each PV in the slice, repeat until a batch comes back short:

1. `find(selection, {_id: 1}).sort(firstTime).limit(batchSize).hint(compound index)`.
2. `deleteMany({_id: {$in: ids}}, {writeConcern: {w: "majority", wtimeout: ...}})`.
   The write concern is fixed. When a secondary is down or too far behind, the batch times
   out, the retries are used up, and the run stops; the error message says to check the
   secondary of the shard holding that PV.
3. On error, retry the batch with backoff a bounded number of times, then mark the run
   failed in `trimLog` and exit non-zero.
4. Pause if configured.

Without a filter step 1 is answered from the index. With a filter it fetches the candidates,
and step 2 then finds them in cache. A delete by `_id` through `mongos` is sent to every
shard; the five that do not hold the PV answer from the `_id` index.

### Dry run

- Per PV: `countDocuments(age)` hinted to the compound index, and the oldest and newest
  candidate's `firstTime`.
- The newest `lastTime` over the PVs visited, printed beside the cutoff.
- With a filter: evaluate it against the oldest and newest candidate of each PV and report
  `sample: both match / one matches / neither matches`; totals count PVs in each class. With
  `--exact-filter-count`, `countDocuments({$and: [age, F]})` instead.
- The summary states plainly when the filter excluded nothing in the sample.

### `trimLog` record

Inserted before the PV walk, updated at the end and on failure.

```
{ _id, scriptVersion, startedAt, endedAt, host, database,
  cutoffSeconds, cutoffSource: "olderThanDays:60" | "before:<ts>",
  filter: <as given, string>, slice: "i/n" | null, dryRun,
  status: "running" | "completed" | "failed", error,
  pvsVisited, bucketsMatchedByAge, bucketsDeleted, deletesPerSecond,
  horizonSeconds }   // set only when completed, executed, no filter, no slice
```

## Test

A script under the repo that starts the fixture, seeds it by direct insert of documents with
the stored bucket shape, runs the trim through the wrapper, and asserts on the collection.
Fixtures: a single replica set, and a two-shard cluster with the shard key on the column
attribute path. First task: confirm the Percona image has an arm64 build for local runs.

Cases:

- buckets older than, newer than, and straddling the cutoff;
- cutoff truncation at a second boundary;
- a filter that narrows; a filter naming `dataTimestamps` or `pvName` does not widen;
- dry run deletes nothing; its counts match what `--execute` then deletes;
- the filter sample reports a filter that excludes nothing;
- a run killed part-way leaves a `running` record; the re-run completes and deletes the rest;
- two slices together delete exactly what an unsliced run would, with no overlap;
- a PV left with no buckets;
- rejected before any delete: both cutoff settings, neither, an invalid filter, a bad slice,
  a direct connection to a shard, a missing compound index;
- non-zero exit on a failed connection;
- `horizonSeconds` set only for a completed, unfiltered, unsliced, executed run.
- a write that cannot reach `majority` (secondary stopped on the fixture) times out, is
  retried, and ends the run non-zero with a `failed` record and nothing half-reported.

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

## Out of scope

Everything the epic plan lists, plus: any change to dp-service; trimming other collections;
a checkpoint or resume file.

## Dependencies and sequencing

- Nothing blocks writing and testing the script.
- The tested Archiver filter in the runbook blocks on SLAC's answer, and SLAC's first
  `--execute` run blocks on that filter.
- The CI workflow may land in a following PR.
