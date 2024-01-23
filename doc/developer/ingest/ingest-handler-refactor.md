# December 2023: refactoring ingestion service implementation to separate handler logic from database code

Before adding query handling logic to the query service, I wanted to refactor some code from the ingestion service so that common code for interacting with MongoDB can be shared by both service implementations (e.g., Ingestion and Query).

The primary refactoring that I performed was to separate the Mongo-specific database code from the service-specific request handling logic.  My thinking is that we want to share (and extend) the code for connecting to the database, creating collections and building indexes with all service implementations, but allow each service implementation to use appropriate control and data structures for handling requests that are probably unique to that service.  Previously, the class _MongoHandlerBase_ included both database code and the logic for handling incoming requests.

I moved the database code into a new hierarchy in the shared _common.mongo_ package.  The new database interface framework includes three classes.  The core logic from _MongoHandlerBase_ was moved to _MongoClientBase_, which defines a set of abstract methods and includes logic for initializing a database connection and creating the containers in the database that uses those abstract methods.  Two subclasses implement the abstract method interface to provide concrete implementations using the MongoDB sync and async (reactivestreams) drivers.  The subclass _MongoSyncClient_ uses the sync driver for interacting with the database and contains logic moved from the ingestion server class _MongoSyncHandler_.  _MongoAsyncClient_ uses the async / reactivestreams driver for interacting with the database and contains logic moved from the ingestion server class _MongoAsyncHandler_.

The ingestion service logic for handling incoming requests by using a pool of workers to service a queue of incoming requests is moved to the new class _ingest.handler.mongo.MongoIngestionHandler_.  The handler uses an ingestion database client for interacting with the database.  The operations required of the ingestion database client by the handler are defined in the _MongoIngestionClientInterface_.  The two concrete implementations of that interface, _MongoSyncIngestionClient_ and _MongoAsyncIngestionClient_, derive from the corresponding client base classes, _MongoSyncClient_ and _MongoAsyncClient_, respectively, to provide the required database operations using the sync and async mongodb drivers.

Below are more detailed descriptions of some of the relevant classes:

## common.bson.BsonConstants.java
- file: Added new class in common.bson package to contain constants for field names used in mongo BSON documents.

## common.mongo.MongoClientBase.java
- file: Added new class in common.mongo package to contain core logic for initializing mongodb client database connection, and creating containers/indexes within the database.
- abstract methods: Defines an abstract method interface for concrete subclasses that includes: initMongoClient(), initMongoDatabase(), initMongoCollectionBuckets(), createMongoIndexBuckets(), initMongoCollectionRequestStatus(), createMongoIndexRequestStatus().
- constants: Defines constants for MONGO_DATABASE_NAME, COLLECTION_NAME_BUCKETS, COLLECTION_NAME_REQUEST_STATUS.
- configuration: Defines constants for configuration resource names and default values for database host, port, user, and password.
- configMgr(): Convenience method for accessing ConfigurationManager singleton.
- getPojoCodecRegistry(): Sets up codec registry so mongo clients can find the user-defined POJO codec classes for our BSON bucket document hierarchy.
- init(), fini(), getMongoConnectString(), getMongoDatabaseName(), getCollectionNameBuckets(), getCollectionNameRequestStatus(), createMongoIndexesBuckets(), createMongoIndexesRequestStatus(): framework of methods to initialize the mongo client connection, database, collections, and indexes using the abstract methods defined above.

## common.mongo.MongoSyncClient.java
- file: Added new concrete subclass of MongoClientBase to provide implementations of abstract method interface using the mongodb "sync" driver.

## common.mongo.MongoAsyncClient.java
- file: Added new concrete subclass of MongoClientBase to provide implementations of abstract method interface using the mongodb "async (reactive streams)" driver.

## ingest.handler.mongo.MongoIngestionHandler.java
- file: Added new class with core control structures and data structures for ingestion service request handling, with a pool of worker threads consuming ingestion tasks from a queue, and using a concrete implementation of the mongo client interface for database operations.
- constants: Includes TIMEOUT_SECONDS, MAX_INGESTION_QUEUE_SIZE, POLL_TIMEOUT_SECONDS.
- configuration: Includes constants for configuration resource name and default value for number of thread pool workers.
- instance variables: mongoIngestionClientInterface is the concrete implementation of the MongoIngestionClientInterface and extension of MongoClientBase. executorService is used to manage and execute the thread pool workers.  ingestionQueue is a BlockingQueue of HandlerIngestionRequest objects to be serviced by worker threads.  shutdownRequested is a boolean flag used to inform the worker threads to shut down.
- constructor, newMongoSyncIngestionHandler(), newMongoAsyncIngestionHandler(): Constructor and static factory methods used to create new handler instances initialized with appropriate client implementation.
- configMgr(): Convenience method for accessing ConfigurationManager singleton.
- IngestionTaskResult: Nested class used to encapsulate the result of an ingestion task.
- IngestionWorker: Implementation of Runnable interface to contain logic for worker threads.  The run() method polls the task queue for the next task with a timeout, and handles the task retrieved from the queue.
- generateBucketsFromRequest(): Generates a list of bucket documents for a given IngestionRequest, used for writing the buckets to the database.
- init(): Initializes the handler, including the database client interface implementation, creates ExecutorService with worker thread pool of specified size, creates pool of ingestion workers and executes them in the executorService, and register shutdownHook to perform necessary cleanup.
- fini(): Cleans up the handler, shutting down and waiting for executor service, and shutting down database client interface.
- handleIngestionRequest(): Used by worker threads to handle an ingestion request from the queue.  Generates batch of bucket documents for request, inserts them to database using client database interface, checks for successful handling, and inserts request status details in mongo describing the handling of the request with any error-related details.
- onNext(): Used by producers (threads handling grpc ingestion request stream) to add an ingestion request to the queue for servicing by a worker thread.

## ingest.handler.mongo.MongoIngestionClientInterface.java
- file: Added new interface defining the operations required of concrete database client implementations, including init(), fini(), insertBatch(), and insertRequestStatus().

## ingest.handler.mongo.MongoSyncIngestionClient.java
- file: Added new concrete extension of MongoSyncClient that implements the MongoIngestionClientInterface by using the mongodb sync driver.

## ingest.handler.mongo.MongoAsyncIngestionClient.java
- file: Added new concrete extension of MongoAsyncClient that implements the MongoIngestionClientInterface by using the mongodb async/reactivestreams driver.

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
