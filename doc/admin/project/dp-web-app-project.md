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

# relevant data platform todos

* API and handling for table-level queries
* handling for non-streaming query APIs
* add attributes, event metadata, and annotations to query API
* query handling for column name patterns

# initial ideas about approach

* Use JavaScript/React following pattern developed for datastore prototype.
* Use React "Router" (or similar mechanism) for navigation via browser location bar and updating location by navigation in application.  This allows the user to utilize browser bookmarks within the application.
* Use React Hooks for application code as in the prototype.
* Use "Tailwind" library for UX styling?
* Call gRPC API directly from web app (instead of building a middle tier app server that can do gRPC streaming for the web app)

# questions / todo

* Requirements: clarify and prioritize.
  * Ability to identify and isolate data is core feature.  How should it work?  We have a starting place in the prototype application.
    * Table Navigation: Paging buttons vs. infinite scroll?
  * Refine ideas about export, annotation, visualization, and data science, and relationship to the core "isolation" feature.  How should these features be integrated into the user interface?
  * Relative priorities beyond "isolating data": export vs. annotation vs. visualization vs. data science operations?
* Do we like the "Tailwind" UX framework that we chose for styling the prototype web application?  Ditto for React Router and React Hooks?  Are there any better alternatives?
* Export Feature: how to implement?  As a server API that returns a browser MIME type, or in the web application code?
* API interface: Should we develop a "mock" API for web application development that doesn't require a running data platform server and envoy proxy?
* Middle tier application server: Should we develop a middle tier JavaScript application server that might avoid some of the limitations with streaming data via grpc from the browser-based web application?

# thoughts on "isolating" data and relationship to other features from chris

It comes down to isolating sets in the [data source]x[time] query domain.  Recall that we wanted to tag an annotation to a "data block", which is a subset of the query domain.

Thus, developing a navigation strategy is based upon moving through the 2 query domain axes (for a potentially very large domain).  I don't know the best was to do this, that is, "Paging buttons vs. infinite scroll" might be something we have to muddle through.  Probably have some general mechanism that has configuration parameters that we can tweak until we get a good "look and feel."

NOTE: Once a data block is identified by the user (as a data block), then we can annotate it, or export it, or visualize it.

Visualization will likely have further restrictions, it will be context specific according to the feature.  For example, viewing time series data assumes contiguous time ranges and a limited number of data sources.  That is probably the best use case to start with.  I don't think we want to get too involved with visualization, that's a whole field of study in itself.

# references

[1] [github repo for original web app prototype with documentation](https://github.com/craigmcchesney/datastore-web-app)

[2] [prototype web app styling overview](https://github.com/craigmcchesney/datastore-web-app/wiki/Styling-Overview)