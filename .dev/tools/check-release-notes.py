#!/usr/bin/env python3
"""Check doc/release-notes/rel-X.Y.Z.md and the NEXT.md draft: their links, their placeholders, and the
tag-bearing parts of their verification instructions.

One script, copied verbatim into each of the five osprey-dcs repos (dp-grpc, dp-service, dp-desktop-app,
dp-python-lib, data-platform).  The copies differ ONLY in the "REPO-SPECIFIC CONFIGURATION" block below.  The rules
are osprey-dcs/data-platform#98.  The self-test exercises every rule, including identity rules a given copy does
not enable, so a copy whose rules have stopped matching fails on its first run.

A notes file is published verbatim as its GitHub release body (here via release.yml's `body_path`;
plan/tickets/56/plan.md), so whatever the file says is what readers of the release page get.  GitHub does not
resolve relative links in a release body, a link pinned to `main` drifts as the repo moves on, and a link copied
from the previous release's notes resolves to real but stale content.  None of that looks wrong in a diff or a
local preview, which is why it is checked rather than left to review.

LINK RULES.  Code spans and fenced code blocks are blanked out first, so text that *quotes* a bad link does not
fail; R5 runs on the raw text, because the placeholders it catches live in code blocks.  A link is an inline
`[text](target)` or image, a reference definition `[label]: target`, an autolink, or a bare URL.

  rel-X.Y.Z.md
    R1  No relative cross-file links: an inline or reference-definition target that is not http(s):, mailto: or
        `#anchor` fails (`../../README.md`, `doc/x.md`).
    R2  Every github.com/osprey-dcs/<repo>/(blob|tree)/<ref>/... and raw.githubusercontent.com/osprey-dcs/<repo>/
        <ref>/... link, into any of the five repos, has <ref> equal to this file's tag (they release in lockstep).
        Exception: a full 40-character commit SHA, for a target that did not exist at the tag -- a section added
        to the notes after the release, such as rel-1.16.0's README.env link.  A SHA cannot drift; `main`, a short
        SHA, or any other tag still fails.
    R3  For tag-pinned links into this repo, the path exists in the working tree, spelled exactly (GitHub is
        case-sensitive; macOS is not), as a file for blob/raw and a directory for tree.
    R4  For tag-pinned links into this repo's .md files with a `#anchor`, and for same-document `#anchor` links,
        the anchor is a heading slug (or an `<a name>`/`id`) in the target, and that heading is not duplicated
        there.  A duplicated heading is what silently moves an anchor to `-1`.  A duplicate no link points at is
        left alone, since there is nothing for it to move.
    R5  No template placeholder left: `rel-<version>`, `<version>`, `<previous>`.

  NEXT.md (the version-less draft, renamed to rel-<version>.md at the cut)
    N1  As R1.
    N2  Every osprey-dcs blob/tree/raw link uses `main`: a `rel-*` ref here guesses an undecided version, and R2
        requires repointing at the cut anyway.
    N3  R3 and R4 for `main`-pinned links into this repo, against the working tree.  This is the check that fails
        a PR renaming a heading a NEXT.md link points at, in the PR that renames it.
    R5 does not apply to NEXT.md: placeholders belong in a draft.

R3, R4 and N3 run against the working tree, which is the tree being tagged both in CI on the cut PR and in
release.yml at the tag: no git, no tag peeling, no network.  Cross-repo paths and anchors get R2 only, since that
tree is not checked out, and so do SHA-pinned links.  Whether URLs resolve over the network is deliberately not
checked: before the tag is pushed, every correctly pinned link 404s.

WHICH NOTES ARE ALREADY RELEASED.  The rel-*.md with the highest X.Y.Z in its directory is the release being cut
(or, between cuts, the latest one) and gets every rule.  Every other rel-*.md is already released and gets the
form rules only -- R1, R2, R5 and the identity rules -- because it is immutable and pinned to its own tag, and
checking its paths and anchors against today's tree would fail an old file the first time a heading is renamed on
`main`.  This needs only the directory listing, so it works offline and the same way in CI and in release.yml
(which passes just the file being released; the comparison is still against that file's directory).  Accepted
consequences: between cuts, the latest release's links into this repo are checked against the moving tree, so a
rename that breaks one fails its PR; and a patch release of an older line would count as released, which the five
repos' lockstep versioning does not produce.

IDENTITY RULES (rel-X.Y.Z.md only), switched on by the configuration block:

  SIGSTORE_PYTHON_RULES (dp-python-lib)
      A `## Verifying these artifacts` heading; at least one `sigstore verify identity`, each naming the wheel,
      the sdist and SHA256SUMS; every `--cert-identity` exactly this repository's release.yml at this file's tag,
      with the GitHub Actions OIDC issuer; and a `**Full Changelog**:` compare link ending at this file's tag and
      starting at an earlier one (which release came before is not knowable from one file).  For NEXT.md this is
      inverted: a verification heading, a verify command at the start of a line, a `--cert-identity` with a value,
      or a Full Changelog line is an error there, since each names the tag.  Prose naming them is fine.
  COSIGN_IDENTITY_WORKFLOWS (dp-service, dp-desktop-app)
      Every `--certificate-identity` is exactly https://github.com/<repo>/.github/workflows/<one of these>
      @refs/tags/<this file's tag>.
  COSIGN_IMAGE (dp-service)
      Every `<image>:rel-...` reference names this file's tag.
  COSIGN_IDENTITY_REGEXP (dp-grpc)
      Every `--certificate-identity-regexp` is exactly this regexp.  It has no tag in it by design; the check stops
      a later edit from loosening it.
  With any COSIGN_* rule on, every `--certificate-oidc-issuer` must also be the GitHub Actions issuer.

The identity rules earn their keep the same way the link rules do: the verification section is copied from the
previous release, and a stale tag in the identity makes verification reject every genuine artifact.

Runs in CI on every PR over every notes file, and in release.yml on the tagged file as a backstop.  Each run starts
with a self-test that feeds every rule known-bad input it must reject and known-good input it must accept, so a
rule that has quietly stopped matching fails loudly instead of passing everything.

Usage:
    python .dev/tools/check-release-notes.py [FILE ...]

With no arguments, checks every <notes dir>/rel-*.md, and NEXT.md if present.  Stdlib only.  Exits 0 if all pass,
1 otherwise.
"""

from __future__ import annotations

import os
import re
import sys
import tempfile
from dataclasses import dataclass, replace
from pathlib import Path
from urllib.parse import unquote

# dp-grpc's documented cosign identity regexp: anchored, and pinned to its repository, release.yml, and a `rel-` tag.
# Shared by every copy (the self-test uses it), and defined here so dp-grpc's configuration below can name it.
DP_GRPC_IDENTITY_REGEXP = r"^https://github.com/osprey-dcs/dp-grpc/\.github/workflows/release\.yml@refs/tags/rel-"

# ==================================================================================================================
# REPO-SPECIFIC CONFIGURATION -- the only lines that differ between the five copies of this script.
#
# REPOSITORY is "osprey-dcs/<repo>" in each, and NOTES_DIR_IN_REPO is the same in all five.  Then:
#   dp-python-lib   SIGSTORE_PYTHON_RULES = True                              (and no COSIGN_* rules)
#   dp-service      COSIGN_IDENTITY_WORKFLOWS = ("release.yml", "release-image.yml")
#                   COSIGN_IMAGE = "ghcr.io/osprey-dcs/dp-service"
#   dp-desktop-app  COSIGN_IDENTITY_WORKFLOWS = ("release.yml",)
#   dp-grpc         COSIGN_IDENTITY_REGEXP = DP_GRPC_IDENTITY_REGEXP
#   data-platform   none of them
# ==================================================================================================================
REPOSITORY = "osprey-dcs/data-platform"
NOTES_DIR_IN_REPO = "doc/release-notes"
SIGSTORE_PYTHON_RULES = False
COSIGN_IDENTITY_WORKFLOWS: tuple[str, ...] = ()
COSIGN_IMAGE: str | None = None
COSIGN_IDENTITY_REGEXP: str | None = None
# ==================================================================================================================
# END OF REPO-SPECIFIC CONFIGURATION.  Everything below is identical in every copy.
# ==================================================================================================================

REPO_ROOT = Path(__file__).resolve().parents[2]
NOTES_DIR = REPO_ROOT / NOTES_DIR_IN_REPO
NEXT_NAME = "NEXT.md"
OWNER = "osprey-dcs"
OIDC_ISSUER = "https://token.actions.githubusercontent.com"


@dataclass(frozen=True)
class Config:
    repository: str
    sigstore_python: bool
    cosign_workflows: tuple[str, ...]
    cosign_image: str | None
    cosign_identity_regexp: str | None


CONFIG = Config(
    repository=REPOSITORY,
    sigstore_python=SIGSTORE_PYTHON_RULES,
    cosign_workflows=COSIGN_IDENTITY_WORKFLOWS,
    cosign_image=COSIGN_IMAGE,
    cosign_identity_regexp=COSIGN_IDENTITY_REGEXP,
)

STEM_RE = re.compile(r"^rel-(\d+)\.(\d+)\.(\d+)$")


def version_of(tag: str) -> tuple[int, ...]:
    match = STEM_RE.match(tag)
    assert match is not None
    return tuple(int(part) for part in match.groups())


def line_of(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


# ------------------------------------------------------------------------------------------------------------------
# Which notes are already released
# ------------------------------------------------------------------------------------------------------------------


def newest_release(names: list[str]) -> str | None:
    """The stem of the highest-versioned rel-X.Y.Z.md among `names`; every other rel-*.md is already released."""
    tags = [Path(name).stem for name in names if Path(name).suffix == ".md" and STEM_RE.match(Path(name).stem)]
    return max(tags, key=version_of, default=None)


def is_released(path: Path) -> bool:
    newest = newest_release([p.name for p in path.parent.glob("rel-*.md")])
    return newest is not None and version_of(path.stem) < version_of(newest)


# ------------------------------------------------------------------------------------------------------------------
# Markdown: stripping code, collecting links and heading anchors
# ------------------------------------------------------------------------------------------------------------------

FENCE_OPEN_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
FENCE_CLOSE_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})[ \t]*$")
# A code span: a run of N backticks, then content with no blank line in it, then a run of exactly N backticks.
CODE_SPAN_RE = re.compile(r"(?<!`)(`+)(?!`)((?:[^\n]|\n(?![ \t]*\n))+?)(?<!`)\1(?!`)")


def strip_fences(text: str) -> str:
    """`text` with every fenced code block's lines (fences included) blanked; line numbers are preserved."""
    out: list[str] = []
    fence: str | None = None
    for line in text.split("\n"):
        if fence is None:
            opened = FENCE_OPEN_RE.match(line)
            # A backtick fence's info string cannot contain a backtick, so "```x``` y" is a code span, not a fence.
            if opened and not (opened.group(1)[0] == "`" and "`" in opened.group(2)):
                fence = opened.group(1)
                out.append("")
            else:
                out.append(line)
        else:
            closed = FENCE_CLOSE_RE.match(line)
            if closed and closed.group(1)[0] == fence[0] and len(closed.group(1)) >= len(fence):
                fence = None
            out.append("")
    return "\n".join(out)


def strip_code(text: str) -> str:
    """`text` with fenced blocks and code spans blanked, keeping every offset's line number."""
    return CODE_SPAN_RE.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), strip_fences(text))


# Inline link or image: `](target`, optionally <wrapped>.  Reference definition: `[label]: target` at the start of
# a line (a footnote definition, `[^1]:`, is not a link).
INLINE_TARGET_RE = re.compile(r"\]\(\s*(<[^>\n]*>|[^\s)]+)")
REFDEF_TARGET_RE = re.compile(r"^ {0,3}\[(?!\^)[^\]\n]+\]:[ \t]*(<[^>\n]*>|\S+)", re.MULTILINE)
# Any absolute URL, wherever it appears: GitHub links bare URLs too, so R2 must see them.
URL_RE = re.compile(r"https?://[^\s<>()\[\]\"'`]+")
ALLOWED_TARGET_RE = re.compile(r"^(?:https?:|mailto:|#)", re.IGNORECASE)


def link_targets(stripped: str) -> list[tuple[int, str]]:
    """(offset, target) for every inline link and reference definition in code-stripped text."""
    found = [(m.start(1), m.group(1)) for m in INLINE_TARGET_RE.finditer(stripped)]
    found += [(m.start(1), m.group(1)) for m in REFDEF_TARGET_RE.finditer(stripped)]
    return sorted((pos, target.strip("<>")) for pos, target in found)


def urls(stripped: str) -> list[tuple[int, str]]:
    """(offset, url) for every absolute URL in code-stripped text, without trailing sentence punctuation."""
    return [(m.start(), m.group(0).rstrip(".,;:!?*_")) for m in URL_RE.finditer(stripped)]


HEADING_LINE_RE = re.compile(r"^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$", re.MULTILINE)
HTML_ANCHOR_RE = re.compile(r"<a\s[^>]*?\b(?:name|id)\s*=\s*[\"']([^\"']+)[\"']", re.IGNORECASE)
LINE_ANCHOR_RE = re.compile(r"^L\d+(?:C\d+)?(?:-L\d+(?:C\d+)?)?$")


def slug_base(heading: str) -> str:
    """GitHub's slug for a heading, before de-duplication: the rendered text lowercased, punctuation dropped,
    spaces turned into hyphens.  ATX (`#`) headings only; these files use no setext headings."""
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", heading)  # a link or image renders as its text
    text = re.sub(r"<[^>]+>", "", text).replace("`", "")
    return re.sub(r"[^\w\- ]", "", text.strip().lower()).replace(" ", "-")


def heading_anchors(text: str) -> tuple[set[str], set[str]]:
    """(every anchor in a Markdown document, the anchors that belong to a duplicated heading).

    GitHub slugs repeated headings `x`, `x-1`, `x-2`, so a link to any of them is ambiguous: adding or removing one
    of those headings silently moves where it lands.
    """
    counts: dict[str, int] = {}
    anchors: set[str] = set()
    by_base: dict[str, list[str]] = {}
    for match in HEADING_LINE_RE.finditer(strip_fences(text)):
        base = slug_base(match.group(2))
        n = counts.get(base, 0)
        counts[base] = n + 1
        slug = base if n == 0 else f"{base}-{n}"
        anchors.add(slug)
        by_base.setdefault(base, []).append(slug)
    duplicated = {slug for slugs in by_base.values() if len(slugs) > 1 for slug in slugs}
    anchors.update(HTML_ANCHOR_RE.findall(text))
    return anchors, duplicated


# ------------------------------------------------------------------------------------------------------------------
# osprey-dcs repository links
# ------------------------------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class RepoLink:
    repo: str  # e.g. "dp-python-lib"
    kind: str  # "blob", "tree" or "raw"
    ref: str
    path: str  # repository-relative and percent-decoded; "" for the root
    anchor: str | None


BLOB_RE = re.compile(
    rf"^https://(?:www\.)?github\.com/{OWNER}/([\w.-]+)/(blob|tree)/([^/?#]+)(/[^?#]*)?(\?[^#]*)?(#.*)?$"
)
RAW_RE = re.compile(
    rf"^https://raw\.githubusercontent\.com/{OWNER}/([\w.-]+)/(?:refs/(?:heads|tags)/)?([^/?#]+)(/[^?#]*)?"
    r"(\?[^#]*)?(#.*)?$"
)
FULL_SHA_RE = re.compile(r"^[0-9a-f]{40}$")


def parse_repo_link(url: str) -> RepoLink | None:
    """The parts of an osprey-dcs blob/tree/raw URL, or None for any other URL (issues, PRs, compare, ...)."""
    blob = BLOB_RE.match(url)
    if blob:
        repo, kind, ref, path, _query, anchor = blob.groups()
    else:
        raw = RAW_RE.match(url)
        if not raw:
            return None
        repo, ref, path, _query, anchor = raw.groups()
        kind = "raw"
    return RepoLink(
        repo=repo,
        kind=kind,
        ref=ref,
        path=unquote((path or "").strip("/")),
        anchor=unquote(anchor[1:]) if anchor and len(anchor) > 1 else None,
    )


def exists_exactly(root: Path, rel: str, kind: str) -> bool:
    """Whether `rel` exists under `root` with exactly this spelling, as a directory for a tree link and a file
    otherwise.  Each component is matched against its directory listing rather than with Path.exists(), because
    macOS file systems are case-insensitive and GitHub is not."""
    here = root
    for part in [p for p in rel.split("/") if p]:
        if part in (".", "..") or not here.is_dir() or part not in os.listdir(here):
            return False
        here = here / part
    return here.is_dir() if kind == "tree" or not rel else here.is_file()


# ------------------------------------------------------------------------------------------------------------------
# Link rules R1-R4 (rel-X.Y.Z.md) and N1-N3 (NEXT.md); placeholder rule R5
# ------------------------------------------------------------------------------------------------------------------

PLACEHOLDER_RE = re.compile(r"rel-<version>|<version>|<previous>")


def check_links(name: str, text: str, *, tag: str | None, full: bool, root: Path, cfg: Config) -> list[str]:
    """The link rules for one file.  `tag` is the file's tag, or None for NEXT.md (the N rules).  `full` adds the
    working-tree rules (R3/R4, N3); it is False for notes that are already released."""
    problems: list[str] = []
    stripped = strip_code(text)
    this_repo = cfg.repository.split("/", 1)[1]
    r1, r2, r3, r4 = ("R1", "R2", "R3", "R4") if tag else ("N1", "N2", "N3", "N3")
    want_ref = tag or "main"
    own_anchors: tuple[set[str], set[str]] | None = None
    target_anchors: dict[str, tuple[set[str], set[str]]] = {}

    def where(pos: int) -> str:
        return f"{name}:{line_of(stripped, pos)}"

    def check_anchor(pos: int, anchor: str, anchors: tuple[set[str], set[str]], target: str, rule: str) -> None:
        if LINE_ANCHOR_RE.match(anchor):
            return
        known, duplicated = anchors
        if anchor not in known:
            problems.append(f"{where(pos)}: {rule}: no heading with anchor #{anchor} in {target}")
        elif anchor in duplicated:
            problems.append(
                f"{where(pos)}: {rule}: #{anchor} points at a duplicated heading in {target}; rename one of them, "
                "or the anchor moves when either changes"
            )

    for pos, target in link_targets(stripped):
        if not ALLOWED_TARGET_RE.match(target):
            problems.append(
                f"{where(pos)}: {r1}: relative link '{target}' cannot resolve in a release body; use "
                f"https://github.com/{cfg.repository}/blob/{want_ref}/<path>"
            )
        elif full and target.startswith("#") and len(target) > 1:
            if own_anchors is None:
                own_anchors = heading_anchors(text)
            check_anchor(pos, unquote(target[1:]), own_anchors, "this file", r4)

    for pos, url in urls(stripped):
        link = parse_repo_link(url)
        if link is None:
            continue
        sha_pinned = tag is not None and FULL_SHA_RE.match(link.ref) is not None
        if link.ref != want_ref and not sha_pinned:
            expected = f"expected this release's tag {tag}" if tag else "NEXT.md links use main until the cut"
            problems.append(f"{where(pos)}: {r2}: link pinned to '{link.ref}', {expected}: {url}")
            continue
        if not full or sha_pinned or link.repo != this_repo:
            continue  # released notes get the form rules only; a SHA's or another repo's tree is not checked out
        if not exists_exactly(root, link.path, link.kind):
            problems.append(f"{where(pos)}: {r3}: no {link.kind} '{link.path or '/'}' in this repository: {url}")
            continue
        if link.anchor and link.kind == "blob" and link.path.lower().endswith((".md", ".markdown")):
            if link.path not in target_anchors:
                target_anchors[link.path] = heading_anchors((root / link.path).read_text(encoding="utf-8"))
            check_anchor(pos, link.anchor, target_anchors[link.path], link.path, r4)

    return problems


def check_placeholders(name: str, text: str) -> list[str]:
    """R5, over the raw text: the placeholders live in code blocks, so nothing is stripped."""
    return [
        f"{name}:{line_of(text, m.start())}: R5: template placeholder '{m.group(0)}' left in a release note"
        for m in PLACEHOLDER_RE.finditer(text)
    ]


# ------------------------------------------------------------------------------------------------------------------
# Identity rules: sigstore-python (dp-python-lib)
# ------------------------------------------------------------------------------------------------------------------

VERIFY_HEADING_RE = re.compile(r"^## Verifying these artifacts\s*$", re.MULTILINE)
# The whole command, backslash continuations included, up to the first line that does not continue.
SIGSTORE_VERIFY_RE = re.compile(r"\bsigstore\s+verify\s+identity\b(?:[^\n]*\\\n)*[^\n]*")
SIGSTORE_IDENTITY_RE = re.compile(r"--cert-identity[ =]\"?([^\"\s]+)\"?")
SIGSTORE_ISSUER_RE = re.compile(r"--cert-oidc-issuer[ =]\"?([^\"\s]+)\"?")
# A command as written in a code block, rather than named in prose.
SIGSTORE_VERIFY_COMMAND_RE = re.compile(r"^[ \t]*sigstore\s+verify\s+identity\b", re.MULTILINE)
CHANGELOG_RE = re.compile(r"^\*\*Full Changelog\*\*:\s*(\S+)\s*$", re.MULTILINE)

# What each `sigstore verify identity` must name, as (description, predicate over its file operands).  Every
# release signs all three, and verifying only the wheel was exactly the shape rel-1.16.0's page first shipped with.
REQUIRED_OPERANDS = [
    ("the wheel", lambda arg: arg.endswith(".whl")),
    ("the sdist", lambda arg: arg.endswith(".tar.gz")),
    ("SHA256SUMS", lambda arg: arg == "SHA256SUMS"),
]


def expected_identity(tag: str, repository: str = REPOSITORY, workflow: str = "release.yml") -> str:
    return f"https://github.com/{repository}/.github/workflows/{workflow}@refs/tags/{tag}"


def verify_operands(command: str) -> list[str]:
    """The file operands of one `sigstore verify identity` command: every token that is not an option or its value."""
    tokens = command.replace("\\\n", " ").split()[3:]
    operands: list[str] = []
    skip_value = False
    for token in tokens:
        if skip_value:
            skip_value = False
        elif token.startswith("--"):
            skip_value = "=" not in token
        else:
            operands.append(token)
    return operands


def check_sigstore_python(name: str, tag: str, text: str, cfg: Config) -> list[str]:
    """dp-python-lib's verification section and changelog link in a rel-X.Y.Z.md; empty when they pass."""
    problems: list[str] = []

    if not VERIFY_HEADING_RE.search(text):
        problems.append(f"{name}: missing a '## Verifying these artifacts' section")

    commands = SIGSTORE_VERIFY_RE.findall(text)
    if not commands:
        problems.append(f"{name}: missing a 'sigstore verify identity' command")
    for command in commands:
        operands = verify_operands(command)
        for description, matches in REQUIRED_OPERANDS:
            if not any(matches(arg) for arg in operands):
                problems.append(f"{name}: 'sigstore verify identity' does not verify {description}")

    identities = SIGSTORE_IDENTITY_RE.findall(text)
    if not identities:
        problems.append(f"{name}: missing --cert-identity")
    want = expected_identity(tag, cfg.repository)
    for identity in identities:
        if identity != want:
            problems.append(f"{name}: --cert-identity is\n      {identity}\n    expected\n      {want}")

    issuers = SIGSTORE_ISSUER_RE.findall(text)
    if not issuers:
        problems.append(f"{name}: missing --cert-oidc-issuer")
    for issuer in issuers:
        if issuer != OIDC_ISSUER:
            problems.append(f"{name}: --cert-oidc-issuer is {issuer}, expected {OIDC_ISSUER}")

    compare_re = re.compile(
        rf"^https://github\.com/{re.escape(cfg.repository)}/compare/(rel-\d+\.\d+\.\d+)\.\.\.(rel-\d+\.\d+\.\d+)$"
    )
    changelogs = CHANGELOG_RE.findall(text)
    if not changelogs:
        problems.append(f"{name}: missing a '**Full Changelog**: .../compare/rel-<prev>...{tag}' line")
    for url in changelogs:
        compare = compare_re.match(url)
        if compare is None:
            problems.append(
                f"{name}: Full Changelog link is\n      {url}\n    expected"
                f"\n      https://github.com/{cfg.repository}/compare/rel-<prev>...{tag}"
            )
            continue
        prev, this = compare.groups()
        if this != tag:
            problems.append(f"{name}: Full Changelog link ends at {this}, expected {tag}")
        elif version_of(prev) >= version_of(tag):
            problems.append(f"{name}: Full Changelog link starts at {prev}, which is not earlier than {tag}")

    return problems


def check_next_sigstore_python(name: str, text: str) -> list[str]:
    """One message per tag-bearing verification part found in dp-python-lib's NEXT.md draft."""
    problems: list[str] = []
    forbidden = [
        (VERIFY_HEADING_RE, "a '## Verifying these artifacts' section"),
        (SIGSTORE_VERIFY_COMMAND_RE, "a 'sigstore verify identity' command"),
        (SIGSTORE_IDENTITY_RE, "a --cert-identity"),
        (CHANGELOG_RE, "a '**Full Changelog**' line"),
    ]
    for pattern, description in forbidden:
        if pattern.search(text):
            problems.append(
                f"{name}: contains {description}, which names the release's tag; NEXT.md names no version, "
                "so add it when the file is renamed at the cut"
            )
    return problems


# ------------------------------------------------------------------------------------------------------------------
# Identity rules: cosign (dp-service, dp-desktop-app, dp-grpc)
# ------------------------------------------------------------------------------------------------------------------


def option_values(option: str, text: str) -> list[tuple[int, str]]:
    """(offset, value) of every `option VALUE` / `option=VALUE`, the value optionally single- or double-quoted.
    `--certificate-identity` does not match `--certificate-identity-regexp`, nor prose naming the flag in
    backticks."""
    pattern = re.compile(rf"{re.escape(option)}[ =](?:'([^'\n]*)'|\"([^\"\n]*)\"|([^\s'\"]+))")
    return [(m.start(), next(g for g in m.groups() if g is not None)) for m in pattern.finditer(text)]


def check_cosign(name: str, tag: str, text: str, cfg: Config) -> list[str]:
    """The cosign identity rules switched on in `cfg`, over a rel-X.Y.Z.md's raw text; empty when they pass."""
    problems: list[str] = []
    if cfg.cosign_workflows:
        allowed = [expected_identity(tag, cfg.repository, workflow) for workflow in cfg.cosign_workflows]
        for pos, identity in option_values("--certificate-identity", text):
            if identity not in allowed:
                problems.append(
                    f"{name}:{line_of(text, pos)}: --certificate-identity is\n      {identity}\n    expected one of"
                    + "".join(f"\n      {a}" for a in allowed)
                )
    if cfg.cosign_image:
        for m in re.finditer(rf"{re.escape(cfg.cosign_image)}:(rel-[^\s'\"`)]*)", text):
            if m.group(1) != tag:
                problems.append(
                    f"{name}:{line_of(text, m.start())}: image {cfg.cosign_image}:{m.group(1)}, expected :{tag}"
                )
    if cfg.cosign_identity_regexp:
        for pos, regexp in option_values("--certificate-identity-regexp", text):
            if regexp != cfg.cosign_identity_regexp:
                problems.append(
                    f"{name}:{line_of(text, pos)}: --certificate-identity-regexp is\n      {regexp}\n"
                    f"    expected exactly\n      {cfg.cosign_identity_regexp}"
                )
    if cfg.cosign_workflows or cfg.cosign_image or cfg.cosign_identity_regexp:
        for pos, issuer in option_values("--certificate-oidc-issuer", text):
            if issuer != OIDC_ISSUER:
                problems.append(
                    f"{name}:{line_of(text, pos)}: --certificate-oidc-issuer is {issuer}, expected {OIDC_ISSUER}"
                )
    return problems


# ------------------------------------------------------------------------------------------------------------------
# Per-file entry points
# ------------------------------------------------------------------------------------------------------------------


def check_release_text(
    name: str, tag: str, text: str, *, released: bool, root: Path = REPO_ROOT, cfg: Config = CONFIG
) -> list[str]:
    """Every rule for a rel-X.Y.Z.md; `released` drops the working-tree rules (R3, R4)."""
    problems: list[str] = []
    if cfg.sigstore_python:
        problems += check_sigstore_python(name, tag, text, cfg)
    problems += check_cosign(name, tag, text, cfg)
    problems += check_links(name, text, tag=tag, full=not released, root=root, cfg=cfg)
    problems += check_placeholders(name, text)
    return problems


def check_next_text(name: str, text: str, *, root: Path = REPO_ROOT, cfg: Config = CONFIG) -> list[str]:
    """Every rule for the NEXT.md draft."""
    problems: list[str] = []
    if cfg.sigstore_python:
        problems += check_next_sigstore_python(name, text)
    problems += check_links(name, text, tag=None, full=True, root=root, cfg=cfg)
    return problems


def check_file(path: Path) -> tuple[list[str], str]:
    """(one message per problem found in `path`, which rules it was checked under)."""
    if path.name == NEXT_NAME:
        return check_next_text(str(path), path.read_text(encoding="utf-8")), "draft rules (N1-N3)"
    tag = path.stem
    if path.suffix != ".md" or not STEM_RE.match(tag):
        return [f"{path}: name must be rel-X.Y.Z.md or {NEXT_NAME} (release.yml looks the notes up by tag)"], "-"
    released = is_released(path)
    problems = check_release_text(str(path), tag, path.read_text(encoding="utf-8"), released=released)
    return problems, "already released: form rules (R1, R2, R5)" if released else "newest: all rules (R1-R5)"


# ------------------------------------------------------------------------------------------------------------------
# Self-test
# ------------------------------------------------------------------------------------------------------------------

_TAG = "rel-2.1.0"
_PY = "https://github.com/osprey-dcs/dp-python-lib"


def _sigstore_sample(
    identity_tag: str = _TAG,
    files: str = "dp_python_lib-*.whl dp_python_lib-*.tar.gz SHA256SUMS",
    changelog: str | None = "rel-2.0.0...rel-2.1.0",
) -> str:
    notes = f"""# dp-python-lib rel-2.1.0

## Verifying these artifacts

```bash
sigstore verify identity \\
  --cert-identity "{expected_identity(identity_tag, "osprey-dcs/dp-python-lib")}" \\
  --cert-oidc-issuer "{OIDC_ISSUER}" \\
  {files}
```
"""
    if changelog is not None:
        notes += f"\n**Full Changelog**: {_PY}/compare/{changelog}\n"
    return notes


def _make_tree(root: Path) -> None:
    """A minimal working tree for R3/R4/N3: a README with a duplicated heading and an HTML anchor, and a doc dir."""
    (root / "doc").mkdir()
    (root / "README.md").write_text(
        "# Project\n\n## Configuration priority\n\n### Methods\n\n### Methods\n\n"
        '<a name="pinned"></a>\n\n```\n## Not a heading\n```\n',
        encoding="utf-8",
    )
    (root / "doc" / "guide.md").write_text("# Guide\n\n## Internal: the `_dispatch` refactor (Issue #14)\n")
    (root / "README.env").write_text("verification reference\n")


# Links that must pass in the newest notes (rel-2.1.0), against the tree from _make_tree.
_GOOD_LINKS = f"""# Notes

## Installing

- [config]({_PY}/blob/{_TAG}/README.md#configuration-priority) and [guide][guide]
- [dispatch]({_PY}/blob/{_TAG}/doc/guide.md#internal-the-_dispatch-refactor-issue-14)
- [html anchor]({_PY}/blob/{_TAG}/README.md#pinned), [env]({_PY}/blob/{_TAG}/README.env)
- [doc dir]({_PY}/tree/{_TAG}/doc), raw: https://raw.githubusercontent.com/osprey-dcs/dp-python-lib/{_TAG}/README.env
- [dp-grpc notes](https://github.com/osprey-dcs/dp-grpc/blob/{_TAG}/doc/release-notes/{_TAG}.md#anything)
- [added later]({_PY}/blob/0123456789abcdef0123456789abcdef01234567/not/in/this/tree.md)
- [issue]({_PY}/issues/7), [mail](mailto:x@example.org), [up](#installing), <{_PY}/pull/9>
- quoted, not linked: `[x](../../README.md)` and `{_PY}/blob/main/README.md`

```markdown
See [the README](../../README.md#x) or [on main]({_PY}/blob/main/README.md).
[stale]: {_PY}/blob/rel-1.0.0/README.md
```

[guide]: {_PY}/blob/{_TAG}/doc/guide.md
"""

# A NEXT.md that must pass: links on main, and a checklist quoting everything the release rules forbid.
_GOOD_NEXT = f"""# Release Notes -- next release (unreleased)

- [config]({_PY}/blob/main/README.md#configuration-priority), [guide][guide], [down](#cutting-the-release)
- [dp-grpc](https://github.com/osprey-dcs/dp-grpc/blob/main/README.md)

## Cutting the release

4. **Add the `## Verifying these artifacts` section**: `sigstore verify identity` over all three files, with
   `--cert-identity` ending `release.yml@refs/tags/rel-<version>`.
5. **End with the Full Changelog line**:
   `**Full Changelog**: {_PY}/compare/rel-<previous>...rel-<version>`.
6. Repoint `{_PY}/blob/main/...` links to `blob/rel-<version>/...`; `](../x.md)` is quoted here.

```bash
cosign verify-blob --certificate-identity 'x@refs/tags/rel-<version>'  # [a](../a.md)
```

[guide]: {_PY}/blob/main/doc/guide.md
"""


def _self_test_links(root: Path) -> list[str]:
    failures: list[str] = []
    cfg = replace(CONFIG, repository="osprey-dcs/dp-python-lib")

    def release(text: str, released: bool = False) -> list[str]:
        return check_links("<t>", text, tag=_TAG, full=not released, root=root, cfg=cfg) + check_placeholders(
            "<t>", text
        )

    def draft(text: str) -> list[str]:
        return check_links("<t>", text, tag=None, full=True, root=root, cfg=cfg)

    for description, problems in {
        "good links in the newest notes": release(_GOOD_LINKS),
        "good links in released notes": release(_GOOD_LINKS, released=True),
        "a good NEXT.md's links": draft(_GOOD_NEXT),
    }.items():
        if problems:
            failures.append(f"{description} were rejected:\n      " + "\n      ".join(problems))

    form_rules = {
        "R1 a ../ relative link": "[r](../../README.md#x)",
        "R1 a bare relative path": "[r](doc/guide.md)",
        "R1 a relative reference definition": "[r]: doc/guide.md",
        "R1 a relative image": "![i](img/x.png)",
        "R2 a link left on main": f"[m]({_PY}/blob/main/README.md)",
        "R2 a main-pinned reference definition": f"[readme-env]: {_PY}/blob/main/README.env",
        "R2 a stale tag": f"[s]({_PY}/blob/rel-2.0.0/README.md)",
        "R2 a stale tag into another repo": "[g](https://github.com/osprey-dcs/dp-grpc/blob/rel-2.0.0/README.md)",
        "R2 a tree link on main": f"[t]({_PY}/tree/main/doc)",
        "R2 a raw link on main": "https://raw.githubusercontent.com/osprey-dcs/dp-service/main/README.md",
        "R2 a bare URL on main": f"See {_PY}/blob/main/README.md.",
        "R2 a short SHA": f"[s]({_PY}/blob/0123456/README.md)",
        "R5 a leftover rel-<version>": "```\n--certificate-identity '...@refs/tags/rel-<version>'\n```",
        "R5 a leftover <previous>": f"`{_PY}/compare/<previous>...rel-2.1.0`",
    }
    tree_rules = {
        "R3 a missing path": f"[p]({_PY}/blob/{_TAG}/doc/missing.md)",
        "R3 a path in the wrong case": f"[p]({_PY}/blob/{_TAG}/readme.md)",
        "R3 a blob link to a directory": f"[p]({_PY}/blob/{_TAG}/doc)",
        "R4 a missing anchor": f"[a]({_PY}/blob/{_TAG}/README.md#configuration)",
        "R4 an anchor only inside a code block": f"[a]({_PY}/blob/{_TAG}/README.md#not-a-heading)",
        "R4 an anchor to a duplicated heading": f"[d]({_PY}/blob/{_TAG}/README.md#methods)",
        "R4 an anchor to a duplicate's -1": f"[d]({_PY}/blob/{_TAG}/README.md#methods-1)",
        "R4 a missing same-document anchor": "[c](#contents)",
    }
    for description, extra in {**form_rules, **tree_rules}.items():
        if not release(f"{_GOOD_LINKS}\n{extra}\n"):
            failures.append(f"{description} was accepted")
    for description, extra in form_rules.items():
        if not release(f"{_GOOD_LINKS}\n{extra}\n", released=True):
            failures.append(f"{description} was accepted in already released notes")
    for description, extra in tree_rules.items():
        if release(f"{_GOOD_LINKS}\n{extra}\n", released=True):
            failures.append(f"{description} was rejected in already released notes, which get the form rules only")

    for description, extra in {
        "N1 a relative link": "[r](../README.md)",
        "N1 a relative reference definition": "[r]: ./doc/guide.md",
        "N2 a rel- tag": f"[t]({_PY}/blob/rel-2.1.0/README.md)",
        "N2 a rel- reference definition into another repo": "[g]: https://github.com/osprey-dcs/dp-grpc/blob/rel-2.1.0/x",
        "N2 a commit SHA": f"[s]({_PY}/blob/0123456789abcdef0123456789abcdef01234567/README.md)",
        "N3 a missing path": f"[p]({_PY}/blob/main/doc/gone.md)",
        "N3 a missing anchor": f"[a]({_PY}/blob/main/README.md#configuration-priorities)",
        "N3 an anchor to a duplicated heading": f"[d]({_PY}/blob/main/README.md#methods)",
        "N3 a missing same-document anchor": "[c](#contents)",
    }.items():
        if not draft(f"{_GOOD_NEXT}\n{extra}\n"):
            failures.append(f"NEXT.md with {description} was accepted")

    # A duplicate heading in the notes themselves moves a same-document anchor just the same.
    if not release("# N\n\n## Methods\n\n## Methods\n\n[m](#methods)\n"):
        failures.append("R4 a same-document anchor to a duplicated heading was accepted")
    if release("# N\n\n## Methods\n\n### Methods\n\n[n](#n)\n"):
        failures.append("a duplicate heading that no link points at was rejected")
    return failures


def _self_test_released_rule() -> list[str]:
    names = ["rel-1.9.0.md", "rel-1.16.0.md", "rel-1.10.2.md", "NEXT.md", "README.md"]
    newest = newest_release(names)
    if newest != "rel-1.16.0":
        return [f"the newest of {names} was {newest}, expected rel-1.16.0 (versions compare numerically)"]
    return []


def _self_test_sigstore_python() -> list[str]:
    failures: list[str] = []
    cfg = replace(CONFIG, repository="osprey-dcs/dp-python-lib")
    good = check_sigstore_python("<good>", _TAG, _sigstore_sample(), cfg)
    if good:
        failures.append("a correct sigstore sample was rejected:\n      " + "\n      ".join(good))
    for description, notes in {
        "a stale --cert-identity tag": _sigstore_sample(identity_tag="rel-2.0.0"),
        "a verify of the wheel only": _sigstore_sample(files="dp_python_lib-*.whl"),
        "a verify missing SHA256SUMS": _sigstore_sample(files="dp_python_lib-*.whl dp_python_lib-*.tar.gz"),
        "a verify missing the sdist": _sigstore_sample(files="dp_python_lib-*.whl SHA256SUMS"),
        "no Full Changelog line": _sigstore_sample(changelog=None),
        "a Full Changelog link ending at a stale tag": _sigstore_sample(changelog="rel-1.9.0...rel-2.0.0"),
        "a Full Changelog link starting at a later tag": _sigstore_sample(changelog="rel-2.2.0...rel-2.1.0"),
        "a Full Changelog link to another repository": _sigstore_sample().replace(
            "dp-python-lib/compare", "dp-grpc/compare"
        ),
        "no verification heading": _sigstore_sample().replace("## Verifying these artifacts", "## Verification"),
    }.items():
        if not check_sigstore_python(f"<{description}>", _TAG, notes, cfg):
            failures.append(f"{description} was accepted")

    # The draft's own checklist names each forbidden part in prose; that must not trip the rule.
    good_next = check_next_sigstore_python("<good NEXT.md>", _GOOD_NEXT)
    if good_next:
        failures.append("a correct NEXT.md was rejected:\n      " + "\n      ".join(good_next))
    for description, notes in {
        "a NEXT.md with a verification section": _GOOD_NEXT + "\n## Verifying these artifacts\n",
        "a NEXT.md with a verify command": _GOOD_NEXT + "\n```bash\nsigstore verify identity \\\n```\n",
        "a NEXT.md with a signing identity": _GOOD_NEXT + f'\n  --cert-identity "{expected_identity(_TAG)}"\n',
        "a NEXT.md with a Full Changelog line": _GOOD_NEXT
        + f"\n**Full Changelog**: {_PY}/compare/rel-2.0.0...{_TAG}\n",
    }.items():
        if not check_next_sigstore_python(f"<{description}>", notes):
            failures.append(f"{description} was accepted")
    return failures


def _self_test_cosign() -> list[str]:
    """Every cosign rule under the configuration of the repo it is written for, whichever repo this copy is in."""
    failures: list[str] = []
    issuer = f"--certificate-oidc-issuer {OIDC_ISSUER}"
    service = Config(
        "osprey-dcs/dp-service", False, ("release.yml", "release-image.yml"), "ghcr.io/osprey-dcs/dp-service", None
    )
    desktop = Config("osprey-dcs/dp-desktop-app", False, ("release.yml",), None, None)
    grpc = Config("osprey-dcs/dp-grpc", False, (), None, DP_GRPC_IDENTITY_REGEXP)
    no_cosign = Config("osprey-dcs/data-platform", False, (), None, None)

    def ident(repo: str, workflow: str = "release.yml", tag: str = _TAG) -> str:
        return expected_identity(tag, f"osprey-dcs/{repo}", workflow)

    service_blob, service_image = ident("dp-service"), ident("dp-service", "release-image.yml")
    service_good = (
        f"cosign verify-blob --certificate-identity '{service_blob}' {issuer} SHA256SUMS\n"
        f"cosign verify --certificate-identity '{service_image}' \\\n  {issuer} \\\n"
        f"  ghcr.io/osprey-dcs/dp-service:{_TAG}\n"
        "Prose naming `--certificate-identity` is not an identity.\n"
    )
    desktop_id = ident("dp-desktop-app")
    desktop_good = (
        f"cosign verify-blob --certificate-identity '{desktop_id}' {issuer} SHA256SUMS\n"
        f'cosign verify-blob --certificate-identity "{desktop_id}" {issuer} '
        "--certificate-github-workflow-trigger push SHA256SUMS\n"
    )
    grpc_good = (
        f"cosign verify-blob \\\n  --certificate-identity-regexp '{DP_GRPC_IDENTITY_REGEXP}' \\\n"
        f"  {issuer} \\\n  SHA256SUMS\n"
    )
    for description, cfg, text in [
        ("dp-service", service, service_good),
        ("dp-desktop-app", desktop, desktop_good),
        ("dp-grpc", grpc, grpc_good),
        ("a repo with no cosign rules, over stale identities,", no_cosign, service_good.replace(_TAG, "rel-2.0.0")),
    ]:
        problems = check_cosign("<good>", _TAG, text, cfg)
        if problems:
            failures.append(f"correct {description} cosign notes were rejected:\n      " + "\n      ".join(problems))

    stale = "rel-2.0.0"
    for description, cfg, text in [
        (
            "dp-service: a stale blob identity",
            service,
            service_good.replace(service_blob, ident("dp-service", tag=stale)),
        ),
        (
            "dp-service: a stale image identity",
            service,
            service_good.replace(service_image, ident("dp-service", "release-image.yml", stale)),
        ),
        ("dp-service: a stale image tag", service, service_good.replace(f"dp-service:{_TAG}", f"dp-service:{stale}")),
        ("dp-service: an identity for another workflow", service, service_good.replace("release-image.yml", "ci.yml")),
        (
            "dp-service: an identity for another repo",
            service,
            service_good.replace("dp-service/.github", "dp-grpc/.github"),
        ),
        ("dp-service: a wrong issuer", service, service_good.replace(OIDC_ISSUER, "https://accounts.google.com")),
        (
            "dp-desktop-app: a stale single-quoted identity",
            desktop,
            desktop_good.replace(f"'{desktop_id}'", f"'{ident('dp-desktop-app', tag=stale)}'"),
        ),
        (
            "dp-desktop-app: a stale double-quoted identity",
            desktop,
            desktop_good.replace(f'"{desktop_id}"', f'"{ident("dp-desktop-app", tag=stale)}"'),
        ),
        (
            "dp-desktop-app: an identity placeholder",
            desktop,
            desktop_good.replace(f"'{desktop_id}'", f"'{ident('dp-desktop-app', tag='rel-<version>')}'"),
        ),
        (
            "dp-desktop-app: release-image.yml, which it does not publish",
            desktop,
            desktop_good.replace("release.yml", "release-image.yml", 1),
        ),
        ("dp-grpc: an unanchored regexp", grpc, grpc_good.replace("'^https", "'https")),
        ("dp-grpc: a regexp for any workflow", grpc, grpc_good.replace(r"release\.yml", ".*")),
        ("dp-grpc: a regexp without the rel- prefix", grpc, grpc_good.replace("refs/tags/rel-'", "refs/tags/'")),
    ]:
        if not check_cosign(f"<{description}>", _TAG, text, cfg):
            failures.append(f"{description} was accepted")
    return failures


def self_test() -> list[str]:
    """Confirms the good samples pass and each known-bad variant is rejected; returns a message per failure."""
    failures = _self_test_released_rule() + _self_test_sigstore_python() + _self_test_cosign()
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        _make_tree(root)
        failures += _self_test_links(root)
    return failures


def main(argv: list[str]) -> int:
    canary_failures = self_test()
    if canary_failures:
        print("FAIL: checker self-test failed; its rules no longer catch what they are meant to\n")
        for failure in canary_failures:
            print(f"  {failure}")
        return 1

    if argv:
        paths = [Path(arg) for arg in argv]
    else:
        paths = sorted(NOTES_DIR.glob("rel-*.md"))
        if (NOTES_DIR / NEXT_NAME).is_file():
            paths.append(NOTES_DIR / NEXT_NAME)
    if not paths:
        print(f"FAIL: no release notes found under {NOTES_DIR}")
        return 1

    problems: list[str] = []
    for path in paths:
        if not path.is_file():
            problems.append(f"{path}: not found")
            continue
        file_problems, rules = check_file(path)
        print(f"  {path}: {rules}{f' -- {len(file_problems)} problem(s)' if file_problems else ''}")
        problems.extend(file_problems)

    if problems:
        print(f"\nFAIL: {len(problems)} problem(s) in {len(paths)} release notes file(s)\n")
        for problem in problems:
            print(f"  {problem}")
        return 1

    print(f"OK: {len(paths)} release notes file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
