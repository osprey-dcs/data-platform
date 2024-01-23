# Data Platform Quick Start

This section will help you get the data platform up and running as quickly as possible.  If you are looking for a full project overview with other installation options, skip to the next section!

## preinstallation

- [install Java 16 or 17](https://github.com/osprey-dcs/data-platform#java-installation)
- [install MongoDB version 6, create database user and password](https://github.com/osprey-dcs/data-platform#mongodb-installation)
- [optionally install mongo-express](https://github.com/osprey-dcs/data-platform#mongo-express-installation)

## extract data plaform installer

The data-platform github repo includes an installer that contains everything needed to run the Data Platform.  Navigate to the [most recent data-platform release](https://github.com/osprey-dcs/data-platform/releases/latest) and download the file "data-platform-installer.tar.gz" to the desired installation location (e.g., the user's home directory).  Extract the installer using:

```
tar xvf data-platform-installer.tar.gz
```

## create data platform environment config file

The dp-support scripts require an environment configuration file in the user's home directory that specifies the location of the data platform installation.  The file must be called ".dp.env" (note the leading "dot" character).  The file contents should look like this (for an installation in the user's home directory):

```
export DP_HOME=~/data-platform
```

If the data-platform installer was extracted in a different location, use the appropriate installation path for DP_HOME.

## customize config files

The "data-platform/config" directory includes template config files for the installation.  Minimally, you'll need to edit "dp-ingest.yml" to include the proper "dbUser" and "dbPassword" for your MongoDB installation.  The included log4j config file sets up logging output to the console and can be customized as desired.

## start ecosystem processes

The "data-platform/dp-support/current/bin" directory includes a set of scripts for managing the data platform ecosystem.  These can be used to quickly get the system up and running.  See the section [running data platform services and applications](https://github.com/osprey-dcs/data-platform/tree/main#dp-support-ecosystem-scripts) for more details about using these scripts.

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
- [dp-support](https://github.com/osprey-dcs/dp-support) - Includes tools for installing, configuring, and managing the Data Platform ecosystem.
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

1. This data-platform repo contains everything needed to run the Data Platform and is the easiest way to get started.  See the [Quick Start](https://github.com/osprey-dcs/data-platform#data-platform-quick-start) for details on installing and using this repo.  

2. To learn more about installing the Data Platform in your development environment, see the instructions for [development installation](https://github.com/osprey-dcs/data-platform#development-installation).

3. The [jar installation section](https://github.com/osprey-dcs/data-platform#jar-installation) describes the process for downloading the latest Data Platform jar files.

### development installation

Developer installation consists of cloning the first 3 github repos listed above. The dp-support repo is optional, and the dp-benchmark is probably not useful unless you are interested in performance benchmarks outside the Data Platform).  After cloning the repos, use maven to "install" the dp-grpc and dp-common projects (either from the command line or using your Java IDE).  Then use maven to compile the dp-ingest project.

To run the ingestion service, execute IngestionGrpcServer.main().  To run the performance benchmark (with the server running), execute IngestionPerformanceBenchmark.main().

There are jUnit tests for the elements of the service in dp-ingest/src/test/java.

### jar installation

In situations where the Data Platform code will be used without the ecosystem support provided by the dp-support repo or for Java development, source code and/or jar files can be installed directly by using the desired github release.  Here are links to the releases page for each repo: [dp-grpc](https://github.com/osprey-dcs/dp-grpc/releases), [dp-common](https://github.com/osprey-dcs/dp-common/releases), and [dp-ingest](https://github.com/osprey-dcs/dp-ingest/releases).

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

## running data platform services and applications

### dp-support ecosystem scripts

The dp-support repo includes scripts to manage the Data Platform ecosystem, including MongoDB, the Java server applications, and other applications.  These are installed by the Data Platform installer in "data-platform/dp-support/current/bin".  Each is described in more detail below.

#### MongoDB scripts
- _mongodb-start_: Starts standard MongoDB installation using systemctl.
- _mongodb-stop_: Stops MongoDB.
- _mongodb-status_: Checks MongoDB status.
- _mongodb-enable_: Enables MongoDB auto-start after reboot.

#### data platform server scripts
- _server-start-ingest_: Starts the ingestion server application using the util-pm-start script.
- _server-stop-ingest_: Stops the running ingestion server application using the util-pm-stop script.
- _server-status-ingest_: Checks the status of the ingestion server application using util-pm-status.

#### other data platform applications
- _app-run-ingestion-benchmark_: Runs the data platform ingestion service performance benchmark application against the running ingestion server.  Displays an error if the server is not running.  Uploads one minute's data for 4,000 data sources sampled at 1 KHz.  This is a good way to test the installation.  Confirm that data is written to MongoDB by the ingestion server.

### running the ingestion server application

To run the ingestion server using the dp-support ecosystem scripts in "data-platform/dp-support/current/bin", use:
```
server-start-ingest
```

Here is the Java command line to run the server directly (update file paths as appropriate for your installation):
```
java -Ddp.config=~/data-platform/config/dp-ingest.yml -Dlog4j.configurationFile=~/data-platform/config/log4j2.xml -jar ~/data-platform/lib/dp-ingest/dp-ingest.jar
```

### running the ingestion performance benchmark application

To run the ingestion performance benchmark application using the dp-support ecosystem scripts in "data-platform/dp-support/current/bin", use:
```
app-run-ingestion-benchmark
```

Here is the Java command line to run the application directly (update file paths as appropriate for your installation):
```
java -Ddp.config=~/data-platform/config/dp-ingest.yml -Dlog4j.configurationFile=~/data-platform/config/log4j2.xml -cp ~/data-platform/lib/dp-ingest/dp-ingest.jar com.ospreydcs.dp.ingest.benchmark.IngestionPerformanceBenchmark
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
