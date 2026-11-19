#!/bin/bash
#
# Runs the test of bin/mongodb-trim-buckets against a throwaway MongoDB cluster in Docker.
#
#     test/mongodb-trim-buckets/run-test.sh           # start the cluster, test, remove it
#     test/mongodb-trim-buckets/run-test.sh --keep    # leave the cluster up afterwards
#
# Needs docker (with compose) and mongosh.  Uses localhost ports 27117-27119.

set -u
cd "$(dirname "$0")" || exit 1
KEEP=false
[ "${1:-}" = "--keep" ] && KEEP=true

cleanup() {
    if [ "$KEEP" = false ]; then docker compose down -v >/dev/null 2>&1; fi
}
trap cleanup EXIT

docker compose up -d || exit 1

# Wait for a mongod inside a container to answer, then run a snippet in it.
in_container() {
    local service="$1" script="$2" i
    for i in $(seq 1 60); do
        docker compose exec -T "$service" mongosh --quiet --port 27017 \
            --eval 'db.runCommand({ping: 1}).ok' >/dev/null 2>&1 && break
        sleep 1
    done
    docker compose exec -T "$service" mongosh --quiet --port 27017 --eval "$script"
}

# rs.initiate is skipped when the set already has a config, so --keep runs can be repeated.
initiate() {
    in_container "$1" "try { rs.status().ok } catch (e) { rs.initiate($2).ok }" >/dev/null || exit 1
}
initiate cfg1 '{_id: "cfg", configsvr: true, members: [{_id: 0, host: "cfg1:27017"}]}'
initiate single '{_id: "single", members: [{_id: 0, host: "single:27017"}]}'
for s in s0 s1; do
    initiate "${s}a" "{_id: \"$s\", members: [
        {_id: 0, host: \"${s}a:27017\", priority: 2},
        {_id: 1, host: \"${s}b:27017\"},
        {_id: 2, host: \"${s}arb:27017\", arbiterOnly: true}]}"
done

# Every replica set needs a primary before the shards can be added.
for target in "mongodb://localhost:27118/?directConnection=true" "mongodb://localhost:27119/?directConnection=true"; do
    for i in $(seq 1 60); do
        mongosh "$target" --quiet --eval 'if (!db.hello().isWritablePrimary) quit(1)' >/dev/null 2>&1 && break
        sleep 1
    done
done
added=false
for i in $(seq 1 30); do
    if mongosh "mongodb://localhost:27117" --quiet --file init-cluster.js; then added=true; break; fi
    sleep 2
done
[ "$added" = true ] || { echo "could not add the shards"; exit 1; }

mongosh --nodb --quiet --file test.js
status=$?
exit $status
