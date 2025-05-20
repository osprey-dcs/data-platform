# development roadmap through august

## ingestion stream service - Craig
* Build service that aggregates PV data into block/tabular structure into correlated blocks with API for consumption by algorithms and applications for data event monitoring.
* Incorporate components built by Chris for aggregating bucket-oriented query results into correlated blocks.
* Utilize Ingestion Service data subscription mechanism for accessing data from ingestion stream.
* Filtering: 1.7 ingestion stream prototype includes a filtering (condition filter) mechanism with API, should this be part of ingestion stream service or a client application facility.  Could also apply to query results, and that might be a good reason to make it part of the client library.

## plugin framework (Application Framework / Java API library) - Chris
* Create application framework for building "plugins" for data event monitoring and algorithm processing.
* Follow patterns and conventions Chris has used for the client libraries.
* Access data using mechanisms provided by Ingestion Stream Service (aggregated data / correlated data blocks) and Ingestion Service subscription API (raw ingestion data).

## integration testing
* how to include michael's aggregator

## web application - Mitch
* Create data blocks from existing query for use in data sets
* Streamline selection of pvs
  * Regex pattern to select PVs? Select range of PVs in a query via clicking PV names?
* Rerun raw data query with selected PVs
* Tabbing system within the app
  * Viewing a dataset will not take you to a new page but to a new tab within the app
  * Copying and pasting the URL will bring you back to your existing tabs
* handling for new annotation types / schema / api

## side projects for investigation
* load balancer / kubernetes prototype
* kafka prototype for data subscription?
* spring boot retrofit prototype
* mongo connection pooling prototype
* mongo sharding prototype

# ===== FEATURES FOR FUTURE VERSIONS =====

## event monitoring prototype next steps (done in v1.7 as ingestionstream service, move to new application framework?  or add a filtering mechanism to new ingestionstream service focused on aggregating correlated data blocks)
* ConditionMonitor.handleSubscribeDataResult(): Flesh out method to cover all data types, and all operator cases for each type.  We plan to do this as an example/tutorial for the "plugin framework" (application framework for implementing data event monitoring and algorithms). 
* EventMonitorSubscribeDataResponseObserver.onError(), onCompleted(), onNext().RESULT_NOT_SET: notify subscriptionManager of problem so it can clean up,
  * remove responseObserver and list of EventMonitors for PV name
  * close streams for subscribeDataEvent() that use the PV
  * should we try again to call subscribeData() for a PV when the ingestion service closes the stream but there are EventMonitors that want data for the PV?
    * could try to resubscribe, but what if the ingestion service is shutting down?
* add IngestionServiceClient.setChannel() for using inprocess grpc?  Should we change benchmark client to use the same mechanism?  Should we change everything to use the same mechanism and the test framework can setup inprocess grpc while everything else is out-of-process with the appropriate kind of channel builder?
* add request validation that each PV name exists in archive in IngestionServiceImpl.subscribeData()?  Or do this in Ingestion Stream Service subscribeDataEvent() only?
* measure impact of data subscription handling on performance benchmark

## SerializedDataColumn
* add more attributes? E.g., for specifying the data type in the request (instead of determining it from the type of the first DataValue)?  Other metadata like sampleCount?

## downstream monitoring of data
* mechanism for validating contents of SerializedDataColumns - is this a monitoring tool?  Try to deserialize contents outside of ingestion process and flag issues with contents?

## excel export
* each data block is a sheet in the workbook (as opposed to one giant sheet)
* each Calculations frame is a sheet in the workbook

## sharing and access control
* Define and implement model for ownership and sharing of data, datasets, and annotations.
* Relationship to authentication/login mechanism (which I think we've said we're putting off beyond August - confirm).

## load testing
* Run large-scale load testing.
* Try continuous capture for 24 hours of "typical" accelerator scenario (4000 pvs sampled at 1 KHz)?
* Try NASA scenario with 250 KHz data for 30 minutes?
* Measure impact of data subscription mechanism on Ingestion Service?
* Use Chris's data generator?

# extend ingestion benchmark to run NASA scenario
* either use ingestion benchmark framework, or create a new load test framework, but what's the difference?
* signals sampled with 4 bytes data + 1 byte of status according to Bob
  * 1000 signals sampled at 250 kHz,
  * 1GB / sec
  * 60 GB / min
  * 1.8 TB / 30 min
* probably need to either set up a server on AWS cloud, or buy external storage to do this test

## bob's provenance scenario
* The Data Platform is optimized for recalling thousands of signals at a single point in time. The Archive Appliance is not. It is good at recall a small number of signals over a large period of time.
* The Data Platform is for managing data sets - annotating them, deleting them, and using them in the life cycle of the data. One of our use cases is experimental data.
* A scientist takes XRay data from some number of detectors, along with some scalar and vector data. The XRay data has to be processed as these XRays are taken from different angles at different distances into some normalized coordinate data. The original data must be preserved for verification of published results especially in proton studies. So the MLDP would have the raw data set stored. In it's Mongo index, this file would be noted for the sample, date and owner of the data. The data scientists would normalize the coordinates and create a new MLDP version of the data. The Mongo index would have a link to the RAW data file and include in the metadata the code / version of the algorithm used to normalize the coordinates, the date it was run, and the person that performed the normalization. This normalized data would then be processed further to reconstruct the protein structure. This file would point back to the normalized data - and add the information for this transformation. This is the provenance portion of the data and its most challenging scenario.

## simple data generator for demo / web application data
* data generator with broader time range and different data types
* include datasets / annotations / ingestion attributes and event metadata
* what is the relationship to simulator that Chris is building

## ingestion provider validation
* consider adding a config resource to disable provider id validation?
* could validate providers "off-line" (post-ingestion)

## data statistics framework
* should we add a framework for measuring data statistics, e.g., add fields containing time data was captured, time request was sent, time request was received, and time bucket was created, etc.  Could put in requestStatus document, bucket documents, or new statistics collection.

## use transaction for writing ingestion artifacts
* I started down this path in v1.5 issue #103, but discovered transactions can't be used with standalone mongodb.
* Requires conversion to "replica set" cluster or sharded database.
* Can convert standalone database to replica set, but that has implications for development and deployment to casual users because can't use vanilla mongodb install
* see dp-service #103 for details, created new method MongoIngestionClientInterface.ingestionTransaction containing code for 3 steps (verifying provider, writing buckets, writing request status)

## strategy/design/prototype for ingestion data validation
* do we want to enforce data type for PV in ingestion? what about array dimensions and nested data types etc
  * explicit registration of data type for each PV (register PV name, data type, dimensionality, sample period etc) vs. registration on first ingested data etc ?
  * specify dimensionality in PV registration or ingestion request?
  * would we ever want multiple data types for a PV?
* how to do this without affecting performance
* make this a configurable option?
* or do off-line (post-ingestion) validation to avoid performance impacts, part of monitoring tools like looking for ingestion errors

## documentation
* UML for important grpc API elements
* interaction diagram for job execution?

## general
* make collection names (or database name) configurable?

## ValueStatus / EPICS status and alarm handling
* do we need a way to query by alarm conditions, or add it to metadata for a PV (last alarm etc), this would mean unpacking the serialized DataColumn byte array values (or setting fields in the bucket indicating alarms during ingestion which would affect performance, e.g., probably would reduce performance to the level before we used serialization to persist data values since we have to iterate through the whole data vector to find alarms)

## ingestion service
* use parallel stream iteration in ingesting the batch of data buckets for an ingestion request? e.g.,
<pre>
  List<Integer> squaredNumbers = numbers.parallelStream()
  .map(number -> number * number)
  .collect(Collectors.toList());
</pre>

## query service
* should we change the query handler tests in MongoQueryHandlerTestBase / MongoSyncQueryHandlerTest to be integration tests?  The code inserts bucket documents manually for use in the query tests, and this is a completely different path than the buckets created by the ingestion service.  It caused a failure because the code to insert bucket documents was not properly naming the DataColumns serialized to the database, so the deserialized columns caused assertion failures checking the column name in query results.
* Should we add check that query time range is less than some configured maximum time range size?
* I only implemented a single HandlerQueryInterface concrete class using the "sync" mongodb driver, since this meets our performance requirements (and seems to outperform the async/reactivestreams driver for our use) and is in some ways less complex to work with.  Should we try building a handler using the async/reactivestreams mongodb driver to compare performance?

## annotation service
* should we allow deleting datasets and annotations?

## annotation to bucket collection database document cross reference
* Should we cross reference annotations to buckets and/or vice versa? 
  * E.g., annotation documents have references to the affected buckets by bucket id? 
  * bucket documents contain list of annotations that apply to bucket? (which would complicate modifying annotation)?
  * Query and modification implications, e.g,
    * If we need to update annotations, we probably want to keep a metadata collection with one or two way references between the metadata document and the bucket documents that it applies to, but this is messy if we are specifying the metadata on each individual request, at that point it might make sense to register the metadata, get an id for it, and the send the id in requests.
    * Relationship between event metadata and attributes added during ingestion to the annotation information, is it the same schema?  Do we need to change something about ingestion?

## envoy configuration
* envoy config: can we use a single envoy.yaml for mac and non-mac?  The difference is literally a single line, maybe we could use localhost or 127.0.0.1 or whatever?
```
  diff envoy.yaml envoy.mac.yaml
  54c54
  <                     address: 0.0.0.0
---
>                     address: host.docker.internal
```

## installation and deployment
* make-installer: check dp-grpc version number in dp-service pom.xml using version number on command line.
* make-installer: add parameter for release tag and use it for naming tar file? 
* make-installer: set up to run on new host/vm as different user with fresh clone of repos etc, delete maven repo to make sure we get a new dp-grpc in dp-service etc.
* extract MongoDB user/name password for dp-support docker and compass scripts from a config file

## java client
* Create client to subscribe to query stream for specified PVs?  E.g., 
  * write data to file at some time interval (hdf5, numpy), allow consumer to subscribe to notification when new data is ready, use onNext() etc pattern 
  * keep a rolling window looking back some specified time window

## authentication / authorization
* Add coverage for TLS encryption in gRPC communication to see performance compared to no encryption.  Does it make sense to enable TLS encryption without authentication if we are running infrastructure behind a firewall (similar to EPICS components)?  What is the performance impact of encryption?

## benchmarking
* Exit benchmarks if corresponding service is not running.

## integration test
* Add support for running integration test with out-of-process grpc against running ingestion and query servers?
  * Add methods for determining whether to run requestObserver.onNext(), onCompleted(), onError() in a different thread for in-process but directly for out-of-process?  Or just leave it the way it is with sending requestObserver messages in a different thread (added because in-process grpc runs sending request and receiving response in same thread, which can cause some issues for re-entering synchronized handler code that was designed to expect different threads).
* Add in-process grpc test coverage for ingestion and query rejects and error conditions? Added coverage for the getColumnInfo() API so can follow that pattern.  Do we need coverage?  There is some other coverage already.

## testing
* More sophisticated grpc test coverage using mockito etc?  Maybe not necessary with integration test coverage.  See:
  * https://github.com/grpc/grpc-java/blob/master/examples/src/test/java/io/grpc/examples/helloworld/HelloWorldClientTest.java
  * https://github.com/grpc/grpc-java/blob/master/examples/src/test/java/io/grpc/examples/routeguide/RouteGuideClientTest.java

## architecture and performance tuning
* Tuning (heap, garbage collection, dynamic thread allocation to worker pool)
* Multithreading controls - custom executor with core/max threads, mechanism for creating new workers when they are needed?
* Experiment with different number of threads / workers in handler?  investigate how to find max number of threads available to java and experiment within that range?
* test horizontal scaling of ingestion and query services?
* Use CompletableFuture for non-blocking async?
  * https://medium.com/javarevisited/java-completablefuture-c47ca8c885af
* Experiment with java virtual threads for some of the async libraries like mongo reactivestreams driver?
* horizontal scaling: consider using a redis queue for ingestion, with multiple consumers processing queue (vs. handle with queue and threads) vs. grpc load balancer

## mongo
* DB connection pooling (e.g., HikariCP or Apache DBCP)?
* change to replica set cluster (required for using transactions)
* Mongo database sharding
* Use retryable writes, exactly once for handling transient network errors and replica set elections https://www.mongodb.com/docs/manual/core/retryable-writes

## configuration
* Add a configuration report to ConfigurationManager that returns an object containing properties read from config file, properties overridden on command line, etc? (for testing, not sure we need it).
* Add a mechanism for the application to specify configuration properties that it expects to find, e.g., a list of properties during initialization, so that we can check up front instead of one at a time as we need them - not sure this is useful either, but might be good to know where the configuration doesn't contain expected values and we'll be using defaults?
