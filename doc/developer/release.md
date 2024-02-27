# Data Platform Release Process

This document contains notes to help streamline the process of creating a Data Platform release.

## consider updating MongoDB reference version

We want to try to keep up to date with MongoDB updates so we don't fall too far behind that it's harder to update, so consider updating as we go.

Consider testing against docker container first.  For local install, it appears that multiple versions on a host are supported but when I updated from 6 to 7, it was still running 6 by default so I uninstalled 6 and installed 7.  Need to better understand this.

Run Data Platform regression tests and benchmarks as part of testing.

### update dp-support mongo scripts

As necessary, update dp-support scripts for local mongo install, docker deployment, and compass.

## complete development work

Edit pom.xml for all repos to reflect current version number!

### dp-grpc
- add comments in proto files for any new contents

### dp-service
- add comments to application.yml for any new contents

### dp-support
- add/modify scripts as needed

### data-platform
- update cron template to add entries for new data platform services etc
- update scripts/make-installer to add any new content to the installer

## update documentation

Update README in all repos: dp-grpc, dp-service, dp-support, data-platform for any new features.  Consider updating things like overview, quick start, installation, new services, new APIs, new scripts etc.

Added detailed document in dp-service for big changes and milestones.

Make sure this is all done before adding tags etc because it's a pain removing tags, deleting releases, adding tags, creating releases etc.

## merge changes from dev branch to main

* git checkout main
* git merge dev-1.2
* git push

## add git tags for version and release

Need to do this in all repos: dp-grpc, dp-service, dp-support, data-platform.

### tag for current major version

I'm using a tag like v1.1, v1.2 to mark the major version as we do minor releases.  So the major version tag gets moved for each minor release.

* git tag -a v1.2 -m "renaming in API proto files"
* git push origin v1.2

### tag for current release

These tags should only need to be added once for a release, unless they need to be "moved" (removed and added) to pick up new files.

* git tag -a rel-1.2.0 -m "1.2.0 release"
* git push origin v1.2

### steps for removing tags

If tags need to be (re)moved:

- git tag -d v1.2
- git push origin --delete v1.2
- git tag -a v1.2
- git push origin v1.2

## create dp-service jar file

## build data-platform installer

## add release for each repo

Need to do this in all repos: dp-grpc, dp-service, dp-support, data-platform.  For dp-grpc and dp-support just do a regular github release by navigating to repo "tags" page, clicking "new release", selecting tag, adding release notes, etc.

### dp-service release

Need to build shaded jar and upload it as part of the release.

#### dp-service jar

Run maven clean and maven package, check that tests are clean.  Intelli-J creates jar in e.g., /home/craigmcc/dp/dp-java/dp-service/target/dp-service-1.2.0-shaded.jar

### data-platform release

Need to build the installer and upload it as part of the release.

#### build data-platform installer

Hopefully the script was updated before adding tags etc.  Sometimes it leads to changes that should be tagged.  Use the data-platform/scripts/make-installer script to create the installer tarball with content from the other repos.