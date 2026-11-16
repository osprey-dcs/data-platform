// Test of bin/mongodb-trim-buckets, run by run-test.sh with `mongosh --nodb --file test.js`
// from this directory, against the cluster in docker-compose.yml.
//
// Each case seeds the same fixture, runs the wrapper as a child process, and compares the
// buckets left in the database with what an independent statement of the rule expects.  The
// cases run against an unsharded replica set and against the sharded cluster; the ones that
// need shards, or a secondary to stop, run on the sharded cluster only.

const {spawnSync} = require("child_process");
const path = require("path");

const WRAPPER = path.resolve(process.cwd(), "../../bin/mongodb-trim-buckets");
const SHARDED_URI = "mongodb://localhost:27117";
const SINGLE_URI = "mongodb://localhost:27118/?directConnection=true";
const SHARD_DIRECT_URI = "mongodb://localhost:27119/?directConnection=true";
const DB = "trimtest";

const INDEX = {
    pvName: 1, "dataTimestamps.firstTime.seconds": 1, "dataTimestamps.firstTime.nanos": 1,
    "dataTimestamps.lastTime.seconds": 1, "dataTimestamps.lastTime.nanos": 1,
};
const SHARD_KEY = "dataColumn.columnMetadata.attributes.shardSlot";
const SOURCE = "dataColumn.columnMetadata.attributes.source";
const BSAS = "bsas_gen1_reader";

const T0 = 1700000000;
const CUTOFF = T0 + 1000;
const CUTOFF_ISO = new Date(CUTOFF * 1000).toISOString();
const BSAS_FILTER = JSON.stringify({[SOURCE]: BSAS});

// ---------------------------------------------------------------------------------------
// fixture

let pvCounter = 0;
function bucket(pv, shard, first, last, source, lastNanos) {
    // Slots below 50000 route to shard s0, the rest to s1; a PV keeps to one shard.
    const slot = shard * 50000 + ((first * 7919 + pvCounter++) % 50000);
    return {
        _id: `${pv}-${first}-0`, pvName: pv, providerId: "provider-1", providerName: "test",
        clientRequestId: `req-${first}`,
        dataTimestamps: {
            firstTime: {seconds: Long(first), nanos: Long(0)},
            lastTime: {seconds: Long(last), nanos: Long(lastNanos || 0)},
            sampleCount: 10,
        },
        dataColumn: {
            _t: "doubleColumn", name: pv, values: [1.5, 2.5, 3.5],
            columnMetadata: {attributes: {
                shardSlot: String(slot).padStart(5, "0"), source: source || BSAS}},
        },
    };
}

function fixture() {
    const docs = [];
    // Entirely old: every bucket goes.
    for (let i = 0; i < 20; i++) docs.push(bucket("PV:OLD", 0, T0 + i * 10, T0 + i * 10 + 9));
    // Entirely new: nothing goes.
    for (let i = 0; i < 20; i++) {
        docs.push(bucket("PV:NEW", 1, CUTOFF + 10 + i * 10, CUTOFF + 19 + i * 10));
    }
    // Across the cutoff in ten-second buckets: T0+800.. are old, CUTOFF.. are new.
    for (let i = 0; i < 40; i++) docs.push(bucket("PV:MIX", 0, T0 + 800 + i * 10, T0 + 809 + i * 10));
    // The boundary: a straddling bucket, one ending exactly at the cutoff second (kept), and
    // one ending in the second before it, with nanos that would exceed a sub-second cutoff.
    docs.push(bucket("PV:EDGE", 1, CUTOFF - 5, CUTOFF + 4));
    docs.push(bucket("PV:EDGE", 1, CUTOFF - 3, CUTOFF));
    docs.push(bucket("PV:EDGE", 1, CUTOFF - 2, CUTOFF - 1, null, 999999999));
    // A bucket spanning far past the cutoff is kept however old its first sample is.
    docs.push(bucket("PV:LONG", 0, T0, CUTOFF + 5000));
    docs.push(bucket("PV:LONG", 0, T0 + 1, T0 + 2));
    // Old data from another source, and a PV whose old data is split between sources with a
    // different source at each end.
    for (let i = 0; i < 10; i++) {
        docs.push(bucket("PV:ARCH", 1, T0 + i * 10, T0 + i * 10 + 9, "archiver"));
        docs.push(bucket("PV:SPLIT", 0, T0 + i * 10, T0 + i * 10 + 9, i % 2 === 0 ? BSAS : "archiver"));
    }
    // Filler so that slices of the PV list each hold several PVs.
    for (let p = 0; p < 20; p++) {
        const pv = "PV:F" + String(p).padStart(2, "0");
        for (let i = 0; i < 5; i++) docs.push(bucket(pv, p % 2, T0 + i * 10, T0 + i * 10 + 9));
        for (let i = 0; i < 2; i++) docs.push(bucket(pv, p % 2, CUTOFF + i * 10, CUTOFF + 9 + i * 10));
    }
    return docs;
}

// The rule, stated independently of the script: trimmed iff the last sample's second is
// before the cutoff second and the filter (when there is one) matches.
function expectedIds(docs, cutoff, matches) {
    return docs.filter(d => !(Number(d.dataTimestamps.lastTime.seconds) < cutoff
        && (!matches || matches(d)))).map(d => d._id).sort();
}
const isBsas = d => d.dataColumn.columnMetadata.attributes.source === BSAS;

// ---------------------------------------------------------------------------------------
// harness

let failures = 0;
let checks = 0;
function check(condition, what) {
    checks++;
    if (!condition) {
        failures++;
        print(`    FAIL: ${what}`);
    }
}
function sameList(actual, expected, what) {
    const ok = actual.length === expected.length && actual.every((v, i) => v === expected[i]);
    if (!ok) {
        const extra = actual.filter(v => !expected.includes(v)).slice(0, 5);
        const missing = expected.filter(v => !actual.includes(v)).slice(0, 5);
        check(false, `${what}: ${actual.length} left, expected ${expected.length}; `
            + `unexpectedly left ${JSON.stringify(extra)}, unexpectedly gone ${JSON.stringify(missing)}`);
    } else {
        check(true, what);
    }
}

function trim(uri, args, options) {
    options = options || {};
    const environment = Object.assign({}, process.env, {DP_TRIM_MONGODB_URI: uri}, options.env || {});
    for (const name of Object.keys(environment)) {
        if (environment[name] === null) delete environment[name];
    }
    const database = options.database || DB;
    const result = spawnSync("bash", [WRAPPER, "--database", database].concat(args), {
        env: environment, encoding: "utf8", timeout: options.timeout, killSignal: "SIGKILL"});
    return {status: result.status, signal: result.signal, out: (result.stdout || "") + (result.stderr || "")};
}

// A plain object, not a class: mongosh cannot open a connection inside a constructor.
function makeTarget(name, uri, sharded) {
    const t = {name: name, uri: uri, sharded: sharded};
    t.db = new Mongo(uri).getDB(DB);
    t.buckets = t.db.getCollection("buckets");
    t.trimLog = t.db.getCollection("trimLog");
    t.setUp = function () {
        t.db.dropDatabase();
        if (sharded) {
            const admin = t.db.getSiblingDB("admin");
            admin.runCommand({enableSharding: DB});
            t.buckets.createIndex({[SHARD_KEY]: 1});
            admin.runCommand({shardCollection: `${DB}.buckets`, key: {[SHARD_KEY]: 1}});
            admin.runCommand({balancerStop: 1});
            admin.runCommand({split: `${DB}.buckets`, middle: {[SHARD_KEY]: "50000"}});
            for (const [slot, shard] of [["00000", "s0"], ["50000", "s1"]]) {
                const moved = admin.runCommand(
                    {moveChunk: `${DB}.buckets`, find: {[SHARD_KEY]: slot}, to: shard});
                if (!moved.ok && !/already/i.test(moved.errmsg || "")) {
                    throw new Error("moveChunk: " + EJSON.stringify(moved));
                }
            }
        }
        t.buckets.createIndex(INDEX);
        t.buckets.createIndex({providerId: 1});
    };
    t.seed = function () {
        t.buckets.deleteMany({});
        t.trimLog.deleteMany({});
        const docs = fixture();
        t.buckets.insertMany(docs, {writeConcern: {w: "majority"}});
        return docs;
    };
    t.ids = function () {
        return t.buckets.find({}, {_id: 1}).toArray().map(d => d._id).sort();
    };
    t.lastLog = function () {
        return t.trimLog.find().sort({startedAt: -1, _id: -1}).limit(1).toArray()[0];
    };
    return t;
}

function runCase(target, name, body) {
    const before = failures;
    print(`  [${target.name}] ${name}`);
    try {
        body(target);
    } catch (e) {
        failures++;
        print(`    FAIL: threw ${e.stack || e}`);
    }
    if (failures === before) print("    ok");
}

// ---------------------------------------------------------------------------------------
// cases

function dryRunThenExecute(t) {
    const docs = t.seed();
    const expected = expectedIds(docs, CUTOFF);
    const toDelete = docs.length - expected.length;

    const dry = trim(t.uri, ["--before", CUTOFF_ISO]);
    check(dry.status === 0, `dry run exits 0 (got ${dry.status}): ${dry.out.slice(-300)}`);
    check(t.ids().length === docs.length, "dry run deletes nothing");
    check(dry.out.includes(`buckets matched by age: ${toDelete}`),
        `dry run reports ${toDelete} matched by age`);
    check(dry.out.includes("nothing was deleted"), "dry run says nothing was deleted");
    let record = t.lastLog();
    check(record.dryRun === true && record.status === "completed", "dry run record is completed");
    check(Number(record.bucketsMatchedByAge) === toDelete, "dry run record has the matched count");
    check(record.horizonSeconds === undefined, "a dry run sets no horizon");

    const run = trim(t.uri, ["--before", CUTOFF_ISO, "--execute"]);
    check(run.status === 0, `execute exits 0 (got ${run.status}): ${run.out.slice(-300)}`);
    sameList(t.ids(), expected, "execute leaves exactly the expected buckets");
    record = t.lastLog();
    check(record.dryRun === false && record.status === "completed", "execute record is completed");
    check(Number(record.bucketsDeleted) === toDelete,
        `record counts ${toDelete} deleted (got ${record.bucketsDeleted})`);
    check(Number(record.horizonSeconds) === CUTOFF, "a complete unfiltered run sets the horizon");
    check(typeof record.deletesPerSecond === "number", "record has a delete rate");
    check(record.endedAt instanceof Date && record.scriptVersion && record.host, "record is filled in");
    check(t.trimLog.countDocuments({}) === 2, "one record per run");

    const again = trim(t.uri, ["--before", CUTOFF_ISO, "--execute"]);
    check(again.status === 0 && again.out.includes("buckets deleted: 0"), "a repeat run deletes nothing");
    sameList(t.ids(), expected, "a repeat run changes nothing");
}

function cutoffIsTruncatedToSeconds(t) {
    const docs = t.seed();
    const iso = new Date(CUTOFF * 1000 + 900).toISOString();
    const run = trim(t.uri, ["--before", iso, "--execute"]);
    check(run.status === 0, `exits 0 (got ${run.status})`);
    sameList(t.ids(), expectedIds(docs, CUTOFF), "a sub-second cutoff behaves as its whole second");
}

function smallBatches(t) {
    const docs = t.seed();
    const run = trim(t.uri, ["--before", CUTOFF_ISO, "--execute", "--batch-size", "3", "--per-pv"]);
    check(run.status === 0, `exits 0 (got ${run.status})`);
    sameList(t.ids(), expectedIds(docs, CUTOFF), "batches of 3 delete the same buckets");
    check(run.out.includes("PV:OLD: deleted 20"), "per-PV lines are printed on request");
}

function filterNarrows(t) {
    const docs = t.seed();
    const expected = expectedIds(docs, CUTOFF, isBsas);
    const byAge = docs.length - expectedIds(docs, CUTOFF).length;
    const byFilter = docs.length - expected.length;

    const sample = trim(t.uri, ["--before", CUTOFF_ISO, "--filter", BSAS_FILTER]);
    check(sample.status === 0, `sampled dry run exits 0 (got ${sample.status})`);
    check(sample.out.includes("1 PVs where one matches"), "sample finds the PV the filter splits");
    check(sample.out.includes("1 PVs where neither matches"), "sample finds the PV the filter keeps");
    check(sample.out.includes("a SAMPLE"), "sample is labelled as a sample");
    check(!sample.out.includes("NOTE: the filter excluded nothing"), "no warning for a filter that keeps data");

    const exact = trim(t.uri, ["--before", CUTOFF_ISO, "--filter", BSAS_FILTER, "--exact-filter-count"]);
    check(exact.out.includes(`buckets matched by age and filter (exact): ${byFilter}; the filter keeps ${byAge - byFilter}`),
        `exact count reports ${byFilter} of ${byAge}: ${exact.out.slice(-400)}`);
    check(t.ids().length === docs.length, "dry runs with a filter delete nothing");

    const run = trim(t.uri, ["--before", CUTOFF_ISO, "--filter", BSAS_FILTER, "--execute", "--batch-size", "2"]);
    check(run.status === 0, `execute exits 0 (got ${run.status}): ${run.out.slice(-300)}`);
    sameList(t.ids(), expected, "the filter keeps the other source's buckets");
    const record = t.lastLog();
    check(record.filter === BSAS_FILTER, "record holds the filter as given");
    check(record.horizonSeconds === undefined, "a filtered run sets no horizon");
    check(Number(record.bucketsDeleted) === byFilter, "record counts the filtered deletes");
}

function filterCannotWiden(t) {
    let docs = t.seed();
    let run = trim(t.uri, ["--before", CUTOFF_ISO, "--execute", "--filter", '{"pvName": "PV:NEW"}']);
    check(run.status === 0, `exits 0 (got ${run.status})`);
    check(t.ids().length === docs.length, "a filter naming a newer PV deletes nothing");

    docs = t.seed();
    run = trim(t.uri, ["--before", CUTOFF_ISO, "--execute", "--filter",
        '{"dataTimestamps.lastTime.seconds": {"$gte": {"$numberLong": "0"}}}']);
    sameList(t.ids(), expectedIds(docs, CUTOFF), "a filter on lastTime cannot replace the age test");

    docs = t.seed();
    run = trim(t.uri, ["--before", CUTOFF_ISO, "--execute", "--filter",
        '{"$or": [{"pvName": "PV:NEW"}, {"pvName": "PV:OLD"}]}']);
    sameList(t.ids(), expectedIds(docs, CUTOFF, d => d.pvName === "PV:OLD"),
        "an $or filter still only reaches old buckets");
}

function filterThatExcludesNothingIsFlagged(t) {
    const docs = t.seed();
    const run = trim(t.uri, ["--before", CUTOFF_ISO, "--filter",
        '{"dataColumn.columnMetadata.attributes.noSuchAttribute": {"$exists": false}}']);
    check(run.status === 0, `exits 0 (got ${run.status})`);
    check(run.out.includes("NOTE: the filter excluded nothing in the sample"),
        "the dry run flags a filter that excludes nothing");
    check(t.ids().length === docs.length, "nothing deleted");
}

function slicesPartitionTheWork(t) {
    const docs = t.seed();
    const all = docs.map(d => d._id).sort();
    const expected = expectedIds(docs, CUTOFF);
    const first = trim(t.uri, ["--before", CUTOFF_ISO, "--execute", "--slice", "0/2"]);
    const afterFirst = t.ids();
    const firstRecord = t.lastLog();
    const second = trim(t.uri, ["--before", CUTOFF_ISO, "--execute", "--slice", "1/2"]);
    const afterSecond = t.ids();
    check(first.status === 0 && second.status === 0, "both slices exit 0");
    const goneFirst = all.filter(id => !afterFirst.includes(id));
    const goneSecond = afterFirst.filter(id => !afterSecond.includes(id));
    check(goneFirst.length > 0 && goneSecond.length > 0,
        `each slice deletes something (${goneFirst.length}, ${goneSecond.length})`);
    const pvOf = id => id.slice(0, id.indexOf("-"));
    const pvsFirst = new Set(goneFirst.map(pvOf));
    check(goneSecond.every(id => !pvsFirst.has(pvOf(id))), "no PV is handled by both slices");
    sameList(afterSecond, expected, "the two slices together equal an unsliced run");
    check(firstRecord.slice === "0/2" && firstRecord.horizonSeconds === undefined
        && t.lastLog().horizonSeconds === undefined, "sliced runs record the slice and set no horizon");
}

function olderThanDaysAndEmptyArchive(t) {
    const docs = t.seed();
    const run = trim(t.uri, ["--older-than-days", "1", "--execute"]);
    check(run.status === 0, `exits 0 (got ${run.status}): ${run.out.slice(-300)}`);
    check(t.ids().length === 0, `everything in the 2023 fixture is older than a day (${t.ids().length} left)`);
    check(t.lastLog().cutoffSource === "olderThanDays:1", "record says how the cutoff was given");
    const empty = trim(t.uri, ["--older-than-days", "1", "--execute"]);
    check(empty.status === 0 && empty.out.includes("0 PVs have buckets"), "an empty archive is a clean run");
    const dry = trim(t.uri, ["--older-than-days", "1"]);
    check(dry.status === 0 && dry.out.includes("buckets matched by age: 0"), "an empty archive dry-runs cleanly");
    check(docs.length > 0, "fixture is not empty");
}

function rejectedBeforeAnything(t) {
    const docs = t.seed();
    const cases = [
        ["both cutoffs", ["--before", CUTOFF_ISO, "--older-than-days", "60", "--execute"]],
        ["no cutoff", ["--execute"]],
        ["zero days", ["--older-than-days", "0", "--execute"]],
        ["fractional days", ["--older-than-days", "1.5", "--execute"]],
        ["cutoff without a zone", ["--before", "2023-11-14T22:30:00", "--execute"]],
        ["cutoff in the future", ["--before", "2999-01-01T00:00:00Z", "--execute"]],
        ["cutoff that is not a time", ["--before", "yesterdayZ", "--execute"]],
        ["filter that is not JSON", ["--before", CUTOFF_ISO, "--execute", "--filter", "{nope"]],
        ["filter that is not an object", ["--before", CUTOFF_ISO, "--execute", "--filter", "[1]"]],
        ["slice out of range", ["--before", CUTOFF_ISO, "--execute", "--slice", "2/2"]],
        ["slice malformed", ["--before", CUTOFF_ISO, "--execute", "--slice", "half"]],
        ["batch size zero", ["--before", CUTOFF_ISO, "--execute", "--batch-size", "0"]],
        ["unknown flag", ["--before", CUTOFF_ISO, "--execute", "--force"]],
        ["flag missing its value", ["--execute", "--before"]],
    ];
    for (const [what, args] of cases) {
        const run = trim(t.uri, args);
        check(run.status === 2, `${what}: exit 2 (got ${run.status}: ${run.out.trim().slice(-160)})`);
    }
    const noUri = trim(t.uri, ["--before", CUTOFF_ISO, "--execute"], {env: {DP_TRIM_MONGODB_URI: null}});
    check(noUri.status === 2, `missing connection string: exit 2 (got ${noUri.status})`);

    const other = t.db.getSiblingDB("trimnoindex");
    other.dropDatabase();
    other.buckets.insertOne(bucket("PV:OLD", 0, T0, T0 + 9));
    const noIndex = trim(t.uri, ["--before", CUTOFF_ISO, "--execute"], {database: "trimnoindex"});
    check(noIndex.status === 2 && noIndex.out.includes("lacks the bucket query index"),
        `missing index: exit 2 (got ${noIndex.status})`);
    check(other.buckets.countDocuments({}) === 1 && other.trimLog.countDocuments({}) === 0,
        "missing index: nothing deleted, no record");
    other.dropDatabase();

    check(t.ids().length === docs.length, "no rejected run deleted anything");
    check(t.trimLog.countDocuments({}) === 0, "no rejected run left a record");

    const unreachable = trim("mongodb://localhost:27999/?serverSelectionTimeoutMS=1500&directConnection=true",
        ["--before", CUTOFF_ISO, "--execute"]);
    check(unreachable.status === 1, `unreachable server: exit 1 (got ${unreachable.status})`);
}

function interruptedRunIsSafeToRepeat(t) {
    const docs = t.seed();
    const expected = expectedIds(docs, CUTOFF);
    const killed = trim(t.uri, ["--before", CUTOFF_ISO, "--execute", "--batch-size", "1", "--pause-ms", "250"],
        {timeout: 5000});
    check(killed.signal === "SIGKILL", `the run was killed part-way (status ${killed.status}, signal ${killed.signal})`);
    const left = t.ids().length;
    check(left < docs.length && left > expected.length,
        `the killed run had deleted some but not all (${docs.length} -> ${left}, target ${expected.length})`);
    check(t.lastLog().status === "running", "a killed run leaves its record marked running");
    const rerun = trim(t.uri, ["--before", CUTOFF_ISO, "--execute"]);
    check(rerun.status === 0, `the repeat run exits 0 (got ${rerun.status})`);
    sameList(t.ids(), expected, "the repeat run finishes the job");
    check(t.lastLog().status === "completed" && t.trimLog.countDocuments({}) === 2,
        "the repeat run has its own completed record");
}

function refusesDirectShardConnection(t) {
    const docs = t.seed();
    const run = trim(SHARD_DIRECT_URI, ["--before", CUTOFF_ISO, "--execute"]);
    check(run.status === 2 && run.out.includes("connect to a mongos"),
        `direct connection to a shard: exit 2 (got ${run.status}: ${run.out.trim().slice(-200)})`);
    check(t.ids().length === docs.length, "nothing deleted");
}

function bothShardsHoldData(t) {
    t.seed();
    const counts = {};
    for (const [shard, stats] of Object.entries(t.buckets.stats().shards)) counts[shard] = stats.count;
    check(counts.s0 > 0 && counts.s1 > 0, `the fixture is spread over both shards: ${JSON.stringify(counts)}`);
}

function compose(args) {
    const result = spawnSync("docker", ["compose"].concat(args), {encoding: "utf8"});
    if (result.status !== 0) throw new Error(`docker compose ${args.join(" ")}: ${result.stderr}`);
}

function stopsWhenMajorityIsUnavailable(t) {
    const docs = t.seed();
    const expected = expectedIds(docs, CUTOFF);
    compose(["stop", "s0b"]);
    try {
        const run = trim(t.uri, ["--before", CUTOFF_ISO, "--execute"],
            {env: {DP_TRIM_WTIMEOUT_MS: "1500", DP_TRIM_RETRY_DELAYS_MS: "300,300"}});
        check(run.status === 1, `exits 1 when a majority cannot confirm (got ${run.status}): ${run.out.slice(-400)}`);
        check(run.out.includes("retry 2 of 2"), "the batch was retried");
        check(run.out.includes("majority needs both"), "the message points at the shard's members");
        const record = t.lastLog();
        check(record.status === "failed" && /attempts/.test(record.error || ""),
            `the record is marked failed with the error (${record.status})`);
        check(record.horizonSeconds === undefined, "a failed run sets no horizon");
        // The delete was applied on the primary each time; what the record counts must be
        // what is actually gone.
        check(Number(record.bucketsDeleted) === docs.length - t.ids().length,
            `the failed run's count matches what is gone (${record.bucketsDeleted} vs ${docs.length - t.ids().length})`);
    } finally {
        compose(["start", "s0b"]);
        const shard = new Mongo(SHARD_DIRECT_URI).getDB("admin");
        for (let i = 0; i < 120; i++) {
            const members = shard.runCommand({replSetGetStatus: 1}).members || [];
            if (members.some(m => m.name.startsWith("s0b") && m.stateStr === "SECONDARY")) break;
            sleep(500);
        }
    }
    const rerun = trim(t.uri, ["--before", CUTOFF_ISO, "--execute"]);
    check(rerun.status === 0, `the repeat run exits 0 once the secondary is back (got ${rerun.status}): ${rerun.out.slice(-300)}`);
    sameList(t.ids(), expected, "the repeat run finishes the job");
}

// ---------------------------------------------------------------------------------------

const common = [
    ["dry run, then execute, then repeat", dryRunThenExecute],
    ["cutoff is truncated to whole seconds", cutoffIsTruncatedToSeconds],
    ["small batches", smallBatches],
    ["filter narrows what is trimmed", filterNarrows],
    ["filter cannot widen what is trimmed", filterCannotWiden],
    ["filter that excludes nothing is flagged", filterThatExcludesNothingIsFlagged],
    ["slices partition the work", slicesPartitionTheWork],
    ["--older-than-days, and an archive left empty", olderThanDaysAndEmptyArchive],
    ["bad input is rejected before anything happens", rejectedBeforeAnything],
    ["an interrupted run is safe to repeat", interruptedRunIsSafeToRepeat],
];
const shardedOnly = [
    ["fixture spans both shards", bothShardsHoldData],
    ["refuses a direct connection to a shard", refusesDirectShardConnection],
    ["stops when a majority is unavailable", stopsWhenMajorityIsUnavailable],
];

const only = process.env.TRIM_TEST_ONLY || "";
for (const target of [makeTarget("replica set", SINGLE_URI, false), makeTarget("sharded", SHARDED_URI, true)]) {
    print(`${target.name}:`);
    target.setUp();
    for (const [name, body] of common.concat(target.sharded ? shardedOnly : [])) {
        if (only && !name.includes(only)) continue;
        runCase(target, name, body);
    }
}
print("");
print(failures === 0 ? `PASSED: ${checks} checks` : `FAILED: ${failures} of ${checks} checks`);
quit(failures === 0 ? 0 : 1);
