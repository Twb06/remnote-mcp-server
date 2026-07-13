import { readFile, realpath, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';

export const DEFAULT_MAX_INLINE_BYTES = 5 * 1024 * 1024;
export const HARD_MAX_INLINE_BYTES = 10 * 1024 * 1024;

export interface MediaLocator {
  mediaId: string;
  kind: 'image';
  field: 'text' | 'backText';
  elementIndex: number;
  imageIndex: number;
  imgId?: string;
  title?: string;
  dimensions?: { width: number; height: number };
  mimeType?: string;
  source: 'remnote_managed_local';
  localToken: string;
}

export interface ResolvedMedia {
  data: string;
  mimeType: string;
  sizeBytes: number;
  metadata: Omit<MediaLocator, 'localToken'>;
}

function validateLocalToken(token: string): void {
  if (
    !token ||
    basename(token) !== token ||
    token === '.' ||
    token === '..' ||
    token.normalize('NFC') !== token ||
    token.includes('\0')
  ) {
    throw new Error('Media path traversal rejected: local media token must be a basename');
  }
}

function detectImageMime(data: Buffer): string | undefined {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return 'image/png';
  }
  if (data.length >= 3 && data.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) {
    return 'image/jpeg';
  }
  if (data.length >= 6) {
    const signature = data.subarray(0, 6).toString('ascii');
    if (signature === 'GIF87a' || signature === 'GIF89a') return 'image/gif';
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString('ascii') === 'RIFF' &&
    data.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return undefined;
}

function isWithinRoot(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === '' || (!pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot));
}

export async function resolveManagedImage(
  locator: MediaLocator,
  roots: string[],
  maxInlineBytes = DEFAULT_MAX_INLINE_BYTES
): Promise<ResolvedMedia> {
  if (
    !Number.isInteger(maxInlineBytes) ||
    maxInlineBytes < 1 ||
    maxInlineBytes > HARD_MAX_INLINE_BYTES
  ) {
    throw new Error(`maxInlineBytes must be an integer between 1 and ${HARD_MAX_INLINE_BYTES}`);
  }
  validateLocalToken(locator.localToken);
  if (locator.kind !== 'image' || locator.source !== 'remnote_managed_local') {
    throw new Error('Unsupported MIME: only RemNote-managed local images are supported');
  }

  const matches = new Map<string, string>();
  for (const configuredRoot of roots) {
    let root: string;
    try {
      root = await realpath(resolve(configuredRoot));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') continue;
      throw new Error(
        `Media permission/read failure for configured root: ${code ?? String(error)}`,
        {
          cause: error,
        }
      );
    }

    const candidate = resolve(root, locator.localToken);
    if (!isWithinRoot(root, candidate) || dirname(candidate) !== root) {
      throw new Error('Media path traversal rejected: resolved path escaped the configured root');
    }

    try {
      const candidateReal = await realpath(candidate);
      if (!isWithinRoot(root, candidateReal) || dirname(candidateReal) !== root) {
        throw new Error('Media path traversal rejected: resolved file escaped the configured root');
      }
      const fileStat = await stat(candidateReal);
      if (fileStat.isFile()) matches.set(candidateReal, candidateReal);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Media path traversal rejected:')) {
        throw error;
      }
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') continue;
      throw new Error(
        `Media permission/read failure for ${locator.localToken}: ${code ?? String(error)}`,
        {
          cause: error,
        }
      );
    }
  }

  if (matches.size === 0) {
    throw new Error(`Media file missing: ${locator.localToken}`);
  }
  if (matches.size > 1) {
    throw new Error(`Media file ambiguous: ${locator.localToken} matched ${matches.size} roots`);
  }

  const filePath = [...matches.values()][0];
  let fileStat;
  let data: Buffer;
  try {
    fileStat = await stat(filePath);
    if (fileStat.size > maxInlineBytes) {
      throw new Error(
        `Media file oversized: ${fileStat.size} bytes exceeds maxInlineBytes ${maxInlineBytes}`
      );
    }
    data = await readFile(filePath);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Media file oversized:')) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    throw new Error(
      `Media permission/read failure for ${locator.localToken}: ${code ?? String(error)}`,
      {
        cause: error,
      }
    );
  }

  const mimeType = detectImageMime(data);
  if (!mimeType) {
    throw new Error('Unsupported MIME: allowed image types are png, jpeg, gif, and webp');
  }

  const { localToken: _localToken, ...metadata } = locator;
  return {
    data: data.toString('base64'),
    mimeType,
    sizeBytes: fileStat.size,
    metadata,
  };
}
