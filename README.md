# Data Platform Quick Start

This section will help you get the data platform up and running as quickly as possible.  If you are looking for a full project overview with other installation options, skip to the next section!

## preinstallation

- [install Java 16 or 17](https://github.com/osprey-dcs/dp-support#java-installation)
- [install MongoDB version 6, create database user and password](https://github.com/osprey-dcs/dp-support#mongodb-installation)
- [optionally install mongo-express](https://github.com/osprey-dcs/dp-support#mongo-express-installation)

## clone dp-support repo

This dp-support repo includes everything needed to run the data platform, including jar files for the Java server applications, configuration files, and scripts to manage the ecosystem.  To clone the repo, change to the desired parent directory for the installation, and use the following command:

```
git clone https://github.com/osprey-dcs/dp-support.git
```

Cloning the github repo is a quick way to install the data platform for evaluation purposes, or to jump start a development, test, or production system.  Create a fork of the repo to track your changes to the scripts, make an official branch of the repo if appropriate, or break the connection with git after cloning to go your own direction.

## customize config files

The "dp-support/config" directory includes template config files for the installation.  Minimally, you'll need to edit "dp-ingest.yml" to include the proper "dbUser" and "dbPassword" for your MongoDB installation.  The included log4j config file sets up logging output to the console and can be customized as desired.

## start ecosystem processes

The "dp-support/bin" directory includes a set of scripts for managing the data platform ecosystem.  These can be used to quickly get the system up and running.  Relevant scripts include:

### MongoDB scripts
- _mongodb-start_: Starts standard MongoDB installation using systemctl.
- _mongodb-stop_: Stops MongoDB.
- _mongodb-status_: Checks MongoDB status.
- _mongodb-enable_: Enables MongoDB auto-start after reboot.

### data platform server scripts
- _server-start-ingest_: Starts the ingestion server application using the util-pm-start script.
- _server-stop-ingest_: Stops the running ingestion server application using the util-pm-stop script.
- _server-status-ingest_: Checks the status of the ingestion server application using util-pm-status.

### other data platform applications
- _app-run-ingestion-benchmark_: Runs the data platform ingestion service performance benchmark application against the running ingestion server.  Displays an error if the server is not running.  Uploads one minute's data for 4,000 data sources sampled at 1 KHz.  This is a good way to test the installation.  Confirm that data is written to MongoDB by the ingestion server.

## next steps

Read the relevant sections of the Data Platform documentation to learn about options for uploading and retrieving data.

# Data Platform Overview

This repo includes support for installing and managing the Data Platform and surrounding ecosystem.

The Data Platform provides tools for managing the data captured in an experimental research facility, such as a particle accelerator.  The data are used within control systems and analytics applications, and facilitate the creation of machine learning models for those applications.

The Data Platform is agnostic to the source and acquisition of the data.  A project goal is to manage data captured from the [EPICS "Experimental Physics and Industrial Control System"](https://epics-controls.org/), that use of EPICS is not required.  The Data Platform APIs are generic and can be used from essentially all programming languages and any type of application.

## performance

A key requirement of the Data Platform is ingesting data at rates suitable for use in an environment such as a particle accelerator.  One baseline performance goal is to ingest data from 4,000 sources sampling at a rate of 1 KHz, or 4 million samples per second.

## data platform components

The core Data Platform contains two primary components, an Ingestion Service and a Query Service.  Each of those services provides a gRPC-based API that can be used directly to build client applications in a variety of programming languages.  Alternatively, we plan to provide higher level libraries for building client applications using languages like Java, Python, and C++.

## technology stack and ecosystem

A primary technology used building the Data Platform is the [gRPC open-source high-performance remote procedure call (RPC) framework](https://grpc.io/).  As described on [Wikipedia](https://en.wikipedia.org/wiki/GRPC), "this framework was originally developed by Google for use in connecting microservices.  It uses HTTP/2 for transport, protocol buffers as the interface description languages, and provides features such as authentication and bidirectional streaming.  It generates cross-platform client and server bindings for many languages."

The other primary technology element is [MongoDB](https://www.mongodb.com/).  MongoDB is an open source document / NoSQL database management system.  Instead of using tables like a traditional relational database, it manages data in JSON-like documents.  The Ingestion and Query Services utilize MongoDB to store and retrieve data in fulfillment of client API requests.

## status

- A prototype implementation was built focusing on the creation of a general API supporting [ingestion](https://github.com/osprey-dcs/datastore) and [query](https://github.com/osprey-dcs/datastore-service) of heterogeneous data types including scalar, array / table, structure, and image.  Service implementations were created using Java for both the Ingestion and Query Services, as well as libraries for building client applications.  The prototype technology stack included both [InfluxDB](https://www.influxdata.com/) (for time series data) and MongoDB (for metadata).  This prototype did not meet the project goal for ingestion performance.
- A prototype web application was created using JavaScript React.js and using the gRPC query API.
- Performance benchmark applications were developed and executed to evaluate candidate technologies for use in the Data Platform implementation in light of the project performance goal stated above.  Benchmarks focused on gRPC for API communication; InfluxDB, MongoDB and MariaDB for database storage; and writing JSON and HDF5 files to disk.  The benchmark results showed that it was likely we could build service implementations meeting our performance requirements by using gRPC for communication and [MongoDB for storing "buckets" of time series data](https://dev.to/hpgrahsl/a-slightly-closer-look-at-mongodb-5-0-time-series-collections-part-1-32m6).
- An initial Java implementation of the Ingestion Service providing a gRPC API and using MongoDB for storing time-series data was built.  It is accompanied by a performance benchmark application that is used at each stage of development to measure performance relative to the project goal.  The initial implementation exceeds our goal by a comfortable margin, but this will continue to be a focus as the project evolves.

## todo and roadmap

- The next step in development is to build an initial implementation of the Query Service that provides a gRPC API and uses the MongoDB schema created by the Ingestion Service to fulfill client query requests.
- The initial implementation of the Ingestion Service supports scalar data types including float, integer, string, and boolean data.  Additional work is required to support arrays/tables, structures, and images.
- Ingestion Service features:
  - Add an API for checking the status of individual ingestion requests, and identifying problems in ingested data.
  - Add an API for registering data providers.
  - The initial Ingestion Service implementation is optimized to handle data with a regular sampling interval.  We need to add support for ingestion data with irregular sampling (or do we?).
  - Evaluate the requirements for updating metadata, and make changes to Ingestion Service implementation and database schema as appropriate.
- Query Service features:
  - Add authentication / authorization mechanism.
- Miscellaneous features:
  - add support for post-ingestion annotation of data
  - add support for exporting data
  - add support for uploading and linking datasets, data provenance
- Build libraries for developing client applications.  This might include support for building applications with a rolling time window or retrieving data at a fixed interval.
- Build a new web version of the web application.
- Perform load testing and address issues that arise.
- Potential directions include migration of time-series data from MongoDB to HDF5 files, storing protobuf data directly in MongoDB or data files, and horizontal scaling using an approach such as [Kubernetes](https://kubernetes.io/).

## repos

- [dp-grpc](https://github.com/osprey-dcs/dp-grpc) - Includes the gRPC API definition for the Ingestion and Query Services (in "proto" files).
- [dp-common](https://github.com/osprey-dcs/dp-common) - Includes features in common to both the Ingestion and Query Services, such as the configuration mechanism.
- [dp-ingest](https://github.com/osprey-dcs/dp-ingest) - Includes the initial implementation of the Ingestion Service, as well as the performance benchmark application.
- [dp-support](https://github.com/osprey-dcs/dp-support) - (this repo) Includes tools for installing, configuring, and managing the Data Platform ecosystem.
- [dp-benchmark](https://github.com/osprey-dcs/dp-benchmark) - Includes the performance benchmark applications, not part of the Data Platform.

# Data Platform Installation

## installation prerequisites

The primary prerequisites for installing the Data Platform are Java and MongoDB.  Mongo-express is a web portal for navigating a MongoDB platform, and can be extremely useful during development and testing, but it's installation is optional.

### java installation

The Data Platform Java applications are compiled using Java 16, and have been tested with Java 17.  Newer versions of Java will probably work without issue, so please let us know if you test on any of them before we do our own port.  Here are links for installing [Java 16](https://docs.oracle.com/en/java/javase/16/install/overview-jdk-installation.html) or [Java 17](https://docs.oracle.com/en/java/javase/17/install/overview-jdk-installation.html).

### mongodb installation

MongoDB version 6 is required to use the Data Platform.  Installation will vary by platform and instructions for doing so should be fairly easy to find.  For installing on Ubuntu Linux 22.04 and similar platforms, I've found [these instructions](https://tecadmin.net/how-to-install-mongodb-on-ubuntu-22-04/) to be helpful.

It is also possible (and relatively simple) to run MongoDB from a docker container.  While probably not appropriate for a production installation or system under heavy load, this approach might be useful for development, evaluation, and other applications.  The [official site includes instructions for doing so](https://www.mongodb.com/compatibility/docker).

After installing MongoDB, create a user for the data platform applications.  The following example creates an "admin" user in the "admin" database.  You can also create a user with privileges scoped only to the "dp" database in MongoDB.

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

### mongo-express installation

This tool is a bit quirky, and probably not appropriate for a production MongoDB installation.  There is some documentation on the [github repo](https://github.com/mongo-express/mongo-express), but I encountered some odd issues in installation, namely that I couldn't get the latest version working.  It is also necessary to tweak the config file (/usr/local/lib/node_modules/mongo-express/config.js by default) to get the installation working with your MongoDB install.

Here is a note about installing a previous version:

> Installation according to the instructions on the github readme (link 1) failed, using "npm install -g mongo-express".  (Link 2) recommended installing an older version, which seems to solve the problem. "npm i -g mongo-express@1.0.0"

Regarding configuration, if user/password authentication is enabled on MongoDB, this needs to be reflected in the mongo-express configuration.  Adding the connectionString explicitly at the top of the config.js file (including the username and password) seems to be the easiest thing to do, e.g.,

```
let mongo = {
  <snip>
  connectionString: 'mongodb://user:password@localhost:27017/',
  <snip>
};
```

I also like to enable "admin" mode, which shows everything in the database.  This is done in the section shown below, by setting "admin: true":

```
module.exports = {
  mongodb: {
    <snip>
    admin: true,
    <snip>
```

## data platform installation options

There are three main options for installing the Data Platform.  

1. This dp-support repo contains everything needed to run the Data Platform and is the easiest way to get started.  See the [Quick Start](https://github.com/osprey-dcs/dp-support#data-platform-quick-start) for details on installing and using this repo.  

2. To learn more about installing the Data Platform in your development environment, see the instructions for [development installation](https://github.com/osprey-dcs/dp-support#development-installation).

3. The [jar installation] section describes the process for downloading the latest Data Platform jar files.

### development installation

Developer installation consists of cloning the first 3 github repos listed above. The dp-support repo is optional, and the dp-benchmark is probably not useful unless you are interested in performance benchmarks outside the Data Platform).  After cloning the repos, use maven to "install" the dp-grpc and dp-common projects (either from the command line or using your Java IDE).  Then use maven to compile the dp-ingest project.

There is no requirement for the directory structure used, however, the dp-support repo will probably make some assumptions about the directory structure for a deployed system.  I'm using the convention of a root deployment directory "~/dp" with subdirectories "~/dp/dp-support" (where the dp-support repo is cloned), and "~/dp/dp-java" (where the 3 java repos are cloned).  This will probably be reflected in the scripts and utilites created in dp-support.

To run the ingestion service, execute IngestionGrpcServer.main().  To run the performance benchmark (with the server running), execute IngestionPerformanceBenchmark.main().

There are jUnit tests for the elements of the service in dp-ingest/src/test/java.

### jar installation

In situations where the Data Platform code will be used without the ecosystem support provided by this dp-support repo or for Java development, source code and/or jar files can be installed directly by using the desired github release.  Here are links to the releases page for each repo: [dp-grpc](https://github.com/osprey-dcs/dp-grpc/releases), [dp-common](https://github.com/osprey-dcs/dp-common/releases), and [dp-ingest](https://github.com/osprey-dcs/dp-ingest/releases).

# Configuring and Running the Data Platform

## service configuration

### default config file
The default configuration file for the Ingestion Service is in "dp-ingest/src/main/resources/application.yml".  For now, I've tried to keep the configuration minimal.  The contents are as follows:

```
GrpcServer:
  port: 50051

MongoHandler:
  numWorkers: 7
  dbHost: localhost
  dbPort: 27017
  dbUser: admin
  dbPassword: admin

Benchmark:
  grpcConnectString: "localhost:50051"
```

The settings are grouped by subcomponent of the Ingestion Service: GrpcServer, MongoHandler, and Benchmark.  The setting names are pretty self explanatory.  The setting MongoHandler.numWorkers controls the number of worker threads created within the handler framework for simultaneously writing ingested data to MongoDB.  I've had pretty good results using a value of 7 on my development system, but this parameter might take some tuning on other systems to get the best performance.

The default settings are probably reasonable for most development systems, though you'll want to override the MongoDB uername and password to match your configuration (or make them both "admin").  Options for overriding are discussed below.

### overriding config file

The default configuration file can be overridden in two different ways, by specifying an alternative file on either the command line used to start the application, or as an environment variable.

To specify an alternative on the command line, add a VM option (e.g., on the command line BEFORE the class name) like the following: "-Ddp.config=/path/to/config/override.yml".

To specify an alternative via an envoronment variable, define a variable in the environment "DP.CONFIG=/path/to/config/override.yml" before running the Ingestion Service application.

### overriding individual configuration properties

In addition to overriding the default config file, individual configuration settings can be overridden on the command line.  To do so, use a VM option (in the java command line BEFORE the class name), prefixing the configuration setting name with "dp.".  For example, to override the gRPC port, use "-Ddp.GrpcServer.port=50052".

## running data platform services

### running the ingestion server application

To run the ingestion server using the dp-support ecosystem scripts in "dp-support/bin", use:
```
server-start-ingest
```

Here is the Java command line to run the server directly (update file paths as appropriate for your installation):
```
java -Ddp.config=../config/dp-ingest.yml -Dlog4j.configurationFile=../config/log4j2.xml -jar ../lib/dp-ingest.jar
```

### running the ingestion performance benchmark application

To run the ingestion performance benchmark application using the dp-support ecosystem scripts in "dp-support/bin", use:
```
app-run-ingestion-benchmark
```

Here is the Java command line to run the application directly (update file paths as appropriate for your installation):
```
java -Ddp.config=../config/dp-ingest.yml -Dlog4j.configurationFile=../config/log4j2.xml -cp ../lib/dp-ingest.jar com.ospreydcs.dp.ingest.benchmark.IngestionPerformanceBenchmark
```

# Data Platform API

## API overview

The Data Platform uses the [gRPC remote procedure call (RPC) framework](https://grpc.io/) to provide the API for its Ingestion and Query Services.  Support for bulding gRPC clients and servers is provided for[many programming languages](https://grpc.io/docs/languages/).

The gRPC framework uses [Google's Protocol Buffers](https://protobuf.dev/overview) for serializing structured data.  The API is specified in text files with a ".proto" extension with definitions of both protocol buffer data structures and services.  The service definition includes the RPC methods supported by the service with method parameters and return types.

The Data Platform API includes "proto" files for both the Ingestion and Query Services that define the RPC methods and data structures specific to those services.  They both utilize a third file, "common.proto" that defines data structures common to both APIs.  The "proto" files defining the Data Platform API are contained in the [dp-grpc repo](https://github.com/osprey-dcs/dp-grpc).  The Ingestion and Query Service APIs are discussed in more detail below, preceded by a description of the service proto files and relevant conventions.

## service proto file structure and conventions

The service "proto" files, "ingestion.proto" and "query.proto" use a similar file structure and naming conventions.

Each file imports the file "common.proto" which defines data structures in common to both services.

Each proto file includes a "service" definition block that defines the service's RPC method interface including method parameters and return types.

The remainder of each file includes data structures specific to the service API.  The "most important" data structures are listed first.

The primary naming convention concerns the parameters and return types for the RPC methods.  In general, method parameters are bundled into a single gRPC "message" (data structure) with a name that includes the method name.  Likewise for the method return type.  In cases where it is appropriate to use the same data structure for method parameters or return value for multiple methods, we do our best to indicate that in the data structure names.  Below are a simple example and then one that is a bit more complex.

A simple example is the Ingestion Service method "registerProvider()".  The method parameters are bundled in a message data structure called "RegisterProviderRequest".  The method returns the message type "RegisterProviderResponse".

A more complex example is the Ingestion Service methods "streamingIngestion()" and "unaryIngestion()".  The method parameters to each RPC are bundled in the message type "IngestionRequest".  The method return type is "IngestionResponse".

## ingestion service API

The Ingestion Service API is defined in the dp-grpc repo's [ingestion.proto](https://github.com/osprey-dcs/dp-grpc/blob/main/src/main/proto/ingestion.proto) file.  The strcuture and naming conventions used within the file are discussed above.

### ingestion service API RPC methods

#### registerProvider()

```
rpc registerProvider (RegisterProviderRequest) returns (RegisterProviderResponse);
```

The provider registration API is not yet implemented.  For now, ingestion clients should send a unique integer identifier on ingestion requests to distinghuish provider.

#### streamingIngestion()

```
rpc streamingIngestion (stream IngestionRequest) returns (stream IngestionResponse);
```

This is the primary method for data ingestion.  It is a bidirectional streaming RPC method.  It accepts a stream of *IngestionRequest* messages, and returns a stream of *IngestionResponse* messages, one for each request.

##### streamingIngestion() inputs

Each *IngestionRequest* message sent in the input stream contains a *DataTable* object to be ingested, along with some descriptive attributes.  These data structures are described in more detail below.

##### streamingIngestion() processing

The Ingestion Service performs initial validation on each request in the stream, and replies immediately with *IngestionResponse* message  indicating acknowledgement for a valid request, or rejection of an invalid one.  The request is then added to a queue for ingestion handling.

The ingestion handling of each request in the stream is performed asynchronously.  The Ingestion Service writes data from the request to the "buckets" collection in MongoDB, adding one document to the bucket for each "column" of data in the request.

A separate MongoDB "requestStatus" collection is used to note the processing status of each request, with a document for each handled request.  The collection is keyed by the *clientRequestId* specified in the *IngestionRequest*.  This collection can be used by an administrative monitoring process to detect and notify about errors in the ingestion process.

More details about the MongoDB schema for time series data, metadata, and request status can be found in the appendix of this document.

##### streamingIngestion() outputs

The method returns a stream of *IngestionResponse* messages, one per request.  Each response includes providerId and clientRequestId for use by the client in mapping to the request object.  The response message only indicates if validation succeeded or failed.  Because ingestion handling is performed asynchronously, the MongoDB "requestStatus" collection must be used to determine the success or failure of individual requests.  The TODO list includes a task for building an API to facilitate status queries.

#### unaryIngestion()

This API is not yet implemented.  It is anticipated that the behavior will be exactly the same as for the *streamingIngestion()* method, except that the method supports sending a single request and receiving a single response.  The response and processing performed will be the same as for the streaming case.

### ingestion service API data structures

Primary data structures for the Ingestion Service API are detailed below.  See  [ingestion.proto](https://github.com/osprey-dcs/dp-grpc/blob/main/src/main/proto/ingestion.proto) and  [common.proto](https://github.com/osprey-dcs/dp-grpc/blob/main/src/main/proto/common.proto) for definitions of secondary data structures.

#### IngestionRequest

```
message IngestionRequest {
  uint32 providerId = 1;
  string clientRequestId = 2;
  Timestamp requestTime = 3;
  repeated Attribute attributes = 4;
  EventMetadata eventMetadata = 5;
  DataTable dataTable = 6;
}
```

This is the request data structure for the two data ingestion API methods.

* providerId: (required) Unique integer identifier for provider clients.  There is a TODO list task to add an API for registering providers with metadata.  For now, the client must use a unique integer to identify each provider that it wants to distinguish.

* clientRequestId: (required) An identifier provided by the client to distinguish requests sent by a given provider.

* requestTime: (required) Time that request was generated.  Required for analytics.

* attributes: (optional) List of key/value metadata tags.

* eventMetadata: (optional) Event-related metadata.

* dataTable: (required) Contains the data to be ingested.

#### EventMetadata

```
message EventMetadata {
  Timestamp eventTimestamp = 1;
  string eventDescription = 2;
}
```

This structure encapsulates metadata about an event with which the *IngestionRequest* data are associated.

* eventTimestamp: The time of the event, such as a trigger or synchronization time.

* eventDescription: Textual description of the event.

#### DataTable

```
message DataTable {
  DataTimeSpec dataTimeSpec = 1;
  repeated DataColumn dataColumns = 2;
}
```

Contains the data to be ingested for an *IngestionRequest*.

* dataTimeSpec: Contains details about the timestamps for the data columns.  Supports specifying both fixed and irregular sample intervals, though currently only the fixed interval is supported.

* dataColumns: A list of column objects, each of which contains a column name and list of data values.

#### DataTimeSpec

```
message DataTimeSpec {
  oneof value_oneof {
    FixedIntervalTimestampSpec fixedIntervalTimestampSpec = 1;
    TimestampList timestampList = 2;
  }
}
```

Supports two different approaches for specifying the timestamps for the corresponding column data.  *FixedIntervalTimestampSpec* is used for a fixed sampling interval, and an explicit list of *Timestamp* objects is provided for an inreggular sampling interval.

#### FixedIntervalTimestampSpec

```
message FixedIntervalTimestampSpec {
  Timestamp startTime = 1;
  uint64 sampleIntervalNanos = 2;
  uint32 numSamples = 3;
}
```

Used to specify timestamp details for an *IngestionRequest* with a fixed sample interval.

* startTime: Specifies timestamp for first data value in each column of the request.

* sampleIntervalNanos: Specifies the sampling frequency in nanoseconds for subsequent data values in each column.

* numSamples: Specifies the number of data values provided in each column.


#### DataColumn

```
message DataColumn {
  string name = 1;
  repeated DataValue dataValues = 2;
}
```

Contains the data for a particular column in the request.

* name: Column name.

* dataValues: List of *DataValue* objects, one for each column data value.

#### DataValue

```
message DataValue {

  oneof value_oneof {
    string stringValue = 1;             // String value
    double floatValue = 2;              // floating point value
    uint64 intValue = 3;                // integer value
    bytes byteArrayValue = 4;           // byte array value
    bool booleanValue = 5;              // boolean value
    Image image = 6;                    // image value
    Structure structureValue = 7;      // structure value
    Array arrayValue = 8;              // Array value
  }
```

Contains a single column data value.  Uses the gRPC "oneof" mechanism to specify column data values of heterogeneous types.  Each supported data type is enumerated.  One implication of this approach is that it allows a single column to contain values with different data types.  Currently the Ingestion Service will reject a request containing columns whose data includes more than one data type.  That restriction can be removed if this is deemed to be a useful feature.  It's not a simple change however, as it would be complicated to map the Java data structure to a MongoDB BSON document.

#### IngestionResponse

```
message IngestionResponse {

  uint32 providerId = 1;
  string clientRequestId = 2;
  ResponseType responseType = 3;
  Timestamp responseTime = 4;

  oneof details_oneof {
    AckDetails ackDetails = 10;
    RejectDetails rejectDetails = 11;
  }
}
```

Encapsulates a response from the Ingestion Service to an individual *IngestionRequest*.  Each request in the *streamingIngestion()* input stream receives an *IngestionResponse* in the output stream.

* providerId: Echos providerId specified in the request.

* clientRequestId: Echos clientRequestId specified in the request.

* responseType: Uses *ResponseType* enum to specify the type of response, either ACK or REJECT.  Note that an ACK response doesn't necessarily mean that ingestion is successful, only that the request passed validation that it was properly formed.  Ingestion is performed asynchronously and the final disposition of the request is noted in the MongoDB "requestStatus" collect, which contains a single status document per *IngestionRequest* that is processed by the ingestion handler.  A REJECT response indicates that a request is not properly formed.

* responseTime: Timestamp that response is generated.

* details: Uses gRPC "oneof" mechanism to include either *AckDetails* or *ResponseDetails* depending on type of response.  *AckDetails* includes the number of rows and columns specified in the request, which can be used by the client for error checking.  *RejectDetails* includes a message and enum indicating reason for rejection.

### ingestion service API client examples

For now, see the ingestion performance benchmark application [IngestionPerformanceBenchmark](https://github.com/osprey-dcs/dp-ingest/blob/main/src/main/java/com/ospreydcs/dp/ingest/benchmark/IngestionPerformanceBenchmark.java). *prepareIngestionRequest()* demonstrates building an *IngestionRequest* in Java.  *sendStreamingIngestionRequest()* demonstrates calling the bidirectional streaming API *streamingIngestion()*, including creating a response stream observer, RPC invocation, and result handling.

TODO: develop this section further to contain direct examples.

## query service API

TODO (for now, see [query.proto](https://github.com/osprey-dcs/dp-grpc/blob/main/src/main/proto/query.proto))

# Appendix and Technical Details

## data platform developer notes

### development milestones

#### July 2023: performance benchmarking of gRPC communication and persistence technology alternatives

##### overview

A primary performance goal for the re-implemented data platform is an ingestion service implementation handling scalar data types (float, integer, string, and boolean) that captures data for 4,000 data sources at a sampling rate of 1 KHz (or 4M scalar values/second).

Performance benchmarks were developed to investigate the performance of technologies used in the initial Ingestion Service prototype implementation (gRPC, InfluxDB, and MongoDB), as well as some alternatives including MariaDB as well as HDF5 and JSON file storage.  These benchmarks focus only on ingestion performance, a follow up study will look at query performance.

Though the Ingestion Service manages both time series data and metadata, the performance benchmarks focus on storing time series data since it is a much more significant technical challenge.

A primary goal for each of the benchmarks is to avoid measuring the time for any processing beyond transmitting data (in the case of the gRPC benchmark) and storing data (for the persistence technologies).  To that end, the benchmarks applications create static data for testing before the performance measurement begins.

To the extent possible for the persistence technology benchmarks, I tested saving time series data both storing individual points and batching the points into "buckets", where a database record or file is created that contains a set of data values corresponding to a specific time range.  I didn't test both approaches for all the technologies, e.g., InfluxDB only stores individual points, and I only tested writing bucketed data to HDF5 and JSON files because writing files containing only an individual point doesn't make much sense.

All benchmarks follow the same general pattern:

* Create batches of data for use in the benchmark where each batch is a list of objects appropriate for the particular test (tables of double values for gRPC, "line protocol" strings for InfluxDB, Bson documents for MongoDB, Json strings for JSON files, and Java Pojos for HDF5 and MariaDB).

* Create thread pool tasks to perform the work to be measured by the benchmark by processing a batch of items (e.g., insert records to database, write data to files, transmit data from client to server).

* Run an individual benchmark scenario by creating thread pool and invoking tasks to process batches of objects, measuring duration of scenario, specifying batch size for each task, number of threads for thread pool, and data dimensions.

* Run an experiment to vary settings like batch size and number of threads for fixed data dimensions to find the "optimal" settings.

The github repo [dp-benchmark](https://github.com/osprey-dcs/dp-benchmark) contains the code for the performance benchmarks.

##### results summary

| benchmark description            | result (values / sec)  |
| -------------------------------- | ---------------------- |
| gRPC network communication       | 22M to 33M             |
| time series, bucket - HDF5 large | 68M - 77M              |
| time series, bucket - JSON files | 38M - 47M              |
| time series, bucket - MongoDB    | 7M - 11M               |
| time series, bucket - MariaDB    | 4.5M - 5.5M            |
| time series, bucket - HDF5 small | 1.3M - 2.4M            |
| time series, points - InfluxDB   | 750K - 940K            |
| time series, points - MongoDB    | 360K - 410K            |
| time series, points - MariaDB    | 140K - 162K            |

Each of the individual performance benchmarks is discussed in more detail below.

##### gRPC


Benchmark results showed that gRPC communication provided ample headroom beyond the project performance requirements, 22M - 33M values/second.

The gRPC performance benchmark is located in the [grpc directory](https://github.com/osprey-dcs/dp-benchmark/tree/main/src/main/java/com/ospreydcs/dp/benchmark/grpc) and includes Java client and server code.  The proto files are located in the [proto directory](https://github.com/osprey-dcs/dp-benchmark/tree/main/src/main/proto).

The [BenchmarkServer](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/grpc/BenchmarkServer.java) implements the service API defined in the "ingestion.proto" file.  The main method relevant to the benchmark is the implementation of *streamingIngestion()*.  It handles an ingestion request stream, performing simple validation on each request and sending a response for each request that echos the number of rows and columns in the request.

The [BenchmarkClient](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/grpc/BenchmarkClient.java).  Its *main()* method calls *multithreadedStreamingIngestionScenario()* to execute the performance benchmark.  It creates a single gRPC request message that is sent repeatedly to the server (to avoid creating a new request message inside the loop where we are measuring performance).

It creates an *ExecutorService* with a fixed size thread pool of the specified thread count.  It creates a task for each thread that sends the specified number of requests, and executes the tasks via the executor service.

The method measures and reports performance statistics as values/second and MB/second.

##### InfluxDB

InfluxDB, used in the prototype implementation for storing time series data, performed well in the benchmark but topped out at about 1M values/second (using the core community product without scaling).

We used the "community version" for performance testing, because our user base is not willing to pay annual licensing fees for the "enterprise version", and it wouldn't make sense for us to do the equivalent custom work to scale the community product.

The InfluxDB benchark is contained in the file [InfluxDbBenchmark](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/InfluxDbBenchmark.java).

The benchmark includes tests for writing data to InfluxDB as points, "line protocol" (a proprietary Influx format), and Java POJO.  The tests also covered using both the blocking and non-blocking Influx "write API".  The best performance was obtained using the blocking write API to write line protocol records.

The *main()* method creates an InfluxDB bucket for the test, writes some data to initialize the data structures for the bucket (which seemed to have a big impact if done while measuring performance), and calls *benchmarkMultithreadedWrite()* to run the performance benchmark.

That method generates a list of batches of line protocol records, creates an ExecutorService with a fixed size thread pool of the specified size, generates a list of tasks with a task to write each batch of line protocol records to InfluxDB, and then measures and reports the time to execute those tasks in the thread pool.

The *main()* method then checks the size of the InfluxDB bucket to verify that the records were written to the database and removes the bucket.

##### MariaDB

MariaDB, a relational database platform alternative, performed well in the benchmark for storing time series data, with a performance range of 4.5M to 5.5M values/second for ingesting "bucketed" time series data.  The test also covered writing individual samples as rows to a database table, which ranged in performance from 140K to 160K values/second.

The MariaDB benchmark is in [MariaDbBenchmark](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/MariaDbBenchmark.java).

The *main()* method creates a database for the test (dropping the existing one, if any), creates a new database with appropriate tables, and calls *experimentCreatePvTimeSeriesDataSqlJson()* to execute the peformance benchmark.

MariaDB doesn't have a built in way to deal with time series data "buckets", so we used a database table with a string column whose value is a JSON segment containing the array of data points for the bucket.  There is probably/maybe a better way to do this.

*experimentCreatePvTimeSeriesDataSqlJson()* sweeps arrays of parameters for JSON bucket batch size and number of threads, and calls *scenarioCreatePvTimeseriesDataSqlJson()* to execute each scenario in the experiment.  It displays the results of each scenario executed, highlighting the best and worst performance.

*scenarioCreatePvTimeseriesDataSqlJson()* creates a database table for the time series data (with JSON column for bucket of data), builds an index on that table (to see how that impacts ingestion performance), creates a list of batches of JSON time series data (using a utility method from the MongoDB BSON framework), creates a task for writing each batch of JSON buckets to MariaDB, creates an ExecutorService with a fixed size thread pool of specified size, and uses the executor service to execute the tasks.  It verifies that the correct number of rows is inserted, and measures performance and returns the results back to the experiment driver method.

##### MongoDB

For MongoDB, we developed performance benchmarks for storing time series data as individual points, as well as using "bucketed time series data" (storing a collection of points in a single MongoDB "document").  Using the bucketed data approach showed performance exceeding the project performance goal by a comfortable margin, in the range of 7M to 10M values/second.  The best performance was obtained using the MongoDB "Sync Driver".  Tests were also performed using the async "reactive streams driver".

The tests using the MongoDB Sync Driver are contained in [MongoDbSyncBenchmark](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/MongoDbSyncBenchmark.java).  

The *main()* method creates a client database connection, and calls *benchmarkCreatePvTimeseriesDataExperimentBucket()* to perform the benchmark experiment.  That method sweeps values for batch size and number of threads, and calls *benchmarkCreatePvTimeseriesDataBucket()* to execute a scenario for each combination of parameters, displaying the results for each scenario and highlighting the best and worst performance.

*benchmarkCreatePvTimeseriesDataBucket()* uses a utility method in the base class to generate a list of batches of BSON documents each containing a bucket of time series data, creates a collection in MongoDB to contain the data written by the test, creates indexes on the collection (to see the impact on ingestion performance), creates a list of tasks for writing each batch of BSON documents to MongoDB, creates an ExecutorService with a fixed size thread pool of specified size, and uses the executor service to execute the tasks.  It checks that the correct number of documents is inserted to the collection, which it then removes.  The performance result is returned to the experiment driver method.

The class contains other driver methods for measuring the performance of creating and updating metadata documents using both "updateOne()" and "updateMany()" in the MongoDB driver, and using the recent MongoDB "time series collection" feature to write data as individual points.

The file [MongoDbAsyncBenchmark](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/MongoDbAsyncBenchmark.java) follows pretty much the same pattern described above, only it uses the MongoDB "reactive streams" driver instead of the "sync" driver.  Both benchmark classes derive from a common class [MongoDbBenchmarkCommon](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/MongoDbBenchmarkCommon.java) that provides utilities for generating BSON document batches since both benchmarks use the same BSON documents.

Both MongoDB benchmarks (as well as some of the ones for the other technologies), use the class [BenchmarkCommon](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/BenchmarkCommon.java) which provides utilities like *createExecutorServiceAndInvokeTasks()* for creating an executor service with specified number of threads, and executing a list of tasks in the executor service.

##### HDF5 and JSON files

Saving time series data to HDF5 files seems to be a very good option, given its benchmark performance for writing large data files, and acceptance within our community.  That said, the Java HDF5 project feels "dated" and requires calling out to a native library, not an optimal approach for a server application.

The ingestion performance ranges from 68M to 77M values per second, about an order of magnitude better than the best performance obtained for any of the database products.  Better performance was seen for larger HDF5 files than small ones, which ranged from 1.3M to 2.4M values per second.  We also tested writing data to JSON text files to have a reference point for comparing another file-based approach, with a performance in the range of 38M to 47M values per second, also quite good.

As good as the performance numbers are for these benchmarks, it is important to realize that 1) they don't involve a network call to database service and 2) there is no external indexing mechanism to the files themselves.  We are only measuring the performance of writing data to the files.

The package "ch.systemsx.cisd.hdf5" is used for writing HDF5 files from Java.  It was actually quite challenging to find and install the most current version of the library (which seems to be quite old, at least for Java).  Maybe there is a better / more recent library?

The file performance benchmarks are contained in [FileBenchmark] (https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/FileBenchmark.java).  The class extends *MongoDbBenchmarkCommon* so that it can use the MongoDB BSON framework to simplify the generation of JSON document content.

The *main()* method can call two methods, *experimentCreatePvTimeseriesDataHdf5()* for measuring HDF5 performance and *experimentCreatePvTimeseriesDataJson()* for JSON.

*experimentCreatePvTimeseriesDataHdf5()* sweeps parameter values for batch size and number of threads, calling *scenarioCreatePvTimeseriesDataHdf5()* to run a performance benchmark for each parameter combination.  The results are displayed for each scenario that it executes.

*scenarioCreatePvTimeseriesDataHdf5()* creates a list of batches of content to be written to HDF5 files, using a local POJO *Hdf5FileContent* to encapsulate the data for each file.  It creates a directory structure to contain the HDF5 files, generates a list of tasks for writing each batch of HDF5 files, creates an ExecutorService with the specified number of threads, and executes the tasks in the ExecutorService to create the HDF5 files.  Performance is measured and returned to the experiment driver method.

The methods *experimentCreatePvTimeseriesDataJson()* and *scenarioCreatePvTimeseriesDataJson()* follow the same pattern for measuring the performance of writing JSON files instead of HDF5.

##### summary and revision to data platform technology stack

Based on the benchmark results, we decided to move forward with an Ingestion Service implementation using gRPC for communication, and MongoDB for storage of both time series data and metadata.

We eliminated InfluxDB from the Data Platform technology stack because it is unlikely that without using the commercial "Enterprise" version we can exceed the project goal of ingesting 4M values/second.

We chose MongoDB for storing time series data because it showed better performance than MariaDB for storing "bucketed" time series data, and seemed to be a better fit for the problem.  In addition to storing individual scalar values as data points, we also need to store arrays, tables, structures, and images and this seems more natural in Mongo.

While we don't plan to do it initially, we also feel like MongoDB might be a better fit than MariaDB for a hybrid solution that uses MongoDB to store recent time series data and HDF5 files to store older data, with Mongo providing an index to the data files.  We might take this approach if the size of the Mongo database becomes unwieldy.  Other hybid approaches might be developed to leverage the performance of writing to HDF5 files, so we are "keeping this in our back pocket" as an area to explore in the future when it is needed.

#### October 2023: initial ingestion service implementation for scalar data using mongodb for time series data

##### milestone objective

Given the performance benchmark results discussed elsewhere in this document, we decided to move forward in re-development of the Ingestion and Query Services using a revised technology stack that uses gRPC for API communication and MongoDB for storing both time series data and metadata.

The initial development milestone focused on building an implementation of the Ingestion Service that exceeds the project performance goal of ingesting 4M scalar values per second using MongoDB for persistence of all data.  Because the focus is on performance, the initial implementation provides a subset of the features that we will ultimately provide in the Ingestion Service, handling only scalar data (Float, Integer, String, Boolean) using a fixed sampling interval.  Only the bidirectional streaming API RPC method *streamingIngestion()* is implemented by the service.  Additional ingestion features will be enabled in subsequent milestones.

Because of the focus on performance in this milestone, an ingestion performance benchmark application was created to measure performance at each step of the development process to see where we stand relative to the goal of 4M values/second.  The benchmark application sends one minute's data for 4,000 PVs each sampled at 1KHz, and is discussed in more detail below.

At completion of this milestone, the ingestion performance benchmark ranges from 7M to 10M values/second.  It is interesting to note that this is the same performance range that we observed for writing data directly to MongoDB, which means that our server overhead doesn't seem to degrade performance significantly.  We will see if that holds as we add more functionality, and under more stressful load testing.

##### ingestion service implementation

The Ingestion Service implementation includes three main elements: 1) a server that listens on the configured port, 2) a gRPC service implementation that handles incoming gRPC messages and dispatches them to the handler, and 3) an ingestion handler that writes data to MongoDB.  Each element is described in more detail below.

The packages and classes for the Ingestion Service are contained in the [dp-ingest github repo](https://github.com/osprey-dcs/dp-ingest).

###### ingestion server

The Ingestion server element includes the class [IngestionGrpcServer](https://github.com/osprey-dcs/dp-ingest/blob/main/src/main/java/com/ospreydcs/dp/ingest/server/IngestionGrpcServer.java) in the package "com.ospreydcs.dp.ingest.server".

This simple class includes a *main()* method for running the Ingestion Service.  It instantiates an *IngestionServiceImpl*, implementing the gRPC service API, and starts a gRPC server listening on the configured port.  It the registers a shutdown hook and waits for the server to shut down.

###### ingestion service

The class [IngestionServiceImpl](https://github.com/osprey-dcs/dp-ingest/blob/main/src/main/java/com/ospreydcs/dp/ingest/service/IngestionServiceImpl.java) in the package "com.ospreydcs.dp.ingest.service" provides an implementation of the gRPC Ingestion Service API and extends *DpIngestionServiceImplBase* which is generated by the Java protoc gRPC compiler.

The main purpose of this class is to implement the RPC methods specified in the gRPC proto file for the Ingestion Service.  The initial implementation only includes the method *streamingIngestion()*, the bidirectional streaming API for ingesting data.

This class is instantiated by the ingestion server and provides methods *init()* and *fini()* to initialize and shutdown the service, respectively.  The init() method is passed an ingestion handler instance that is used to handle incoming ingestion requests.

The *streamingIngestion()* method performs validation on each *IngestionRequest* received on the method's input stream (using the handler implementation of *validateIngestionRequest()*) and sends an *IngestionResponse* whose type depends on the validation result.  If validation is successful, an ACK response is sent otherwise it sends a REJECT response.

Each valid request is sent to the ingestion handler via its *onNext()* method.

###### ingestion handler

The ingestion handler framework is the "meat" of the Ingestion Service implementation, as it is responsible for writing data to the underlying persistence layer (e.g., MongoDB).  It uses a simple interface [IngestionHandlerInterface](https://github.com/osprey-dcs/dp-ingest/blob/main/src/main/java/com/ospreydcs/dp/ingest/handler/IngestionHandlerInterface.java) to define the required handler methods *init()*, *fini()*, *start()*, *stop()*, *validateIngestionRequest()*, and *onNext()*.

The handler framework is contained in the package "com.ospreydcs.dp.ingest.handler", or sub-packages within it.

An interface is used so that we can have multiple handler implementations and use injection at runtime to configure a running system.  This is probably more useful for creating mock implementations for testing than alternative real implementations.  However, I wanted to test different approaches to the handler implementation using both sync and async MongoDB drivers so the interface was helpful in accomplishing that objective.

There are two primary implementations of the handler interface, both using MongoDB to store time series and metadata.  [MongoSyncHandler](https://github.com/osprey-dcs/dp-ingest/blob/main/src/main/java/com/ospreydcs/dp/ingest/handler/mongo/MongoSyncHandler.java) uses the sync MongoDB driver, while [MongoAsyncHandler](https://github.com/osprey-dcs/dp-ingest/blob/main/src/main/java/com/ospreydcs/dp/ingest/handler/mongo/MongoAsyncHandler.java) uses the "reactivestreams" async MongoDB driver.  Both classes extend [MongoHandlerBase](https://github.com/osprey-dcs/dp-ingest/blob/main/src/main/java/com/ospreydcs/dp/ingest/handler/mongo/MongoHandlerBase.java) to take advantage of sharing common code that is useful for both implementations.

*MongoHandlerBase* defines an abstract method interface that must be implemented by derived classes.  These methods are used to isolate behavior that is different between the sync and async MongoDB drivers.  The most interesting method is *insertBatch()*, which inserts the batch of BSON documents for a given *IngestionRequest* to MongoDB.  There are other methods for initializing the driver client, database, and collection; creating indexes on collections, and inserting a document to the request status collection.

The primary methods of the handler interface implemented by *MongoHandlerBase* are *validateIngestionRequest()* and *onNext()*.  

The validation method is invoked by the service implementation method for handling incoming ingestion requests.  I decided to try to maintain a separation of concerns where the handler understands the details of an *IngestionRequest* instead of providing validation logic in the service implementation.  The *IngestionServiceImpl* focuses on gRPC communication details and dispatching to the handler.

The *onNext()* method simply adds incoming *IngestionRequests* to the *ingestionQueue*.

*MongoHandlerBase* employs a *producer-consumer-queue* pattern for handling requests.  

The "producer" is the gRPC service implementation which receives *IngestionRequests* in gRPC framework threads and adds them to the handler's queue via the *onNext()* method.

The "consumer" is the pool of worker tasks running in an *ExecutorService* managed by *MongoHandlerBase*.  It creates a fixed size thread pool for the executor service with the configured number of *IngestionWorkers*.  The nested class *IngestionWorker* implements the *Runnable* interface for executing a task asynchronously.  The worker's *run()* method polls the queue to wait for the next ingestion request, and handles the request via *handleIngestionRequest()*.

*handleIngestionRequest()* uses the utility method *generateBucketsFromRequest()* to create a list of BSON documents from the ingestion request, with on document per column in the request.  It then calls the abstract method *insertBatch()* to write the batch to MongoDB (with derived classes using the sync or async mongo driver to write to the database), and handles the result in a uniform way.  It also adds a document to the requestStatus MongoDB collection indicating the disposition of the request.

One tricky aspect of the handler implementation is that it is not straightforward to map a polymorphic Java class to a single MongoDB collection.  MongoDB provides a *codec* mechanism for mapping Java *POJO* classes to Mongo collections.  I did some research and ended up using a Java class hierarchy rooted by [BucketDocument](https://github.com/osprey-dcs/dp-ingest/blob/main/src/main/java/com/ospreydcs/dp/ingest/model/bson/BucketDocument.java), with the *BsonDiscriminator* attribute used so that MongoDB can distinguish the various subclasses.  *BucketDocument* is a generic type, with a type parameter for specifying the Java type of the data to be stored in a bucket.

There are derived classes *DoubleBucketDocument*, *LongBucketDocument*, *BooleanBucketDocument*, and *StringBucketDocument*, each of which specify a different value for the BsonDiscriminator annotation and the corresponding Java type to fulfill the type parameter in the parent *BucketDocument* class (e.g., *Double*, *Long*, *Boolean, *String*).

The MongoDB *codec* mechanism then can map this polymorphic bucket document hierarchy to a single collection, "buckets".  Each document in that collection includes a "dataType" whose value is determined by the BsonDiscriminator annotation value for the derived bucket document class, e.g., "dataType: 'DOUBLE'".  See the appendix section "mongodb schema" for more details.

###### configuration

I created a simple configuration mechanism, [ConfigurationManager](https://github.com/osprey-dcs/dp-common/blob/main/src/main/java/com/ospreydcs/dp/common/config/ConfigurationManager.java) in the repo [dp-common](https://github.com/osprey-dcs/dp-common).  I created this new repo so that I can share Java components with both the Ingestion and Query Services.  The dependency is accomplished via configuration in the project's "pom.xml" file.

The *ConfigurationManager* uses [snakeyaml](https://bitbucket.org/snakeyaml/snakeyaml/src/master/) to parse config files in YML format.

The *singleton* pattern is used to access the *ConfigurationManager* instance for the running service.  Lazy initialization is used to create and initialize the instance in a thread-safe way.

Initialization looks for the default config file "application.yml" in the class loader path.  It flattens the configuration details to a map whose keys are configuration properties (using dot notation) and values are the configuration resource values as strings.

An alternate config file can be specified on the command line (using e.g., "java -Ddp.config=/tmp/config-override.yml com.ospreydcs.dp.ingest.server.IngestionGrpcServer") or via an environment variable (DP.CONFIG=/tmp/config-override.yml).

Individual config resources can be overridden on the command line (e.g., "java -Ddp.GrpcServer.port=50052 com.ospreydcs.dp.ingest.server.IngestionGrpcServer").  Command line overrides take precedence over config file entries.

The main objectives employed in the interface for retrieving config resource values are:

* Minimize the need for clients to check the results from config lookup methods.  To me this means 1) don't throw exceptions but instead return null values for missing keys and 2) provide methods for specifying a default value that is return instead of a null.  This way the caller never has to check the result of config lookup.

* Provide getter methods for casting the config value to a certain data type e.g., getConfigInt() and getConfigBoolean().  This also minimizes code in the client to cast return values (and catch resulting exceptions etc).

A convenience method *configMgr()* is used in service classes to return *ConfigurationManager.getInstance()*.  A typical call in the service to access a config resource then looks like this:

```
int numWorkers = configMgr().getConfigInteger(CFG_KEY_NUM_WORKERS, DEFAULT_NUM_WORKERS);
```

###### grpc protocol definition

The gRPC API definition for the Ingestion Service is defined in the [dp-grpc github repo](https://github.com/osprey-dcs/dp-grpc) in the file [ingest.proto](https://github.com/osprey-dcs/dp-grpc/blob/main/src/main/proto/ingestion.proto).  The API spec is discussed elsewhere in this document.

The *dp-grpc* project uses the Java *protoc* compiler to build Java classes implementing the gRPC API.  The *dp-ingest* project includes a dependency in its "pom.xml" file to include those derived artifacts.

###### ingestion benchmark application

The class [IngestionPerformanceBenchmark](https://github.com/osprey-dcs/dp-ingest/blob/main/src/main/java/com/ospreydcs/dp/ingest/benchmark/IngestionPerformanceBenchmark.java) provides a simple performance benchmark application that is used to monitor the performance of the Ingestion Service implementation during development.  It is run via *main()*.

The base data set for the ingestion performance benchmark includes 4,000 data sources sampled at 1 KHz for 60 seconds.

The *main()* method uses *streamingIngestionExperiment()* to execute a set of scenarios for sweeping parameters that control behavior in the client, number of threads and number of data streams, looking for "optimal" values.  Each scenario is executed by *streamingIngestionScenario()*. 

That method creates an ExecutorService with a fixed size thread pool of the specified number of threads.  It then creates a set of executor service tasks of the specified number of streams, essentially dividing the total set of data to be ingested across those tasks, and executes the tasks via the executor service thread pool.

Each task is run via *sendStreamingIngestionRequest()*.  It creates a responseObserver, opens the *streamingIngestion()* API RPC method stream, sends a stream of *IngestionRequest* messages (determined by the parameters for the scenario), and waits for the expected number of responses.

The performance benchmark application measures and reports elapsed time for each scenario.  I tried to exclude as much processing as possible from the time measurement, however it does include the time required to generate each gRPC *IngestionRequest* message.  I hoped to avoid this, but the application runs out of memory if I try to preallocate the messages.  One workaround is to preallocate a single IngestionRequest message that is sent repeatedly.  The gRPC performance benchmark in the dp-benchmark repo takes this approach.

###### unit test coverage

The dp-ingest project includes pretty thorough jUnit test coverage in its "test/java" hierarchy, with packages that mirror the source directory structure and test class names that reflect the name of the class under test.

[IngestionServiceImplTest](https://github.com/osprey-dcs/dp-ingest/blob/main/src/test/java/com/ospreydcs/dp/ingest/service/IngestionServiceImplTest.java) covers utility methods in *IngestionServiceImpl* for sending ACK and REJECT responses, and converting a gRPC *Timestamp* to a Java *Date*.

[IngestionGrpcTest](https://github.com/osprey-dcs/dp-ingest/blob/main/src/test/java/com/ospreydcs/dp/ingest/server/IngestionGrpcTest.java) runs a simple gRPC client-server scenario to test gRPC communication, using *io.grpc.inprocess.InProcessServerBuilder* and *InProcessChannelBuilder* for running both in the same process.  It includes two simple test cases, one for a rejected ingestion request and the other for a valid ingestion request.  Both cases verify properties of the response received.

[IngestionHandlerBaseTest](https://github.com/osprey-dcs/dp-ingest/blob/main/src/test/java/com/ospreydcs/dp/ingest/handler/IngestionHandlerBaseTest.java) covers the validation utility method *IngestionHandlerBase.validateIngestionRequest()* with various scenarios that lead to validation errors.

[MongoSyncHandlerTest](https://github.com/osprey-dcs/dp-ingest/blob/main/src/test/java/com/ospreydcs/dp/ingest/handler/mongo/MongoSyncHandlerTest.java) and [MongoAsyncHandlerTest](https://github.com/osprey-dcs/dp-ingest/blob/main/src/test/java/com/ospreydcs/dp/ingest/handler/mongo/MongoAsyncHandlerTest.java) cover using the MongoDB sync and async drivers via *MongoSyncHandler* and *MongoAsyncHandler*, respectively.  They are both derived from the common class [MongoHandlerTestBase](https://github.com/osprey-dcs/dp-ingest/blob/main/src/test/java/com/ospreydcs/dp/ingest/handler/mongo/MongoHandlerTestBase.java), which provides the implementation of the test case methods used by both derived classes.  The test cases cover various success and error scenarios in the handler.  Test cases retrieve data from MongoDB to verify the test results.  The two derived classes use the appropriate sync or async MongoDB code for retrieving data.

[IngestionConfigurationmanagerTest](https://github.com/osprey-dcs/dp-ingest/blob/main/src/test/java/com/ospreydcs/dp/ingest/config/IngestionConfigurationManagerTest.java) covers use of the *ConfigurationManager* within the Ingestion Service.  It includes test cases that check for handling and default values for three ingestion components that use config resources, server, handler, and benchmark.

## mongodb schema

This section includes some details about the schema used to store data in MongoDB.  Please note that this is all subject to change at this point in our project!

The Data Platform uses a single MongoDB database called "dp" to contain the data that it creates.

The database contains two primary collections, "buckets" and "requestStatus".  The former contains the time series and metadata documents created from by the ingestion service.  A document is created for each "IngestionRequest" handled by the service to reflect the disposition of that request, indicating whether or not it was successfully handled.

On a development system, the "dp" database might contain other collections that are created by regression test execution.  This will generally be named with a "test-" prefix.

Each of the primary collections is described in more detail below.

### buckets collection

Documents in the "buckets" collection contain the following fields:

- __id_: The MongoDB unique document identifier.
- _columnName_: The name of the source data column for the bucket.
- _eventDescriptption_: String description of associated event, if any.
- _eventSeconds / eventNanos_: Timestamp for associated event, if any.
- _firstSeconds / firstNanos_: Timestamp for first timestamp of bucket.
- _lastSeconds / lastNanos_: Timestamp for last timestamp of bucket.
- _dataType_: Indicates the Java data type for the data contained by the document's bucket, e.g., "DOUBLE", "INTEGER", "STRING", "BOOLEAN".
- _attributeMap_: Key/value metadata for the bucket document.
- _numSamples_: Number of samples contained by the bucket.
- _sampleFrequency_: Delta in nanoseconds from first timestamp for each data value contained by the bucket.
- _columnDataList_: A list of data values for the bucket.  The timestamp for the first value in the list is firstSeconds + firstNanos.  The timestamp for each subsequent value in the list is the delta from the start time plus e.g., first timestamp + (sampleFrequency * list index).

### requestStatus collection

- __id_: The MongoDB unique document identifier.
- _providerId_: The providerId specified in the corresponding IngestionRequest.
- _requestId_: The clientRequestId specified in the corresponding IngestionRequest.
- _status_: Indicates "success", "reject", or "error" disposition of request.
- _msg_: Provides details for "reject" and "error" disposition.
- _idsCreated_: For a successful request, contains the MongoDB ids (_id field) of the documents created in the "buckets" collection for the request.
- _updateTime_: Indicates the time that the requestStatus was updated.

## gRPC

TODO: details for using protoc and programming examples for languages that we have experience with (Java, C++, Python, JavaScript, etc).
