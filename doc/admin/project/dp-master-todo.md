# highlights of items listed below
* Move contents of dp-common repo to dp-service
* update deployment process to run from dp-service, include all services and benchmarks
* java changes to reflect Chris's bulk renaming in gRPC API proto files
* documentation for integration test framework, query service API, implementation, developer notes etc
* experiment using a mongo BSON bucket document format that stores data in protobuf format to avoid unpacking data in ingestion and repacking data in query
* define API and develop initial implementation of annotation service
* add attributes, event metadata, and annotations to query API
* ingestion and query handling for arrays, tables, images, structures etc
* ingestion and query handling for irregular sample intervals

# installation and deployment
* New process for running both ingestion and query services from dp-service (original docs for dp-ingest).
* Add mechanisms for running performance benchmarks?
* Support/documentation for deploying mongodb/express as docker containers?

# documentation
* Update installation and deployment instructions to reflect dp-service repo changes.
* Overview of initial query service implementation.
* Overview of integration test and benchmark framework.
* Add/update query API docs.
* Add/update API docs to reflect name changes to common and ingestion.
* Add/update annotation API docs.

# general
* Reflect gRPC API name changes in ingestion and query service implementations.

# ingestion
* Test with new mongo BSON Java POJO document type using protobuf format for data values without unpacking it (might support heterogeneous datatypes directly without explicit handling), would also avoid re-packing data in the query service.
  * Store serialized size of data in bucket for convenience?
  * Are there issues with the data being "opaque" in the database?
* Move logic from init() to start() in MongoIngestionHandler for starting queue and workers?
* Handling for heterogeneous data types e.g., array, table, byte array, image, structure.
  * Need BucketDocument subclass for each type of list data, e.g, for array might need multiple classes like array-float, array-string, …, not to mention table-float, table-string, … and maybe even cube-float, cube-string, … (I think Bob and Chris have said we only care about arrays and tables but need to confirm).
  * Should IngestionRequest specify dimensions of array data structures, or are we allowing unlimited dimensions?
  * Should IngestionRequest columns specify data type? Would we ever want multiple data types in a column? In George's original schema, each DataValue can be a different type, but still could specify intention and check values instead of just deducing from first data value so we can reject an invalid request.
  * Change MongoHandlerBase.generateBucketsFromRequest() to create and populate the correct type of document from within the switch statement by data type?
  * Test framework / client: Change IngestionTestBase.buildIngestionRequest() to build the appropriate DataValue elements, and add test coverage to MongoHandlerTestBase for success and failure scenarios.
* Handling for list of timestamps instead of startTime/interval/numSamples.
* Handling for irregular sample intervals. How do we accommodate both regular and irregular buckets in mongodb?  E.g., use a map data structure, mark bucket type as regular or irregular to indicate handling.  What is impact on query service of having to deal with both?  Better to have separate mongo collections?
  * Could probably have a new "AbstractBucketDocument" super class with derivations for fixed interval (existing BucketDocument class) and irregular interval following pattern of BucketDocument subclasses using discriminator annotation on subclasses.
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

# query
* Add support (API and handling) for searching by attributes and event metadata (was holding off to see how the annotation API design falls out).
  * MongoQueryHandler.dataBucketFromDocument() handle attributes, eventMetadata.
* Should we add check that query time range is less than some configured maximum time range size?
* I only implemented a single HandlerQueryInterface concrete class using the "sync" mongodb driver, since this meets our performance requirements (and seems to outperform the async/reactivestreams driver for our use) and is in some ways less complex to work with.  Should we try building a handler using the async/reactivestreams mongodb driver to compare performance?

# annotation
* Define initial annotation API.
* Define database schema for storing annotations, as separate collection with references to the affected buckets by bucket id? Reference by time range?  Copy annotation (e.g., key/values) to each bucket that it pertains to (which would complicate modifying annotation).  Bucket reference back to annotation(s)?  Query and modification implications, e.g,
  * If we need to update annotations, we probably want to keep a metadata collection with one or two way references between the metadata document and the bucket documents that it applies to, but this is messy if we are specifying the metadata on each individual request, at that point it might make sense to register the metadata, get an id for it, and the send the id in requests.
  * Relationship between event metadata and attributes added during ingestion to the annotation information, is it the same schema?  Do we need to change something about ingestion?
* Implement initial annotation service.

# dp-grpc
* Finish making name changes to existing API spec.

# repo admin
* add tags for v1.1 with initial query service
* create dev-1.2 dev branches
* can remove dp-ingest, dp-query, dp-common

# java client
* Create client to subscribe to query stream for specified PVs?  E.g., 
  * write data to file at some time interval (hdf5, numpy), allow consumer to subscribe to notification when new data is ready, use onNext() etc pattern 
  * keep a rolling window looking back some specified time window

# authentication / authorization
* Add coverage for TLS encryption in gRPC communication to see performance compared to no encryption.  Does it make sense to enable TLS encryption without authentication if we are running infrastructure behind a firewall (similar to EPICS components)?  What is the performance impact of encryption?

# benchmarking
* Exit benchmarks if corresponding service is not running.
* Should we clean up after running the benchmark / integration tests, which add data to the default bucket collection, by removing the data they created?  Should we override the default collection names for the purposes of the test?
* Currently the ingestion benchmark (and therefore integration test) create data for a configured time in the past (which the integration then uses for the corresponding queries).  The query benchmarks just use the current time, since they create their own data.  Is it better to have the ingestion benchmark create data for a configured time in the past or just use the current?  Currently the test fails if the data already exists, so it must be manually removed to run the test again, which is sort of a feature but sort of a pain.
* Scale / load testing. How big can a collection be before it is impractical?

# integration test
* Remove data created by integration test at completion?  Use command line switch/config? Talk to Chris.
* Add support for running integration test with out-of-process grpc against running ingestion and query servers?
  * Add methods for determining whether to run requestObserver.onNext(), onCompleted(), onError() in a different thread for in-process but directly for out-of-process?  Or just leave it the way it is with sending requestObserver messages in a different thread (added because in-process grpc runs sending request and receiving response in same thread, which can cause some issues for re-entering synchronized handler code that was designed to expect different threads).
* Add in-process grpc test coverage for ingestion and query rejects and error conditions? Added coverage for the getColumnInfo() API so can follow that pattern.  Do we need coverage?  There is some other coverage already.

# testing
* More sophisticated grpc test coverage using mockito etc?  Maybe not necessary with integration test coverage.  See:
  * https://github.com/grpc/grpc-java/blob/master/examples/src/test/java/io/grpc/examples/helloworld/HelloWorldClientTest.java
  * https://github.com/grpc/grpc-java/blob/master/examples/src/test/java/io/grpc/examples/routeguide/RouteGuideClientTest.java

# architecture and performance tuning
* Tuning (heap, garbage collection, dynamic thread allocation to worker pool)
* Multithreading controls - custom executor with core/max threads, mechanism for creating new workers when they are needed?
* Experiment with different number of threads / workers in handler?  investigate how to find max number of threads available to java and experiment within that range?
* test horizontal scaling of ingestion and query services?
* Use CompletableFuture for non-blocking async?
  * https://medium.com/javarevisited/java-completablefuture-c47ca8c885af
* Experiment with java virtual threads for some of the async libraries like mongo reactivestreams driver?

# mongo
* DB connection pooling (e.g., HikariCP or Apache DBCP)?
* Mongo database sharding?
* Use retryable writes, exactly once for handling transient network errors and replica set elections https://www.mongodb.com/docs/manual/core/retryable-writes

# configuration
* Move contents of dp-common repo to dp-service since Chris doesn't plan to use it in the client libraries.
* Add a configuration report to ConfigurationManager that returns an object containing properties read from config file, properties overridden on command line, etc? (for testing, not sure we need it).
* Add a mechanism for the application to specify configuration properties that it expects to find, e.g., a list of properties during initialization, so that we can check up front instead of one at a time as we need them - not sure this is useful either, but might be good to know where the configuration doesn't contain expected values and we'll be using defaults?

# blue sky
* Kafka ingestion prototype?