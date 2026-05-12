import { HttpClient } from '@actions/http-client';

const REPO = 'sunholo-data/ailang';

interface ReleaseResponse {
  tag_name: string;
}

/**
 * Resolve the input version to a concrete tag like 'v0.18.11'.
 *
 * - 'latest' (or empty) hits the GitHub API with the supplied token to
 *   dodge the 60/hr anonymous rate limit.
 * - Explicit semver inputs are normalised to have a leading 'v'.
 */
export async function resolveVersion(input: string, token: string): Promise<string> {
  const trimmed = (input ?? '').trim();
  if (trimmed && trimmed !== 'latest') {
    return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
  }

  const http = new HttpClient('setup-ailang', [], {
    allowRetries: true,
    maxRetries: 3,
  });

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `https://api.github.com/repos/${REPO}/releases/latest`;
  const res = await http.getJson<ReleaseResponse>(url, headers);
  if (res.statusCode !== 200 || !res.result) {
    throw new Error(
      `Failed to resolve latest AILANG version: GitHub API returned HTTP ${res.statusCode}.` +
        (token ? '' : ' No token was supplied — anonymous calls are rate-limited at 60/hr.')
    );
  }
  return res.result.tag_name;
}
