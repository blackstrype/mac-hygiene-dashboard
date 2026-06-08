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
