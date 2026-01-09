## Overview

This docker-compose file runs MongoDB in a single-node replica set configuration. It is designed for **external client connections** from host applications, MongoDB Compass, and other external tools.

**⚠️ Important**: This configuration is optimized for external connections only. For testing Docker containers that need to connect to MongoDB, use the `mongo-replica-set-multi` scenario instead.

## Running

Run the scenario using the provided shell script:

```
dp-support/docker/docker-compose/mongo-replica-set-single/start-mongo-replica-set-single.sh
```

## Database Connection URI

Use the following URI to connect to the database from a client application or Mongo Compass UI:

```
mongodb://admin:admin@localhost:27017/?replicaSet=rs0&authSource=admin
```

## Useful Commands

Check that the "mongo" container is running:
```
docker ps | grep mongo
```

Check docker logs for the mongo container:
```
docker logs mongo
```

Send hello command via mongo shell to running container to check topology and stats:
```
docker exec mongo mongosh -u admin -p admin --authenticationDatabase admin --eval "db.hello()"
```

## Use Cases

This setup is perfect for:
- **External client testing**: MongoDB Compass, host applications
- **Development work**: Local applications connecting to replica set
- **Simple testing**: Minimal replica set features without complexity

## For Docker Container Testing

If you need to test Docker containers connecting to MongoDB (like ingestion servers), use the multi-node replica set instead:
```
cd ../mongo-replica-set-multi/
./start-mongo-replica-set-multi.sh
```

## Using the Mongo Replica Set

To run an ingestion server against the mongo replica set started by this docker compose configuration, use the supplied script:

```
./start-ingestion-server.sh
```

To run a test data generator against that ingestion server, use the script:

```
./run-test-data-generator.sh
```

## Cleaning Up

You must manually stop the ingestion server:

```
../../../bin/server-ingest-stop
```

And then stop the replica set docker container:

Stop the database as shown below:

```
docker compose down -v
```