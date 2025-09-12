# data-platform repo

This is the primary repo for the Machine Learning Data Platform (MLDP), providing project background and including links to the various project elements.  This document includes the following details:

- [Project motivation](#motivation)
- [Requirements and objectives](#requirements-and-objectives)
- [MLDP Project elements](#data-platform-project-elements)
- [Status and milestones](#status-and-milestones)
- [Todo and road map](#todo-and-road-map)
- [Additional documentation](#additional-documentation)
- [Installation and getting started](#installation-and-getting-started)



---
## Motivation

The Data Platform provides tools for managing the data captured in an experimental research facility, such as a particle accelerator. The data are used within control systems and analytics applications, and facilitate the creation of machine learning models for those applications.

The Data Platform is agnostic to the source and acquisition of the data. A project goal is to manage data captured from the [EPICS "Experimental Physics and Industrial Control System"](https://epics-controls.org/), however, use of EPICS is not required. The Data Platform APIs are generic and can be used from essentially all programming languages and any type of application.

### How is the Data Patform different from the Epics Archive Appliance?

This is a common question.  The Data Platform is optimized for recalling thousands of signals at a single point in time. The Archive Appliance is not. It is good at recalling a small number of signals over a large period of time.

### Data Provenance

The Data Platform is for managing data sets - annotating them, deleting them, and using them in the life cycle of the data. One of our use cases is managing experimental data.

A scientist takes XRay data from some number of detectors, along with some scalar and vector data. The XRay data must be processed as these XRays are taken from different angles at different distances into some normalized coordinate data. The original data must be preserved for verification of published results especially in proton studies. The raw data set is stored in the archive noting important details about the data. 

Data scientists normalize the coordinates and upload the normalized data to the archive, linking it to the RAW data set and including details about the code / version of the algorithm used to normalize the coordinates, the date it was run, and the person that performed the normalization. 

This normalized data is then processed further to reconstruct the protein structure, creating a new data set that is uploaded to the archive and linked to the normalized data along with information about the data transformation. 

Data provenance is a challenging problem and a key feature of the MLDP archive.

### Data Cleaning Workflow

Using the same features as for tracking data provenance, the MLDP supports the MLOps data cleaning workflow with tools for identifying suspect data, annotating and marking up that data, downloading data for further processing, and uploading new datasets to the archive that are linked to the datasets from which they are derived.



---
## Requirements and Objectives

* Provide an API for ingestion of heterogeneous time-series data including scalar values, arrays, structures, and images.
* Handle the data rates expected for an experimental research facility such as a particle accelerator.  A baseline performance requirement is to handle 4,000 scalar data sources sampled at 1 KHz, or 4 million samples per second.
* Provide an API for retrieval of ingested time-series data.
* Provide mechanisms for adding post-ingestion annotations and calculations to the archive, and performing queries over those annotations.
* Provide an API for exploring metadata for data sources available in the archive.
* Provide mechanism for exporting data from the archive to common formats.



---
## Data Platform Project Elements

The Data Platform includes the following technical components:

- An API built upon the gRPC communication framework.
- A suite of services built using the Java programming language.
- Utilities for deploying and managing the ecosystem.
- High-level Java client libraries for building applications.
- A JavaScript web application for exploring the data archive.
- Benchmarks for comparing alternative technologies.

Each of these elements is described in more detail below.

### gRPC API

The Data Platform API is built upon the [gRPC open-source high-performance remote procedure call (RPC) framework](https://grpc.io/). As described on [Wikipedia](https://en.wikipedia.org/wiki/GRPC), "this framework was originally developed by Google for use in connecting microservices. It uses HTTP/2 for transport, protocol buffers as the interface description languages, and provides features such as authentication and bidirectional streaming. It generates cross-platform client and server bindings for many languages."

We chose to use the gRPC framework for the Data Platform API because it can meet our performance requirements for data ingestion, and bindings are provided for virtually any programming language.

The API definition is managed separately from the service implementations so that it can be utilized for building client applications that are independent of other Data Platform technology.  The Data Platform gRPC API is documented in the [dp-grpc repo](https://github.com/osprey-dcs/dp-grpc).

### Service Implementations

The Data Platform Services are implemented as Java server applications.  There are three independent server applications, providing ingestion, query, and annotation services, respectively.  The [MongoDB document-oriented database management system](https://www.mongodb.com/) is used by the services for persistence.  The [dp-service repo](https://github.com/osprey-dcs/dp-service) provides more detail about the Java service implementations and the frameworks used to build them.

### Desktop GUI Application

Though not a primary project requirement, we decided it was useful to build a Java desktop GUI application to demonstrate the features of the MLDP.  However, instead of making an application that can only be used as a demo, we decided to build a full-featured tool useful for navigating the MLDP data archive.  It provides a user interface for navigating archive metadata and time-series data, viewing and creating annotations, and other tools for visualizing and exporting data.  The application uses the MLDP gRPC API and provides a useful reference for calling those APIs from a Java client.  The application is managed in the [dp-desktop-app repo](https://github.com/osprey-dcs/dp-desktop-app), which contains details for installing and using the GUI application.

### Web Application

The Data Platform Web Application is under development using the [JavaScript React framework](https://react.dev/).  It will provide similar features to the desktop GUI application.  The [dp-web-app repo](https://github.com/osprey-dcs/dp-web-app) contains the JavaScript code for the Data Platform Web Application, with documentation about the project.

### Installation and Deployment Support Tools

A set of utilities is provided to help manage the Data Platform ecosystem.  There are scripts for managing infrastructure services including MongoDB and the Envoy proxy (used for deploying the web application), and a set of simple process-management utilities for managing the Data Platform server and benchmark applications.  The [dp-support repo](https://github.com/osprey-dcs/dp-support) contains the scripts and utilities for managing the components of the Data Platform ecosystem.  It includes documentation for using those tools.

### High-Level Client Libraries

A suite of high-level client libraries is being developed that hide the details of the service APIs and provide a more convenient interface for building client applications.  The libraries are written in Java and are intended to be used by Java applications that need to interact with the Data Platform services.

### Technology Benchmarks

The [dp-benchmark repo](https://github.com/osprey-dcs/dp-benchmark) is not currently active, but contains code developed for evaluating the performance of some candidate technologies considered for use in the Data Platform service technology stack.  It includes an overview of the benchmark process with a summary of results.



---
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

### v1.9 (May 2025)

The main new features added in version 1.9 are 1) a mechanism for including user-defined Calculations alongside PV time-series data in the API for exporting data to CSV, XLSX, and HDF5 files, and 2) facilities for sending byte data in the ingestion, query, and subscription APIs for improved performance (on the order of 2-3x improvement for ingestion and query) by eliminating extra serialization operations in the gRPC communication framework and service implementations.  The release also includes enhancements to the data query handling framework, and updates and testing to use MongoDB 8 as the official reference version for the Data Platform.

### v1.10 (July 2025)

Version 1.10 includes the new Ingestion Stream Service providing a mechanism for subscribing to "data events".  Using the subscribeDataEvent() API, a client registers one or more triggers each specifying a PV name, a condition (e.g., equal to, greater than, less than, etc.), and a trigger data value.  When the condition is triggered by data in the ingestion stream for the specified PV, the client receives an Event notification that specifies the event time, condition that was triggered, and the data value that triggered the event.  The client can optionally register to receive EventData for a list of PVs when an Event is triggered for a window of time offset from the event trigger time.  This is useful for monitoring data conditions in "real-time", and building models and applications that respond to conditions in the data ingestion stream.  The data event monitoring mechanism uses the Ingestion Service's data subscription API to receive data from the ingestion stream for specified PVs.  The release includes improvements to data subscription handling in support of the new data event subscription API, as well as new Data Platform ecosystem scripts for managing the new Ingestion Stream Service.

### v1.11 (September 2025)

Though not a primary project requirement, we decided it was useful to build a Java desktop GUI application to demonstrate the features of the MLDP.  However, instead of making an application that can only be used as a demo, we decided to build a full-featured tool useful for navigating the MLDP data archive.  Version 1.11 includes a new application that provides a user interface for navigating archive metadata and time-series data, viewing and creating annotations, and other tools for visualizing and exporting data.  The application uses the MLDP gRPC API and provides a useful reference for calling those APIs from a Java client.  The application is managed in the [dp-desktop-app repo](https://github.com/osprey-dcs/dp-desktop-app), which contains details for installing and using the GUI application.



---
## todo and road map

* Run more extensive load testing benchmarks.
* Implement mechanism for ingestion data validation.
* Add framework for measuring data statistics.
* Add support for authentication and authorization of query and annotation services.
* Investigate MongoDB database clustering (replica sets), partitioning (sharding), and connection pooling.
* Experiment with horizontal scaling alternatives.
* Experiment with streaming architecture (e.g., Apache Kafka).



---
# Additional Documentation

Use the links below to learn more about the Data Platform project, or the links above to navigate to the other project repositories.

## installation and getting started
* [quick start guide](doc/user/quick-start.md)
* [installation details](doc/user/installation.md)
  * [installation prerequisites](doc/user/installation.md#installation-prerequisites)
  * [data platform installation options](doc/user/installation.md#data-platform-installation-options)
* [data platform ecosystem tools](https://github.com/osprey-dcs/dp-support)

## project documents
* [project overview slide deck - pdf](doc/documents/presentations/mldp-overview.pdf)
* [mldp by example pdf](doc/documents/presentations/mldp-by-example.pdf)

## developer notes
* [data platform release process](doc/developer/release.md)
