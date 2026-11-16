# Trimming old PV time-series data

`bin/mongodb-trim-buckets` deletes PV time-series buckets older than a cutoff from the
`buckets` collection, so that a deployment can keep a rolling window of recent data. This
page is the operating procedure. The design is in
[plan/tickets/118/plan.md](../../plan/tickets/118/plan.md) and the reasons behind it in
[plan/tickets/117/plan.md](../../plan/tickets/117/plan.md).

It was written for the SLAC deployment (Percona Server for MongoDB 8.0, sharded, each shard
two data-bearing members and an arbiter) and the examples use that deployment's field names.

## Contents

1. [What it does and does not do](#what-it-does-and-does-not-do)
2. [Before the first run](#before-the-first-run)
3. [Running it](#running-it)
4. [The dry run](#the-dry-run)
5. [Writing a filter](#writing-a-filter)
6. [The first trim, in stages](#the-first-trim-in-stages)
7. [Running several instances](#running-several-instances)
8. [The daily run](#the-daily-run)
9. [The trimLog collection](#the-trimlog-collection)
10. [When a run stops](#when-a-run-stops)
11. [Limits to know about](#limits-to-know-about)

## What it does and does not do

- It deletes a bucket when the bucket's **last sample** is before the cutoff. A bucket that
  starts before the cutoff and ends after it is kept whole; it goes once the cutoff has moved
  past its last sample.
- The cutoff is the **time of the data**, not the time it was loaded. Buckets do not record
  when they were ingested.
- It deletes nothing unless you pass `--execute`. Without it the run is a dry run.
- It only touches `buckets`, and writes a record of each run to `trimLog`. It does not trim
  `sampleStatusBuckets` or `requestStatus`, and it does not check whether a dataset or
  annotation refers to the data.
- Space freed is reused by MongoDB for new data. It is not returned to the operating system.
- The services can stay up while it runs. See [Limits](#limits-to-know-about).

## Before the first run

**What you need**

- `mongosh` 2.x. The script is tested with 2.6.0, the version inside the
  `percona/percona-server-mongodb:8.0.19-7` image, and 2.8.2.
- A connection string for a **mongos**. The script refuses a direct connection to a shard.
- A user that can read and delete in `buckets`, read its indexes, and write to `trimLog`, in
  the Data Platform database (`dp` unless you use another name). A dry run also writes its
  record to `trimLog`.
- The Data Platform at 1.16.0 or later: the script uses the bucket index that release creates
  and stops if it is missing.

**Drop the indexes nothing uses (recommended)**

Every delete removes an entry from every index on the collection. Three of the indexes on
SLAC's `buckets` collection are not used by the Data Platform services since 1.16.0, which
hint the five-field index for every bucket query. Dropping them removes about three eighths
of the index work of each delete, speeds up ingestion, and frees space:

```javascript
db.buckets.dropIndex("pvName_1")
db.buckets.dropIndex("pvName_1_source_1")
db.buckets.dropIndex("pvName_1_dataTimestamps.firstTime.seconds_1_dataTimestamps.lastTime.seconds_1")
```

`pvName_1_source_1` indexes a top-level `source` field that buckets do not have. Keep `_id_`,
the shard key index, `providerId_1`, and the five-field index beginning `pvName_1_dataTimestamps.firstTime.seconds_1_dataTimestamps.firstTime.nanos_1`.
If a tool of your own queries `buckets` directly, check that it does not depend on one of the
three first.

## Running it

Give the connection string in the environment, never as an argument, so the password does not
appear in the process list:

```bash
export DP_TRIM_MONGODB_URI='mongodb://USER:PASSWORD@MONGOS-HOST:27017/?authSource=admin'

bin/mongodb-trim-buckets --older-than-days 60              # dry run
bin/mongodb-trim-buckets --older-than-days 60 --execute    # delete
```

The script needs only the two files `bin/mongodb-trim-buckets` and
`bin/mongodb-trim-buckets.js`, side by side. It does not use `~/.dp.env` or `DP_HOME`.

| Option | Meaning |
|---|---|
| `--older-than-days N` | Cutoff is N days before now. Whole days, at least 1. |
| `--before TIMESTAMP` | Cutoff is this time. It must end in `Z` or a UTC offset, for example `2026-08-01T00:00:00Z`, and be in the past. |
| `--filter JSON` | Trim only buckets that also match this MongoDB filter. See [Writing a filter](#writing-a-filter). |
| `--execute` | Delete. Without it, a dry run. |
| `--batch-size N` | Buckets per delete. Default 1000. |
| `--pause-ms N` | Pause after each delete. Default 0. |
| `--slice I/N` | Handle only slice I of N of the PV names. See [Running several instances](#running-several-instances). |
| `--exact-filter-count` | Dry run only: count what the filter matches exactly. Reads every candidate bucket. |
| `--per-pv`, `--no-per-pv` | Print a line per PV. On by default for a dry run, off for `--execute`. |
| `--database NAME` | Database name. Default `dp`. |

Give exactly one of `--older-than-days` and `--before`. The cutoff is cut down to a whole
second.

Exit status: `0` the run completed; `1` it failed part-way and is safe to run again; `2` it
did not start (bad options, wrong server, missing index) and changed nothing.

Without the wrapper, set the variables listed at the top of `mongodb-trim-buckets.js` and run
`mongosh --nodb --quiet --file mongodb-trim-buckets.js`. The Kubernetes examples do this.

## The dry run

Always do a dry run with the same options first. It prints what it would delete:

```
mongodb-trim-buckets 1.0.0: dry run
  database dp on sharded cluster, through mongos
  cutoff 2026-08-01T00:00:00Z (before:2026-08-01T00:00:00Z): buckets whose last sample is before this are trimmed
  1234 PVs have buckets
  BPMS:BSYH:445:XCUHBR: 51840 by age, 2026-03-01T00:02:23Z to 2026-07-31T23:59:59Z
  ...
DRY RUN completed in 95s; trimLog record 6afb6e9623ffbcdeddc31084
  PVs visited: 1234 (1200 with buckets to trim, 34 with none)
  buckets matched by age: 61200000
  data that would be trimmed spans 2026-03-01T00:02:23Z to 2026-07-31T23:59:59Z
  newest data in these PVs: 2026-11-10T08:15:02Z; the cutoff is 2026-08-01T00:00:00Z, so about 101.3 days of data would remain
  nothing was deleted; set DP_TRIM_EXECUTE=true (--execute) to delete
```

(The figures above are made up.)

What to check:

- **The count and the time span** are what you mean to delete.
- **The "newest data" line.** `--older-than-days` counts back from today, not from the newest
  data you have loaded. If the newest data is three weeks old, `--older-than-days 60` leaves 39
  days of data, not 60.
- **With a filter**, the sample lines described in the next section.

The counts by age are read from the index and are cheap, even on the full archive. They use
MongoDB's `available` read concern so that the shards do not read each bucket. One effect:
if a chunk migration was interrupted at some point, buckets left behind by it on the wrong
shard are counted. They are not deleted on that basis; deletes are routed normally.

## Writing a filter

`--filter` takes a MongoDB filter document, as Extended JSON. A bucket is trimmed only if it
is old enough **and** matches the filter. The filter can narrow what is trimmed. It cannot
make the script delete a bucket that is not old enough, whatever fields it names.

The fields of a stored bucket that are useful in a filter:

| Path | Holds |
|---|---|
| `_id` | `<pvName>-<first sample seconds>-<first sample nanos>` |
| `pvName` | the PV name |
| `providerId`, `providerName` | the ingestion provider |
| `dataColumn.columnMetadata.attributes.<name>` | the column attributes the ingestion client set, for example `source`, `facility`, `instrument` |
| `dataColumn.columnMetadata.tags` | the column tags |

These are storage paths, not an API. A later release may move them; a saved filter would then
need changing.

**Say what to delete, not what to keep.** Compare:

```bash
# Delete only buckets marked as coming from the BSAS reader.
--filter '{"dataColumn.columnMetadata.attributes.source": "bsas_gen1_reader"}'

# Delete every bucket that is not marked "keep".
--filter '{"dataColumn.columnMetadata.attributes.keep": {"$exists": false}}'
```

With the first form, a mistyped path or value matches nothing and nothing is deleted. A bucket
that lacks the attribute is kept. With the second form the same mistakes delete everything old
enough: a mistyped path does not exist on any bucket, so every bucket matches. Use the first
form when you can. If the data to preserve can only be recognized by a marker the rest lacks,
the second form is what you have, and the dry run is your only check.

**How the dry run tests a filter.** Counting exactly what a filter matches means reading every
candidate bucket, which on the full archive is most of the database. So by default the dry run
tests the filter on two buckets per PV, the oldest and the newest candidate, and reports:

```
  filter, tested on the oldest and newest candidate bucket of each PV (a SAMPLE, not a count):
    1198 PVs where both match (would be trimmed)
    0 PVs where one matches (the filter splits this PV)
    2 PVs where neither matches (would be kept)
```

- If you expect the filter to protect some PVs, they should appear under "neither".
- "NOTE: the filter excluded nothing in the sample" means every sampled bucket matched. If the
  filter is meant to keep anything, it is probably mistyped.
- The sample cannot see a filter whose answer changes in the middle of a PV's history. If that
  is possible for your filter, run the dry run with `--exact-filter-count` on a small cutoff
  first, and accept the read load.

**SLAC's Archiver test data.** A filter that preserves it will be added here once it is known
how that data is marked. Do not run with `--execute` at SLAC before then.

## The first trim, in stages

Deleting a bucket reads it from disk and removes its entry from every index. Removing most of
a large archive is therefore a long job, and how long is not known until it is measured on
your cluster. Do it in stages, moving the cutoff forward:

1. **Pick a first cutoff that removes little**, for example a few days after the oldest data.
   The dry run shows the oldest data time.
2. **Dry run, then `--execute`** with `--before` set to that cutoff.
3. **Read the rate** from the last lines of the run, or from `trimLog`:

   ```
   EXECUTE completed in 5400s; trimLog record ...
     buckets deleted: 9000000 in 9000 batches, 1666.7 per second
   ```

4. **Work out the rest.** Divide the buckets still to delete (from a dry run at the final
   cutoff) by the rate. If that is too long, see
   [Running several instances](#running-several-instances).
5. **Move the cutoff forward** a week or a month at a time, one `--execute` run per stage,
   until you reach the window you want to keep.

Each stage removes the oldest data across all PVs and leaves the archive consistent, so you
can stop between stages, and you can resume loading new data as soon as enough space is free.
Watch replication lag on each shard during the first stage; if secondaries fall behind, add
`--pause-ms` or lower the number of instances.

## Running several instances

One instance works on one PV at a time, and all of a PV's buckets are on one shard, so one
instance keeps one shard busy while the others wait. `--slice I/N` splits the PV names into N
groups by a hash of the name. Run N instances, one per slice, with otherwise identical
options:

```bash
bin/mongodb-trim-buckets --before 2026-08-01T00:00:00Z --execute --slice 0/6 &
bin/mongodb-trim-buckets --before 2026-08-01T00:00:00Z --execute --slice 1/6 &
...
bin/mongodb-trim-buckets --before 2026-08-01T00:00:00Z --execute --slice 5/6 &
```

- Slices do not correspond to shards. Each slice holds PVs from every shard, so the load is
  spread roughly evenly.
- Every slice must be run, or the PVs in the missing ones are not trimmed.
- Start with as many slices as shards and judge from replication lag and the effect on queries
  whether to use more or fewer.
- [kubernetes/examples/trim-buckets/job-sliced.yaml](../../kubernetes/examples/trim-buckets/job-sliced.yaml)
  runs the slices as one Kubernetes Job.

## The daily run

Once the first trim has reached the window you want, run the script daily with
`--older-than-days`:

```bash
bin/mongodb-trim-buckets --older-than-days 60 --execute
```

[kubernetes/examples/trim-buckets/cronjob.yaml](../../kubernetes/examples/trim-buckets/cronjob.yaml)
is an example CronJob. It is an example: it has not been run on SLAC's cluster, and the
namespace, image, schedule, and Secret name will need adjusting.

- Do not run two unsliced instances at once. It is harmless to the data but doubles the load.
  The example sets `concurrencyPolicy: Forbid`; if you also run the script by hand, check that
  the CronJob is not running.
- If a daily run takes too long, run it sliced. The time for a run is in `trimLog`.

## The trimLog collection

Every run that gets as far as connecting writes one document to `trimLog`, when it starts, and
fills it in when it ends:

```javascript
db.trimLog.find().sort({startedAt: -1}).limit(5)
```

| Field | Meaning |
|---|---|
| `startedAt`, `endedAt` | when the run started and ended; `endedAt` is null while it runs |
| `status` | `running`, `completed`, or `failed`. A record still `running` long after `startedAt` is a run that was killed. |
| `error` | the failure, when `failed` |
| `dryRun` | true for a dry run |
| `cutoffSeconds`, `cutoffSource` | the cutoff as epoch seconds, and how it was given |
| `filter`, `slice` | as given, or null |
| `bucketsDeleted`, `batches`, `retries`, `deletesPerSecond` | what an `--execute` run did |
| `bucketsMatchedByAge` | what a dry run counted |
| `pvsVisited` | PVs handled |
| `horizonSeconds` | set only by an `--execute` run that completed with no filter and no slice: nothing whose last sample is before this time remains. For a sliced run the same holds once every slice at that cutoff has a `completed` record. |
| `scriptVersion`, `host`, `database` | where and with what the run was made |

The script does not use `trimLog` to resume. It is a record, not a checkpoint.

## When a run stops

**It is always safe to run the same command again.** A repeat run finds what is left and
deletes it. It does not repeat or undo anything.

- **"A majority did not confirm the write".** Each delete waits until a majority of the
  shard's members have it. On a shard of two data-bearing members and an arbiter that means
  both data members. If the secondary is down, or too far behind to catch up within the
  timeout, the script retries four times over several minutes and then stops with exit
  status 1. This is deliberate: deleting at volume while a secondary is behind can leave it so
  far behind that it has to be rebuilt from scratch. Bring the secondary back, let it catch
  up, and run the command again. The message names the PV; the shard is the one holding it.
- **A primary changes during a run.** The affected delete fails and is retried; the run
  normally carries on.
- **The process is killed.** Nothing is left half-done. The `trimLog` record stays `running`.
- **Other errors** are printed with the PV being handled, and recorded in `trimLog`.

## Limits to know about

- **Do not load data older than the retention window while trimming is in use.** The next run
  deletes it, because the script goes by the time of the data. If you need to load and keep a
  historical run, mark it with an attribute and use a filter that does not match it.
- **A query that reaches into a range being trimmed can see part of that range.** Queries for
  data newer than the cutoff are unaffected.
- **Datasets and annotations** that refer to trimmed time ranges are not changed. A dataset
  export over a range with no data left reports an error.
- **Sample statuses** recorded against trimmed samples are left in place. They are harmless.
- **A PV whose buckets are all trimmed** keeps its `pvStats` document and its PV metadata.
- **Disk usage reported by the operating system does not fall.** The space is free inside
  MongoDB and is reused.
- **Buckets with very long spans** stay until the cutoff passes their last sample.
