# Release Process

## Versioning

- Single product version (the monorepo releases as one unit; packages are internal and unpublished in v0.x).
- SemVer with 0.x semantics: minor = features, patch = fixes. v1.0.0 once self-hosting API/config is stable.

## Mechanics

1. Contributors add **changesets** (`bun changeset`) in feature PRs for user-facing changes; commits follow **Conventional Commits** (enforced on squash-merge titles).
2. **release-please** watches `main` and maintains a running release PR: aggregated CHANGELOG, version bump, tag on merge.
3. Merging the release PR: creates the git tag `vX.Y.Z` + GitHub Release, triggers the Docker publish workflow (`ghcr.io/<org>/stanzachat:X.Y.Z`, `:latest`).
4. Tags come **only** from release-please. Manual tagging is prohibited.

Changesets provide the human-written "what changed for users" prose; release-please provides automation and tag discipline. If maintaining both proves redundant in practice, drop changesets in favor of release-please-only — decide after the first few releases, before external contributors depend on it.

## Release checklist (per release PR)

- [ ] CI fully green on the release PR
- [ ] `docs/self-hosting.md` matches current env vars / compose
- [ ] Fresh `docker compose up` smoke test on a clean machine (or CI job equivalent)
- [ ] Migration path from previous version verified (upgrade an instance with data)
- [ ] CHANGELOG prose readable by a self-hoster (not commit noise)

## Hotfixes

Branch from `main` (trunk-based — `main` is always releasable), fix + changeset, squash-merge; release-please picks it up as a patch release.
