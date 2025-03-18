# data-platform repo

This document includes background for the Data Platform project, a description of the project's requirements and objectives, and a summary of the technical components.  It also provides a status update and a list of milestones for the project.  The document concludes with a list of near-term development plans and longer-term objectives.

You can continue reading the background materials or jump ahead to the [additional documentation](#additional-documentation) section to learn how to install and get started with the Data Platform project.

## motivation

The Data Platform provides tools for managing the data captured in an experimental research facility, such as a particle accelerator. The data are used within control systems and analytics applications, and facilitate the creation of machine learning models for those applications.

The Data Platform is agnostic to the source and acquisition of the data. A project goal is to manage data captured from the [EPICS "Experimental Physics and Industrial Control System"](https://epics-controls.org/), however, use of EPICS is not required. The Data Platform APIs are generic and can be used from essentially all programming languages and any type of application.


## requirements and objectives

* Provide an API for ingestion of heterogeneous time-series data including scalar values, arrays, structures, and images.
* Handle the data rates expected for an experimental research facility such as a particle accelerator.  A baseline performance requirement is to handle 4,000 scalar data sources sampled at 1 KHz, or 4 million samples per second.
* Provide an API for retrieval of ingested time-series data.
* Provide mechanisms for adding post-ingestion annotations and calculations to the archive, and performing queries over those annotations.
* Provide an API for exploring metadata for data sources available in the archive.
* Provide mechanism for exporting data from the archive to common formats.


## data platform elements

The Data Platform includes the following technical components:

- An API built upon the gRPC communication framework.
- A suite of services built using the Java programming language.
- A JavaScript web application for exploring the data archive.
- Utilities for deploying and managing the ecosystem.
- High-level Java client libraries for building applications.

Each of these elements is described in more detail below.

### gRPC API

The Data Platform API is built upon the [gRPC open-source high-performance remote procedure call (RPC) framework](https://grpc.io/). As described on [Wikipedia](https://en.wikipedia.org/wiki/GRPC), "this framework was originally developed by Google for use in connecting microservices. It uses HTTP/2 for transport, protocol buffers as the interface description languages, and provides features such as authentication and bidirectional streaming. It generates cross-platform client and server bindings for many languages."

We chose to use the gRPC framework for the Data Platform API because it can meet our performance requirements for data ingestion, and bindings are provided for virtually any programming language.

The API definition is managed separately from the service implementations so that it can be utilized for building client applications that are independent of other Data Platform technology.  The Data Platform gRPC API is described in more detail in [section "Data Platform API"](#data-platform-api).

### service implementations

The Data Platform Services are implemented as Java server applications.  There are three independent server applications, providing ingestion, query, and annotation services, respectively.  The [MongoDB document-oriented database management system](https://www.mongodb.com/) is used by the services for persistence.  [Section "Data Platform Service Implementations"](#data-platform-service-implementations) provides more detail about the Java service implementations and the frameworks used to build them.

### web application

The Data Platform Web Application is under development using the [JavaScript React library](https://react.dev/).  It will provide a user interface for navigating archive metadata and time-series data, viewing and creating annotations, and other tools for visualizing and exporting data.

### installation and deployment support tools

A set of utilities is provided to help manage the Data Platform ecosystem.  There are scripts for managing infrastructure services including MongoDB and the Envoy proxy (used for deploying the web application), and a set of simple process-management utilities for managing the Data Platform server and benchmark applications.

### high-level client libraries

A suite of high-level client libraries is being developed that hide the details of the service APIs and provide a more convenient interface for building client applications.  The libraries are written in Java and are intended to be used by Java applications that need to interact with the Data Platform services.


## status and milestones

### "datastore" prototype (2022)

A prototype implementation of the Data Platform services was built focusing on the creation of a general API supporting ingestion and query of heterogeneous data types including scalar, array / table, structure, and image. Service implementations were created using Java for both the Ingestion and Query Services, as well as libraries for building client applications. The prototype technology stack included both [InfluxDB](https://www.influxdata.com/) (for time series data) and MongoDB (for metadata). This prototype successfully demonstrated the use of gRPC APIs for ingestion and retrieval of heterogeneous, but did not meet the baseline performance requirements.

### datastore web application prototype (2022)

The datastore prototype included development of a web application using JavaScript React and Tailwind libraries.  The prototype provided simple user interfaces for navigating metadata, as well as querying and displaying time-series data.  It demonstrated calling gRPC APIs from a browser-based application using the [gRPC Web](https://github.com/grpc/grpc-web/) JavaScript implementation of gRPC for browser clients.

### technology performance benchmarking (September 2023)

Performance benchmark applications were developed and utilized to evaluate candidate technologies for use in the Data Platform implementation in light of the project performance goal stated above. Benchmarks focused on gRPC for API communication; InfluxDB, MongoDB and MariaDB for database storage; and writing JSON and HDF5 files to disk. The benchmark results showed that it was likely we could build service implementations meeting our performance requirements by using gRPC for communication and [MongoDB for storing "buckets" of time series data](https://www.mongodb.com/blog/post/building-with-patterns-the-bucket-pattern).

### Data Platform v1.0 (November 2023)

Version 1.0 of the Data Platform includes an initial Java implementation of the Ingestion Service providing a gRPC API and using MongoDB for storing time-series data. The initial ingestion service implementation focuses only on scalar data and with timestamps specified using the "sampling clock" mechanism with start time and sample period.  It is accompanied by a performance benchmark application that is used at each stage of development to measure ingestion performance relative to the project goal. The initial implementation exceeds our goal by a comfortable margin, but this will continue to be a focus as the project evolves.  [section "Data Platform API"](#data-platform-api) provides more information about the ingestion API.

### v1.1 (January 2024)

Version 1.1 includes a Java implementation of the Query Service gRPC API, using the MongoDB database managed by the ingestion service to fulfill client query requests.  A variety of API RPC methods for querying time-series data are provided to support the development of clients with varying performance requirements, ranging from streaming methods that return bucketed result data down to simple single response methods that return tabular data.  See [section "Data Platform API"](#data-platform-api) for a detailed description of the query API.

### v1.2 (February 2024)

Version 1.2 saw changes to the "proto" files defining the gRPC API for the Data Platform to be more consistent and conventional, with corresponding changes to the Java service implementations.

### v1.3 (April 2024)

Version 1.3 provides an initial implementation of the annotation service for adding annotations to archived data and performing queries against those annotations.  The primary focus for the initial annotation service implementation was on the data model for associating annotations with data in the archive.  The only type of annotation currently supported is a simple user comment, but we will be adding many other types of annotations using the same underlying data model.  See [section "Data Platform API"](#data-platform-api) for more details about the annotation data model.

### v1.4 (July 2024)

Version 1.4 adds Ingestion and Query Service support for all data types defined in the Data Platform API including scalars, multi-dimensional arrays, structures, and images. Support is also added to both services for ingesting and querying data with an explicit list of data timestamps to complement the existing support for specifying data timestamps using a SamplingClock (with start time, sample period, and number of samples). Both features utilize serialization of the protobuf DataColumn and DataTimestamps API objects as byte array fields of the MongoDB BucketDocument. This change improves ingestion performance significantly, while also reducing the MongoDB storage footprint and simplifying the codebase.

### v1.5 (August 2024)

With version 1.5, we have now completed the implementation of the initial Data Platform API we defined at the outset for the Core Services.  This version focuses on adding the remaining unimplemented Ingestion Service features including: unidirectional client-side streaming data ingestion API, API for registering providers, API for querying ingestion request status details, testing for handling of value status information, validation of data ingestion providers, as well as improvements to the performance benchmark framework. The java dp-grpc and dp-service projects are updated to use Java 21 and the latest versions of 3rd party libraries.

### v1.6 (October 2024)

Version 1.6 includes a new Annotation Service API method for exporting time-series data from the archive to common file formats including HDF5, CSV, and XLSX (Excel).  It provides an enhancement to the annotations query API method for filtering annotations by dataset id, in addition to the previously supported methods for filtering by owner and comment text field content.  Support is also added for querying datasets and annotations by id.

### v1.7 (January 2025)

Version 1.7 includes a new Ingestion Service API method for subscribing to data received in the ingestion stream, enabling downstream processing.  It also includes a prototype data event monitoring framework, implemented as a new "Ingestion Stream Service".  We decided to discontinue development on the new service for now.  We envision that the functionality in this prototype will probably be divided between the new Ingestion Stream Service and a client application framework for building data event monitors and more general algorithm data processing.  This partitioning will allow the user to create data event monitoring applications with computation that would be impossible to implement in a general way as a service.  We intend to revisit the design and partitioning of functionality for the service and application framework in an upcoming release.

### v1.8 (March 2025)

The primary focus of version 1.8 is an expanded API for creating and querying Annotations.  The Annotation API is redesigned to support modular annotations including components for free-form text comments, linking of associated datasets and other annotations, user-defined calculations, and additional descriptive fields.  This release also includes two new API methods for querying details and ingestion stats for data Providers, queryProviders() and queryProviderMetadata().  Behind the scenes changes include some bulk renaming of Java classes to follow a more consistent naming convention, and a more unified approach to the Java BSON document class framework used to store data in MongoDB for the application entities.


## todo and road map

### near term development plans through 8/2025

* Mechanism for including user-defined Calculations in time-series data queries and export.
* Ingestion Stream Service with API for subscribing to aggregated PV data from the ingestion data stream formatted as correlated data blocks.
* Plugin Application Framework for building data event monitoring applications and developing algorithms utilizing the mechanisms for subscribing to raw ingestion stream data and correlated data blocks.

### longer term objectives

* Run more extensive load testing benchmarks.
* Implement mechanism for ingestion data validation.
* Add API for time-series data query by value status information?
* Add framework for measuring data statistics.
* Add support for authentication and authorization of query and annotation services.
* Investigate MongoDB database clustering (replica sets), partitioning (sharding), and connection pooling.
* Experiment with horizontal scaling alternatives.
* Experiment with streaming architecture (e.g., Apache Kafka)


## project organization

The Data Platform project is organized using the following github repositories:

### dp-grpc

The [dp-grpc repo](https://github.com/osprey-dcs/dp-grpc) contains the Data Platform API definition.  It includes documentation for the Platform's data and service models, and a description of the gRPC "proto" files containing the API definition, which is provided in [section "Data Platform API"](#data-platform-api) of this document.

### dp-service

The [dp-service repo](https://github.com/osprey-dcs/dp-service) contains the Java code for implementations of the Data Platform services, including the shared frameworks used to build them.  It includes documentation about those frameworks and the underlying MongoDB database schema utilized by the services, which is provided by [Section "Data Platform Service Implementations"](#data-platform-service-implementations) of this document.

### dp-web-app

The [dp-web-app repo](https://github.com/osprey-dcs/dp-web-app) contains the JavaScript code for the Data Platform Web Application, with documentation about the approach.

### dp-support

The [dp-support repo](https://github.com/osprey-dcs/dp-support) contains the scripts and utilities for managing the components of the Data Platform ecosystem.  It includes documentation for using those tools.

### data-platform

This [data-platform repo](https://github.com/osprey-dcs/data-platform) is the primary repo for the Data Platform project.  It contains documentation about the approach with links to the other repos, provided in [Section "project organization"](#project-organization) of this document.  It also includes a Quick Start guide for running the Data Platform ecosystem from the installer.

### dp-benchmark

The [dp-benchmark repo](https://github.com/osprey-dcs/dp-benchmark) is not currently active, but contains code developed for evaluating the performance of some candidate technologies considered for use in the Data Platform service technology stack.  It includes an overview of the benchmark process with a summary of results.



# Additional Documentation

Use the links below to learn more about the Data Platform project.

## installation and getting started
* [quick start guide](doc/user/quick-start.md)
* [installation details](doc/user/installation.md)
  * [installation prerequisites](doc/user/installation.md#installation-prerequisites)
  * [data platform installation options](doc/user/installation.md#data-platform-installation-options)
* [data platform ecosystem tools](https://github.com/osprey-dcs/dp-support)

## project documents
* [project overview slide deck - pdf](doc/documents/presentations/mldp-overview.pdf)

## developer notes
* [data platform release process](doc/developer/release.md)
