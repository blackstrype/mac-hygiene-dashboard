import fs from 'fs/promises';
import { createReadStream, constants as fsConstants } from 'fs';
import crypto from 'crypto';
import path from 'path';
import { home } from '../config/paths.js';
import {
  PathSafetyError,
  resolveInsideHome,
  homeRelativeSegments,
  isProtectedRoot
} from '../utils/pathSafety.js';

const CLOUD_STORAGE_DIR = path.join(home, 'Library', 'CloudStorage');
const OFFLOAD_FOLDER = 'ZenMac Offload';
const TRASH_DIR = path.join(home, '.Trash');

// Google Drive only accepts files inside "My Drive" (name is localized)
const GOOGLE_MY_DRIVE_NAMES = [
  'My Drive', 'Mon Drive', 'Mi unidad', 'Meine Ablage', 'Il mio Drive', 'Meu Drive', 'Mijn Drive'
];

// Limits that keep a single request bounded
const MAX_OFFLOAD_ENTRIES = 50000;
const MAX_SCAN_FILES = 300000;
const MAX_GROUPS_RETURNED = 200;
const SCAN_TIME_BUDGET_MS = 90000;
const QUICK_HASH_BYTES = 64 * 1024;
const FREE_SPACE_MARGIN = 200 * 1024 * 1024;

// Folders that are never descended into when looking for duplicates
const SKIPPED_DIR_NAMES = new Set(['node_modules', 'Library']);
// macOS "packages": folders that Finder shows as a single file. Their insides
// are managed by an app and must not be picked apart.
const PACKAGE_EXTENSIONS = new Set([
  '.app', '.bundle', '.framework', '.plugin', '.kext', '.photoslibrary', '.musiclibrary',
  '.tvlibrary', '.imovielibrary', '.fcpbundle', '.logicx', '.band', '.sparsebundle',
  '.xcodeproj', '.xcworkspace', '.xcassets', '.lrdata', '.aplibrary', '.pkg', '.rtfd'
]);

function userError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function hashFile(filePath, maxBytes = Infinity) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const options = Number.isFinite(maxBytes) ? { start: 0, end: maxBytes - 1 } : {};
    createReadStream(filePath, options)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

async function lstatOrNull(p) {
  try {
    return await fs.lstat(p);
  } catch {
    return null;
  }
}

// Returns a path next to `desired` that does not exist yet: "a.zip", "a (2).zip", ...
async function uniquePath(desired) {
  const { dir, name, ext } = path.parse(desired);
  let candidate = desired;
  for (let i = 2; await lstatOrNull(candidate); i++) {
    if (i > 1000) throw userError('Could not find a free name at the destination.', 409);
    candidate = path.join(dir, `${name} (${i})${ext}`);
  }
  return candidate;
}

// Only ordinary user content may be offloaded or de-duplicated: nothing in
// ~/Library and nothing hidden (dotfiles hold credentials such as ~/.ssh).
async function assertUserContent(realPath) {
  const segments = await homeRelativeSegments(realPath);
  if (segments[0] === 'Library') {
    throw new PathSafetyError('Access Denied: ~/Library is managed by macOS and apps.');
  }
  if (segments.some((s) => s.startsWith('.'))) {
    throw new PathSafetyError('Access Denied: hidden files and folders are excluded for safety.');
  }
}

// ---------------------------------------------------------------------------
// Cloud offload
// ---------------------------------------------------------------------------

async function isDirectory(p) {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

// Detects the local sync folders of Google Drive / OneDrive desktop apps.
// ZenMac never talks to the cloud itself and stores no credentials: it hands
// files to the sync app the user is already signed in to.
async function detectCloudRoots() {
  let entries = [];
  try {
    entries = await fs.readdir(CLOUD_STORAGE_DIR);
  } catch {
    return [];
  }

  const roots = [];
  for (const name of entries.sort()) {
    const base = path.join(CLOUD_STORAGE_DIR, name);
    const account = name.includes('-') ? name.slice(name.indexOf('-') + 1) : '';

    if (name.startsWith('GoogleDrive')) {
      for (const myDrive of GOOGLE_MY_DRIVE_NAMES) {
        const root = path.join(base, myDrive);
        if (await isDirectory(root)) {
          roots.push({ id: name, provider: 'google', label: `Google Drive${account ? ` (${account})` : ''}`, root });
          break;
        }
      }
    } else if (name.startsWith('OneDrive')) {
      if (await isDirectory(base)) {
        roots.push({ id: name, provider: 'onedrive', label: `OneDrive${account ? ` (${account})` : ''}`, root: base });
      }
    }
  }
  return roots;
}

export async function listCloudDestinations() {
  const roots = await detectCloudRoots();
  return roots.map(({ id, provider, label }) => ({ id, provider, label, folder: OFFLOAD_FOLDER }));
}

// Walks a tree that is about to be copied. Refuses anything that cannot be
// reproduced faithfully in a cloud folder (symlinks, sockets, devices).
async function inventoryTree(root) {
  const dirs = [];
  const files = [];
  let bytes = 0;
  const stack = [''];

  while (stack.length) {
    const rel = stack.pop();
    const entries = await fs.readdir(path.join(root, rel), { withFileTypes: true });
    for (const entry of entries) {
      const childRel = path.join(rel, entry.name);
      if (entry.isDirectory()) {
        dirs.push(childRel);
        stack.push(childRel);
      } else if (entry.isFile()) {
        const st = await fs.lstat(path.join(root, childRel));
        files.push(childRel);
        bytes += st.size;
      } else {
        throw userError(`Cannot offload: "${childRel}" is a link or special file. Move the folder manually in Finder instead.`);
      }
      if (dirs.length + files.length > MAX_OFFLOAD_ENTRIES) {
        throw userError(`Cannot offload: folder has more than ${MAX_OFFLOAD_ENTRIES} items. Compress it into an archive first.`);
      }
    }
  }
  return { dirs, files, bytes };
}

async function copyFileVerified(from, to) {
  // COPYFILE_EXCL: never overwrite something that already exists at the destination
  await fs.copyFile(from, to, fsConstants.COPYFILE_EXCL);
  const [a, b] = await Promise.all([hashFile(from), hashFile(to)]);
  if (a !== b) throw new Error(`Verification failed for ${path.basename(from)}`);
  const st = await fs.stat(from);
  await fs.utimes(to, st.atime, st.mtime).catch(() => {});
}

// Used when a plain rename is impossible (destination on another volume).
// The original is only removed after every copied file has been re-read and
// matched against it by SHA-256.
async function copyVerifyRemove(source, target, sourceStat) {
  const tree = sourceStat.isDirectory()
    ? await inventoryTree(source)
    : { dirs: [], files: [''], bytes: sourceStat.size };

  const fsInfo = await fs.statfs(path.dirname(target));
  const free = fsInfo.bavail * fsInfo.bsize;
  if (free < tree.bytes + FREE_SPACE_MARGIN) {
    throw userError('Not enough free space to stage the copy safely. Offload a smaller item first.', 507);
  }

  try {
    if (sourceStat.isDirectory()) {
      await fs.mkdir(target);
      for (const dir of tree.dirs) await fs.mkdir(path.join(target, dir), { recursive: true });
    }
    for (const file of tree.files) {
      await copyFileVerified(path.join(source, file), path.join(target, file));
    }
  } catch (error) {
    // `target` was created by this call (unique name), so cleaning it up is safe
    await fs.rm(target, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  await fs.rm(source, { recursive: true });
}

export async function offloadToCloud(sourcePath, destinationId) {
  if (typeof destinationId !== 'string') throw userError('Destination is required.');

  const source = await resolveInsideHome(sourcePath);
  const stat = await lstatOrNull(source);
  if (!stat) throw userError('Item no longer exists.', 404);
  if (stat.isSymbolicLink()) throw new PathSafetyError('Access Denied: symbolic links cannot be offloaded.');
  if (!stat.isFile() && !stat.isDirectory()) throw new PathSafetyError('Access Denied: unsupported file type.');
  if (await isProtectedRoot(source)) {
    throw new PathSafetyError('Access Denied: primary user folders cannot be offloaded as a whole.');
  }
  await assertUserContent(source);

  // The client only names a destination; the actual folder is always
  // re-derived here so a request can never choose where files are written.
  const destination = (await detectCloudRoots()).find((d) => d.id === destinationId);
  if (!destination) throw userError('Cloud destination is not available. Is the sync app installed and signed in?', 404);

  // Mirror the original location so things stay organized and easy to restore:
  //   ~/Documents/old/a.zip  ->  <cloud>/ZenMac Offload/Documents/old/a.zip
  const segments = await homeRelativeSegments(source);
  const targetDir = path.join(destination.root, OFFLOAD_FOLDER, ...segments.slice(0, -1));
  await fs.mkdir(targetDir, { recursive: true });
  const target = await uniquePath(path.join(targetDir, segments[segments.length - 1]));

  let method = 'move';
  try {
    // Same volume: atomic, needs no extra disk space, nothing is ever half-moved
    await fs.rename(source, target);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    method = 'copy-verify';
    await copyVerifyRemove(source, target, stat);
  }

  return {
    success: true,
    method,
    destination: destination.label,
    provider: destination.provider,
    movedTo: target
  };
}

// ---------------------------------------------------------------------------
// Duplicate finder
// ---------------------------------------------------------------------------

function isSkippedDir(name) {
  return name.startsWith('.') ||
    SKIPPED_DIR_NAMES.has(name) ||
    PACKAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

export async function findDuplicates(rootPath, minSizeInput) {
  const root = rootPath ? await resolveInsideHome(rootPath) : await resolveInsideHome(home);
  const rootStat = await lstatOrNull(root);
  if (!rootStat || !rootStat.isDirectory()) throw userError('Scan target must be a folder.');
  await assertUserContent(root);

  const minSize = Math.max(1, Number.isFinite(Number(minSizeInput)) ? Math.floor(Number(minSizeInput)) : 1024 * 1024);
  const deadline = Date.now() + SCAN_TIME_BUDGET_MS;
  let truncated = false;
  let scannedFiles = 0;

  // Pass 1: collect candidate files, bucketed by size. Symlinks are never
  // followed, and hard links to the same data count once.
  const bySize = new Map();
  const seenInodes = new Set();
  const stack = [root];

  walk:
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable folder (permissions / privacy protection)
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!isSkippedDir(entry.name)) stack.push(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile() || entry.name.startsWith('.')) continue;

      const filePath = path.join(dir, entry.name);
      let st;
      try {
        st = await fs.lstat(filePath);
      } catch {
        continue;
      }
      if (!st.isFile() || st.size < minSize) continue;

      const inode = `${st.dev}:${st.ino}`;
      if (seenInodes.has(inode)) continue;
      seenInodes.add(inode);

      if (++scannedFiles > MAX_SCAN_FILES || Date.now() > deadline) {
        truncated = true;
        break walk;
      }
      if (!bySize.has(st.size)) bySize.set(st.size, []);
      bySize.get(st.size).push({ path: filePath, size: st.size, mtime: st.mtimeMs });
    }
  }

  // Pass 2 + 3: within same-size buckets compare a hash of the first 64 KB,
  // then a full SHA-256 of whatever still matches. Largest files first, so
  // the biggest wins are found even if the time budget runs out.
  const candidates = [...bySize.values()].filter((b) => b.length > 1).sort((a, b) => b[0].size - a[0].size);
  const groups = [];

  const bucketBy = async (files, keyFn) => {
    const buckets = new Map();
    for (const file of files) {
      if (Date.now() > deadline) {
        truncated = true;
        break;
      }
      try {
        const key = await keyFn(file);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(file);
      } catch {
        // unreadable file: leave it out
      }
    }
    return [...buckets.entries()].filter(([, list]) => list.length > 1);
  };

  for (const sameSize of candidates) {
    if (Date.now() > deadline) {
      truncated = true;
      break;
    }
    const quickMatches = sameSize[0].size <= QUICK_HASH_BYTES
      ? [['', sameSize]]
      : await bucketBy(sameSize, (f) => hashFile(f.path, QUICK_HASH_BYTES));

    for (const [, quick] of quickMatches) {
      for (const [hash, files] of await bucketBy(quick, (f) => hashFile(f.path))) {
        files.sort((a, b) => a.mtime - b.mtime); // oldest (likely the original) first
        groups.push({
          hash,
          size: files[0].size,
          reclaimable: files[0].size * (files.length - 1),
          files: files.map((f) => ({ path: f.path, mtime: f.mtime }))
        });
      }
    }
  }

  groups.sort((a, b) => b.reclaimable - a.reclaimable);
  const totalGroups = groups.length;
  const reclaimable = groups.reduce((sum, g) => sum + g.reclaimable, 0);

  return {
    root,
    minSize,
    scannedFiles: Math.min(scannedFiles, MAX_SCAN_FILES),
    truncated,
    totalGroups,
    reclaimable,
    groups: groups.slice(0, MAX_GROUPS_RETURNED)
  };
}

// Moves a file to the user's Trash without ever overwriting anything there.
// link() fails if the name is taken, which makes the "pick a free name" step
// race-free; the original is unlinked only once it is safely in the Trash.
async function moveToTrash(filePath) {
  await fs.mkdir(TRASH_DIR, { recursive: true }).catch(() => {});
  const { name, ext } = path.parse(filePath);

  for (let attempt = 0; attempt < 50; attempt++) {
    const suffix = attempt === 0 ? '' : ` ${new Date().toTimeString().slice(0, 8).replace(/:/g, '.')}-${attempt}`;
    const target = path.join(TRASH_DIR, `${name}${suffix}${ext}`);
    try {
      await fs.link(filePath, target);
    } catch (error) {
      if (error.code === 'EEXIST') continue;
      if (error.code === 'EXDEV') {
        throw new Error('File is on a different volume than the Trash; remove it from Finder instead.');
      }
      throw error;
    }
    await fs.unlink(filePath);
    return target;
  }
  throw new Error('Could not find a free name in the Trash.');
}

/**
 * Removes duplicate files by moving them to the Trash.
 *
 * Nothing sent by the browser is trusted: for every file to remove, the copy
 * to keep is re-checked right now and both are re-hashed. A file is only
 * trashed while a byte-identical, separate copy of it stays on disk.
 */
export async function removeDuplicates(groups) {
  if (!Array.isArray(groups) || groups.length === 0 || groups.length > 1000) {
    throw userError('A list of duplicate groups is required.');
  }

  const removed = [];
  const errors = [];
  let freed = 0;

  for (const group of groups) {
    const toRemove = Array.isArray(group?.remove) ? group.remove.slice(0, 1000) : [];
    let keep, keepStat, keepHash;

    try {
      keep = await resolveInsideHome(group?.keep);
      keepStat = await lstatOrNull(keep);
      if (!keepStat || !keepStat.isFile()) throw new Error('the copy to keep is missing or is not a regular file');
      keepHash = await hashFile(keep);
    } catch (error) {
      for (const p of toRemove) errors.push({ path: String(p), error: `Skipped: ${error.message}` });
      continue;
    }

    for (const candidate of toRemove) {
      try {
        const target = await resolveInsideHome(candidate);
        await assertUserContent(target);
        const st = await lstatOrNull(target);

        if (!st || !st.isFile()) throw new Error('not a regular file');
        if (target === keep || (st.dev === keepStat.dev && st.ino === keepStat.ino)) {
          throw new Error('this is the same file as the copy being kept');
        }
        if (st.size !== keepStat.size || (await hashFile(target)) !== keepHash) {
          throw new Error('file changed since the scan and is no longer an identical copy');
        }
        // The kept copy must still be there at the moment of removal
        if (!(await lstatOrNull(keep))?.isFile()) throw new Error('the copy to keep disappeared');

        await moveToTrash(target);
        removed.push(target);
        freed += st.size;
      } catch (error) {
        errors.push({ path: String(candidate), error: error.message });
      }
    }
  }

  return { success: errors.length === 0, removed, freed, errors };
}
