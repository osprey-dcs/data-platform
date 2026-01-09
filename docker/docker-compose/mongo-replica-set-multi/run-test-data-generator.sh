#!/bin/bash

echo
echo '================================================================'
echo 'run-test-data-generator (mongo-replica-set-multi)'
echo '================================================================'
echo

# Wrapper script to run test data generator for mongo-replica-set-multi scenario
# This calls the parameterized app-docker-run-test-data-generator script with the correct
# network and gRPC connection string for this docker compose configuration.

DOCKER_NETWORK="mongo-replica-set-multi_mongo-cluster"
GRPC_CONNECT_STRING="dp-ingestion-server:50051"

# Call the main script with parameters for this scenario
exec ../../../bin/app-docker-run-test-data-generator "$DOCKER_NETWORK" "$GRPC_CONNECT_STRING"