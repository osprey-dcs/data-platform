#!/bin/bash

echo
echo '================================================================'
echo 'start-ingestion-server (mongo-replica-set-single)'
echo '================================================================'
echo

# Wrapper script to start native ingestion server for mongo-replica-set-single scenario
# This calls the parameterized server-ingest-start script with the MongoDB URI
# configured for external connection to the Docker MongoDB replica set.

MONGO_URI="mongodb://admin:admin@localhost:27017/?replicaSet=rs0&authSource=admin"

echo "Starting ingestion server with MongoDB URI: $MONGO_URI"
echo

# Call the main script with MongoDB URI parameter for this scenario
exec ../../../bin/server-ingest-start "$MONGO_URI"