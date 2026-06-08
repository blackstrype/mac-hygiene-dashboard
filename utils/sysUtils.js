import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

export const execAsync = promisify(exec);

// Helper to check if file/folder exists
export async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Helper to get size of directory
export async function getDirSize(dirPath) {
  if (!(await exists(dirPath))) return 0;
  try {
    const escapedPath = dirPath.replace(/(["\\$])/g, '\\$1');
    const { stdout } = await execAsync(`du -sk "${escapedPath}"`);
    const match = stdout.trim().match(/^(\d+)/);
    if (match) {
      return parseInt(match[1]) * 1024; // convert KB to bytes
    }
    return 0;
  } catch (error) {
    console.error(`Error sizing ${dirPath}:`, error.message);
    return 0;
  }
}

// Helper to read the start of a file for AI preview (max 1000 bytes)
export async function getFilePreview(filePath, maxBytes = 1000) {
  try {
    const handle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    await handle.close();
    
    const raw = buffer.toString('utf8', 0, bytesRead);
    // Remove binary control characters
    const clean = raw.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    return clean.trim();
  } catch (error) {
    console.error(`Error reading preview for ${filePath}:`, error.message);
    return '';
  }
}
