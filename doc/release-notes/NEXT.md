# Release Notes — next release (unreleased)

**This is the working draft of the master notes for the next release. It is not a release note
yet.**

Sections accumulate here as tickets land, so the content is written while it is fresh and gets
reviewed in the PR that causes it. At release time this file is renamed to
`doc/release-notes/rel-<version>.md` and finished — see **Cutting the release** at the bottom.

**The version of the upcoming release is deliberately not named anywhere in this file**, in its
filename or in its prose. `release.yml` resolves the notes path strictly from the tag, so a file
committed under a guessed version is both stranded and a failed release-notes check on the tag
that does ship. Nothing here should assert what *else* the release contains, either: that is
knowable only once the release is cut.

This draft holds what lands in this repository. The sections for the four child repositories are
written at the cut, from their own notes.

## Contents

- [Trimming old PV time-series data (Issue #118)](#trimming-old-pv-time-series-data-issue-118)
- [Cutting the release](#cutting-the-release)

---

## Trimming old PV time-series data (Issue #118)

*Epic #117, phase 1a — data-platform*

An archive that only grows eventually fills its storage, and until now the only way to remove old
PV time-series data was by hand in the MongoDB shell. This adds
[`bin/mongodb-trim-buckets`](https://github.com/osprey-dcs/data-platform/blob/main/bin/mongodb-trim-buckets),
an operator script that deletes `buckets` documents older than a cutoff, and a
[runbook](https://github.com/osprey-dcs/data-platform/blob/main/doc/admin/trim-buckets.md) for
running it.

**The script lives on `main` and is not tied to a service release.** It needs only `mongosh` and
a connection string, works against dp-service 1.16.0 archives as they are, and runs while the
services are up. A deployment that needs it can take it from `main` today.

What it does:

- **Deletes whole buckets by data time.** A bucket is removed when its last sample is before the
  cutoff, given as `--older-than-days` or `--before`. Buckets carry no ingestion timestamp, so the
  cutoff is the time of the data, not when it was loaded: **historical data loaded after a trim
  is removed by the next one.**
- **Reports by default, deletes only with `--execute`.** A run without it counts what would be
  removed, per PV, and changes nothing.
- **Takes an optional MongoDB filter** (`--filter`) that is ANDed with the age test, for keeping
  or targeting data by any stored bucket field, column tags and attributes included.
- **Works PV by PV on the index the services already ship**, in bounded batches, oldest first,
  with write concern `majority`. It adds no index. A run that cannot make progress retries, then
  stops with a non-zero exit status; rerunning it continues where it stopped.
- **Splits across parallel instances** with `--slice i/n` for a large first trim.
- **Records every run** in a `trimLog` collection: the host it ran from, the cutoff and filter,
  whether it was a dry run, how many buckets it removed, and how it ended.

It supports unsharded replica sets and sharded clusters, and on a sharded cluster must be pointed
at `mongos`.

Things to know before running it:

- **Freed space is reused by MongoDB, not returned to the operating system.** Disk usage reported
  by the host does not fall after a trim.
- **Only `buckets` is trimmed.** Request status, sample status, annotations and datasets are left
  as they are, so a dataset can refer to a time range whose data is gone.
- **A shard with two data-bearing members and an arbiter cannot trim while either member is
  down**, since `majority` needs both.
- **Rates at scale are unmeasured.** The script is tested for correctness on small sharded and
  unsharded fixtures; stage a large first trim by moving the cutoff forward, as the runbook
  describes.

Example Kubernetes manifests for a daily run and a sliced one-off are in
[`kubernetes/examples/trim-buckets`](https://github.com/osprey-dcs/data-platform/tree/main/kubernetes/examples/trim-buckets).

---

## Cutting the release

When the version is known and the release is being cut:

1. **`git mv doc/release-notes/NEXT.md doc/release-notes/rel-<version>.md`.** The filename must
   match the tag exactly.
2. **Retitle** the H1 to `# Data Platform <version> Release Notes` and replace this file's
   preamble with the "Changes since rel-&lt;previous&gt;" summary and the repository table, as in the
   previous release's notes.
3. **Add the sections for the child repositories**, organized by feature, each linking to the
   repository notes that carry the detail.
4. **Add the "Upgrading from &lt;previous&gt;" section** first after Contents if the release is
   breaking, with silent behavior changes called out separately from compile errors.
5. **Repoint `blob/main/...` and `tree/main/...` links to the release tag.**
   `python3 .github/scripts/check-release-notes.py` lists every link still on `main` and every
   leftover placeholder, with line numbers.
6. **Delete this "Cutting the release" section** and update Contents.
7. **Add the row to the release notes table in `README.md`.**
8. **Merge the notes before pushing the tag**, then follow
   [the release process](https://github.com/osprey-dcs/data-platform/blob/main/doc/developer/release.md).
9. **Start a fresh `NEXT.md`** for the following cycle.
