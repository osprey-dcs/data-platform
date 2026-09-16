# Data Platform Release Process

This document contains notes to help streamline the process of creating a Data Platform release.

Previously, we used scripts to add tags to reach repo and build the release artifacts.

Now, this is largely accomplished by GHA workflows that are triggered when new release tags are added.  So in a nutshell, assuming the development work and documentation is complete for each repo and merged to the main branch using pull requests, take the following general steps in each repo:


## write the release notes first

Starting with 1.16.0, every release ships notes, and they must be **merged to `main` before the
`rel-*` tag is pushed**.  The tag is what the release workflow builds from, so notes that land
after the tag are not on the tagged commit and the workflow will not see them.

The master notes for the whole ecosystem live in this repo at
`doc/release-notes/rel-<version>.md` — for example `doc/release-notes/rel-1.16.0.md`.  The
`release.yml` workflow reads that file and publishes it as the body of the GitHub release, via
`body_path`.  A `Verify release notes exist` step runs immediately after the version is extracted
from the tag and fails the job with a clear error if the file is missing, so a forgotten document
fails within seconds of the tag push rather than after the sibling-repo JARs have been downloaded
and the tarball published.

Each of `dp-grpc`, `dp-service`, `dp-desktop-app`, and `dp-python-lib` follows the same pattern
with its own per-repo notes, and their releases point back to the master notes here.

Organize the notes by issue ticket rather than by PR, since a ticket often spans several PRs.  A
breaking release leads with an "Upgrading from <previous>" checklist that calls out silent
behavior changes separately from compile errors.  Add each new document to the table in the
[release notes](../../README.md#release-notes) section of `README.md`.

If the workflow does fail on a missing document, add the notes, then move the tag onto the new
commit and force-push it — the release job re-runs from the retagged commit:

```
git tag -f rel-1.16.0
git push -f origin rel-1.16.0
```

## release process steps

* update the release notes as described above, in e.g., doc/release-notes/rel-1.16.0, making sure to cover all the PRs / issues / features since the previous release
  * the release.yml workflow in each repo assumes this file exists, and uses it for the body of the published release
  * release notes must be merged to main before the release workflow runs
* make sure the README and other repo documents cover all the key issues / features since the previous release
* create the release tag and push, e.g.,
  * git tag rel-1.16.0 && git push origin rel-1.16.0
* check the actions for the repo to make sure all workflows triggered by the new tag complete successfully
* check the published release, check the links within the release notes resolve

### tag order matters: data-platform goes last

Create the tags manually, one repo at a time, rather than scripting them together.  Two ordering
constraints:

* **`data-platform` must be tagged last, and only after the `dp-grpc`, `dp-service`, and
  `dp-desktop-app` releases are actually published.**  Its release job downloads
  `dp-grpc-<version>.jar`, `dp-service-<version>.jar`, and `dp-desktop-app-<version>.jar` from
  those repos' releases at the matching `rel-` tag.  Tagging it while a sibling's CI is still
  running fails the download step.
* Tagging by hand also avoids a race between the sibling workflows as they publish their own
  releases.

The master release notes in this repo link to the child repos at `blob/rel-<version>/...`, so
those links resolve only once each child tag exists — another reason this repo goes last.

The artifacts created for the published release vary by repo:

* dp-grpc
  * CI creates regular and sha256 jar and tarball files
* dp-service
  * CI creates regular and sha256 jar files
* dp-desktop-app
  * CI creates regular and sha256 jar files
* dp-python-lib
  * CI uses sigstore so creates wheel and tarball unsigned and signed with sigstore
* data-platform
  * creates tarball with sha256

