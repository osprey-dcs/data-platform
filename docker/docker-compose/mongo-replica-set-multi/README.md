## Overview

This docker-compose file runs MongoDB in a 3-node replica set configuration. It is useful for testing high availability, failover scenarios, and distributed consensus behavior.

**⚠️ Important Limitation**: External clients (MongoDB Compass, host applications) cannot connect due to hostname resolution conflicts. This setup is designed for internal Docker container communication and testing via docker exec commands.

## Architecture

- **3 MongoDB nodes**: mongo1 (port 27017), mongo2 (port 27018), mongo3 (port 27019)
- **Replica set name**: rs0
- **Authentication**: admin/admin with root privileges
- **Keyfile authentication**: Shared keyfile for secure inter-node communication
- **Automatic failover**: If primary goes down, secondaries elect a new primary

## Running

Run the scenario using the provided shell script:

```
./start-mongo-replica-set-multi.sh
```

Stop the database cluster:

```
docker compose down -v
```

## Internal Database Connection (Docker containers only)

From within Docker containers or docker-compose services, use:

```
mongodb://admin:admin@mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0&authSource=admin
```

## External Connection Limitation

**External clients CANNOT connect** due to Docker networking limitations:

- MongoDB Compass: ❌ Cannot connect
- Host applications: ❌ Cannot connect  
- External tools: ❌ Cannot connect

**Why**: When you connect to `localhost:27017`, MongoDB responds with replica set configuration containing internal hostnames (`mongo1:27017`, `mongo2:27017`, `mongo3:27017`). External clients cannot resolve these Docker container names.

**Workaround**: Use the single-node replica set (`mongo-replica-set-single`) for external client testing.

## Testing and Administration

Check that containers are running:
```
docker ps | grep mongo
```

Check which node is PRIMARY:
```
docker exec mongo1 mongosh -u admin -p admin --authenticationDatabase admin --eval "rs.status().members.forEach(m => console.log(m.name + ': ' + m.stateStr))"
```

Test failover by stopping the primary:
```
# Find current primary first, then stop it
docker stop mongo1  # (if mongo1 is primary)
# Check election results
docker exec mongo2 mongosh -u admin -p admin --authenticationDatabase admin --eval "rs.status()"
```

Connect via shell to any node:
```
docker exec mongo1 mongosh -u admin -p admin --authenticationDatabase admin
docker exec mongo2 mongosh -u admin -p admin --authenticationDatabase admin  
docker exec mongo3 mongosh -u admin -p admin --authenticationDatabase admin
```

Check docker logs:
```
docker logs mongo1
docker logs mongo2
docker logs mongo3
```

## Use Cases

This setup is perfect for testing:
- **Primary failover**: Stop primary node and watch election
- **Replica set mechanics**: Understand distributed consensus
- **Write concerns**: Test majority writes, etc.
- **Read preferences**: Primary vs secondary reads
- **Application resilience**: Test how apps handle primary changes

## For External Client Testing

Use the single-node replica set instead:
```
cd ../mongo-replica-set-single/
./start-mongo-replica-set-single.sh
```

External URI that works: `mongodb://admin:admin@localhost:27017/?replicaSet=rs0&authSource=admin`

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
docker stop dp-ingestion-server
```

And then stop the replica set docker container:

Stop the database as shown below:

```
docker compose down -v
```