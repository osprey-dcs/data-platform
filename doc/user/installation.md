# Installation Details

## Installation prerequisites

The primary prerequisites for installing the Data Platform are Java and MongoDB.  Mongodb-compass is a GUI for navigating MongoDB databases, and can be extremely useful during development and testing.  Its installation is optional.

### java installation

The Data Platform Java applications are compiled using Java 21.  Here is a link for [downloading and installing Java 21](https://www.oracle.com/java/technologies/downloads/#java21).

### mongodb installation

MongoDB version 7.0.5 is the current reference version for the Data Platform service implementations.  It may be installed as a local package, or via a Docker container.  Each approach is described in more detail below.

#### mongodb installation as local package

Installation will vary by platform and instructions for doing so should be fairly easy to find.  MongoDB provides [documentation for installing on a variety of platforms](https://www.mongodb.com/docs/manual/administration/install-community/), which is a good place to start.

After installing MongoDB, create a user for the data platform applications.  The following example creates an "admin" user (password="admin") with root privileges in the "admin" database.  You can also create a user with privileges scoped only to the "dp" database in MongoDB.

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

#### mongodb installation as docker container

It is also possible (and relatively simple) to run MongoDB from a docker container.  While probably not appropriate for a production installation or system under heavy load, this approach might be useful for development, evaluation, and other applications.  The Quick Start section above demonstrates the steps for creating and running MongoDB via a Docker container.  See the [dp-support repo](https://github.com/osprey-dcs/dp-support) for more details about the scripts.

### mongodb-compass installation

[Mongodb-compass](https://www.mongodb.com/products/tools/compass) is a GUI application for exploring the contents of a MongoDB database.  It is very useful for administration, test verification, and ad hoc queries.  Here are links for [downloading](https://www.mongodb.com/try/download/compass) and [installing](https://www.mongodb.com/docs/compass/current/install/) compass.  The current compass reference version in the Data Platform installation is 1.42.1.

The [dp-support repo](https://github.com/osprey-dcs/dp-support) includes [a script](https://github.com/osprey-dcs/dp-support/blob/main/bin/mongodb-compass-start) for running mongodb-compass after it has been installed.  The script includes a header with the links above for downloading and installing the application.

## Data platform installation options

There are three main options for installing the Data Platform.

1. This data-platform repo contains an installer with everything needed to run the Data Platform and is the easiest way to get started.  See the [Quick Start](https://github.com/osprey-dcs/data-platform#data-platform-quick-start) for details on downloading and using the installer.

2. To learn more about installing the Data Platform in your development environment, see the instructions for [development installation](./installation.md#development-installation).

3. The [jar installation section](./installation.md#jar-installation) describes the process for downloading the latest Data Platform jar files.

### development installation

Developer installation consists of cloning the [dp-grpc](https://github.com/osprey-dcs/dp-grpc) and [dp-service](https://github.com/osprey-dcs/dp-service) repos, and adding a project for each to the IDE. The dp-support repo is optional, and the dp-benchmark is probably not useful unless you are interested in performance benchmarks outside the Data Platform).  After cloning the repos, use maven to "install" the dp-grpc and dp-common projects (either from the command line or using your Java IDE).  Then use maven to compile the dp-service project.

To run the ingestion service, execute IngestionGrpcServer.main().  To run the performance benchmark (with the server running), execute BenchmarkStreamingIngestion.main().

There are jUnit tests for the elements of the Data Platform services in dp-service/src/test/java.

### jar installation

In situations where the Data Platform code will be used without the ecosystem support provided by the dp-support repo or for Java development, source code and/or jar files can be installed directly by using the desired github release.  Here are links to the releases page for each repo: [dp-grpc](https://github.com/osprey-dcs/dp-grpc/releases) and [dp-service](https://github.com/osprey-dcs/dp-service/releases).

