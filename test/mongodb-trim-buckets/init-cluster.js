// Runs against mongos once the replica sets have been initiated (run-test.sh does that with a
// shell inside each container, since only mongos is published): adds the two shards.
//
// A shard with an arbiter has an implicit default write concern of w:1, and mongos refuses to
// add one until a cluster-wide default is set explicitly.  It is set to w:1 here on purpose, so
// that the trim script's own w:"majority" is what the write-concern tests exercise.
const admin = db.getSiblingDB("admin");
const rw = admin.runCommand({setDefaultRWConcern: 1, defaultWriteConcern: {w: 1}});
if (!rw.ok) throw new Error("setDefaultRWConcern: " + EJSON.stringify(rw));
for (const [name, host] of [["s0", "s0a:27017"], ["s1", "s1a:27017"]]) {
    const have = admin.runCommand({listShards: 1}).shards.map(s => s._id);
    if (!have.includes(name)) {
        const r = admin.runCommand({addShard: `${name}/${host}`});
        if (!r.ok) throw new Error("addShard " + name + ": " + EJSON.stringify(r));
    }
}
print("shards: " + admin.runCommand({listShards: 1}).shards.map(s => s._id).join(", "));
