#!/bin/bash

# Build all DP Service Docker Images
# Uses the same build approach as dp-ecosystem docker-compose.yml
# All services use the same base image but are tagged differently for Kubernetes

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Building all DP Service Docker images..."
echo "Project root: $PROJECT_ROOT"
echo "Using same build context as dp-ecosystem docker compose"

# Use project root as context (same as docker-compose context: ../../..)
cd "$PROJECT_ROOT"

# Check if dp-service.jar exists
if [ ! -f "./lib/dp-service.jar" ]; then
    echo "ERROR: dp-service.jar not found at ./lib/dp-service.jar"
    exit 1
fi

echo "Building dp-ingestion-service:latest..."
docker build -f ./docker/applications/JavaApp/Dockerfile -t dp-ingestion-service:latest .

echo "Building dp-query-service:latest..."
docker build -f ./docker/applications/JavaApp/Dockerfile -t dp-query-service:latest .

echo "Building dp-annotation-service:latest..."
docker build -f ./docker/applications/JavaApp/Dockerfile -t dp-annotation-service:latest .

echo "Building dp-ingestion-stream-service:latest..."
docker build -f ./docker/applications/JavaApp/Dockerfile -t dp-ingestion-stream-service:latest .

echo ""
echo "✅ All DP service images built successfully!"
echo "These images use the same base as dp-ecosystem docker compose services."
echo ""
echo "Available images:"
docker images | grep "dp-.*-service"

echo ""
echo "To load into minikube, run:"
echo "  minikube image load dp-ingestion-service:latest"
echo "  minikube image load dp-query-service:latest" 
echo "  minikube image load dp-annotation-service:latest"
echo "  minikube image load dp-ingestion-stream-service:latest"