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

### data-platform
- update cron template to add entries for new data platform services etc
- update scripts/make-installer to add any new content to the installer

### dp-service
- add comments to application.yml for any new contents

### dp-support
- add/modify scripts as needed


## update documentation
- data-platform
  - create release notes
  - update doc/install/quick-start.md, installation.md
  - update README.md
  - update release process (this doc)
- dp-grpc
  - update README.md API docs
  - in-line comments in proto files
- dp-service
  - update README.md
  - update developer-notes.md and UML diagrams for any important new features / frameworks
  - update java command line docs for running new applications etc
  - update config docs
- dp-support
  - update README.md with new scripts etc

Make sure this is all done before adding tags etc because it's a pain removing tags, deleting releases, adding tags, creating releases etc.


## merge changes from dev branch to main for each repo

* git checkout main
* git merge dev-1.8
* git push


## add git tags for version and release

Need to do this in all repos: dp-grpc, dp-service, dp-support, data-platform.

The ~/dp/data-platform/scripts/tag-repos script can be used for this

### tag for current major version

I'm using a tag like v1.1, v1.2 to mark the major version as we do minor releases.  So the major version tag gets moved for each minor release.

- cd ~/dp/data-platform/scripts
- ./tag-repos v1.8

### tag for current release

These tags should only need to be added once for a release, unless they need to be "moved" (removed and added) to pick up new files.

- cd ~/dp/data-platform/scripts
- ./tag-repos rel-1.8.0

### steps for removing tags

The tag-repos script can be used to move an existing tag. If tags need to be (re)moved (this is unusual, for the releases anyway):

- git tag -d v1.8
- git push origin --delete v1.8


## build data-platform installer

- cd ~/dp/data-platform/scripts
- ./make-installer 1.8.0

Upload the installer to include it with the data-platform release.


## create github release for each repo

Need to do this in all repos: dp-grpc, dp-service, dp-support, data-platform.  For dp-grpc and dp-support just do a regular github release by navigating to repo "tags" page, clicking "new release", selecting tag, adding release notes, etc.

### dp-service release

Use jar from ~/data-platform/lib/dp-service.jar used to create installer.

### data-platform release

Upload the installer built previously.


## create new dev branch for major release

If transitioning to a new major release, consider creating new dev branch from main.  E.g., for v1.2 to v1.3:

- git checkout main
- git checkout -b dev-1.8
- git merge main
- git push --set-upstream origin dev-1.8

Also set the version numbers in pom.xml for dp-grpc and dp-service (both for the package itself, and where dp-service includes dp-grpc etc.)
