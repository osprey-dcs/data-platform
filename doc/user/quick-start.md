# Data Platform Quick Start

This document will help you get the Data Platform up and running as quickly as possible.  The fastest way to get the ecosystem up and running is via Docker.  Installing and running the applications locally allows more customization and probably offers higher performance.  Each approach is described in more detail below.

In either case, it is necessary to 1) download and extract the Data Platform installer and 2) create the environment config file.  Since those steps are common to both approaches for running the Data Platform, they are covered in this section.

### Download and extract the Data Plaform installer

This repo includes an installer that contains everything needed to run the Data Platform.  Navigate to the [most recent data-platform release](https://github.com/osprey-dcs/data-platform/releases/latest) and download the file "data-platform-installer.tar.gz" to the desired installation location (e.g., the user's home directory).  Extract the installer using:

```
tar xvf data-platform-installer.tar.gz
```

### Create Data Platform environment config file

The dp-support scripts require an environment configuration file in the user's home directory that specifies the location of the data platform installation.  The file must be called ".dp.env" (note the leading "dot" character).  The file contents should look like this (for an installation in the user's home directory):

```
export DP_HOME=~/data-platform
```

If the data-platform installer was extracted in a different location, use the appropriate installation path for DP_HOME.



## Data Platform Docker Installation

The fastest and easiest way to run the Data Platform services and applications is using Docker.  After downloading and extracting the installer, and creating the environment config file, you are ready to run the scripts for 1) starting the Data Platform Docker ecosystem and 2) generating test data.  Each is described in more detail below.

These instructions assume that the "docker" and "docker-compose" tools are installed on the host that will be used to run the Data Platform, and that the Data Platform installer is extracted to "~/data-platform".

### Starting the Data Platform ecosystem

Use "docker compose" to start the Data Platform ecosystem, including MongoDB and the Ingestion, Query, Annotation, and Ingestion Stream Services, e.g.:
```
docker compose -f ~/data-platform/docker/docker-compose/mldp-ecosystem/docker-compose.yml -p mldp-ecosystem up -d
```

### Generating test data

Once the ecosystem is up and running, any Data Platform client can be used to interact with the services.  For example, to use Docker to run a Java client application that generates some test data, run the following script:
```
~/data-platform/bin/app-run-docker-test-data-generator
```

This will generate and send some test data to the Ingestion Service for archival.



## Data Platform Local Installation 

### Preinstallation

#### Java 21
[Installing Java 21](./installation.md#java-installation) is required to run the Data Platform services and applications locally.

#### MongoDB
MongoDB is required to run the Data Platform.  The project includes scripts for running MongoDB using Docker.  Otherwise, [MongoDB must be installed and configured locally.](./installation.md#mongodb-installation)

#### MongoDB Compass
MongoDB Compass is an optional application for navigating Mongo databases and their document collections, whether running MongoDB is running via Docker or locally installed.  Here are [notes for installing Compass](./installation.md#mongodb-compass-installation).

### Customize config files

The "data-platform/config" directory includes template config files for the installation.  Minimally, you'll need to edit "dp.yml" to include the proper "dbUser" and "dbPassword" for your MongoDB installation.  The included log4j config file sets up logging output to the console and can be customized as desired.

### Start ecosystem processes

The "data-platform/bin" directory includes a set of scripts for managing the data platform ecosystem.  These can be used to quickly get the system up and running.  Below are some of the basics for getting the ecosystem up and running, including starting the MongoDB database, running the Data Platform services, and running the performance benchmarks.  See the [dp-support repo](https://github.com/osprey-dcs/dp-support) for additional details about the available scripts.

#### manage local mongodb

Assuming you've installed MongoDB as a local package, use the following scripts to start the database and check status via systemctl.

##### start local mongodb
```
data-platform/bin/mongodb-systemctl-start
```

##### check status of local mongodb
```
data-platform/bin/mongodb-systemctl-status
```

#### manage docker mongodb

If you choose to run MongoDB via a Docker container, use the following commands to create the container, start it, and run a database shell (mongosh) against it.

##### create mongodb docker container
```
data-platform/bin/mongodb-docker-create
```

##### start mongodb docker container
```
data-platform/bin/mongodb-docker-start
```

##### create mongodb docker container
```
data-platform/bin/mongodb-docker-create
```

##### run mongosh against mongodb docker container
```
data-platform/bin/mongodb-docker-shell
```

#### run mongodb compass gui
Whether you've installed MongoDB as a local package, or are running it via a Docker container, you can use the Compass GUI to navigate the database contents.  The wrapper script shown below runs the application, and passes a default connection string (assuming the database user and password are "admin", you'll need to edit the connect string in Compass if you've overridden the defaults).
```
data-platform/bin/mongodb-compass-start
```

#### run data platform services

Use the following commands to start the standard Ingestion and Query Services.

##### start ingestion service
```
data-platform/bin/server-ingest-start
```

##### check ingestion service status
```
data-platform/bin/server-ingest-status
```

##### start query service
```
data-platform/bin/server-query-start
```

##### check query service status
```
data-platform/bin/server-query-status
```

##### start annotation service
```
data-platform/bin/server-annotation-start
```

##### check annotation service status
```
data-platform/bin/server-annotation-status
```

#### run data platform performance benchmarks

The Data Platform includes tools for running performance benchmarks against the Ingestion and Query Services.  The benchmarks use non-standard server applications that override the network port number and database name so that data is added to the "dp-benchmark" database.

To run a benchmark, first start the appropriate benchmark server and then run the client application against that server.

##### run ingestion benchmark

Here are the commands for starting the benchmark ingestion server and client applications:

```
data-platform/bin/server-benchmark-ingest-start
```

```
data-platform/bin/app-run-ingestion-benchmark
```

##### run query benchmark

Here are the commands for starting the benchmark query server and client applications:

```
data-platform/bin/server-benchmark-query-start
```

```
data-platform/bin/app-run-query-benchmark
```

#### run sample data generator

The Data Platform includes a utility for generating sample data for use in web application development and demo purposes.  The application generates sample data for one minute and 4,000 signals each sampled at 1 KHz.  The data generator uses the standard "dp" database and data is created with a fixed date/time starting at "2023-10-31T15:51:00.000+00:00".  Happy Halloween...

```
data-platform/bin/app-run-test-data-generator
```
