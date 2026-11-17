// mongodb-trim-buckets.js
//
// Deletes PV time-series buckets older than a cutoff from the Data Platform "buckets"
// collection.  Run it through the wrapper beside it (bin/mongodb-trim-buckets), or directly:
//
//     DP_TRIM_MONGODB_URI=... DP_TRIM_OLDER_THAN_DAYS=60 \
//         mongosh --nodb --quiet --file mongodb-trim-buckets.js
//
// It deletes nothing unless DP_TRIM_EXECUTE=true.  The runbook is doc/admin/trim-buckets.md;
// the design is plan/tickets/118/plan.md.
//
// Configuration is by environment variable only, so that the connection string, which holds
// the password, never appears on a command line:
//
//   DP_TRIM_MONGODB_URI         required.  On a sharded cluster this must be a mongos.
//   DP_TRIM_OLDER_THAN_DAYS     cutoff = now - N days            } exactly one
//   DP_TRIM_BEFORE              cutoff = this timestamp, with Z or a UTC offset   } of these
//   DP_TRIM_FILTER              MongoDB filter (Extended JSON), ANDed with the age test
//   DP_TRIM_EXECUTE             "true" to delete; anything else is a dry run
//   DP_TRIM_BATCH_SIZE          buckets per delete (default 1000)
//   DP_TRIM_PAUSE_MS            pause after each delete batch (default 0)
//   DP_TRIM_SLICE               "i/n": handle only slice i of n of the PV names
//   DP_TRIM_EXACT_FILTER_COUNT  "true": dry run counts the filter exactly (reads every candidate)
//   DP_TRIM_PER_PV              "true"/"false": a line per PV (default: dry run yes, execute no)
//   DP_TRIM_DATABASE            database name (default "dp")
//   DP_TRIM_WTIMEOUT_MS         write concern timeout per batch (default 60000)

const SCRIPT_VERSION = "1.0.0";

const BUCKETS = "buckets";
const TRIM_LOG = "trimLog";
const FIRST_SECONDS = "dataTimestamps.firstTime.seconds";
const FIRST_NANOS = "dataTimestamps.firstTime.nanos";
const LAST_SECONDS = "dataTimestamps.lastTime.seconds";
const LAST_NANOS = "dataTimestamps.lastTime.nanos";

// The compound index dp-service creates and hints (MongoClientBase.BUCKET_QUERY_INDEX_KEYS).
// Every query here runs on it; the script refuses to start when it is missing.
const BUCKET_INDEX_KEYS = {
    pvName: 1, [FIRST_SECONDS]: 1, [FIRST_NANOS]: 1, [LAST_SECONDS]: 1, [LAST_NANOS]: 1,
};

// In an --execute run a batch whose read or delete fails (a step-down, a write concern
// timeout) is retried after each of these delays, then the run stops.  A dry run is not
// retried: it changes nothing, so it is simply run again.  Re-running is always safe: a delete names bucket ids.
// DP_TRIM_RETRY_DELAYS_MS (comma-separated) replaces the delays; it exists for the test.
const RETRY_DELAYS_MS = (process.env.DP_TRIM_RETRY_DELAYS_MS || "5000,15000,45000,120000")
    .split(",").map(Number);
const PROGRESS_INTERVAL_MS = 60000;

// Reads that only need the index use read concern "available".  With the default read concern
// a sharded cluster fetches every document a query touches, to test it against the shard's
// ownership ranges (the shard key is not in the index), which turns an index count into a read
// of the whole candidate set.  "available" skips that test.  The price is that documents left
// behind by an interrupted chunk migration would be counted; they are never deleted on that
// basis, since deletes go through the normal routing.
const INDEX_ONLY = {level: "available"};

// Long(n) keeps only the low 32 bits of a number, so every Long here is made with
// Long.fromNumber, which is exact for any count or time this script can meet.

class ConfigError extends Error {}

function log(message) {
    print(`${new Date().toISOString()}  ${message}`);
}

function env(name) {
    const value = process.env[name];
    return value === undefined || value.trim() === "" ? null : value.trim();
}

function envInt(name, fallback, min) {
    const raw = env(name);
    if (raw === null) return fallback;
    if (!/^\d+$/.test(raw) || Number(raw) < min) {
        throw new ConfigError(`${name} must be an integer of at least ${min}, got "${raw}"`);
    }
    return Number(raw);
}

function envBool(name) {
    const raw = env(name);
    if (raw === null) return null;
    if (raw !== "true" && raw !== "false") {
        throw new ConfigError(`${name} must be "true" or "false", got "${raw}"`);
    }
    return raw === "true";
}

function readConfig(nowMillis) {
    const config = {
        uri: env("DP_TRIM_MONGODB_URI"),
        database: env("DP_TRIM_DATABASE") || "dp",
        execute: envBool("DP_TRIM_EXECUTE") === true,
        batchSize: envInt("DP_TRIM_BATCH_SIZE", 1000, 1),
        pauseMillis: envInt("DP_TRIM_PAUSE_MS", 0, 0),
        wtimeoutMillis: envInt("DP_TRIM_WTIMEOUT_MS", 60000, 1),
        exactFilterCount: envBool("DP_TRIM_EXACT_FILTER_COUNT") === true,
        filterText: env("DP_TRIM_FILTER"),
        filter: null,
        slice: null,
    };
    if (config.uri === null) throw new ConfigError("DP_TRIM_MONGODB_URI is required");

    const days = env("DP_TRIM_OLDER_THAN_DAYS");
    const before = env("DP_TRIM_BEFORE");
    if ((days === null) === (before === null)) {
        throw new ConfigError(
            "give exactly one of DP_TRIM_OLDER_THAN_DAYS and DP_TRIM_BEFORE");
    }
    let cutoffMillis;
    if (days !== null) {
        if (!/^\d+$/.test(days) || Number(days) < 1) {
            throw new ConfigError(
                `DP_TRIM_OLDER_THAN_DAYS must be a whole number of days, at least 1, got "${days}"`);
        }
        cutoffMillis = nowMillis - Number(days) * 86400000;
        config.cutoffSource = `olderThanDays:${days}`;
    } else {
        // A timestamp with no zone would be read in the local zone of whatever host runs this.
        if (!/(Z|[+-]\d\d:?\d\d)$/.test(before)) {
            throw new ConfigError(
                `DP_TRIM_BEFORE must end in Z or a UTC offset, e.g. 2026-09-01T00:00:00Z, got "${before}"`);
        }
        cutoffMillis = Date.parse(before);
        if (Number.isNaN(cutoffMillis)) {
            throw new ConfigError(`DP_TRIM_BEFORE is not a timestamp: "${before}"`);
        }
        if (cutoffMillis >= nowMillis) {
            throw new ConfigError(`DP_TRIM_BEFORE must be in the past, got "${before}"`);
        }
        config.cutoffSource = `before:${before}`;
    }
    // Whole seconds: the age test is then a single bound on lastTime.seconds.
    config.cutoffSeconds = Math.floor(cutoffMillis / 1000);

    if (config.filterText !== null) {
        let parsed;
        try {
            parsed = EJSON.parse(config.filterText);
        } catch (e) {
            throw new ConfigError(`DP_TRIM_FILTER is not valid Extended JSON: ${e.message}`);
        }
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new ConfigError("DP_TRIM_FILTER must be a JSON object");
        }
        config.filter = parsed;
    }

    const slice = env("DP_TRIM_SLICE");
    if (slice !== null) {
        const match = /^(\d+)\/(\d+)$/.exec(slice);
        if (!match || Number(match[2]) < 1 || Number(match[1]) >= Number(match[2])) {
            throw new ConfigError(
                `DP_TRIM_SLICE must be i/n with 0 <= i < n, got "${slice}"`);
        }
        config.slice = {index: Number(match[1]), count: Number(match[2]), text: slice};
    }

    const perPv = envBool("DP_TRIM_PER_PV");
    config.perPv = perPv === null ? !config.execute : perPv;
    return config;
}

// FNV-1a over the name's UTF-16 code units.  Only its stability matters: every instance of a
// sliced run must put a given PV in the same slice.
function sliceOf(pvName, sliceCount) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < pvName.length; i++) {
        hash ^= pvName.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash % sliceCount;
}

function isoSeconds(seconds) {
    return new Date(Number(seconds) * 1000).toISOString().replace(".000Z", "Z");
}

// The age test for one PV.  A bucket is trimmed whole, when its last sample is before the
// cutoff.  firstTime < cutoff is implied by that and is stated so the index scan is bounded;
// fromSeconds, when given, moves the lower bound past buckets an earlier batch already handled.
function ageSelection(pvName, cutoffSeconds, fromSeconds) {
    const first = {$lt: Long.fromNumber(cutoffSeconds)};
    if (fromSeconds !== null && fromSeconds !== undefined) first.$gte = Long.fromNumber(fromSeconds);
    return {pvName: pvName, [FIRST_SECONDS]: first, [LAST_SECONDS]: {$lt: Long.fromNumber(cutoffSeconds)}};
}

// The filter is ANDed as its own clause, never merged into the age document: a filter that
// names pvName or dataTimestamps then narrows the selection and cannot replace the age test.
function selection(config, pvName, fromSeconds) {
    const age = ageSelection(pvName, config.cutoffSeconds, fromSeconds);
    return config.filter === null ? age : {$and: [age, config.filter]};
}

function checkDeployment(conn, database) {
    const hello = database.hello();
    if (hello.msg === "isdbgrid") return "sharded cluster, through mongos";
    // Not a mongos.  A member of a sharded cluster must not be trimmed directly.
    let clusterRole = null;
    try {
        const state = database.adminCommand({shardingState: 1});
        if (state.enabled) clusterRole = "shard";
    } catch (e) {
        try {
            const parsed = database.serverCmdLineOpts().parsed;
            clusterRole = (parsed.sharding && parsed.sharding.clusterRole) || null;
        } catch (e2) {
            log("warning: could not determine whether this server belongs to a sharded cluster "
                + `(${e2.codeName || e2.message}); continuing`);
        }
    }
    if (clusterRole !== null) {
        throw new ConfigError(
            "this server is a member of a sharded cluster; connect to a mongos instead");
    }
    return hello.setName ? `replica set ${hello.setName}` : "standalone server";
}

function checkBucketIndex(buckets) {
    const wanted = JSON.stringify(BUCKET_INDEX_KEYS);
    let indexes;
    try {
        indexes = buckets.getIndexes();
    } catch (e) {
        if (e.codeName !== "NamespaceNotFound") throw e;
        throw new ConfigError(
            `collection ${buckets.getFullName()} does not exist; is the database name right?`);
    }
    const found = indexes.some(index => JSON.stringify(index.key) === wanted);
    if (!found) {
        throw new ConfigError(
            `collection ${buckets.getFullName()} lacks the bucket query index ${wanted}; `
            + "is this a Data Platform database at version 1.16 or later?");
    }
}

// Every PV name that has a bucket, from the index.  The planner answers this $group with a
// DISTINCT_SCAN, one index seek per PV; the check below warns when it would not, because the
// alternative walks every index key.
function listPvNames(database, buckets) {
    const pipeline = [{$group: {_id: "$pvName"}}];
    try {
        const explained = database.runCommand({
            explain: {aggregate: BUCKETS, pipeline: pipeline, cursor: {}, readConcern: INDEX_ONLY},
            verbosity: "queryPlanner",
        });
        if (!JSON.stringify(explained).includes("DISTINCT_SCAN")) {
            log("warning: listing PV names will scan the whole index (no DISTINCT_SCAN in the "
                + "plan); this can take a long time on a large archive");
        }
    } catch (e) {
        log(`warning: could not check the plan for listing PV names (${e.message})`);
    }
    const names = [];
    buckets.aggregate(pipeline, {readConcern: INDEX_ONLY}).forEach(doc => {
        if (typeof doc._id === "string") names.push(doc._id);
    });
    names.sort();
    return names;
}

function indexCount(database, query) {
    const result = database.runCommand({
        count: BUCKETS, query: query, hint: BUCKET_INDEX_KEYS, readConcern: INDEX_ONLY});
    return Number(result.n);
}

// One end of a PV's index range under a query: its firstTime and lastTime seconds, or null.
// The index is ordered by firstTime, so the far end is the bucket that STARTS last.  That is
// not always the bucket that ends last (buckets can overlap, or span a long time), and the
// latest end is not available from the index without walking it.  The dry run therefore
// reports when buckets start, and treats the end of the latest-starting bucket as a lower
// bound on the newest data.
function indexEnd(database, query, direction) {
    const sort = {};
    for (const key of Object.keys(BUCKET_INDEX_KEYS)) sort[key] = direction;
    const result = database.runCommand({
        find: BUCKETS, filter: query, sort: sort, limit: 1, hint: BUCKET_INDEX_KEYS,
        projection: {_id: 0, [FIRST_SECONDS]: 1, [LAST_SECONDS]: 1},
        readConcern: INDEX_ONLY, singleBatch: true,
    });
    const doc = result.cursor.firstBatch[0];
    if (!doc) return null;
    return {
        firstSeconds: Number(doc.dataTimestamps.firstTime.seconds),
        lastSeconds: Number(doc.dataTimestamps.lastTime.seconds),
    };
}

// Whether the filter matches the bucket at one end of a PV's candidates.  This reads that one
// bucket; the filter is evaluated by the server so its meaning is exactly what a delete uses.
function filterMatchesEnd(buckets, config, pvName, direction) {
    const sort = {};
    for (const key of Object.keys(BUCKET_INDEX_KEYS)) sort[key] = direction;
    const end = buckets.find(ageSelection(pvName, config.cutoffSeconds), {_id: 1})
        .sort(sort).limit(1).hint(BUCKET_INDEX_KEYS).toArray()[0];
    if (!end) return null;
    return buckets.countDocuments({$and: [{_id: end._id}, config.filter]}) > 0;
}

function dryRunPv(database, buckets, config, pvName, totals) {
    const age = ageSelection(pvName, config.cutoffSeconds);
    const newest = indexEnd(database, {pvName: pvName}, -1);
    if (newest !== null && newest.lastSeconds > totals.newestDataSeconds) {
        totals.newestDataSeconds = newest.lastSeconds;
    }
    const byAge = indexCount(database, age);
    totals.bucketsMatchedByAge += byAge;
    if (byAge === 0) {
        totals.pvsWithNothingToTrim++;
        return;
    }
    totals.pvsWithCandidates++;
    const oldest = indexEnd(database, age, 1);
    const last = indexEnd(database, age, -1);
    if (oldest.firstSeconds < totals.oldestCandidateSeconds) {
        totals.oldestCandidateSeconds = oldest.firstSeconds;
    }
    if (last.firstSeconds > totals.newestCandidateSeconds) {
        totals.newestCandidateSeconds = last.firstSeconds;
    }
    let filterNote = "";
    if (config.filter !== null) {
        if (config.exactFilterCount) {
            const matched = buckets.countDocuments(selection(config, pvName),
                {hint: BUCKET_INDEX_KEYS});
            totals.bucketsMatchedByFilter += matched;
            filterNote = `, ${matched} match the filter (exact), ${byAge - matched} kept`;
        } else {
            const first = filterMatchesEnd(buckets, config, pvName, 1);
            const final = byAge === 1 ? first : filterMatchesEnd(buckets, config, pvName, -1);
            const sample = first && final ? "both" : first || final ? "one" : "neither";
            totals.filterSample[sample]++;
            filterNote = `, filter sample: ${sample} of oldest/newest match`;
        }
    }
    if (config.perPv) {
        log(`  ${pvName}: ${byAge} by age, starting ${isoSeconds(oldest.firstSeconds)} to `
            + `${isoSeconds(last.firstSeconds)}${filterNote}`);
    }
}

// Runs one step of an --execute run (reading a batch, or deleting it), retrying it after each
// of RETRY_DELAYS_MS when it fails: a primary changing, a write concern timeout.  onFailure,
// when given, sees every error first.
function withRetries(what, pvName, totals, step, onFailure) {
    for (let attempt = 0; ; attempt++) {
        try {
            // Not "return step()": mongosh would hand the pending call straight back to the
            // caller, and its failure would then bypass this catch.
            const result = step();
            return result;
        } catch (e) {
            if (onFailure) onFailure(e);
            if (attempt >= RETRY_DELAYS_MS.length) {
                // A delete by _id goes to every shard, and every shard waits for its own
                // majority even when it holds none of the buckets.  So the shard that could
                // not confirm is not necessarily the one holding this PV; the server's
                // message, quoted here, ends with its name ("... at <shard>").
                const hint = /write ?concern/i.test(`${e.codeName} ${e.message}`)
                    ? "  A majority did not confirm the write. The delete is sent to every "
                      + "shard, so this can be any shard, not only the one holding this PV: "
                      + "the message above ends with the name of the shard that timed out. "
                      + "Check that every data-bearing member of that shard is up and not far "
                      + "behind. On a shard of two data members and an arbiter, majority needs "
                      + "both."
                    : "";
                throw new Error(
                    `${what} failed for PV "${pvName}" after ${attempt + 1} attempts: `
                    + `${e.codeName || e.name}: ${e.message}.${hint}`);
            }
            log(`  ${what} for PV "${pvName}" failed (${e.codeName || e.name}: ${e.message}); `
                + `retry ${attempt + 1} of ${RETRY_DELAYS_MS.length} in `
                + `${RETRY_DELAYS_MS[attempt] / 1000}s`);
            totals.retries++;
            sleep(RETRY_DELAYS_MS[attempt]);
        }
    }
}

// Deletes one batch and adds what was removed to the run's and the PV's counts, as it goes:
// a delete that fails for good has usually still removed its buckets.
function deleteBatch(buckets, config, ids, pvName, totals, pv) {
    const options = {writeConcern: {w: "majority", wtimeout: config.wtimeoutMillis}};
    const count = n => {
        totals.bucketsDeleted += n;
        pv.deleted += n;
    };
    totals.batches++;
    count(withRetries("delete", pvName, totals,
        () => buckets.deleteMany({_id: {$in: ids}}, options).deletedCount,
        e => {
            // A write concern failure means the delete was applied on the primary and not yet
            // confirmed by a majority.  The retry then matches nothing and waits again, so the
            // buckets it removed are counted here.
            // The driver's write concern error carries the server's count as "n".
            count(e.result && typeof e.result.n === "number" ? e.result.n
                : typeof e.n === "number" ? e.n : 0);
        }));
}

function executePv(buckets, config, pvName, totals, progress) {
    let fromSeconds = null;
    const pv = {deleted: 0};
    try {
        for (;;) {
            // Oldest first.  With a filter this fetches the candidates to test them; the
            // delete then finds them in cache.  Without one the fetch still happens on a
            // sharded cluster.
            const batch = withRetries("read", pvName, totals, () => buckets
                .find(selection(config, pvName, fromSeconds), {_id: 1, [FIRST_SECONDS]: 1})
                .sort(BUCKET_INDEX_KEYS).limit(config.batchSize).hint(BUCKET_INDEX_KEYS)
                .toArray());
            if (batch.length === 0) break;
            deleteBatch(buckets, config, batch.map(doc => doc._id), pvName, totals, pv);
            // Later batches start at the second this one ended in, so buckets the filter
            // keeps at the old end of a PV are not read again for every batch.
            fromSeconds = Number(batch[batch.length - 1].dataTimestamps.firstTime.seconds);
            progress();
            if (config.pauseMillis > 0) sleep(config.pauseMillis);
            if (batch.length < config.batchSize) break;
        }
    } finally {
        // Counted here so that a PV whose run stopped part-way is still reported.
        totals.pvsVisited++;
        if (pv.deleted > 0) totals.pvsWithCandidates++;
        else totals.pvsWithNothingToTrim++;
        if (config.perPv && pv.deleted > 0) log(`  ${pvName}: deleted ${pv.deleted}`);
    }
}

function main() {
    const startedAt = new Date();
    const config = readConfig(startedAt.getTime());

    const conn = new Mongo(config.uri);
    const database = conn.getDB(config.database);
    const buckets = database.getCollection(BUCKETS);
    const trimLog = database.getCollection(TRIM_LOG);

    const deployment = checkDeployment(conn, database);
    checkBucketIndex(buckets);

    log(`mongodb-trim-buckets ${SCRIPT_VERSION}: ${config.execute ? "EXECUTE" : "dry run"}`);
    log(`  database ${config.database} on ${deployment}`);
    log(`  cutoff ${isoSeconds(config.cutoffSeconds)} (${config.cutoffSource}): buckets whose `
        + "last sample is before this are trimmed");
    if (config.filter !== null) log(`  filter ${config.filterText}`);
    if (config.slice !== null) log(`  slice ${config.slice.text} of the PV names`);
    if (config.execute) {
        log(`  batch size ${config.batchSize}, pause ${config.pauseMillis} ms, `
            + `write concern majority (timeout ${config.wtimeoutMillis} ms)`);
    }

    const totals = {
        pvsVisited: 0, pvsWithCandidates: 0, pvsWithNothingToTrim: 0,
        bucketsMatchedByAge: 0, bucketsMatchedByFilter: 0, bucketsDeleted: 0,
        batches: 0, retries: 0,
        filterSample: {both: 0, one: 0, neither: 0},
        oldestCandidateSeconds: Infinity, newestCandidateSeconds: -Infinity,
        newestDataSeconds: -Infinity,
    };

    const logId = new ObjectId();
    trimLog.insertOne({
        _id: logId, scriptVersion: SCRIPT_VERSION, startedAt: startedAt, endedAt: null,
        host: require("os").hostname(), database: config.database,
        cutoffSeconds: Long.fromNumber(config.cutoffSeconds), cutoffSource: config.cutoffSource,
        filter: config.filterText, slice: config.slice === null ? null : config.slice.text,
        dryRun: !config.execute, status: "running", error: null,
    });

    let failure = null;
    const workStarted = Date.now();
    try {
        let pvNames = listPvNames(database, buckets);
        const allPvs = pvNames.length;
        if (config.slice !== null) {
            pvNames = pvNames.filter(
                name => sliceOf(name, config.slice.count) === config.slice.index);
        }
        log(`  ${allPvs} PVs have buckets` + (config.slice === null
            ? "" : `; ${pvNames.length} are in slice ${config.slice.text}`));

        let lastProgress = Date.now();
        const progress = () => {
            if (Date.now() - lastProgress < PROGRESS_INTERVAL_MS) return;
            lastProgress = Date.now();
            const seconds = (Date.now() - workStarted) / 1000;
            log(`  progress: ${totals.pvsVisited} of ${pvNames.length} PVs, `
                + (config.execute
                    ? `${totals.bucketsDeleted} deleted, `
                      + `${Math.round(totals.bucketsDeleted / seconds)} per second`
                    : `${totals.bucketsMatchedByAge} matched by age`));
        };

        for (const pvName of pvNames) {
            if (config.execute) {
                executePv(buckets, config, pvName, totals, progress);
            } else {
                dryRunPv(database, buckets, config, pvName, totals);
                totals.pvsVisited++;
            }
            progress();
        }
    } catch (e) {
        failure = e;
    }

    const endedAt = new Date();
    const elapsedSeconds = Math.max((endedAt.getTime() - workStarted) / 1000, 0.001);
    const deletesPerSecond = config.execute
        ? Math.round((totals.bucketsDeleted / elapsedSeconds) * 10) / 10 : null;
    const completed = failure === null;
    const update = {
        endedAt: endedAt, status: completed ? "completed" : "failed",
        error: completed ? null : String(failure.message || failure),
        pvsVisited: totals.pvsVisited, bucketsDeleted: Long.fromNumber(totals.bucketsDeleted),
        batches: totals.batches, retries: totals.retries, deletesPerSecond: deletesPerSecond,
    };
    if (!config.execute) update.bucketsMatchedByAge = Long.fromNumber(totals.bucketsMatchedByAge);
    // The horizon says "nothing older than this remains", which only a run that finished, had
    // no filter and covered every PV can claim.  A sliced run sets none; the horizon holds for
    // its cutoff once every slice has a completed record.
    if (completed && config.execute && config.filter === null && config.slice === null) {
        update.horizonSeconds = Long.fromNumber(config.cutoffSeconds);
    }
    try {
        trimLog.updateOne({_id: logId}, {$set: update});
    } catch (e) {
        log(`warning: could not update the ${TRIM_LOG} record ${logId}: ${e.message}`);
    }

    log("");
    log(`${config.execute ? "EXECUTE" : "DRY RUN"} ${completed ? "completed" : "FAILED"} in `
        + `${Math.round(elapsedSeconds)}s; ${TRIM_LOG} record ${logId}`);
    log(`  PVs visited: ${totals.pvsVisited} (${totals.pvsWithCandidates} with buckets to trim, `
        + `${totals.pvsWithNothingToTrim} with none)`);
    if (config.execute) {
        log(`  buckets deleted: ${totals.bucketsDeleted} in ${totals.batches} batches, `
            + `${deletesPerSecond} per second` + (totals.retries ? `, ${totals.retries} retries` : ""));
    } else {
        log(`  buckets matched by age: ${totals.bucketsMatchedByAge}`);
        if (totals.bucketsMatchedByAge > 0) {
            log(`  buckets that would be trimmed start between `
                + `${isoSeconds(totals.oldestCandidateSeconds)} and `
                + `${isoSeconds(totals.newestCandidateSeconds)}`);
        }
        if (Number.isFinite(totals.newestDataSeconds)) {
            // A lower bound: see indexEnd.
            const keptDays = Math.max(
                (totals.newestDataSeconds - config.cutoffSeconds) / 86400, 0);
            log(`  newest data in these PVs is at least ${isoSeconds(totals.newestDataSeconds)} `
                + `(the end of the latest-starting bucket); the cutoff is `
                + `${isoSeconds(config.cutoffSeconds)}, so at least ${keptDays.toFixed(1)} days `
                + "of data would remain");
        }
        if (config.filter !== null && config.exactFilterCount) {
            const kept = totals.bucketsMatchedByAge - totals.bucketsMatchedByFilter;
            log(`  buckets matched by age and filter (exact): ${totals.bucketsMatchedByFilter}; `
                + `the filter keeps ${kept}`);
            if (kept === 0 && totals.bucketsMatchedByAge > 0) {
                log("  NOTE: the filter excludes nothing. Every bucket old enough would be deleted.");
            }
        } else if (config.filter !== null) {
            const s = totals.filterSample;
            log("  filter, tested on the oldest and newest candidate bucket of each PV (a SAMPLE, "
                + "not a count):");
            log(`    ${s.both} PVs where both match (would be trimmed)`);
            log(`    ${s.one} PVs where one matches (the filter splits this PV)`);
            log(`    ${s.neither} PVs where neither matches (would be kept)`);
            if (s.one === 0 && s.neither === 0 && s.both > 0) {
                log("  NOTE: the filter excluded nothing in the sample. If it is meant to keep "
                    + "some data, check its field paths and values.");
            }
            if (s.both === 0 && s.one === 0 && s.neither > 0) {
                log("  NOTE: the filter matched nothing in the sample. Nothing would be deleted.");
            }
        }
        log("  nothing was deleted; set DP_TRIM_EXECUTE=true (--execute) to delete");
    }
    if (!completed) throw failure;
}

try {
    main();
} catch (e) {
    if (e instanceof ConfigError) {
        print(`mongodb-trim-buckets: ${e.message}`);
        quit(2);
    }
    print(`mongodb-trim-buckets: FAILED: ${e.message || e}`);
    quit(1);
}
