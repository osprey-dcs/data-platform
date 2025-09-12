# DP-GRPC (Data Platform API definition)

### (2) sharing and access control
* In the current MLDP implementation all data, metadata, and annotations are accessible by all users.  We recognize that this is not a suitable situation for every facility and use case, thus, fine-grained access control and sharing mechanisms over data, metadata, and annotations could be implemented for a variety of data security, sharing, and ownership scenarios.  Such an effort should be relatively straightforward as there are common access control methodologies and common encryption technologies supporting them (e.g., TLS, JWP, LDAP, etc.).
* Define and implement model for ownership and sharing of data, datasets, and annotations.
  * Relationship to authentication/login mechanism

### query API
* (2) API change to queryTable() to support calculationsSpect or data frame
  QueryTableDispatcher.handleResult() builds the tabular result from the mongo query result cursor.  That method could be modified to also include Calculations following the pattern of ExportDataJobAbstractTabular.exportData_() where it uses TabularDataUtility.addCalculationsToTable() around line 143 to add Calculations to the table structure after having used TabularDataUtility.addBucketsToTable() to add the query result to the table (as is done in QueryTableDispatcher.handleResult().

### annotation API
* (2) ad hoc export mechanism - Extend the existing MLDP export API with a streamlined mechanism for ad hoc export by simplify specifying list of PV names and time range, avoiding the need to create persistent dataset objects first.
* (2) annotation mechanism targeting individual data points - The existing MLDP DataSet Annotation mechanism could be used to annotate individual data points (e.g., as suspect or invalid) but is probably not very efficient for navigating the annotations.  We could develop a new API optimized for annotating an individual data point and navigating those annotations.
  * maybe annotateDataSet() is too broad for this, and we should add something like annotateData()
    show annotations within the bucket that they target, don't add them to the main dataset annotations collection
* (2) APIs for managing and navigating descriptive elements - The MLDP APIs include descriptive elements such as tags (keywords), lists of key-value attribute pairs, and event association, but there are not APIs for managing and navigating the universe of descriptive elements in use within the archive.  Such APIs could be defined and implemented.
  * is the current separation of ingestion event metadata / tags / attributes from annotation event metadata / tags / attributes a problem?  E.g., how to update ingestion details after ingestion?  How to search across both domains?
* (3) should we allow deleting datasets and annotations?

### ingestion API
* (3) subscribeData() handling: could return PV metadata details in the subscribeData() response stream for use by the caller in dynamically handling subscription data (like data type, sample period etc that might be useful to subscribeDataEvent()  for use in buffer age limit determination, checking data type of pv condition trigger, etc).

### (3) serialized data column handling
* add more attributes? E.g., for specifying the data type in the request (instead of determining it from the type of the first DataValue)?  Other metadata like sampleCount?

### (3) ValueStatus / EPICS status and alarm handling
* do we need a way to query by alarm conditions, or add it to metadata for a PV (last alarm etc), this would mean unpacking the serialized DataColumn byte array values (or setting fields in the bucket indicating alarms during ingestion which would affect performance, e.g., probably would reduce performance to the level before we used serialization to persist data values since we have to iterate through the whole data vector to find alarms)

# DP-SERVICE (Data Platform service implementations)

### v1.11 test coverage for features added to gui
* (1) test coverage for ProviderMetadata embedded in ProviderInfo in QueryProvidersTest (need to ingest data to test)
* (1) test coverage for new ApiClient stuff?

### authentication / authorization
* Implement JWT-based authentication mechanism (find preliminary write up and paste here).
* Implement role-based authorization mechanism.
* (3) Add coverage for TLS encryption in gRPC communication to see performance compared to no encryption.  Does it make sense to enable TLS encryption without authentication if we are running infrastructure behind a firewall (similar to EPICS components)?  What is the performance impact of encryption?

### (3) java performance tuning
* Experiment with java virtual threads for some of the async libraries like mongo reactivestreams driver?
* Tuning (heap, garbage collection, dynamic thread allocation to worker pool)
* Multithreading controls - custom executor with core/max threads, mechanism for creating new workers when they are needed?
* Experiment with different number of threads / workers in handler?  investigate how to find max number of threads available to java and experiment within that range?

### export data to file
* (3) improved excel export
  * each data block is a sheet in the workbook (as opposed to one giant sheet)
  * each Calculations frame is a sheet in the workbook

### misc mongodb
* (1) DB connection pooling (e.g., HikariCP or Apache DBCP)?
* (2) change to replica set cluster (required for using transactions)
* (2) database sharding
* (2) Use retryable writes, exactly once for handling transient network errors and replica set elections https://www.mongodb.com/docs/manual/core/retryable-writes

### data curation and aging
* (2) Complementary to MongoDB scaling and performance optimization is the idea of MLDP “Data Curation” (covered in the Phase IIB Project Narrative).  We could develop tools for moving PV time-series data out of MongoDB to file storage (e.g., HDF5) for long-term archival (and sharing with other facilities), while maintaining the ability to index those files from the MLDP.

### (3) mongodb transaction handling
* I started down this path in v1.5 issue #103, but discovered transactions can't be used with standalone mongodb.
* Requires conversion to "replica set" cluster or sharded database.
* Can convert standalone database to replica set, but that has implications for development and deployment to casual users because can't use vanilla mongodb install
* see dp-service #103 for details, created new method MongoIngestionClientInterface.ingestionTransaction containing code for 3 steps (verifying provider, writing buckets, writing request status)

### (3) strategy/design/prototype for ingestion data validation
* do we want to enforce data type for PV in ingestion? what about array dimensions and nested data types etc
  * explicit registration of data type for each PV (register PV name, data type, dimensionality, sample period etc) vs. registration on first ingested data etc ?
  * specify dimensionality in PV registration or ingestion request?
  * would we ever want multiple data types for a PV?
* how to do this without affecting performance
* make this a configurable option?
* or do off-line (post-ingestion) validation to avoid performance impacts, part of monitoring tools like looking for ingestion errors

### ingestion service
* (3) dp-service #143: The biggest performance issue that is most directly under our control in the Ingestion Service is the lookup to verify provider by id for each ingestion request, 2% in the stream / bidi stream benchmarks but 6% in the byte stream scenario (IngestDataJob.handleIngestionRequest() 5% time spent in providerNameForId()). This could be improved by a caching mechanism with some ideas for implementation:
  * If a provider is not in the cache, refresh the cache and check again. Would need a mechanism for tracking unregistered / invalid providers so we don't keep checking a bad one.
  * Fetch the list of providers at start up, and then keep it fresh with calls to registerProvider().

### query service
* (3) dp-service #144: store serialized size for regular DataColumns in Mongo bucket documents: The biggest performance issue in the Query Service that is under our control is calling getSerializedSize() on each bucket (for checking response message size against the limit), which is 8-10% of the performance for the stream scenario but only 0.15% for the byte stream scenario (called from QueryDataStreamDispatcher.handleResult_()). I did some investigation of the gRPC code and this makes sense because in the former case we are getting the size of a DataColumn object and the size must be calculated based on each of the DataValues contained in the column, whereas in the latter case we are using a byte array containing the serialized DataColumn so the size can be calculated directly. I'm not going to make it a high priority to investigate this further at the moment, since I think/hope facilities that care about overall performance will use the byte data mechanism anyway. Potential solutions would include storing the serialized size of buckets in mongo on ingestion (when we are using regular DataColumns and not Serialized ones).
* (3) Should we add check that query time range is less than some configured maximum time range size?
* (3) I only implemented a single HandlerQueryInterface concrete class using the "sync" mongodb driver, since this meets our performance requirements (and seems to outperform the async/reactivestreams driver for our use) and is in some ways less complex to work with.  Should we try building a handler using the async/reactivestreams mongodb driver to compare performance?

### ingestion stream service
* (3) do we need to check that SubscribeDataEventRequest.DataEventOperation.DataEventWindow TimeInterval negative trigger time value is "reasonable", whatever that means? E.g., negative trigger time offset determines the age limit for the buffer, which might be sized to be excessively large, but would still be subject to the byte and number of item limits…


# DP-DESKTOP-APP (Data Platform desktop gui app)

## annotation builder
* (1) Calculations Data Frame button "Add to Query Editor"
(requires API change to queryTable() to support calculationsSpect or data frame)
  * add new calculations data frame field to Query Editor that shows display string
  * copy time range of data frame to query begin/end time
    * e.g., user enters pv names and gets PV time-series data side by side with calculations

## remote gRPC targets
* (1) mechanism for switching between in-process and remote grpc targets
* (2) do we want to always drop and recreate dp-demo database, or would it be better to just have a Tools->Delete Data option to clear it on request?
* (3) disable data generation when connected to remote grpc targets
* (3) enable Explore menu items by default, so that when we connect to remote system, we can query without ingesting data first

## general navigation
* (2) don't clear explore views when navigating to other views?
  * e.g., when navigating from annotation-explore and dataset-explore to Annotation Builder and Dataset Builder, keep contents of explore views for navigating back to them

## pv-explore
* (2) add mechanism for initiating a data event subscription from the pv-explore view, e.g., add hyperlink/button that moves you to dataset-explore view with selected PV name filled in etc.
  * Could use the type specified in the metadata to determine the proper DataValueType to use for the PvConditionTrigger value so that it matches the PV data.

## deployment
* (3) packaging / deployment
  * jpackage to create native installers 
  * dockerized version for demo environment with in-process gRPC pre-wired 
  * intelli-j javafx docs mention jlink https://www.jetbrains.com/help/idea/javafx.html#package-app-with-jlink
* (3) UI testing: TestFX for JavaFX GUI tests 
* (3) Logging / Debugging: Use SLF4J + Logback and expose logs in the GUI for visibility



# DP-WEB-APP (Data Platform web app)

### AI experiment?
* (2) Use claude or some AI agent to build a web app that "looks like" the desktop app?  Maybe a better use of time than hand-coding the existing React web app.

### (3) envoy configuration
* envoy config: can we use a single envoy.yaml for mac and non-mac?  The difference is literally a single line, maybe we could use localhost or 127.0.0.1 or whatever?
```
  diff envoy.yaml envoy.mac.yaml
  54c54
  <                     address: 0.0.0.0
---
>                     address: host.docker.internal
```

### (3) Mitch's web app todo list
* Create data blocks from existing query for use in data sets
* Streamline selection of pvs
  * Regex pattern to select PVs? Select range of PVs in a query via clicking PV names?
* Rerun raw data query with selected PVs
* Tabbing system within the app
  * Viewing a dataset will not take you to a new page but to a new tab within the app
  * Copying and pasting the URL will bring you back to your existing tabs
* handling for new annotation types / schema / api


# DP-SUPPORT (Data Platform deployment and ecosystem support)

### horizontal scaling of services
* (1) grpc load balancer / kubernetes prototype

### (3) mongo password handling
* extract MongoDB user/name password for dp-support docker and compass scripts from a config file


# DATA-PLATFORM (Data Platform installer and documentation)

### documentation
* (1) try tools for generating UML from code e.g., mermaid
  * https://medium.com/@optimzationking2/stop-drawing-diagrams-manually-8-game-changing-tools-that-generate-architecture-diagrams-from-code-71d4067092b5
* (1) generate UML for
  * data event subscription class diagram, interaction diagram (for incoming subscribeData() response stream)
  * GUI class diagram(s)
  * UML for important grpc API elements
  * interaction diagram for job execution?

### make-installer script
* (1) should clean / compile / install dp-grpc, then clean / compile / package dp-service
  * i think right now the installed version of dp-grpc is used, which might be the wrong version if the upstream directory is pointing at an older release branch than the current dev branch (which is likely)
* (3) check dp-grpc version number in dp-service pom.xml using version number on command line.
* (3) add parameter for release tag and use it for naming tar file?
* (3) set up to run on new host/vm as different user with fresh clone of repos etc, delete maven repo to make sure we get a new dp-grpc in dp-service etc.





# Monitoring

### (3) data statistics framework
* should we add a framework for measuring data statistics, e.g., add fields containing time data was captured, time request was sent, time request was received, and time bucket was created, etc.  Could put in requestStatus document, bucket documents, or new statistics collection.

### downstream monitoring of data
* (3) mechanism for validating contents of SerializedDataColumns - is this a monitoring tool?  Try to deserialize contents outside of ingestion process and flag issues with contents?


# Client Tools (client-level frameworks, tools)

### EPIC aggregator streaming
* (2) EPICS aggregator  infrastructure component that streams data to MLDP instead of writing hdf5 file

### ingestion automation
* (2) Explore development of tools to automate the ingestion of tabular data files (CSV / Excel) containing PV time-series data, combined with a directory watcher mechanism to trigger automatic ingestion of files added to the input directory.  The new ImportUtility added to dp-service for the desktop application might be used for this purpose.

### automation for data cleaning
* (3) Use the MLDP Ingestion Stream Service as the foundation for automation of data cleaning including data event monitoring, tagging suspicious / erroneous data points, normalizing data and uploading calculated data to the archive via the Annotation Service’s Calculations mechanism.

### client ingestion stream processing
* (3) Build framework that aggregates PV data into block/tabular structure into correlated blocks with API for consumption by algorithms and applications for data event monitoring. Incorporate components built by Chris for aggregating bucket-oriented query results into correlated blocks. Utilize Ingestion and Ingestion Stream Service subscription mechanisms for accessing data from ingestion stream.

### plugin framework (Application Framework / Java API library)
* (3) Create application framework for building "plugins" for data event monitoring and algorithm processing. Follow patterns and conventions Chris has used for the client libraries. Utilize Ingestion and Ingestion Stream Service subscription mechanisms for accessing data from ingestion stream.

### (3) python client library development
* Many public Off-The-Shelf ML/AI and data analysis libraries are written in Python (e.g., TensorFlow, Keros, scikit-learn, NumPy, etc.) and are familiar to data scientists.  The availability of a Python Client Library for the Data Platform would support direct integration with these Python libraries.  The Python API Library would support the following: Heterogeneous, time-series data search and query; Metadata queries, data provenance, etc; Annotations – comments, data relationships, post-ingestion calculations; Support for data ingestion with Python is probably unwarranted, and ill advised (too inefficient).

# Side Projects / Prototypes

### (2) load testing
* Run large-scale load testing.
* Try continuous capture for 24 hours of "typical" accelerator scenario (4000 pvs sampled at 1 KHz)?
* Try NASA scenario with 250 KHz data for 30 minutes?
* Measure impact of data subscription mechanism on Ingestion Service?
* Use Chris's data generator?

### communication
* (3) kafka prototype for data subscription - what would we gain
* (3) redis prototype
  * horizontal scaling: consider using a redis queue for ingestion, with multiple consumers processing queue (vs. handle with queue and threads) vs. grpc load balancer


### application framework
* (2) spring boot retrofit prototype
