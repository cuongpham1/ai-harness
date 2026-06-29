# US-025 Post-Merge CLI Release And Changelog

## Status

implemented

## Lane

normal

## Product Contract

Merged pull requests should leave a project-visible changelog entry. If a
merged PR changes the Rust Harness CLI tool or its release packaging, the repo
should publish a fresh CLI release for downstream installers.

## Relevant Product Docs

- `README.md`
- `scripts/README.md`
- `docs/decisions/0005-prebuilt-rust-harness-cli.md`
- `CHANGELOG.md`

## Acceptance Criteria

- Merged PRs to `main` prepend a summary entry to `CHANGELOG.md`.
- PRs that do not touch CLI files update only the changelog.
- PRs that touch CLI source, schema, Cargo metadata, or release packaging bump
  the CLI patch version, update `scripts/harness-cli-release-tag`, create a
  matching `harness-cli-v*` tag, and publish release assets.
- Manual and tag-driven CLI releases continue to use the same release workflow.

## Design Notes

- Commands: GitHub Actions workflows.
- Domain rules: CLI release detection is path-based and scoped to files that can
  affect the Rust CLI binary, schema, Cargo metadata, or packaging output.
- Release flow: the post-merge workflow commits maintenance metadata, tags that
  commit when needed, then calls the reusable release workflow for the tag.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-025 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | YAML and shell syntax checks pass for changed workflows. |
| Integration | Existing Rust workspace tests still pass. |
| E2E | Not run locally; GitHub merge event required. |
| Platform | Release workflow still targets macOS arm64, macOS x64, Linux x64, Linux arm64, and Windows x64. |
| Release | Reusable workflow accepts tag/manual/reusable entry points. |

## Harness Delta

The Harness release process now includes automatic changelog recording and
conditional CLI release preparation after merged pull requests.

## Evidence

- `ruby -e 'require "yaml"; ARGV.each { |f| YAML.load_file(f); puts "ok #{f}" }' .github/workflows/harness-cli-release.yml .github/workflows/post-merge-maintenance.yml`: passed.
- `cargo test --workspace`: passed, 20 tests.
- `cargo fmt --check`: passed.
- `cargo clippy --workspace -- -D warnings`: passed.
- `bash -n scripts/install-harness.sh && bash -n scripts/build-harness-cli-release.sh`: passed.
- `actionlint`: not installed locally, so GitHub-specific workflow linting was not run.
- 2026-06-09 follow-up: GitHub run `27180707313` failed in
  `Update maintenance files` because changelog bullet `printf` formats began
  with `-` and were parsed as options on the runner. The workflow now uses
  `printf --` for all bullet formats. Local reproduction of the PR #13
  changelog entry passed.
