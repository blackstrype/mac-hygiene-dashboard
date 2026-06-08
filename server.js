import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);
const app = express();
const PORT = 3000;

// Resolve home directory
const home = os.homedir();

// Configure cache paths
const CACHE_PATHS = {
  homebrew: path.join(home, 'Library/Caches/Homebrew'),
  npm: path.join(home, '.npm'),
  pip: path.join(home, 'Library/Caches/pip'),
  yarn: path.join(home, 'Library/Caches/Yarn'),
  cocoapods: path.join(home, 'Library/Caches/CocoaPods'),
  xcode: path.join(home, 'Library/Developer/Xcode/DerivedData'),
  vscode_shipit: path.join(home, 'Library/Caches/com.microsoft.VSCode.ShipIt'),
  jetbrains: path.join(home, 'Library/Caches/JetBrains')
};

// Check if applications exist
const APP_PATHS = {
  googleDrive: '/Applications/Google Drive.app',
  oneDrive: '/Applications/OneDrive.app'
};

app.use(express.json());
// Serve static frontend files
const __dirname = path.dirname(new URL(import.meta.url).pathname);
app.use(express.static(path.join(process.cwd(), 'public')));

// Helper to check if file/folder exists
async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Helper to get size of directory
async function getDirSize(dirPath) {
  if (!(await exists(dirPath))) return 0;
  try {
    const { stdout } = await execAsync(`du -sk "${dirPath}"`);
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

// 1. Get System stats
app.get('/api/stats', async (req, res) => {
  try {
    // A. CPU Stats
    let cpuUser = 0, cpuSys = 0, cpuIdle = 100;
    try {
      const { stdout: topOut } = await execAsync('top -l 1 -n 0');
      const cpuLine = topOut.split('\n').find(l => l.includes('CPU usage:'));
      if (cpuLine) {
        const match = cpuLine.match(/CPU usage:\s+([0-9.]+)%\s+user,\s+([0-9.]+)%\s+sys,\s+([0-9.]+)%\s+idle/);
        if (match) {
          cpuUser = parseFloat(match[1]);
          cpuSys = parseFloat(match[2]);
          cpuIdle = parseFloat(match[3]);
        }
      }
    } catch (e) {
      console.error('Error getting CPU stats:', e.message);
    }

    // B. Load Averages
    let loadAvg = [0, 0, 0];
    try {
      const { stdout: loadOut } = await execAsync('sysctl -n vm.loadavg');
      const match = loadOut.match(/\{\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\}/);
      if (match) {
        loadAvg = [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
      }
    } catch (e) {
      console.error('Error getting load average:', e.message);
    }

    // C. Core count
    let cores = 8;
    try {
      const { stdout: coresOut } = await execAsync('sysctl -n hw.ncpu');
      cores = parseInt(coresOut.trim()) || 8;
    } catch {}

    // D. RAM Stats
    let ramTotal = os.totalmem();
    let ramUsed = 0, ramWired = 0, ramCompressed = 0, ramFree = 0, ramActive = 0, ramInactive = 0;
    try {
      const { stdout: pageOut } = await execAsync('sysctl -n hw.pagesize');
      const pageSize = parseInt(pageOut.trim()) || 16384;
      
      const { stdout: vmOut } = await execAsync('vm_stat');
      const lines = vmOut.split('\n');
      const getVal = (label) => {
        const line = lines.find(l => l.includes(label));
        if (!line) return 0;
        const match = line.match(/:?\s+(\d+)\./);
        return match ? parseInt(match[1]) * pageSize : 0;
      };

      const free = getVal('Pages free');
      const active = getVal('Pages active');
      const inactive = getVal('Pages inactive');
      const speculative = getVal('Pages speculative');
      const wired = getVal('Pages wired');
      const compressed = getVal('Pages occupied by compressor');

      ramWired = wired;
      ramCompressed = compressed;
      ramFree = free + speculative;
      ramActive = active;
      ramInactive = inactive;
      ramUsed = ramTotal - ramFree;
    } catch (e) {
      console.error('Error getting RAM stats:', e.message);
      ramFree = os.freemem();
      ramUsed = ramTotal - ramFree;
    }

    // E. Swap Stats
    let swapTotal = 0, swapUsed = 0, swapFree = 0;
    try {
      const { stdout: swapOut } = await execAsync('sysctl vm.swapusage');
      const match = swapOut.match(/total = ([0-9.]+)M\s+used = ([0-9.]+)M\s+free = ([0-9.]+)M/);
      if (match) {
        swapTotal = parseFloat(match[1]) * 1024 * 1024;
        swapUsed = parseFloat(match[2]) * 1024 * 1024;
        swapFree = parseFloat(match[3]) * 1024 * 1024;
      }
    } catch (e) {
      console.error('Error getting Swap stats:', e.message);
    }

    // F. Battery Stats
    let batteryPercentage = 100;
    let isCharging = false;
    let cycleCount = 0;
    let batteryCondition = 'Normal';
    let maxCapacity = 100;

    try {
      const { stdout: pmsetOut } = await execAsync('pmset -g batt');
      const matchPct = pmsetOut.match(/(\d+)%/);
      if (matchPct) batteryPercentage = parseInt(matchPct[1]);
      isCharging = pmsetOut.includes('AC attached') && !pmsetOut.includes('not charging');

      const { stdout: profilerOut } = await execAsync('system_profiler SPPowerDataType | grep -E "Cycle Count|Condition|Maximum Capacity"');
      const lines = profilerOut.split('\n');
      for (const line of lines) {
        if (line.includes('Cycle Count')) {
          const match = line.match(/Cycle Count:\s+(\d+)/);
          if (match) cycleCount = parseInt(match[1]);
        } else if (line.includes('Condition')) {
          const match = line.match(/Condition:\s+(.+)/);
          if (match) batteryCondition = match[1].trim();
        } else if (line.includes('Maximum Capacity')) {
          const match = line.match(/Maximum Capacity:\s+(\d+)/);
          if (match) maxCapacity = parseInt(match[1]);
        }
      }
    } catch (e) {
      console.error('Error getting Battery stats:', e.message);
    }

    // G. Disk Stats
    let diskTotal = 0, diskUsed = 0, diskFree = 0, diskPercentage = 0;
    try {
      const { stdout: dfOut } = await execAsync('df -g /System/Volumes/Data');
      const lines = dfOut.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        // df -g outputs sizes in GiB (Gibibytes)
        const sizeGB = parseInt(parts[1]);
        const usedGB = parseInt(parts[2]);
        const availGB = parseInt(parts[3]);
        diskTotal = sizeGB * 1024 * 1024 * 1024;
        diskUsed = usedGB * 1024 * 1024 * 1024;
        diskFree = availGB * 1024 * 1024 * 1024;
        diskPercentage = Math.round((diskUsed / diskTotal) * 100);
      }
    } catch (e) {
      console.error('Error getting Disk stats:', e.message);
    }

    res.json({
      cpu: {
        user: cpuUser,
        system: cpuSys,
        idle: cpuIdle,
        loadAvg,
        cores
      },
      memory: {
        total: ramTotal,
        used: ramUsed,
        free: ramFree,
        active: ramActive,
        inactive: ramInactive,
        wired: ramWired,
        compressed: ramCompressed
      },
      swap: {
        total: swapTotal,
        used: swapUsed,
        free: swapFree
      },
      battery: {
        percentage: batteryPercentage,
        isCharging,
        cycleCount,
        condition: batteryCondition,
        maxCapacity
      },
      disk: {
        total: diskTotal,
        used: diskUsed,
        free: diskFree,
        percentage: diskPercentage
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get Process list
app.get('/api/processes', async (req, res) => {
  try {
    const { stdout } = await execAsync('ps -Ao pid,%cpu,%mem,comm');
    const lines = stdout.trim().split('\n').slice(1);
    
    const processes = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[0]);
      const cpu = parseFloat(parts[1]);
      const mem = parseFloat(parts[2]);
      const comm = parts.slice(3).join(' ');
      const name = comm.split('/').pop();
      return { pid, cpu, mem, name, comm };
    }).filter(p => !isNaN(p.pid) && p.name);

    // Group resources by categories
    let cloudSyncCpu = 0, cloudSyncMem = 0;
    let browserCpu = 0, browserMem = 0;
    let devCpu = 0, devMem = 0;

    processes.forEach(p => {
      const cmd = p.comm.toLowerCase();
      const name = p.name.toLowerCase();

      // Cloud Sync
      if (cmd.includes('google drive') || cmd.includes('onedrive') || cmd.includes('findersyncextension') || cmd.includes('fileproviderextension')) {
        cloudSyncCpu += p.cpu;
        cloudSyncMem += p.mem;
      }
      // Browsers
      else if (name.includes('chrome') || name.includes('brave') || name.includes('safari') || name.includes('firefox') || name.includes('helper')) {
        browserCpu += p.cpu;
        browserMem += p.mem;
      }
      // Dev tools
      else if (name.includes('code') || name.includes('idea') || name.includes('pycharm') || name.includes('webstorm') || name.includes('node') || name.includes('git')) {
        devCpu += p.cpu;
        devMem += p.mem;
      }
    });

    // Sort top processes
    const topCpu = [...processes].sort((a, b) => b.cpu - a.cpu).slice(0, 10);
    const topMem = [...processes].sort((a, b) => b.mem - a.mem).slice(0, 10);

    res.json({
      topCpu,
      topMem,
      categories: {
        cloudSync: { cpu: Math.round(cloudSyncCpu * 10) / 10, mem: Math.round(cloudSyncMem * 10) / 10 },
        browser: { cpu: Math.round(browserCpu * 10) / 10, mem: Math.round(browserMem * 10) / 10 },
        dev: { cpu: Math.round(devCpu * 10) / 10, mem: Math.round(devMem * 10) / 10 }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Kill process
app.post('/api/processes/kill', async (req, res) => {
  const { pid } = req.body;
  if (!pid) return res.status(400).json({ error: 'PID is required' });
  
  try {
    await execAsync(`kill -9 ${pid}`);
    res.json({ success: true, message: `Process ${pid} terminated.` });
  } catch (error) {
    res.status(500).json({ error: `Failed to kill process: ${error.message}` });
  }
});

// 4. Focus presets status
app.get('/api/focus/status', async (req, res) => {
  try {
    const googleRunning = await exists('/Applications/Google Drive.app') 
      ? (await execAsync('pgrep -f "Google Drive"').then(() => true).catch(() => false))
      : false;
      
    const oneDriveRunning = await exists('/Applications/OneDrive.app')
      ? (await execAsync('pgrep -f "OneDrive"').then(() => true).catch(() => false))
      : false;

    res.json({
      googleDrive: { installed: await exists(APP_PATHS.googleDrive), running: googleRunning },
      oneDrive: { installed: await exists(APP_PATHS.oneDrive), running: oneDriveRunning }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Apply Focus preset
app.post('/api/focus/preset', async (req, res) => {
  const { preset } = req.body;
  if (!preset) return res.status(400).json({ error: 'Preset is required' });

  const actions = [];
  try {
    if (preset === 'coding' || preset === 'cinema') {
      // Pause/Stop cloud sync processes to conserve CPU & RAM
      actions.push('Stopping cloud syncs to maximize CPU/RAM hygiene.');
      await execAsync('pkill -f "Google Drive"').catch(() => {});
      await execAsync('pkill -f "OneDrive"').catch(() => {});
    } else if (preset === 'sync') {
      // Start Cloud Sync
      if (await exists(APP_PATHS.googleDrive)) {
        actions.push('Starting Google Drive.');
        await execAsync('open -a "Google Drive"').catch(() => {});
      }
      if (await exists(APP_PATHS.oneDrive)) {
        actions.push('Starting OneDrive.');
        await execAsync('open -a "OneDrive"').catch(() => {});
      }
    }

    res.json({ success: true, actions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Scan developer/system caches
app.get('/api/clean/scan', async (req, res) => {
  try {
    const results = {};
    for (const [key, dirPath] of Object.entries(CACHE_PATHS)) {
      results[key] = {
        path: dirPath,
        size: await getDirSize(dirPath),
        exists: await exists(dirPath)
      };
    }
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Run Cache Clean
app.post('/api/clean/run', async (req, res) => {
  const { caches } = req.body; // array of cache keys (e.g. ['homebrew', 'npm'])
  if (!caches || !Array.isArray(caches)) {
    return res.status(400).json({ error: 'Caches array is required' });
  }

  const cleaned = [];
  const errors = [];

  for (const cacheKey of caches) {
    const dirPath = CACHE_PATHS[cacheKey];
    if (!dirPath) {
      errors.push(`Invalid cache key: ${cacheKey}`);
      continue;
    }

    // Safety checks
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

  res.json({ success: errors.length === 0, cleaned, errors });
});

// Process Directory with safeness scores and descriptions
const PROCESS_DIRECTORY = {
  'kernel_task': {
    description: 'The macOS operating system kernel. Responsible for managing CPU temperatures, system scheduling, and memory paging. It cannot be terminated.',
    safeness: 0,
    risk: 'Critical System Process'
  },
  'launchd': {
    description: 'The parent process of all services on macOS. Responsible for loading system daemons, user agents, and starting user sessions. Terminating it is impossible.',
    safeness: 0,
    risk: 'Critical System Process'
  },
  'windowserver': {
    description: 'The macOS compositing window manager. Responsible for rendering all visual components, windows, animations, and graphics on your display. Terminating it will force log you out.',
    safeness: 0,
    risk: 'Critical System Process'
  },
  'fseventsd': {
    description: 'File System Events Daemon. Monitors the file system and reports changes to apps (like git, IDE trackers, Google Drive). Essential for hot-reloading.',
    safeness: 10,
    risk: 'Important System Service'
  },
  'syslogd': {
    description: 'System Log Daemon. Receives and processes log messages from applications and the operating system.',
    safeness: 20,
    risk: 'System Logger'
  },
  'logd': {
    description: 'macOS diagnostics logging daemon. Manages system logs and retrieves active process log logs.',
    safeness: 20,
    risk: 'System Logger'
  },
  'mds': {
    description: 'Spotlight metadata server. The core indexing service behind Spotlight search. Can spike CPU when indexing new files.',
    safeness: 70,
    risk: 'Spotlight Indexer'
  },
  'mdworker': {
    description: 'Spotlight metadata indexing worker. Spawned by mds to index specific files. Safe to terminate, but Spotlight will restart it.',
    safeness: 80,
    risk: 'Spotlight Indexer'
  },
  'mds_stores': {
    description: 'Spotlight search storage worker. Writes search database indexes to disk.',
    safeness: 70,
    risk: 'Spotlight Indexer'
  },
  'finder': {
    description: 'The macOS Finder. Serves as the primary graphical file manager interface and desktop layout. Terminating it will restart the desktop shell.',
    safeness: 80,
    risk: 'Desktop Shell UI'
  },
  'google drive': {
    description: 'Google Drive Desktop client. Manages file streaming and sync. Pausing or quitting Google Drive reduces CPU usage during heavy coding sessions.',
    safeness: 100,
    risk: 'Safe User Service'
  },
  'onedrive': {
    description: 'Microsoft OneDrive Desktop client. Syncs your files to the cloud. Quitting OneDrive frees memory and halts background file hashing.',
    safeness: 100,
    risk: 'Safe User Service'
  },
  'code': {
    description: 'Visual Studio Code. An Electron-based code editor and IDE. Generally safe to quit, but make sure to save your files in the editor first.',
    safeness: 95,
    risk: 'User Application'
  },
  'electron': {
    description: 'Electron framework process. Used by apps like VS Code, Slack, and Discord. Make sure you know which app it belongs to before terminating.',
    safeness: 90,
    risk: 'User Application'
  },
  'brave': {
    description: 'Brave Browser. A privacy-focused browser. Terminating will close the corresponding browser windows or tabs.',
    safeness: 95,
    risk: 'User Application'
  },
  'chrome': {
    description: 'Google Chrome web browser. Runs separate processes for each window, tab, and extension. Safe to close, but you will lose unsaved tab states.',
    safeness: 95,
    risk: 'User Application'
  },
  'safari': {
    description: 'Apple Safari web browser. Efficient, native browser. Terminating will close browser tabs or windows.',
    safeness: 95,
    risk: 'User Application'
  },
  'firefox': {
    description: 'Mozilla Firefox web browser. Safe to terminate. Will close active tabs and browser sessions.',
    safeness: 95,
    risk: 'User Application'
  },
  'node': {
    description: 'Node.js runtime environment. Runs web servers, build tools, or scripts. Terminating is safe and highly useful for killing crashed local servers.',
    safeness: 95,
    risk: 'Developer Runtime'
  },
  'git': {
    description: 'Git version control. Manages code tracking, branches, and logs. Terminating it is safe but will cancel the active repository command.',
    safeness: 90,
    risk: 'Developer Tool'
  },
  'python': {
    description: 'Python interpreter. Runs scripts, data-science models, or local utilities. Safe to close unless it is running an active database backup or sync script.',
    safeness: 95,
    risk: 'User Script/Runtime'
  },
  'python3': {
    description: 'Python 3 interpreter. Runs scripts or local tools. Safe to terminate, which will stop the active script execution.',
    safeness: 95,
    risk: 'User Script/Runtime'
  },
  'zsh': {
    description: 'Zsh Command shell. Powering active terminal tabs. Terminating it will close the corresponding terminal window or halt the shell session.',
    safeness: 85,
    risk: 'Shell Session'
  },
  'bash': {
    description: 'Bash Command shell. Manages CLI commands. Terminating it will kill the active command shell.',
    safeness: 85,
    risk: 'Shell Session'
  },
  'activity monitor': {
    description: 'macOS Activity Monitor. Tracks active process resource usage. Fully safe to close.',
    safeness: 100,
    risk: 'User Application'
  },
  'activitymonitor': {
    description: 'macOS Activity Monitor. Resource monitoring application. Fully safe to close.',
    safeness: 100,
    risk: 'User Application'
  },
  'systemuiserver': {
    description: 'Manages status bar items (menu extras) in the top-right menu bar (Wi-Fi, clock, battery). Terminating it simply forces them to redraw.',
    safeness: 80,
    risk: 'Menu Bar Interface'
  },
  'powerd': {
    description: 'macOS Power Daemon. Tracks battery status, charging, sleep, wake schedules, and power conservation states.',
    safeness: 10,
    risk: 'Power Management Service'
  },
  'pmset': {
    description: 'Power management configuration utility. Interacts with the powerd service.',
    safeness: 20,
    risk: 'Power Management Service'
  },
  'docker': {
    description: 'Docker Desktop backend. Runs containerized development systems. Highly resource intensive on macOS; quitting it frees large amounts of RAM.',
    safeness: 95,
    risk: 'Developer Tool'
  },
  'dockerd': {
    description: 'Docker Daemon. Manages active Docker containers. Quitting it shuts down all running containers.',
    safeness: 90,
    risk: 'Developer Tool'
  },
  'spotify': {
    description: 'Spotify music player client. Safe to close.',
    safeness: 100,
    risk: 'User Application'
  },
  'discord': {
    description: 'Discord chat application. Terminating closes the chat window.',
    safeness: 100,
    risk: 'User Application'
  },
  'slack': {
    description: 'Slack collaboration tool. Electron-based app that consumes substantial memory. Safe to terminate.',
    safeness: 100,
    risk: 'User Application'
  }
};

// 8. Get Process Info Details
app.get('/api/processes/info', (req, res) => {
  const { name, comm } = req.query;
  if (!name) return res.status(400).json({ error: 'Process name is required' });

  const cleanName = name.toLowerCase().trim();
  
  // Look up in directory
  let info = PROCESS_DIRECTORY[cleanName];
  
  // If not found, try substring matching
  if (!info) {
    const key = Object.keys(PROCESS_DIRECTORY).find(k => cleanName.includes(k) || k.includes(cleanName));
    if (key) {
      info = PROCESS_DIRECTORY[key];
    }
  }

  // Fallbacks
  if (!info) {
    const commStr = comm || '';
    const isSystem = commStr.startsWith('/System/') || 
                     commStr.startsWith('/usr/lib') || 
                     commStr.startsWith('/usr/libexec') || 
                     commStr.startsWith('/System/Library');
    if (isSystem) {
      info = {
        description: `This process (${name}) appears to be a core macOS system service or daemon. Terminating system components can cause OS instability and crashes.`,
        safeness: 30,
        risk: 'macOS System Process'
      };
    } else {
      info = {
        description: `A user-level background process or application (${name}). Generally safe to terminate if it is frozen or consuming high resources. Save work in corresponding apps first.`,
        safeness: 85,
        risk: 'User Application / Script'
      };
    }
  }

  res.json({ name, ...info });
});

// 9. Scan directory for Disk Usage Analyzer
app.get('/api/disk/scan', async (req, res) => {
  const targetPath = req.query.path ? path.resolve(req.query.path) : home;
  
  if (!targetPath.startsWith(home)) {
    return res.status(403).json({ error: 'Access Denied: Path is outside user home directory.' });
  }

  try {
    const files = await fs.readdir(targetPath, { withFileTypes: true });
    
    const scanPromises = files.map(async (file) => {
      const fullPath = path.join(targetPath, file.name);
      
      // Library is massive and protected by macOS Sandbox (TCC). Avoid deep traversal.
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
            size = parseInt(match[1]) * 1024; // convert KB to bytes
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
    
    // Sort from largest to smallest
    results.sort((a, b) => b.size - a.size);
    
    res.json({
      path: targetPath,
      parent: targetPath === home ? null : path.dirname(targetPath),
      items: results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Open directory/file in Finder
app.post('/api/disk/open', async (req, res) => {
  const { path: targetPath } = req.body;
  if (!targetPath) return res.status(400).json({ error: 'Path is required' });
  
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(home)) {
    return res.status(403).json({ error: 'Access Denied: Path is outside user home directory.' });
  }
  
  try {
    const escaped = resolved.replace(/(["\\$])/g, '\\$1');
    await execAsync(`open "${escaped}"`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: `Failed to open: ${error.message}` });
  }
});

// 11. Delete directory/file
app.post('/api/disk/delete', async (req, res) => {
  const { path: targetPath } = req.body;
  if (!targetPath) return res.status(400).json({ error: 'Path is required' });
  
  const resolved = path.resolve(targetPath);
  
  if (!resolved.startsWith(home)) {
    return res.status(403).json({ error: 'Access Denied: Cannot delete outside home directory.' });
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
    return res.status(403).json({ error: 'Access Denied: Deleting primary system or user directories is prohibited for safety reasons.' });
  }
  
  try {
    await fs.rm(resolved, { recursive: true, force: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: `Deletion failed: ${error.message}` });
  }
});

// Start listening
app.listen(PORT, () => {
  console.log(`ZenMac dashboard backend running on http://localhost:${PORT}`);
});
