#!/bin/bash

echo
echo '================================================================'
echo 'run-test-data-generator (mongo-replica-set-single)'
echo '================================================================'
echo

# Wrapper script to run native test data generator for mongo-replica-set-single scenario
# This calls the standard app-run-test-data-generator script which will connect
# to the native ingestion server running on the host.

echo "Running test data generator..."
echo "Note: Ensure the ingestion server is started first with ./start-ingestion-server.sh"
echo

# Call the main test data generator script
exec ../../../bin/app-run-test-data-generator