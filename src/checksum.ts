import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * Verify that the SHA256 of `archivePath` matches the digest in `sha256Path`.
 * The .sha256 file format published by AILANG is:
 *   <hex-digest>  <filename>
 * (Both BSD-style two-space and GNU-style two-space outputs work.)
 */
export async function verifySha256(archivePath: string, sha256Path: string): Promise<void> {
  const expectedRaw = fs.readFileSync(sha256Path, 'utf8').trim();
  const expected = expectedRaw.split(/\s+/)[0]?.toLowerCase();
  if (!expected || expected.length !== 64) {
    throw new Error(`Malformed .sha256 file at ${sha256Path}: ${expectedRaw}`);
  }

  const hash = crypto.createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(archivePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  const actual = hash.digest('hex');

  if (actual !== expected) {
    throw new Error(
      `SHA256 mismatch for ${archivePath}: expected ${expected}, got ${actual}. ` +
        'Refusing to install — release artefact may be corrupted or tampered with.'
    );
  }
}
