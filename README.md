# setup-ailang

Install the [AILANG](https://github.com/sunholo-data/ailang) compiler in
GitHub Actions with platform auto-detection, SHA256 verification, and
binary caching.

## Usage

```yaml
- uses: sunholo-data/setup-ailang@v1
  with:
    version: latest                       # or a specific tag like 'v0.18.11'
    cache: true                           # cache the binary across runs (default true)
    github-token: ${{ github.token }}     # avoids the 60/hr anonymous API limit
- run: ailang --version
- run: ailang lock && ailang run main.ail
```

Replaces ~15 lines of bash boilerplate (curl + jq + tar + sudo mv).

`github-token` is technically optional — if omitted, the action falls back
to `$GITHUB_TOKEN` in `env:`, and finally to anonymous calls (capped at
60/hr per runner IP). Pass it explicitly for reliable CI. (JavaScript
actions can't default to `${{ github.token }}` in `action.yml` — only
composite actions can — which is why this isn't auto-wired.)

## Inputs

| Input          | Default              | Description                                                                                                       |
| -------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `version`      | `latest`             | AILANG version (with or without leading `v`). `latest` resolves the most recent GitHub release.                    |
| `cache`        | `true`               | Cache the binary in `actions/cache` keyed on version + platform. Cache hit drops install time from ~25s to ~5s.   |
| `github-token` | (none)               | Token for authenticated GitHub API + release-asset downloads. Avoids the 60/hr anonymous rate limit. Pass `${{ github.token }}` explicitly or set `GITHUB_TOKEN` in `env:`. |

## Outputs

| Output      | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| `version`   | The resolved version (e.g. `v0.18.11`). Useful for downstream pinning.   |
| `cache-hit` | `true` if the binary came from the runner cache, otherwise `false`.      |

## Platforms

| Runner             | Supported                              |
| ------------------ | -------------------------------------- |
| `ubuntu-*` (x64)   | yes                                    |
| `macos-*` (arm64)  | yes                                    |
| `macos-13` (x64)   | yes (supported, but not currently gated by CI — see test.yml) |
| `windows-*`        | not yet — action exits with a clear message |
| `ubuntu-*` (arm64) | not yet — no `linux.arm64` tarball published |

## Pinning

For reproducible builds, pin to a major (recommended), a minor, or a SHA:

```yaml
- uses: sunholo-data/setup-ailang@v1                 # tracks v1.x.x
- uses: sunholo-data/setup-ailang@v1.0.0             # exact version
- uses: sunholo-data/setup-ailang@<full-commit-sha>  # SHA pin (most strict)
```

## Examples

### Pinned AILANG version, with cache

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: sunholo-data/setup-ailang@v1
        with:
          version: v0.18.11
      - run: ailang test ./...
```

### Matrix across versions

```yaml
jobs:
  compat:
    strategy:
      matrix:
        ailang: ['v0.17.0', 'v0.18.0', 'latest']
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: sunholo-data/setup-ailang@v1
        with:
          version: ${{ matrix.ailang }}
      - run: ailang run main.ail
```

### Use the resolved version downstream

```yaml
- id: setup
  uses: sunholo-data/setup-ailang@v1
  with: { version: latest }
- run: echo "Built against AILANG ${{ steps.setup.outputs.version }}"
```

## Why an action (vs `install.sh`)?

The [`install.sh`](https://ailang.sunholo.com/install.sh) one-liner works
fine in any CI system. Use the action specifically for GitHub Actions
because:

- It uses `actions/cache` to skip the download on subsequent runs.
- It uses `${{ github.token }}` automatically, dodging the anonymous
  API rate limit (a common cause of `curl: (22)` errors in busy
  pipelines).
- It auto-detects platform — no `linux.x64` / `darwin.arm64`
  copy-paste drift.
- It SHA256-verifies every download.

For non-GitHub CI (CircleCI, GitLab, Buildkite, Jenkins), use install.sh:

```sh
curl -fsSL https://ailang.sunholo.com/install.sh | sh -s -- --version v0.18.11
```

## Development

```bash
npm install
npm run build         # compiles TS + bundles via @vercel/ncc into dist/
git add dist
git commit -m "build: rebuild dist"
```

`dist/index.js` is checked in because GitHub Actions runs the bundled
output directly — there is no `npm install` step at action runtime.
The `check-dist` workflow on every PR fails if `dist/` isn't in sync
with `src/`.

## Releasing

1. Bump `package.json` version.
2. `npm run build && git add dist package.json && git commit`
3. `git tag v1.0.X && git push --tags`
4. Move the floating `v1` tag: `git tag -fa v1 -m "v1.0.X" && git push -f origin v1`

## License

MIT — see [LICENSE](./LICENSE).
