#!/bin/bash

echo
echo '================================================================'
echo 'run-test-data-generator (dp-ecosystem)'
echo '================================================================'
echo

# Wrapper script to run test data generator for dp-ecosystem scenario
# This calls the parameterized app-docker-run-test-data-generator script with the correct
# network and gRPC connection string for this docker compose configuration.

DOCKER_NETWORK="dp-ecosystem_eco-network"
GRPC_CONNECT_STRING="eco-envoy:8080"

# Call the main script with parameters for this scenario
exec ../../../bin/app-docker-run-test-data-generator "$DOCKER_NETWORK" "$GRPC_CONNECT_STRING"