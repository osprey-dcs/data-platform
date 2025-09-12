# Data Platform Release Process

This document contains notes to help streamline the process of creating a Data Platform release.


## complete development work

Edit pom.xml for dp-grpc, dp-service to reflect current version number!

### data-platform
- update cron template to add entries for new data platform services etc
- update scripts/make-installer to add any new content to the installer

### dp-service
- add comments to application.yml for any new contents

### dp-support
- add/modify scripts as needed


## update documentation
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
- data-platform
  - create release notes
  - update doc/install/quick-start.md, installation.md
  - update README.md
  - update release process (this doc)

Make sure this is all done before adding tags etc because it's a pain removing tags, deleting releases, adding tags, creating releases etc.


## merge changes from fork's development branch to upstream's main branch

### create pull requests

If working in a fork, create a github pull request to merge the development branch in the fork to the development branch in the upstream repo.

### pull dev branch in upstream directory

Change to the directory for each of the upstream repos, checkout and pull the dev branch to pick up the files from the pull request merge.

### merge changes from dev branch to main for each repo

Merge the new files just merged to the development branch to the main branch in each upstream repo directory:

* git checkout main
* git merge dev-1.10
* git push


## add git tags for version and release

Need to do this in the upstream for all repos: dp-grpc, dp-service, dp-support, data-platform.  Tags created in the fork aren't automatically added to the upstream, they need to be manually pushed.

The ~/dp/data-platform/scripts/tag-repos script can be used for this.

### tag for current major version

I'm using a tag like v1.1, v1.2 to mark the major version as we do minor releases.  So the major version tag gets moved for each minor release.

- cd ~/dp/data-platform/scripts
- ./tag-repos v1.10

### tag for current release

These tags should only need to be added once for a release, unless they need to be "moved" (removed and added) to pick up new files.

- cd ~/dp/data-platform/scripts
- ./tag-repos rel-1.10.0

### steps for removing tags

The tag-repos script can be used to move an existing tag. If tags need to be (re)moved (this is unusual, for the releases anyway):

- git tag -d v1.10
- git push origin --delete v1.10


## build data-platform installer

- cd ~/dp/data-platform/scripts
- ./make-installer 1.10.0

Upload the installer to include it with the data-platform release.


## create github release for each repo

Need to do this in all repos: dp-grpc, dp-service, dp-support, data-platform.  For dp-grpc and dp-support just do a regular github release by navigating to repo "tags" page, clicking "new release", selecting tag, adding release notes, etc.

### dp-service release

Use jar from ~/data-platform/lib/dp-service.jar used to create installer.

### data-platform release

Upload the installer built previously.
