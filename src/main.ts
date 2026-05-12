import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as cache from '@actions/cache';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFileSync } from 'child_process';

import { detectPlatform, archiveFilename } from './platform';
import { resolveVersion } from './version';
import { verifySha256 } from './checksum';

const REPO = 'sunholo-data/ailang';
const TOOL_NAME = 'ailang';

async function run(): Promise<void> {
  try {
    const versionInput = core.getInput('version') || 'latest';
    const cacheEnabled = (core.getInput('cache') || 'true').toLowerCase() !== 'false';
    // `${{ github.token }}` can't be an action.yml default for JS actions
    // (only composites), so callers either pass it via `with:` or export it
    // via `env:`. We accept either.
    const token = core.getInput('github-token') || process.env.GITHUB_TOKEN || '';
    if (!token) {
      core.warning(
        'No github-token provided. Anonymous calls to the GitHub API are limited to ' +
          '60/hr per IP and may fail in busy CI. Pass `github-token: ${{ github.token }}` ' +
          'or set `GITHUB_TOKEN` in env to avoid this.'
      );
    }

    const platform = detectPlatform();
    const version = await resolveVersion(versionInput, token);
    core.info(`Resolved AILANG version: ${version} for ${platform.os}.${platform.arch}`);

    const cacheKey = `ailang-${version}-${platform.os}-${platform.arch}`;
    const installDir = path.join(os.homedir(), '.ailang-setup', version);
    fs.mkdirSync(installDir, { recursive: true });

    let cacheHit = false;

    // 1. Try the runner cache first.
    if (cacheEnabled) {
      const restored = await cache.restoreCache([installDir], cacheKey);
      if (restored) {
        core.info(`Restored AILANG ${version} from cache (key: ${cacheKey})`);
        cacheHit = true;
      }
    }

    // 2. If no cache hit, download + verify + extract.
    if (!cacheHit) {
      const archive = archiveFilename(platform);
      const baseUrl = `https://github.com/${REPO}/releases/download/${version}`;
      const tarballUrl = `${baseUrl}/${archive}`;
      const sha256Url = `${tarballUrl}.sha256`;

      const auth = token ? `Bearer ${token}` : undefined;

      core.info(`Downloading ${tarballUrl}`);
      const tarballPath = await tc.downloadTool(tarballUrl, undefined, auth);

      core.info(`Downloading ${sha256Url}`);
      const shaPath = await tc.downloadTool(sha256Url, undefined, auth);

      core.info('Verifying SHA256...');
      await verifySha256(tarballPath, shaPath);

      core.info(`Extracting to ${installDir}`);
      await tc.extractTar(tarballPath, installDir);

      if (cacheEnabled) {
        try {
          await cache.saveCache([installDir], cacheKey);
          core.info(`Saved AILANG ${version} to cache (key: ${cacheKey})`);
        } catch (e) {
          // Cache save failures are non-fatal — the binary is installed,
          // we just won't get a cache hit next run.
          core.warning(`Failed to save to runner cache: ${(e as Error).message}`);
        }
      }
    }

    // 3. Locate the binary and add it to PATH.
    const binaryPath = locateBinary(installDir);
    const binaryDir = path.dirname(binaryPath);
    core.addPath(binaryDir);
    core.info(`Added ${binaryDir} to PATH`);

    // 4. Smoke test — fail loudly if `ailang --version` doesn't work.
    let reportedVersion = '';
    try {
      reportedVersion = execFileSync(binaryPath, ['--version'], {
        encoding: 'utf8',
      }).trim();
      core.info(`ailang --version → ${reportedVersion}`);
    } catch (e) {
      throw new Error(
        `Installed binary at ${binaryPath} but \`ailang --version\` failed: ${(e as Error).message}`
      );
    }

    core.setOutput('version', version);
    core.setOutput('cache-hit', String(cacheHit));
  } catch (err) {
    core.setFailed((err as Error).message);
  }
}

/**
 * Find the `ailang` binary inside the install directory. AILANG release
 * tarballs have historically had inconsistent internal layouts (binary at
 * root, or under a `bin/` subdir, or under `ailang-<version>/`), so we
 * walk the tree rather than hardcode a path.
 */
function locateBinary(installDir: string): string {
  const candidates: string[] = [];
  const walk = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name === TOOL_NAME) {
        candidates.push(full);
      }
    }
  };
  walk(installDir);

  if (candidates.length === 0) {
    throw new Error(
      `Could not find an '${TOOL_NAME}' binary anywhere under ${installDir} after extraction.`
    );
  }
  // Prefer shorter paths — root-level binary beats a nested one.
  candidates.sort((a, b) => a.length - b.length);
  const chosen = candidates[0];
  // Make sure it's executable (tar should preserve mode but belt-and-braces).
  fs.chmodSync(chosen, 0o755);
  return chosen;
}

void run();
