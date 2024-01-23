# July 2023: performance benchmarking of gRPC communication and persistence technology alternatives

# overview

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

# results summary

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

# gRPC


Benchmark results showed that gRPC communication provided ample headroom beyond the project performance requirements, 22M - 33M values/second.

The gRPC performance benchmark is located in the [grpc directory](https://github.com/osprey-dcs/dp-benchmark/tree/main/src/main/java/com/ospreydcs/dp/benchmark/grpc) and includes Java client and server code.  The proto files are located in the [proto directory](https://github.com/osprey-dcs/dp-benchmark/tree/main/src/main/proto).

The [BenchmarkServer](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/grpc/BenchmarkServer.java) implements the service API defined in the "ingestion.proto" file.  The main method relevant to the benchmark is the implementation of *streamingIngestion()*.  It handles an ingestion request stream, performing simple validation on each request and sending a response for each request that echos the number of rows and columns in the request.

The [BenchmarkClient](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/grpc/BenchmarkClient.java).  Its *main()* method calls *multithreadedStreamingIngestionScenario()* to execute the performance benchmark.  It creates a single gRPC request message that is sent repeatedly to the server (to avoid creating a new request message inside the loop where we are measuring performance).

It creates an *ExecutorService* with a fixed size thread pool of the specified thread count.  It creates a task for each thread that sends the specified number of requests, and executes the tasks via the executor service.

The method measures and reports performance statistics as values/second and MB/second.

# InfluxDB

InfluxDB, used in the prototype implementation for storing time series data, performed well in the benchmark but topped out at about 1M values/second (using the core community product without scaling).

We used the "community version" for performance testing, because our user base is not willing to pay annual licensing fees for the "enterprise version", and it wouldn't make sense for us to do the equivalent custom work to scale the community product.

The InfluxDB benchark is contained in the file [InfluxDbBenchmark](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/InfluxDbBenchmark.java).

The benchmark includes tests for writing data to InfluxDB as points, "line protocol" (a proprietary Influx format), and Java POJO.  The tests also covered using both the blocking and non-blocking Influx "write API".  The best performance was obtained using the blocking write API to write line protocol records.

The *main()* method creates an InfluxDB bucket for the test, writes some data to initialize the data structures for the bucket (which seemed to have a big impact if done while measuring performance), and calls *benchmarkMultithreadedWrite()* to run the performance benchmark.

That method generates a list of batches of line protocol records, creates an ExecutorService with a fixed size thread pool of the specified size, generates a list of tasks with a task to write each batch of line protocol records to InfluxDB, and then measures and reports the time to execute those tasks in the thread pool.

The *main()* method then checks the size of the InfluxDB bucket to verify that the records were written to the database and removes the bucket.

# MariaDB

MariaDB, a relational database platform alternative, performed well in the benchmark for storing time series data, with a performance range of 4.5M to 5.5M values/second for ingesting "bucketed" time series data.  The test also covered writing individual samples as rows to a database table, which ranged in performance from 140K to 160K values/second.

The MariaDB benchmark is in [MariaDbBenchmark](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/MariaDbBenchmark.java).

The *main()* method creates a database for the test (dropping the existing one, if any), creates a new database with appropriate tables, and calls *experimentCreatePvTimeSeriesDataSqlJson()* to execute the peformance benchmark.

MariaDB doesn't have a built in way to deal with time series data "buckets", so we used a database table with a string column whose value is a JSON segment containing the array of data points for the bucket.  There is probably/maybe a better way to do this.

*experimentCreatePvTimeSeriesDataSqlJson()* sweeps arrays of parameters for JSON bucket batch size and number of threads, and calls *scenarioCreatePvTimeseriesDataSqlJson()* to execute each scenario in the experiment.  It displays the results of each scenario executed, highlighting the best and worst performance.

*scenarioCreatePvTimeseriesDataSqlJson()* creates a database table for the time series data (with JSON column for bucket of data), builds an index on that table (to see how that impacts ingestion performance), creates a list of batches of JSON time series data (using a utility method from the MongoDB BSON framework), creates a task for writing each batch of JSON buckets to MariaDB, creates an ExecutorService with a fixed size thread pool of specified size, and uses the executor service to execute the tasks.  It verifies that the correct number of rows is inserted, and measures performance and returns the results back to the experiment driver method.

# MongoDB

For MongoDB, we developed performance benchmarks for storing time series data as individual points, as well as using "bucketed time series data" (storing a collection of points in a single MongoDB "document").  Using the bucketed data approach showed performance exceeding the project performance goal by a comfortable margin, in the range of 7M to 10M values/second.  The best performance was obtained using the MongoDB "Sync Driver".  Tests were also performed using the async "reactive streams driver".

The tests using the MongoDB Sync Driver are contained in [MongoDbSyncBenchmark](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/MongoDbSyncBenchmark.java).

The *main()* method creates a client database connection, and calls *benchmarkCreatePvTimeseriesDataExperimentBucket()* to perform the benchmark experiment.  That method sweeps values for batch size and number of threads, and calls *benchmarkCreatePvTimeseriesDataBucket()* to execute a scenario for each combination of parameters, displaying the results for each scenario and highlighting the best and worst performance.

*benchmarkCreatePvTimeseriesDataBucket()* uses a utility method in the base class to generate a list of batches of BSON documents each containing a bucket of time series data, creates a collection in MongoDB to contain the data written by the test, creates indexes on the collection (to see the impact on ingestion performance), creates a list of tasks for writing each batch of BSON documents to MongoDB, creates an ExecutorService with a fixed size thread pool of specified size, and uses the executor service to execute the tasks.  It checks that the correct number of documents is inserted to the collection, which it then removes.  The performance result is returned to the experiment driver method.

The class contains other driver methods for measuring the performance of creating and updating metadata documents using both "updateOne()" and "updateMany()" in the MongoDB driver, and using the recent MongoDB "time series collection" feature to write data as individual points.

The file [MongoDbAsyncBenchmark](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/MongoDbAsyncBenchmark.java) follows pretty much the same pattern described above, only it uses the MongoDB "reactive streams" driver instead of the "sync" driver.  Both benchmark classes derive from a common class [MongoDbBenchmarkCommon](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/MongoDbBenchmarkCommon.java) that provides utilities for generating BSON document batches since both benchmarks use the same BSON documents.

Both MongoDB benchmarks (as well as some of the ones for the other technologies), use the class [BenchmarkCommon](https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/BenchmarkCommon.java) which provides utilities like *createExecutorServiceAndInvokeTasks()* for creating an executor service with specified number of threads, and executing a list of tasks in the executor service.

# HDF5 and JSON files

Saving time series data to HDF5 files seems to be a very good option, given its benchmark performance for writing large data files, and acceptance within our community.  That said, the Java HDF5 project feels "dated" and requires calling out to a native library, not an optimal approach for a server application.

The ingestion performance ranges from 68M to 77M values per second, about an order of magnitude better than the best performance obtained for any of the database products.  Better performance was seen for larger HDF5 files than small ones, which ranged from 1.3M to 2.4M values per second.  We also tested writing data to JSON text files to have a reference point for comparing another file-based approach, with a performance in the range of 38M to 47M values per second, also quite good.

As good as the performance numbers are for these benchmarks, it is important to realize that 1) they don't involve a network call to database service and 2) there is no external indexing mechanism to the files themselves.  We are only measuring the performance of writing data to the files.

The package "ch.systemsx.cisd.hdf5" is used for writing HDF5 files from Java.  It was actually quite challenging to find and install the most current version of the library (which seems to be quite old, at least for Java).  Maybe there is a better / more recent library?

The file performance benchmarks are contained in [FileBenchmark] (https://github.com/osprey-dcs/dp-benchmark/blob/main/src/main/java/com/ospreydcs/dp/benchmark/FileBenchmark.java).  The class extends *MongoDbBenchmarkCommon* so that it can use the MongoDB BSON framework to simplify the generation of JSON document content.

The *main()* method can call two methods, *experimentCreatePvTimeseriesDataHdf5()* for measuring HDF5 performance and *experimentCreatePvTimeseriesDataJson()* for JSON.

*experimentCreatePvTimeseriesDataHdf5()* sweeps parameter values for batch size and number of threads, calling *scenarioCreatePvTimeseriesDataHdf5()* to run a performance benchmark for each parameter combination.  The results are displayed for each scenario that it executes.

*scenarioCreatePvTimeseriesDataHdf5()* creates a list of batches of content to be written to HDF5 files, using a local POJO *Hdf5FileContent* to encapsulate the data for each file.  It creates a directory structure to contain the HDF5 files, generates a list of tasks for writing each batch of HDF5 files, creates an ExecutorService with the specified number of threads, and executes the tasks in the ExecutorService to create the HDF5 files.  Performance is measured and returned to the experiment driver method.

The methods *experimentCreatePvTimeseriesDataJson()* and *scenarioCreatePvTimeseriesDataJson()* follow the same pattern for measuring the performance of writing JSON files instead of HDF5.

# summary and revision to data platform technology stack

Based on the benchmark results, we decided to move forward with an Ingestion Service implementation using gRPC for communication, and MongoDB for storage of both time series data and metadata.

We eliminated InfluxDB from the Data Platform technology stack because it is unlikely that without using the commercial "Enterprise" version we can exceed the project goal of ingesting 4M values/second.

We chose MongoDB for storing time series data because it showed better performance than MariaDB for storing "bucketed" time series data, and seemed to be a better fit for the problem.  In addition to storing individual scalar values as data points, we also need to store arrays, tables, structures, and images and this seems more natural in Mongo.

While we don't plan to do it initially, we also feel like MongoDB might be a better fit than MariaDB for a hybrid solution that uses MongoDB to store recent time series data and HDF5 files to store older data, with Mongo providing an index to the data files.  We might take this approach if the size of the Mongo database becomes unwieldy.  Other hybid approaches might be developed to leverage the performance of writing to HDF5 files, so we are "keeping this in our back pocket" as an area to explore in the future when it is needed.

