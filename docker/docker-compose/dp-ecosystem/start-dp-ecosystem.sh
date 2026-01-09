#!/bin/bash

echo
echo '================================================================'
echo 'start-dp-ecosystem'
echo '================================================================'
echo

# Start the complete DP ecosystem using docker-compose
# This includes MongoDB, Envoy load balancer, and all DP services

echo "Starting DP ecosystem with docker-compose..."
docker compose up -d

if [ $? -eq 0 ]; then
  echo
  echo "✅ DP ecosystem started successfully"
  echo
  echo "Services available:"
  echo "  - MongoDB: localhost:27017"
  echo "  - Envoy Load Balancer: localhost:8080"
  echo "  - Ingestion servers: eco-ingestion-server-1, eco-ingestion-server-2"
  echo
  echo "To generate test data:"
  echo "  ./run-test-data-generator.sh"
  echo
  echo "To stop the ecosystem:"
  echo "  docker compose down"
  echo
  echo "Check status:"
  echo "  docker compose ps"
else
  echo "❌ Failed to start DP ecosystem"
  exit 1
fi