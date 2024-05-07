# data-platform

The Data Platform provides tools for managing the data captured in an experimental research facility, such as a particle accelerator. The data are used within control systems and analytics applications, and facilitate the creation of machine learning models for those applications.

## project organization

The Data Platform project is organized using the following github repositories:


### dp-grpc

The [dp-grpc repo](https://github.com/osprey-dcs/dp-grpc) contains the Data Platform API definition.  It includes documentation for the Platform's data and service models, and a description of the gRPC "proto" files containing the API definition.


### dp-service

The [dp-service repo](https://github.com/osprey-dcs/dp-service) contains the Java code for implementations of the Data Platform services, including the shared frameworks used to build them.  It includes documentation about those frameworks and the underlying MongoDB database schema utilized by the services.


### dp-web-app

The [dp-web-app repo](https://github.com/osprey-dcs/dp-web-app) contains the JavaScript code for the Data Platform Web Application, with documentation about the approach.


### dp-support

The [dp-support repo](https://github.com/osprey-dcs/dp-support) contains the scripts and utilities for managing the components of the Data Platform ecosystem.  It includes documentation for using those tools.


### data-platform

The [data-platform repo](https://github.com/osprey-dcs/data-platform) is the primary repo for the Data Platform project.  It contains documentation about the approach with links to the other repos.  It also includes a Quick Start guide for running the Data Platform ecosystem from the installer.


### dp-benchmark

The [dp-benchmark repo](https://github.com/osprey-dcs/dp-benchmark) is not currently active, but contains code developed for evaluating the performance of some candidate technologies considered for use in the Data Platform service technology stack.  It includes an overview of the benchmark process with a summary of results, which is provided as Appendix A of this document.


## project details

Use the links below to learn more about the Data Platform project.

### data platform overview

* [motivation](https://github.com/osprey-dcs/data-platform/blob/main/doc/documents/dp/dp-tech.md#motivation)
* [requirements and objectives](https://github.com/osprey-dcs/data-platform/blob/main/doc/documents/dp/dp-tech.md#requirements-and-objectives)
* [data platform elements](https://github.com/osprey-dcs/data-platform/blob/main/doc/documents/dp/dp-tech.md#data-platform-elements)
  * [gRPC API](https://github.com/osprey-dcs/data-platform/blob/main/doc/documents/dp/dp-tech.md#grpc-api)
  * [service implementations](https://github.com/osprey-dcs/data-platform/blob/main/doc/documents/dp/dp-tech.md#service-implementations)
  * [web application](https://github.com/osprey-dcs/data-platform/blob/main/doc/documents/dp/dp-tech.md#web-application)
  * [installation and deployment support tools](https://github.com/osprey-dcs/data-platform/blob/main/doc/documents/dp/dp-tech.md#installation-and-deployment-support-tools)
* [status and milestones](https://github.com/osprey-dcs/data-platform/blob/main/doc/documents/dp/dp-tech.md#status-and-milestones)
* [todo and road map](https://github.com/osprey-dcs/data-platform/blob/main/doc/documents/dp/dp-tech.md#todo-and-road-map)
* [project organization](https://github.com/osprey-dcs/data-platform/blob/main/doc/documents/dp/dp-tech.md#project-organization)

### installation and getting started
* [quick start guide](doc/user/quick-start.md)
* [installation details](doc/user/installation.md)
  * [installation prerequisites](doc/user/installation.md#installation-prerequisites)
  * [data platform installation options](doc/user/installation.md#data-platform-installation-options)

### developer notes

* [data platform release process](doc/developer/release.md)
* [generating JavaScript stubs from dp-grpc proto files (possibly obsolete)](doc/developer/protoc-javascript.md)