#!/bin/bash

echo
echo '================================================================'
echo 'start-ingestion-server (mongo-replica-set-multi)'
echo '================================================================'
echo

# Wrapper script to start ingestion server for mongo-replica-set-multi scenario
# This calls the parameterized server-docker-ingest-start script with the correct
# network and MongoDB URI for this docker compose configuration.

DOCKER_NETWORK="mongo-replica-set-multi_mongo-cluster"
MONGO_URI="mongodb://admin:admin@mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0&authSource=admin"

# Call the main script with parameters for this scenario
exec ../../../bin/server-docker-ingest-start "$DOCKER_NETWORK" "$MONGO_URI"