# Plan Documents

Official, version-controlled plan documents for data-platform work. This repo hosts the
cross-repo epics for the Data Platform (dp-grpc, dp-service, dp-python-lib, dp-desktop-app, and
this repo), so the plans here are mostly epic-level: what the work is, why, how it splits across
the repos, and in what order. Component-level design belongs in the component repo's own
`plan/tickets/<N>/` directory, linked from the epic plan.

Layout: one directory per GitHub issue under `plan/tickets/<N>/`, typically containing
`plan.md` plus any companion documents. Other kinds of plans may get sibling directories later
(e.g., `plan/releases/`).

Lifecycle:

- Draft and iterate in `~/dp/dev/tickets/data-platform/<N>/`, outside the repo; promote a
  document here once its decisions are settled enough to review, so the plan gets review
  without churning the repo during drafting.
- An epic plan may be committed early and refined in later PRs while the epic is open, as
  child tickets are created and their scope settles. Once the epic closes, the plan becomes a
  **point-in-time record**: it is not retro-edited to track later changes, and the component
  repos are authoritative for current behavior. If a closed plan turns out to be wrong about
  something material, add a dated correction note at the top rather than rewriting it.

This follows the convention in dp-grpc's and dp-service's `plan/` directories.
