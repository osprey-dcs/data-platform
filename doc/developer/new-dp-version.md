# creating a branch for a new dp version


## dependencies

- consider updating reference Java version
  - also check java libs
- consider updating reference MongoDB version
  - also update dp-support mongo scripts as appropriate
- consider updating 3rd party dependency versions in dp-grpc and dp-service pom.xml

## git gymnastics

- create new branch in upstream for each repo
  - cd ~/dp.upstream/...
  - git checkout main
  - git pull
  - git checkout -b dev-1.10
  - git push --set-upstream origin dev-1.10
- add upstream as remote in fork (if not already there) for each repo
  - cd ~/dp.fork/...
  - git remote -v
  - git remote add upstream https://github.com/osprey-dcs/data-platform.git
- merge main branch from upstream to fork
  - git checkout main
  - git fetch upstream
  - git merge upstream/main
- create development branch in fork (don't checkout the upstream branch or we're updating upstream branch directly, e.g., use "-b")
  - git checkout -b dev-1.10
  - git push --set-upstream origin dev-1.10

## pom.xml version numbers

- set the version numbers in pom.xml for dp-grpc and dp-service (both for the package itself, and where dp-service includes dp-grpc etc.)

## performance benchmarks

- run the performance benchmarks to get a snapshot before starting development

## release notes

- create an area for draft release notes in the development journal
