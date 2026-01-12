## Overview

This docker-compose file runs the full MLDP ecosystem, including the mongodb server, an Envoy load balancer proxy server, and the 4 MLDP services: Ingestion, Query, Annotation, and Ingestion stream. 

To demonstrate the configuration of a static Envoy load balancer for the Ingestion Service, the configuration starts 2 ingestion server instances, it includes a single server instance for each of the other DP services.  The Envoy load balancer is configured to use a round-robin strategy for dispatching incoming ingestion requests.

## Running

Run the scenario using the start script:

```
./start-dp-ecosystem
```

Once the ecosystem is running, any MLDP client can be used to interact with the services on the standard ports (50051 - ingestion, 50052 - query, 50053 - annotation, 50054 - ingestion stream).

To use the Ingestion load balancer, clients must use port 8080 instead of the typical service port, 50051.  To see the load balancer in action, run the TestDataGenerator pointed at port 8080.

You can run the TestDataGenerator outside the docker environment with the default settings, e.g.,
```
/usr/lib/jvm/java-21-openjdk-amd64/bin/java -Ddp.GrpcClient.ingestionConnectString=localhost:8080 com.ospreydcs.dp.service.ingest.utility.TestDataGenerator
```

The Envoy load balancer receives requests on port 8080 and dipatches them to the pool of ingestion servers defined in the envoy.yaml configuration file (which point to the services defined in the docker-compose.yml file via service name).

There is also a script for running the test data generator inside the docker environment against the docker service ecosystem.  The script is in dp-support/bin:

```
./run-test-data-generator.sh
```

Note that when running the docker client, we are overriding the ingestion service hostname to use the docker service name for the Envoy load balancer, e.g., "eco-envoy", on port 8080.

## Stopping

To stop the ecosystem, use docker compose down:

```
docker compose down -v
```