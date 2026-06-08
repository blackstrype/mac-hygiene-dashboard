import fs from 'fs/promises';
import path from 'path';
import { execAsync, exists, getDirSize } from '../utils/sysUtils.js';
import { home, CACHE_PATHS } from '../config/paths.js';

// Scan developer/system caches
export async function scanCaches() {
  const results = {};
  for (const [key, dirPath] of Object.entries(CACHE_PATHS)) {
    results[key] = {
      path: dirPath,
      size: await getDirSize(dirPath),
      exists: await exists(dirPath)
    };
  }
  return results;
}

// Clear specific developer caches
export async function runCacheClean(caches) {
  const cleaned = [];
  const errors = [];

  for (const cacheKey of caches) {
    const dirPath = CACHE_PATHS[cacheKey];
    if (!dirPath) {
      errors.push(`Invalid cache key: ${cacheKey}`);
      continue;
    }

    if (!dirPath.startsWith(home)) {
      errors.push(`Safety check failed: path for ${cacheKey} is outside user home`);
      continue;
    }

    try {
      if (await exists(dirPath)) {
        await execAsync(`rm -rf "${dirPath}"/*`);
        cleaned.push(cacheKey);
      } else {
        cleaned.push(`${cacheKey} (already clean/absent)`);
      }
    } catch (e) {
      console.error(`Cleanup failed for ${cacheKey}:`, e.message);
      errors.push(`Failed to clear ${cacheKey}: ${e.message}`);
    }
  }

  return { success: errors.length === 0, cleaned, errors };
}

// Scan directory children for Disk Usage Analyzer
export async function scanDirectory(targetDir) {
  const targetPath = targetDir ? path.resolve(targetDir) : home;
  
  if (!targetPath.startsWith(home)) {
    throw new Error('Access Denied: Path is outside user home directory.');
  }

  const files = await fs.readdir(targetPath, { withFileTypes: true });
  
  const scanPromises = files.map(async (file) => {
    const fullPath = path.join(targetPath, file.name);
    
    if (file.name === 'Library' && targetPath === home) {
      return {
        name: file.name,
        path: fullPath,
        isDirectory: true,
        size: 0,
        isLibrary: true
      };
    }
    
    let size = 0;
    if (file.isDirectory()) {
      try {
        const escapedPath = fullPath.replace(/(["\\$])/g, '\\$1');
        const { stdout } = await execAsync(`du -sk "${escapedPath}"`, { timeout: 8000 });
        const match = stdout.trim().match(/^(\d+)/);
        if (match) {
          size = parseInt(match[1]) * 1024;
        }
      } catch {
        size = 0;
      }
    } else if (file.isFile()) {
      try {
        const stats = await fs.stat(fullPath);
        size = stats.size;
      } catch {
        size = 0;
      }
    }
    
    return {
      name: file.name,
      path: fullPath,
      isDirectory: file.isDirectory(),
      size
    };
  });

  const results = await Promise.all(scanPromises);
  results.sort((a, b) => b.size - a.size);

  return {
    path: targetPath,
    home: home,
    parent: targetPath === home ? null : path.dirname(targetPath),
    items: results
  };
}

// Open folder/file in Finder
export async function openPath(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(home)) {
    throw new Error('Access Denied: Path is outside user home directory.');
  }
  
  const escaped = resolved.replace(/(["\\$])/g, '\\$1');
  await execAsync(`open "${escaped}"`);
}

// Delete folder/file recursively with safety checks
export async function deletePath(targetPath) {
  const resolved = path.resolve(targetPath);
  
  if (!resolved.startsWith(home)) {
    throw new Error('Access Denied: Cannot delete outside home directory.');
  }
  
  const protectedPaths = [
    home,
    path.join(home, 'Library'),
    path.join(home, 'Desktop'),
    path.join(home, 'Documents'),
    path.join(home, 'Downloads'),
    path.join(home, 'Applications'),
    path.join(home, 'Movies'),
    path.join(home, 'Music'),
    path.join(home, 'Pictures')
  ];
  
  if (protectedPaths.includes(resolved)) {
    throw new Error('Access Denied: Deleting primary system or user directories is prohibited.');
  }
  
  await fs.rm(resolved, { recursive: true, force: true });
}
