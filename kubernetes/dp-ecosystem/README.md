# Kubernetes Data Platform Ecosystem

This directory contains Kubernetes manifests for deploying the complete Data Platform ecosystem with all four core services: Ingestion, Query, Annotation, and Ingestion Stream services, along with MongoDB and horizontal pod autoscaling.

## Architecture Overview

The Kubernetes deployment provides:
- **All 4 DP Services**: Ingestion, Query, Annotation, and Ingestion Stream
- **MongoDB**: Shared persistence layer
- **Horizontal Pod Autoscaling**: Dynamic scaling based on CPU/memory usage
- **Service Discovery**: Native Kubernetes DNS and service routing
- **Health Checks**: Liveness and readiness probes for all services
- **NodePort Access**: External access via minikube for development

## Files Overview

- **namespace.yaml**: Creates isolated namespace `dp-ecosystem`
- **mongodb-deployment.yaml**: MongoDB single instance with resource limits
- **mongodb-service.yaml**: NodePort service exposing MongoDB externally
- **ingestion-deployment.yaml**: Ingestion service with 2 initial replicas
- **ingestion-service.yaml**: NodePort service exposing ingestion on ports 31406/32607
- **query-deployment.yaml**: Query service with 2 initial replicas
- **query-service.yaml**: NodePort service exposing query on ports 31407/32608
- **annotation-deployment.yaml**: Annotation service with 2 initial replicas
- **annotation-service.yaml**: NodePort service exposing annotation on ports 31408/32609
- **ingestion-stream-deployment.yaml**: Ingestion Stream service with 2 initial replicas
- **ingestion-stream-service.yaml**: NodePort service exposing ingestion stream on ports 31409/32610
- **hpa.yaml**: HorizontalPodAutoscaler configurations for all services
- **deployment-instructions.md**: Complete step-by-step deployment instructions

## Service Architecture

| Service | Internal Port | External gRPC | External HTTP | Main Class |
|---------|---------------|---------------|---------------|------------|
| **Ingestion** | 50051 | 31406 | 32607 | `IngestionGrpcServer` |
| **Query** | 50052 | 31407 | 32608 | `QueryGrpcServer` |
| **Annotation** | 50053 | 31408 | 32609 | `AnnotationGrpcServer` |
| **Ingestion Stream** | 50054 | 31409 | 32610 | `IngestionStreamGrpcServer` |
| **MongoDB** | 27017 | 30017 | - | - |

## Prerequisites

1. **Minikube** running: `minikube start`
2. **Docker images** built: `./docker/applications/build-dp-images.sh`
3. **kubectl** configured to connect to minikube cluster

## Quick Start

```bash
# 0. Start minikube
minikube start

# 1. Build all DP service images
./docker/applications/build-dp-images.sh

# 2. Load images into minikube
minikube image load dp-ingestion-service:latest
minikube image load dp-query-service:latest
minikube image load dp-annotation-service:latest
minikube image load dp-ingestion-stream-service:latest

# 3. Deploy all services
cd kubernetes/dp-ecosystem
kubectl apply -f namespace.yaml  # Create namespace first
kubectl apply -f .                # Deploy all resources

# 4. Check status
kubectl get all -n dp-ecosystem

# 5. Get external access URLs
minikube ip  # Use this IP with the NodePorts above
```

#6. Generate test data
Once the ecosystem is running, the MLDP sample data generator can be used to ingest some data, using the IP address obtained above using the specified gRPC port for the configuration, e.g.,
```
java -Ddp.GrpcClient.ingestionConnectString=192.168.49.2:31406 com.ospreydcs.dp.service.ingest.utility.TestDataGenerator
```

NOTE that because minikube is a development tool that is simulating a cluster on a single host, the performance is quite poor even for the sample data generator. That tool usually runs in a matter of seconds against a single Java application, but takes over 10 minutes to run against a minikube cluster!  If there are time out errors on the test data generator console, it is likely that it timed out while waiting for the expected responses.

## Horizontal Pod Autoscaling

Each service has HPA configured with different scaling limits:

| Service | Min Replicas | Max Replicas | Scale Triggers |
|---------|--------------|--------------|----------------|
| **Ingestion** | 2 | 10 | CPU 70%, Memory 80% |
| **Query** | 2 | 8 | CPU 70%, Memory 80% |
| **Annotation** | 2 | 6 | CPU 70%, Memory 80% |
| **Ingestion Stream** | 2 | 8 | CPU 70%, Memory 80% |

Monitor scaling:
```bash
kubectl get hpa -n dp-ecosystem -w
kubectl get pods -n dp-ecosystem -w
```

## Docker Integration

The Kubernetes deployment uses the same Docker images as the docker-compose configurations:
- **Shared Dockerfile**: `docker/applications/JavaApp/Dockerfile`
- **Shared JAR**: All services use `dp-service.jar` with different main classes
- **Build Script**: `./docker/applications/build-dp-images.sh` creates K8s-tagged images
- **Consistency**: Identical runtime behavior between docker-compose and Kubernetes

## Development vs Production

**Development (Minikube):**
- Uses NodePort services for external access
- Single MongoDB instance
- Local image loading with `minikube image load`
- Resource limits suitable for local development

**Production Considerations:**
- Replace NodePort with LoadBalancer or Ingress
- MongoDB replica set with persistent volumes
- Push images to container registry
- Increase resource limits for production workloads
- Implement proper monitoring and logging

## Troubleshooting

**Common Issues:**
1. **Images not found**: Run `./docker/applications/build-dp-images.sh` first
2. **Connection failures**: Verify minikube is running and `kubectl cluster-info` works
3. **Port conflicts**: Clean up old deployments with `kubectl delete namespace dp-ecosystem`
4. **HPA not working**: Ensure metrics-server is installed in minikube

**Cleanup:**
```bash
kubectl delete namespace dp-ecosystem
```

## Next Steps

- Add persistent storage for MongoDB
- Implement service mesh for advanced traffic management
- Add monitoring with Prometheus/Grafana
- Configure ingress controller for production access
- Implement backup strategies for MongoDB