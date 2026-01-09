# Deployment Instructions for Data Platform Ecosystem
# 
# This file contains commands to deploy the Kubernetes configuration
# 
# PREREQUISITES:
# 1. Start minikube cluster:
#    minikube start
# 
# 2. Build Docker images for all DP services:
#    ./docker/applications/build-dp-images.sh
# 
# 3. Verify minikube is running and kubectl is connected:
#    minikube status
#    kubectl cluster-info
#
# Then run these commands in order:

# 1. For minikube: Load Docker images into minikube
minikube image load dp-ingestion-service:latest
minikube image load dp-query-service:latest
minikube image load dp-annotation-service:latest
minikube image load dp-ingestion-stream-service:latest

# 2. Apply all configurations
kubectl apply -f namespace.yaml
kubectl apply -f mongodb-deployment.yaml
kubectl apply -f mongodb-service.yaml
kubectl apply -f ingestion-deployment.yaml
kubectl apply -f ingestion-service.yaml
kubectl apply -f query-deployment.yaml
kubectl apply -f query-service.yaml
kubectl apply -f annotation-deployment.yaml
kubectl apply -f annotation-service.yaml
kubectl apply -f ingestion-stream-deployment.yaml
kubectl apply -f ingestion-stream-service.yaml
kubectl apply -f hpa.yaml

# 3. Check deployment status
kubectl get all -n dp-ecosystem

# 4. Get service endpoints for external access
kubectl get svc -n dp-ecosystem
# MongoDB: minikube_ip:30017
# Ingestion gRPC: minikube_ip:31406  
# Ingestion HTTP: minikube_ip:32607
# Query gRPC: minikube_ip:31407  
# Query HTTP: minikube_ip:32608
# Annotation gRPC: minikube_ip:31408  
# Annotation HTTP: minikube_ip:32609
# Ingestion Stream gRPC: minikube_ip:31409  
# Ingestion Stream HTTP: minikube_ip:32610

# 5. Watch HPA scaling in action
kubectl get hpa -n dp-ecosystem -w

# 6. Generate load to test autoscaling
# Run your benchmark clients against service endpoints:
# Ingestion: 192.168.49.2:31406
# Query: 192.168.49.2:31407  
# Annotation: 192.168.49.2:31408
# Ingestion Stream: 192.168.49.2:31409
# (or get minikube IP with: minikube ip)
# You should see HPA automatically scale up the service pods

# 7. Monitor logs
kubectl logs -n dp-ecosystem deployment/ingestion-service -f
kubectl logs -n dp-ecosystem deployment/query-service -f
kubectl logs -n dp-ecosystem deployment/annotation-service -f
kubectl logs -n dp-ecosystem deployment/ingestion-stream-service -f

# 8. Scale manually for testing
kubectl scale deployment ingestion-service --replicas=5 -n dp-ecosystem
kubectl scale deployment query-service --replicas=3 -n dp-ecosystem
kubectl scale deployment annotation-service --replicas=2 -n dp-ecosystem
kubectl scale deployment ingestion-stream-service --replicas=3 -n dp-ecosystem

# 9. Cleanup when done
kubectl delete namespace dp-ecosystem