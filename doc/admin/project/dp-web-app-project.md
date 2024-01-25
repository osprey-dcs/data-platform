# requirements from SBIR proposal document

For commercialization of the Web Application, additional features are recommended, as well as building out existing ones.  Also, stylistically the interface should be improved with better “look and feel” supporting simpler user interaction. The following is a list of project development tasks:
1. 	Data exporting of archived time-series data and metadata:  Isolate and export archive data in common formats (CSV, Excel, NumPy, etc.).  Data sets of interest are identified remotely then downloaded for local analysis and processing.
2. 	Addition of common data science features:  Provide data visualization in the form of graphs and charts.  The ability to analyze time-series data using standard data science techniques such as averages, fitting, and correlations.  Extensive development in this area may be unwarranted as specialized analysis is available through data exporting and common spreadsheet applications, or by Advanced Data Science and machine learning applications supported by the MLDP.
3. 	Post-ingestion archive annotations (i.e., a viable subset): Features of interest are the ability to annotate archived data with user notes and comments, and to provide data associations within the archive.

# development tasks implied by requirements

* user interface for identifying and "isolating" data from the dp archive via query (and annotation?) APIs
* export "isolated" data from archive to common formats (CSV, Excel, NumPy, etc)
* data visualization in the form of graphs and charts
* ability to analyze time-series data using standard data science techniques such as averages, fitting, and correlations
* post-ingestion archive annotations: add user notes and comments, provide data assocations within archive

# relevant data platform todos (currently under development)

* non-streaming query API and handling for query that returns tablular data
* API for exploring data sources (columns)
* API for creating annotations
* metadata query API for exploring attributes, event metadata, and annotations
* add attributes, event metadata, and annotations to query API
* API for exporting data to common file types?

# requirements clarification and prioritization

* Ability to identify and isolate data is core feature.  How should it work?  We have a starting place in the prototype application.
* Refine ideas about export, annotation, visualization, and data science, and relationship to the core "isolation" feature.  How should these features be integrated into the user interface?
* Relative priorities beyond "isolating data": export vs. annotation vs. visualization vs. data science operations?

# thoughts on "isolating" data and relationship to other features from chris

It comes down to isolating sets in the [data source]x[time] query domain.  Recall that we wanted to tag an annotation to a "data block", which is a subset of the query domain.

Thus, developing a navigation strategy is based upon moving through the 2 query domain axes (for a potentially very large domain).  I don't know the best was to do this, that is, "Paging buttons vs. infinite scroll" might be something we have to muddle through.  Probably have some general mechanism that has configuration parameters that we can tweak until we get a good "look and feel."

NOTE: Once a data block is identified by the user (as a data block), then we can annotate it, or export it, or visualize it.

Visualization will likely have further restrictions, it will be context specific according to the feature.  For example, viewing time series data assumes contiguous time ranges and a limited number of data sources.  That is probably the best use case to start with.  I don't think we want to get too involved with visualization, that's a whole field of study in itself.

# thoughts on searching annotation data as part of "isolating" data from chris

For example, I might want to know "how many times did Fred modify things since last Tuesday?"  "What data was Fred looking at?"  "Where did this calculation come from?"  "What archive data was used in this calculation?"  etc.

This could get involved and the annotation query interface will be... interesting.  We should pick off the low-hanging fruit first - hopefully that will provide insight.

# references

[1] [github repo for original web app prototype with documentation](https://github.com/craigmcchesney/datastore-web-app)

[2] [prototype web app styling overview](https://github.com/craigmcchesney/datastore-web-app/wiki/Styling-Overview)

[3] [grpc-web framework used to call gRPC from JavaScript browser app](https://github.com/grpc/grpc-web)

# Phase One

## scope

The primary objective for the first phase is to build the core feature of the application, which is "isolating" data of interest.  If we think of the data archive as a giant spreadsheet, then we are filtering that spreadsheet down to a specific region of interest in the query domain [data source]x[time].  The annotation query API, currently under development, provides additional capabilities for data in both dimensions.

As the annotation API is developed, we will focus on using the core query API to build a filtering mechanism over the two dimensions of data source and time.  We will probably need to add some query features to make this possible, so part of the phase one scope is to identify and quickly build query API tools to support the filtering and isolation process.  For example, we probably need some tools for finding out what data sources (columns) are available from the archive and relevant details about them such as data type and sample frequency.

It's worth pointing out that this capability if essentially what was developed in the initial web application prototype, making it a good place to start.

So in summary, the scope of the first phase includes:
* focus primarily on filtering the (data source x time) query axes
* identify and incorporate tools for exploring the data sources available in the system
* understand annotation query API and incorporate filtering by annotation data in the design, possibly with an initial implementation
* incorporate design for operating on the filtered data set, such as exporting, adding annotations, visualizing, and initiating basic data science operations. 

## initial ideas about approach

* Use JavaScript/React following pattern developed for datastore prototype.
* Use React "Router" (or similar mechanism) for navigation via browser location bar and updating location by navigation in application.  This allows the user to utilize browser bookmarks within the application.
* Use React Hooks for application code as in the prototype.
* Use "Tailwind" library for UX styling?
* Call gRPC API directly from web app (instead of building a middle tier app server that can do gRPC streaming for the web app)

## open questions

* What simple queries are needed to facilitate the isolation and filtering process, to help us explore the universe of possible data sources?
* Do we like the "Tailwind" UX framework that we chose for styling the prototype web application?  Ditto for React Router and React Hooks?  Are there any better alternatives?
* API interface: Should we develop a "mock" API for web application development that doesn't require a running data platform server and envoy proxy?
* Middle tier application server: Should we develop a middle tier JavaScript application server that might avoid some of the limitations with streaming data via grpc from the browser-based web application? 
* Table Navigation: Paging buttons vs. infinite scroll?  I think maybe we should start with infinite scroll but I'm open to other ideas.
* Export Feature: how to implement?  As a server API that returns a browser MIME type, or in the web application code?

## thoughts about the design

* We need a mechanism that allows the user to explore the universe of data sources (columns) in the archive.  There will initially be a limited query mechanism for this, e.g, return information for columns whose name match a pattern, or whose name is in a specified list of names.  The query result will include an "info" object for each column, with some details such as data type, last measurement time, interval between measurements, etc.  This is similar to the "explore PVs" feature we had in the prototype, or whatever it's called.
* Mechanism for adding specified columns to the dataset.
* Mechanism for filtering the time axis down to the range of interest.  It's probably safe to assume that the columns are valid for the specified time range at this point.  You could use information about the specific columns to refine this if useful.  We were playing with double ended sliders in the prototype application for this, but we should explore the possibilities.
* How will we incorporate including key/value attributes, event metadata (event name, time and description), and annotations like comments etc in the filtering user interface?  We have not yet implemented the query mechanism to support this, but I'll be working on it for the next few weeks.
* Execute an API query using the captured filter parameters that returns a result including a table of data for the specified columns and time range.  We'll need to be careful to send queries whose result is not too large for a single response message.  The current gRPC query API is a simple "unary" RPC with a single request and response.  In the prototype, we used a similar query mechanism with controls for paging.  I'd like to try infinite scroll if it makes sense, where we need to send an API query to retrieve the next page of details.
    * I believe that grpc-web, which we are using to call gRPC APIs from JavaScript/React, does support server-side streaming.  This allows us to send a stream of responses for a single request, and may or may not be useful for the web app.
* Display the results in a table.  The API supports heterogeneous data types including scalar, array, table, structure, and image.  So we'll need to have a design that supports types beyond scalar, like a link to display the contents for that cell in the table or hover pop-up or whatever.
    * We also need to think about how to display any relevant metadata with the result (tags, event metadata, user annotations).  The metadata may only apply to a certain subset of the overall query time range, and a subset of the columns in the result.
* Once the user is happy with the results returned by the filter (which includes columns, time range, and metadata), we need to allow them to apply additional operations to that data set like export, annotation, visualizing, and analysis.  We won't have all those features right off the bat, but we'll need a way to incorporate and trigger them, adding to the set of operations as we implement them.

## getting started

* Understand the requirements and scope.
* Review the prototype datastore web app.
* Work on an initial design.
* Begin to create the basic navigation for the application.
* Check that you have MongoDB and Envoy proxy installed and running.  They were used for the datastore web app prototype so hopefully they are still working.
* Start to think about the types of data source metadata queries that might be needed to support the web app.