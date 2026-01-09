#!/bin/bash

set -e  # Exit on any error

echo "Starting MongoDB cluster (3 nodes)..."
docker compose up -d

echo "Waiting for MongoDB nodes to be ready..."
sleep 10

echo "Checking if admin user exists on primary..."
if docker exec mongo1 mongosh admin --eval 'db.getUsers().length > 0 && db.getUsers()[0].user === "admin"' 2>/dev/null | grep -q "true"; then
  echo "Admin user exists, checking replica set status..."
  if docker exec mongo1 mongosh -u admin -p admin --authenticationDatabase admin --eval "rs.status()" > /dev/null 2>&1; then
    echo "Replica set already initialized"
  else
    echo "Initializing replica set with authentication..."
    docker exec mongo1 mongosh -u admin -p admin --authenticationDatabase admin --eval "
rs.initiate({
  _id: 'rs0',
  members: [
    {_id: 0, host: 'localhost:27017'},
    {_id: 1, host: 'localhost:27018'},
    {_id: 2, host: 'localhost:27019'}
  ]
})"
    echo "Replica set initialized!"
    sleep 5
  fi
else
  echo "Admin user does not exist, initializing replica set and creating admin user..."
  echo "First, temporarily stopping containers to initialize without auth..."
  
  # Stop containers and restart without auth for initialization
  docker compose down
  docker compose -f docker-compose-noauth.yml up -d
  sleep 10
  
  # Initialize replica set without auth (ignore if already initialized)
  if docker exec mongo1 mongosh --eval "
rs.initiate({
  _id: 'rs0',
  members: [
    {_id: 0, host: 'localhost:27017'},
    {_id: 1, host: 'localhost:27018'},
    {_id: 2, host: 'localhost:27019'}
  ]
})" 2>&1 | grep -q "already initialized"; then
    echo "Replica set already initialized"
  else
    echo "Replica set initialized successfully"
  fi
  
  echo "Waiting for replica set to elect primary..."
  sleep 5
  
  # Create admin user without auth requirements (ignore if already exists)
  echo "Creating admin user..."
  if docker exec mongo1 mongosh admin --eval 'db.createUser({user: "admin", pwd: "admin", roles: ["root"]})' 2>&1 | grep -q "already exists"; then
    echo "Admin user already exists"
  else
    echo "Admin user created successfully"
  fi
  
  echo "Restarting with authentication enabled..."
  docker compose down
  docker compose up -d
  sleep 5
  
  echo "Admin user created and authentication enabled!"
fi

echo "✓ Multi-node MongoDB replica set ready!"
echo ""
echo "For external clients (MongoDB Compass, applications):"
echo "Connect to individual nodes (do NOT use replicaSet parameter):"
echo "  - Node 1: mongodb://admin:admin@localhost:27017/admin"
echo "  - Node 2: mongodb://admin:admin@localhost:27018/admin"  
echo "  - Node 3: mongodb://admin:admin@localhost:27019/admin"
echo ""
echo "Internal replica set communication uses: mongo1:27017, mongo2:27017, mongo3:27017"
echo "Check which node is PRIMARY: docker exec mongo1 mongosh -u admin -p admin --authenticationDatabase admin --eval \"rs.status()\""