# Data Platform Overview

The Data Platform provides tools for managing the data captured in an experimental research facility, such as a particle accelerator.  The data are used within control systems and analytics applications, and facilitate the creation of machine learning models for those applications.

The Data Platform is agnostic to the source and acquisition of the data.  A project goal is to manage data captured from the [EPICS "Experimental Physics and Industrial Control System"](https://epics-controls.org/), however, use of EPICS is not required.  The Data Platform APIs are generic and can be used from essentially all programming languages and any type of application.

# Data-Platform Repo

The data-platform repo is the top-level repo for the Data Platform project.  The primary objective is to provide an overview for the project with links to the various components, and a single installer for getting all the components up and running.

## Performance requirements

A key requirement of the Data Platform is ingesting data at rates suitable for use in an environment such as a particle accelerator.  One baseline performance goal is to ingest data from 4,000 sources sampling scalar values at a rate of 1 KHz, or 4 million samples per second.

## Components

The core Data Platform contains two primary components, an Ingestion Service and a Query Service.  Each of those services provides an API that can be used directly to build client applications in a variety of programming languages.  Alternatively, we plan to provide higher level libraries for building client applications using languages like Java, Python, and C++.

## Technology stack and ecosystem

A primary technology used building the Data Platform is the [gRPC open-source high-performance remote procedure call (RPC) framework](https://grpc.io/).  As described on [Wikipedia](https://en.wikipedia.org/wiki/GRPC), "this framework was originally developed by Google for use in connecting microservices.  It uses HTTP/2 for transport, protocol buffers as the interface description languages, and provides features such as authentication and bidirectional streaming.  It generates cross-platform client and server bindings for many languages."

The other primary technology element is [MongoDB](https://www.mongodb.com/).  MongoDB is an open source document / NoSQL database management system.  Instead of using tables like a traditional relational database, it manages data in JSON-like documents.  The Ingestion and Query Services utilize MongoDB to store and retrieve data in fulfillment of client API requests.

## Status and milestones

### "datastore" prototype (2022)

A prototype implementation was built focusing on the creation of a general API supporting [ingestion](https://github.com/osprey-dcs/datastore) and [query](https://github.com/osprey-dcs/datastore-service) of heterogeneous data types including scalar, array / table, structure, and image.  Service implementations were created using Java for both the Ingestion and Query Services, as well as libraries for building client applications.  The prototype technology stack included both [InfluxDB](https://www.influxdata.com/) (for time series data) and MongoDB (for metadata).  This prototype did not meet the project goal for ingestion performance.

### datastore web application prototype (2022)

A prototype web application was created using JavaScript React.js and using the gRPC query API.

### technology performance benchmarking (September 2023)

Performance benchmark applications were developed and executed to evaluate candidate technologies for use in the Data Platform implementation in light of the project performance goal stated above.  Benchmarks focused on gRPC for API communication; InfluxDB, MongoDB and MariaDB for database storage; and writing JSON and HDF5 files to disk.  The benchmark results showed that it was likely we could build service implementations meeting our performance requirements by using gRPC for communication and [MongoDB for storing "buckets" of time series data](https://dev.to/hpgrahsl/a-slightly-closer-look-at-mongodb-5-0-time-series-collections-part-1-32m6).

### Data Platform v1.0 (November 2023)
Version 1.0 of the Data Platform includes an initial Java implementation of the Ingestion Service providing a gRPC API and using MongoDB for storing time-series data was built.  It is accompanied by a performance benchmark application that is used at each stage of development to measure performance relative to the project goal.  The initial implementation exceeds our goal by a comfortable margin, but this will continue to be a focus as the project evolves.

### v1.1 (January 2024)
Version 1.1 includes a Java implementation of the Query Service gRPC API, using the MongoDB database managed by the ingestion service to fulfill client query requests.

### v1.2 (February 2024)
Version 1.2 saw changes to the "proto" files defining the gRPC API for the Data Platform to be more consistent and conventional, with corresponding changes to the Java service implementations.

## Data platform todo and roadmap

### v1.3 planned features
  - Initial implementation of an annotation service.  This service will provide an API for creating annotations over previously ingested data.
  - Simple annotation and metadata query APIs to support the web application.
  - Configurable MongoDB collection names.
  - Clean up of data created by benchmark and regression tests.
  - Handling for unary ingestion RPC.

### v1.4 planned features
  - Experiment storing data in MongoDB using protobuf format to avoid unpacking it in the ingestion service and re-packing it in the query service.
  - Ingestion and query handling for arrays, tables, images, structures etc.
  - Ingestion and query handling for irregular sample intervals, list of timestamps

### Features planned for future releases:
  - Ingestion Service features:
    - API for checking the status of individual ingestion requests, and identifying problems in ingested data.
    - API for registering data providers.
    - Mechanism for enforcing consistency for data sources in ingestion.
  - Query Service features:
    - Add authentication / authorization mechanism.
  - Miscellaneous features:
    - add support for exporting data
    - add support for uploading and linking datasets, data provenance
  - Build libraries for developing client applications.  This might include support for building applications with a rolling time window or retrieving data at a fixed interval.
  - Build a new web version of the web application.
  - Perform load testing and address issues that arise.
  - Investigate MongoDB connection pooling and database sharding.
  - Investigate migration of time-series data from MongoDB to HDF5 files.
  - Explore horizontal scaling using an approach such as [Kubernetes](https://kubernetes.io/).
  - Blue sky: build prototype using streaming environment like Apache Kafka?

## Repos

The Data Platform project includes a collection of github repos, including:

- [dp-grpc](https://github.com/osprey-dcs/dp-grpc) - Contains the gRPC API definition for the Data Platform services (in "proto" files).
- [dp-service](https://github.com/osprey-dcs/dp-service) - Contains implementations of the Data Platform services, peformance benchmark applications, and regression and integration tests.
- [dp-support](https://github.com/osprey-dcs/dp-support) - Contains tools for installing, configuring, and managing the Data Platform ecosystem.
- [dp-web-app](https://github.com/osprey-dcs/dp-web-app) - Contains the Data Platform Web Application.
- [dp-benchmark](https://github.com/osprey-dcs/dp-benchmark) - Includes applications built for measuring the performance of some of the candidate technologies we evaluated for use in the Data Platform, with a summary of the results.

# Data Platform Quick Start

This section will help you get the data platform up and running as quickly as possible.

## Preinstallation

- [install Java 16 or 17](https://github.com/osprey-dcs/data-platform#java-installation)

- [install MongoDB version 7, create database user and password](https://github.com/osprey-dcs/data-platform#mongodb-installation)

- [optionally install mongodb-compass](https://github.com/osprey-dcs/data-platform#mongo-express-installation)

## Download and extract data plaform installer

This repo includes an installer that contains everything needed to run the Data Platform.  Navigate to the [most recent data-platform release](https://github.com/osprey-dcs/data-platform/releases/latest) and download the file "data-platform-installer.tar.gz" to the desired installation location (e.g., the user's home directory).  Extract the installer using:

```
tar xvf data-platform-installer.tar.gz
```

## Create data platform environment config file

The dp-support scripts require an environment configuration file in the user's home directory that specifies the location of the data platform installation.  The file must be called ".dp.env" (note the leading "dot" character).  The file contents should look like this (for an installation in the user's home directory):

```
export DP_HOME=~/data-platform
```

If the data-platform installer was extracted in a different location, use the appropriate installation path for DP_HOME.

## Customize config files

The "data-platform/config" directory includes template config files for the installation.  Minimally, you'll need to edit "dp.yml" to include the proper "dbUser" and "dbPassword" for your MongoDB installation.  The included log4j config file sets up logging output to the console and can be customized as desired.

## Start ecosystem processes

The "data-platform/bin" directory includes a set of scripts for managing the data platform ecosystem.  These can be used to quickly get the system up and running.  See the section [running data platform services and applications](https://github.com/osprey-dcs/data-platform/tree/main#dp-support-ecosystem-scripts) for more details about using these scripts.

# Installation Details

## Installation prerequisites

The primary prerequisites for installing the Data Platform are Java and MongoDB.  Mongodb-compass is a GUI for navigating MongoDB databases, and can be extremely useful during development and testing.  Its installation is optional.

### java installation

The Data Platform Java applications are compiled using Java 16, and have been tested with Java 17.  Newer versions of Java will probably work without issue, so please let us know if you test on any of them before we do our own port.  Here are links for installing [Java 16](https://docs.oracle.com/en/java/javase/16/install/overview-jdk-installation.html) or [Java 17](https://docs.oracle.com/en/java/javase/17/install/overview-jdk-installation.html).

### mongodb installation

MongoDB version 7.0.5 is the current reference version for the Data Platform service implementations.  Installation will vary by platform and instructions for doing so should be fairly easy to find.  MongoDB provides [documentation for installing on a variety of platforms](https://www.mongodb.com/docs/manual/administration/install-community/), which is a good place to start.

It is also possible (and relatively simple) to run MongoDB from a docker container.  While probably not appropriate for a production installation or system under heavy load, this approach might be useful for development, evaluation, and other applications.  The [dp-support repo](https://github.com/osprey-dcs/dp-support) includes example scripts for [creating](https://github.com/osprey-dcs/dp-support/blob/main/bin/mongodb-docker-create) and managing a MongoDB docker deployment.

After installing MongoDB, create a user for the data platform applications.  The following example creates an "admin" user (password="admin") with root privileges in the "admin" database.  You can also create a user with privileges scoped only to the "dp" database in MongoDB.

1. start the MongoDB shell
```
mongosh
```
2. switch to "admin" database
```
use admin 
```
3. create admin user with root role (change password, this example uses "admin"!)
```
db.createUser({user: "admin", pwd: "admin", roles: [ { role: "root", db: "admin" } ]})
```
4. exit shell
```
exit
```

### mongodb-compass installation

[Mongodb-compass](https://www.mongodb.com/products/tools/compass) is a GUI application for exploring the contents of a MongoDB database.  It is very useful for administration, test verification, and ad hoc queries.  Here are links for [downloading](https://www.mongodb.com/try/download/compass) and [installing](https://www.mongodb.com/docs/compass/current/install/) compass.  The current compass reference version in the Data Platform installation is 1.42.1.

The [dp-support repo](https://github.com/osprey-dcs/dp-support) includes [a script](https://github.com/osprey-dcs/dp-support/blob/main/bin/mongodb-compass-start) for running mongodb-compass after it has been installed.  The script includes a header with the links above for downloading and installing the application.

## Data platform installation options

There are three main options for installing the Data Platform.  

1. This data-platform repo contains an installer with everything needed to run the Data Platform and is the easiest way to get started.  See the [Quick Start](https://github.com/osprey-dcs/data-platform#data-platform-quick-start) for details on downloading and using the installer.  

2. To learn more about installing the Data Platform in your development environment, see the instructions for [development installation](https://github.com/osprey-dcs/data-platform#development-installation).

3. The [jar installation section](https://github.com/osprey-dcs/data-platform#jar-installation) describes the process for downloading the latest Data Platform jar files.

### development installation

Developer installation consists of cloning the [dp-grpc](https://github.com/osprey-dcs/dp-grpc) and [dp-service](https://github.com/osprey-dcs/dp-service) repos, and adding a project for each to the IDE. The dp-support repo is optional, and the dp-benchmark is probably not useful unless you are interested in performance benchmarks outside the Data Platform).  After cloning the repos, use maven to "install" the dp-grpc and dp-common projects (either from the command line or using your Java IDE).  Then use maven to compile the dp-service project.

To run the ingestion service, execute IngestionGrpcServer.main().  To run the performance benchmark (with the server running), execute BenchmarkStreamingIngestion.main().

There are jUnit tests for the elements of the Data Platform services in dp-service/src/test/java.

### jar installation

In situations where the Data Platform code will be used without the ecosystem support provided by the dp-support repo or for Java development, source code and/or jar files can be installed directly by using the desired github release.  Here are links to the releases page for each repo: [dp-grpc](https://github.com/osprey-dcs/dp-grpc/releases) and [dp-service](https://github.com/osprey-dcs/dp-service/releases).

# Learning More

## Service APIs

The Data Platform service APIs are documented in the [dp-grpc repo](https://github.com/osprey-dcs/dp-grpc).

## Service configuration

Configuration options for the Data Platform services are discussed in the [dp-service repo](https://github.com/osprey-dcs/dp-service).

## Running services and applications

Utilities for managing the Data Platform ecosystem are described in the [dp-support repo](https://github.com/osprey-dcs/dp-support).

## Service implementations

Details about the Data Platform service implementations are provided in the [dp-service repo](https://github.com/osprey-dcs/dp-service).
