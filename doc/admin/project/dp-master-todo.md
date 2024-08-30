# v1.6 (september-october)

## design/prototype for additional annotation types
* think about how to handle linked dataset, and maybe implement it
  * is there a list of linked dataset ids?  What about the model where an annotation is for a single dataset? Should we change annotation model to include a list of datasets instead of single one?
  * should we consider one giant annotation structure that can include comment, list of links, etc (sort of what Chris had in the original proposal), or is it better to have different types of annotations with different fields?
* consider other needed features for annotations / datasets, e.g,.
  * what ownership/group/sharing/permissions/audit trail info do we want to attach to annotations and datasets?  Where else do we need this?
  * how to handle keywords / attributes (and description?) generically so they can be used for dataset, annotation, (buckets? not sure that makes sense)
    * Does this belong with ownership/sharing/etc properties or a separate object?
* consider changes to data model
  * consider eliminating different subtypes of annotation, and have one fat class/document that includes everything (comment, linked data sets, etc).
  * consider adding a generic "text" field to base annotation document class that is used as needed by subclasses (e.g., comment for CommentAnnotation, description for LinkedDataSetAnnotation, ...).  Mongo only supports a single text indexed field per collection.
  * Should we simplify the query methods to be a flat data structure with all the fields reflected in the list of criteria, or stick with list of criteria?
*  from bob (need to clarify)
  * Perhaps point to a calibration file.
    * Owner
    * Date
    * For data sets that were generated from raw data, a pointer to the raw data file, the code that produced this file and the version of that code.
* Should ownerId be required on dataset queries?


## export service prototype
* part of annotation service or new standalone service? initially will add to annotation service
  * the export feature could get "busy" in a facility running continuous machine learning
* use DataSet model from annotations in new API e.g., exportDataSet(DataSet) rpc method returns URL to exported file
* what formats to support? bob said hdf5 initially, what else?
  * probably 2 different hdf5 formats e.g, one for data platform archive format (using serialize data values) and one for user consumption (where DataValues are unpacked)
* how to handle arbitrarily nested arrays of structures containing arrays of images etc.

## extend ingestion benchmark to run NASA scenario
* either use ingestion benchmark framework, or create a new load test framework, but what's the difference?
* signals sampled with 4 bytes data + 1 byte of status according to Bob
  * 1000 signals sampled at 250 kHz, 
  * 1GB / sec
  * 60 GB / min
  * 1.8 TB / 30 min
* probably need to either set up a server on AWS cloud, or buy external storage to do this test

# ===== FEATURES FOR FUTURE VERSIONS =====

## simple data generator for demo / web application data
* data generator with broader time range and different data types
* include datasets / annotations / ingestion attributes and event metadata
* what is the relationship to simulator that Chris is building

## ingestion provider validation
* consider adding a config resource to disable provider id validation?
* could validate providers "off-line" (post-ingestion)

## provider metadata
* do we want a provider metadata query and where does it belong?

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

## use annotation model to store ingestion metadata like attributes and event metadata?
* Consider using annotations collection / data model for storing event metadata, attribues attached to ingestion requests?
* use parallel stream iteration in ingesting the batch of data buckets for an ingestion request? e.g.,
<pre>
  List<Integer> squaredNumbers = numbers.parallelStream()
  .map(number -> number * number)
  .collect(Collectors.toList());
</pre>

## query
* should we change the query handler tests in MongoQueryHandlerTestBase / MongoSyncQueryHandlerTest to be integration tests?  The code inserts bucket documents manually for use in the query tests, and this is a completely different path than the buckets created by the ingestion service.  It caused a failure because the code to insert bucket documents was not properly naming the DataColumns serialized to the database, so the deserialized columns caused assertion failures checking the column name in query results.
* Should we add check that query time range is less than some configured maximum time range size?
* I only implemented a single HandlerQueryInterface concrete class using the "sync" mongodb driver, since this meets our performance requirements (and seems to outperform the async/reactivestreams driver for our use) and is in some ways less complex to work with.  Should we try building a handler using the async/reactivestreams mongodb driver to compare performance?

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

## mongo
* DB connection pooling (e.g., HikariCP or Apache DBCP)?
* change to replica set cluster (required for using transactions)
* Mongo database sharding
* Use retryable writes, exactly once for handling transient network errors and replica set elections https://www.mongodb.com/docs/manual/core/retryable-writes

## configuration
* Add a configuration report to ConfigurationManager that returns an object containing properties read from config file, properties overridden on command line, etc? (for testing, not sure we need it).
* Add a mechanism for the application to specify configuration properties that it expects to find, e.g., a list of properties during initialization, so that we can check up front instead of one at a time as we need them - not sure this is useful either, but might be good to know where the configuration doesn't contain expected values and we'll be using defaults?

## blue sky
* Kafka ingestion prototype?