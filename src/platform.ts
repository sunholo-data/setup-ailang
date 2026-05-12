import * as os from 'os';

export interface Platform {
  /** GOOS-style: 'linux' | 'darwin' */
  os: 'linux' | 'darwin';
  /** Tag used in AILANG release filenames: 'x64' | 'arm64' */
  arch: 'x64' | 'arm64';
}

/**
 * Map Node's platform/arch to the tag used in AILANG release tarballs:
 *   linux.x64.ailang.tar.gz
 *   darwin.x64.ailang.tar.gz
 *   darwin.arm64.ailang.tar.gz
 *
 * Throws on Windows (no tarball published yet) and unknown architectures.
 */
export function detectPlatform(): Platform {
  const nodeOs = os.platform();
  const nodeArch = os.arch();

  let platformOs: Platform['os'];
  switch (nodeOs) {
    case 'linux':
      platformOs = 'linux';
      break;
    case 'darwin':
      platformOs = 'darwin';
      break;
    case 'win32':
      throw new Error(
        'Windows is not yet supported by AILANG. Track https://github.com/sunholo-data/ailang/issues for updates.'
      );
    default:
      throw new Error(`Unsupported OS: ${nodeOs}`);
  }

  let platformArch: Platform['arch'];
  switch (nodeArch) {
    case 'x64':
      platformArch = 'x64';
      break;
    case 'arm64':
      platformArch = 'arm64';
      break;
    default:
      throw new Error(`Unsupported architecture: ${nodeArch}`);
  }

  // AILANG currently only ships linux.x64 (no linux.arm64). Fail loudly here
  // rather than letting the download 404 with a confusing message.
  if (platformOs === 'linux' && platformArch === 'arm64') {
    throw new Error(
      'AILANG does not yet publish a linux.arm64 binary. Use a linux.x64 runner or build from source.'
    );
  }

  return { os: platformOs, arch: platformArch };
}

export function archiveFilename(p: Platform): string {
  return `${p.os}.${p.arch}.ailang.tar.gz`;
}
