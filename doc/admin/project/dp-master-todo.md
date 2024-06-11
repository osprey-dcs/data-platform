# v1.4 (may/june)

## (dp-service #67) misc ingestion service features
* handling for unary ingestion rpc (only streaming is currently implemented)
* should we use an enum for requestStatus to constrain the values?

## ingestion and query handling for buckets with explicit list of timestamps
* instead of SamplingClock with start time, periodNanos, and sample count
* How do we accommodate both SamplingClock and TimestampList buckets in mongodb?  Maybe just have an optional list of timestamps that if populated implies bucket uses timestamp list, otherwise use SamplingClock.
* MongoQueryHandler.dataTimestampsForBucket(): Change to determine whether to use explicit timestamp list or samplingClock from BucketDocument (e.g., does it contain a non-empty list of timestamps?)
* check code for lastSamplingClock to make sure it will handle case where there is an explicit list of timestamps, e.g., get count from number of timestamps, calculate sample period from delta of two timestamps?

## annotation service
* check indexes for queryDataSets(), queryAnnotations()

## web app support
* change logic for checking response message size when building intermediate data structure (map) instead of when building the table response

## handling for eventMetadata.stopTime
* add ingestion handling and test coverage for eventMetadata.stopTime
  * in MongoIngestionHandler.generateBucketsFromRequest() etc
  * add support to BucketDocument for EventMetadata.stopTimestamp. Either rename existing eventSeconds/Nanos to eventStartSeconds/Nanos, or add new EventMetadata object to contain the data as a field of BucketDocument
* add query handling for EventMetadata.stopTimestamp 
  * building grpc response in MongoQueryHandler.dataBucketFromDocument()
* add integration test coverage 
  * set attributes and event metadata in ingestion and check QueryDataResponse that query correctly returns that data

## build etc.
* investigate compiler warning for QueryServiceImpl, IngestionTestBase "uses unchecked or unsafe operations"
  * BucketDocumentResponseDispatcher.handleResult_(): "raw use of parameterized class Bucketdocument"
  * IngestionTestBase: unchecked cast Object to List<Double> in buildIngestionRequest()



# v1.5 (june/july)

## general
* how to handle keywords / attributes (and description?) generically so they can be used for dataset, annotation, (buckets? not sure that makes sense)
* rename inconsistently named handler methods in annotation to drop word request?  maybe the pattern should be "handleRpcMethodName"?  Maybe similar pattern for Job and Dispatcher classes?  See table in tech document that shows all names.
* What is best API type and Java POJO type for field that is a mongo id (string vs. ObjectId vs. ?)? (e.g., dataSetId reference from annotation, list of bucket ids in requestStatus)

## query
* QueryResponseBidiStreamRequestStreamObserver.onNext() - check if query is already in process before accepting a subsequent one (e.g., cursor not null)

## load testing
* Scale / load testing. How big can a collection be before it is impractical?
  * focus on NASA 30 minute use case described by Bob

## build / deployment
* update to latest Java version


# ===== FEATURES FOR FUTURE VERSIONS =====

## documentation
* interaction diagram for job execution? 
* UML for grpc service proto files

## general
* make collection names (or database name) configurable?

## ingestion
* Consider using annotations collection / data model for storing event metadata, attribues attached to ingestion requests? (finish initial annotation implementation first)
* Should IngestionRequest specify dimensions of array data structures, or are we allowing unlimited dimensions?
* Should IngestionRequest columns specify data type? Would we ever want multiple data types in a column? In George's original schema, each DataValue can be a different type, but still could specify intention and check values instead of just deducing from first data value so we can reject an invalid request.
* How to enforce the data type for a particular column?  How to enforce dimensions of array data types?
  * could make this configurable
  * explicit registration of column name, data type, dimensionality, sample period, etc
  * registration of a column's details on first ingestion, reject might be confusing since it's behind the scenes
* Implement provider registration API.  Currently just use integer chosen by client.
* Add API for checking status of ingestion requests.
* use parallel stream iteration in ingesting the batch of data buckets for an ingestion request? e.g.,
<pre>
  List<Integer> squaredNumbers = numbers.parallelStream()
  .map(number -> number * number)
  .collect(Collectors.toList());
</pre>
* More explicit support for EPICS data types?
* Support for alarm values (e.g., ValueStatus), "user tag" aspect of EPICS timstamp.

## query
* should we change the query handler tests in MongoQueryHandlerTestBase / MongoSyncQueryHandlerTest to be integration tests?  The code inserts bucket documents manually for use in the query tests, and this is a completely different path than the buckets created by the ingestion service.  It caused a failure because the code to insert bucket documents was not properly naming the DataColumns serialized to the database, so the deserialized columns caused assertion failures checking the column name in query results.
* Should we add check that query time range is less than some configured maximum time range size?
* I only implemented a single HandlerQueryInterface concrete class using the "sync" mongodb driver, since this meets our performance requirements (and seems to outperform the async/reactivestreams driver for our use) and is in some ways less complex to work with.  Should we try building a handler using the async/reactivestreams mongodb driver to compare performance?

## annotation
* Should we cross reference annotations to buckets and/or vice versa? 
  * E.g., annotation documents have references to the affected buckets by bucket id? 
  * bucket documents contain list of annotations that apply to bucket? (which would complicate modifying annotation)?
  * Query and modification implications, e.g,
    * If we need to update annotations, we probably want to keep a metadata collection with one or two way references between the metadata document and the bucket documents that it applies to, but this is messy if we are specifying the metadata on each individual request, at that point it might make sense to register the metadata, get an id for it, and the send the id in requests.
    * Relationship between event metadata and attributes added during ingestion to the annotation information, is it the same schema?  Do we need to change something about ingestion?

## dp-grpc

## dp-support
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

## mongo
* DB connection pooling (e.g., HikariCP or Apache DBCP)?
* Mongo database sharding?
* Use retryable writes, exactly once for handling transient network errors and replica set elections https://www.mongodb.com/docs/manual/core/retryable-writes

## configuration
* Add a configuration report to ConfigurationManager that returns an object containing properties read from config file, properties overridden on command line, etc? (for testing, not sure we need it).
* Add a mechanism for the application to specify configuration properties that it expects to find, e.g., a list of properties during initialization, so that we can check up front instead of one at a time as we need them - not sure this is useful either, but might be good to know where the configuration doesn't contain expected values and we'll be using defaults?

## blue sky
* Kafka ingestion prototype?