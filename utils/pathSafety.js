import fs from 'fs/promises';
import path from 'path';
import { home } from '../config/paths.js';

// Top-level folders that must never be moved, offloaded or removed as a whole
const PROTECTED_TOP_LEVEL = [
  'Library', 'Desktop', 'Documents', 'Downloads',
  'Applications', 'Movies', 'Music', 'Pictures', 'Public'
];

export class PathSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PathSafetyError';
    this.status = 403;
  }
}

let cachedRealHome = null;
export async function getRealHome() {
  if (!cachedRealHome) cachedRealHome = await fs.realpath(home);
  return cachedRealHome;
}

// True when `child` is `parent` itself or lives underneath it.
// Uses path segments, so /Users/bob2 is NOT considered inside /Users/bob.
export function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

/**
 * Validates a client-supplied path and returns its canonical location.
 *
 * Symlinks in the parent directories are resolved before the containment check
 * so a link cannot be used to escape the home directory. The final component is
 * deliberately NOT followed: callers act on the entry itself and decide what to
 * do with links via lstat.
 */
export async function resolveInsideHome(inputPath) {
  if (typeof inputPath !== 'string' || inputPath.length === 0 || inputPath.includes('\0')) {
    throw new PathSafetyError('Invalid path.');
  }
  if (!path.isAbsolute(inputPath)) {
    throw new PathSafetyError('Path must be absolute.');
  }

  const resolved = path.resolve(inputPath);
  const realHome = await getRealHome();

  let realParent;
  try {
    realParent = await fs.realpath(path.dirname(resolved));
  } catch {
    throw new PathSafetyError('Path does not exist.');
  }

  const real = resolved === path.parse(resolved).root
    ? resolved
    : path.join(realParent, path.basename(resolved));

  if (!isInside(realHome, real)) {
    throw new PathSafetyError('Access Denied: Path is outside user home directory.');
  }
  return real;
}

// Path segments relative to home, e.g. ['Documents', 'old', 'a.zip']
export async function homeRelativeSegments(realPath) {
  const rel = path.relative(await getRealHome(), realPath);
  return rel === '' ? [] : rel.split(path.sep);
}

// Is this the home directory itself or one of its primary folders?
export async function isProtectedRoot(realPath) {
  const segments = await homeRelativeSegments(realPath);
  if (segments.length === 0) return true;
  return segments.length === 1 && PROTECTED_TOP_LEVEL.includes(segments[0]);
}
