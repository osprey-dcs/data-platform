#!/bin/bash

set -e  # Exit on any error

echo "Starting MongoDB container..."
docker compose up -d

echo "Waiting for MongoDB to be ready..."
sleep 5

echo "Checking if admin user exists..."
if docker exec mongo mongosh -u admin -p admin --authenticationDatabase admin --eval "db.hello()" > /dev/null 2>&1; then
  echo "Admin user exists, checking replica set status..."
  if docker exec mongo mongosh -u admin -p admin --authenticationDatabase admin --eval "rs.status()" > /dev/null 2>&1; then
    echo "Replica set already initialized"
  else
    echo "Initializing replica set with authentication..."
    docker exec mongo mongosh -u admin -p admin --authenticationDatabase admin --eval "
rs.initiate({
  _id: 'rs0',
  members: [{_id: 0, host: 'localhost:27017'}]
})"
    echo "Replica set initialized!"
    sleep 2
  fi
else
  echo "Admin user does not exist, initializing replica set and creating admin user..."
  # Use localhost exception to initialize replica set first
  if docker exec mongo mongosh --eval "
rs.initiate({
  _id: 'rs0',
  members: [{_id: 0, host: 'localhost:27017'}]
})" 2>&1 | grep -q "already initialized"; then
    echo "Replica set already initialized"
  else
    echo "Replica set initialized"
  fi
  echo "Waiting for replica set to become primary..."
  
  # Wait for the replica set to be ready
  for i in {1..10}; do
    if docker exec mongo mongosh --eval "rs.status().myState" 2>/dev/null | grep -q "1"; then
      echo "Replica set is now primary"
      break
    fi
    echo "Waiting for replica set to become primary... ($i/10)"
    sleep 2
  done
  
  # Create admin user using localhost exception
  echo "Creating admin user..."
  docker exec mongo mongosh admin --eval 'db.createUser({user: "admin", pwd: "admin", roles: ["root"]})'
  echo "Admin user created successfully!"
fi

echo "✓ Single-node Docker replica set ready!"
echo "Connection URI: mongodb://admin:admin@localhost:27017/?replicaSet=rs0&authSource=admin"
