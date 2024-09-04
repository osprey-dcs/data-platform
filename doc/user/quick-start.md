# Data Platform Quick Start

This section will help you get the data platform up and running as quickly as possible.

## Preinstallation

- [install Java 21](./installation.md#java-installation)

- [install MongoDB version 7, create database user and password](./installation.md#mongodb-installation)

- [optionally install mongodb-compass](./installation.md#mongodb-compass-installation)

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

The "data-platform/bin" directory includes a set of scripts for managing the data platform ecosystem.  These can be used to quickly get the system up and running.  Below are some of the basics for getting the ecosystem up and running, including starting the MongoDB database, running the Data Platform services, and running the performance benchmarks.  See the [dp-support repo](https://github.com/osprey-dcs/dp-support) for additional details about the available scripts.

### manage local mongodb

Assuming you've installed MongoDB as a local package, use the following scripts to start the database and check status via systemctl.

#### start local mongodb
```
data-platform/bin/mongodb-systemctl-start
```

#### check status of local mongodb
```
data-platform/bin/mongodb-systemctl-status
```

### manage docker mongodb

If you choose to run MongoDB via a Docker container, use the following commands to create the container, start it, and run a database shell (mongosh) against it.

#### create mongodb docker container
```
data-platform/bin/mongodb-docker-create
```

#### start mongodb docker container
```
data-platform/bin/mongodb-docker-start
```

#### create mongodb docker container
```
data-platform/bin/mongodb-docker-create
```

#### run mongosh against mongodb docker container
```
data-platform/bin/mongodb-docker-shell
```

### run mongodb compass gui
Whether you've installed MongoDB as a local package, or are running it via a Docker container, you can use the Compass GUI to navigate the database contents.  The wrapper script shown below runs the application, and passes a default connection string (assuming the database user and password are "admin", you'll need to edit the connect string in Compass if you've overridden the defaults).
```
data-platform/bin/mongodb-compass-start
```

### run data platform services

Use the following commands to start the standard Ingestion and Query Services.

#### start ingestion service
```
data-platform/bin/server-ingest-start
```

#### check ingestion service status
```
data-platform/bin/server-ingest-status
```

#### start query service
```
data-platform/bin/server-query-start
```

#### check query service status
```
data-platform/bin/server-query-status
```

#### start annotation service
```
data-platform/bin/server-annotation-start
```

#### check annotation service status
```
data-platform/bin/server-annotation-status
```

### run data platform performance benchmarks

The Data Platform includes tools for running performance benchmarks against the Ingestion and Query Services.  The benchmarks use non-standard server applications that override the network port number and database name so that data is added to the "dp-benchmark" database.

To run a benchmark, first start the appropriate benchmark server and then run the client application against that server.

#### run ingestion benchmark

Here are the commands for starting the benchmark ingestion server and client applications:

```
data-platform/bin/server-benchmark-ingest-start
```

```
data-platform/bin/app-run-ingestion-benchmark
```

#### run query benchmark

Here are the commands for starting the benchmark query server and client applications:

```
data-platform/bin/server-benchmark-query-start
```

```
data-platform/bin/app-run-query-benchmark
```

### run sample data generator

The Data Platform includes a utility for generating sample data for use in web application development and demo purposes.  The application generates sample data for one minute and 4,000 signals each sampled at 1 KHz.  The data generator uses the standard "dp" database and data is created with a fixed date/time starting at "2023-10-31T15:51:00.000+00:00".  Happy Halloween...

```
data-platform/bin/app-run-test-data-generator
```
