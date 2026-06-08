import os from 'os';
import { execAsync, exists } from '../utils/sysUtils.js';
import { home, APP_PATHS } from '../config/paths.js';
import { PROCESS_DIRECTORY } from '../config/processDirectory.js';

// Retrieve all system resources statistics
export async function getSystemStats() {
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

  return {
    cpu: { user: cpuUser, system: cpuSys, idle: cpuIdle, loadAvg, cores },
    memory: { total: ramTotal, used: ramUsed, free: ramFree, active: ramActive, inactive: ramInactive, wired: ramWired, compressed: ramCompressed },
    swap: { total: swapTotal, used: swapUsed, free: swapFree },
    battery: { percentage: batteryPercentage, isCharging, cycleCount, condition: batteryCondition, maxCapacity },
    disk: { total: diskTotal, used: diskUsed, free: diskFree, percentage: diskPercentage }
  };
}

// Retrieve process information
export async function getProcesses() {
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

  let cloudSyncCpu = 0, cloudSyncMem = 0;
  let browserCpu = 0, browserMem = 0;
  let devCpu = 0, devMem = 0;

  processes.forEach(p => {
    const cmd = p.comm.toLowerCase();
    const name = p.name.toLowerCase();

    if (cmd.includes('google drive') || cmd.includes('onedrive') || cmd.includes('findersyncextension') || cmd.includes('fileproviderextension')) {
      cloudSyncCpu += p.cpu;
      cloudSyncMem += p.mem;
    } else if (name.includes('chrome') || name.includes('brave') || name.includes('safari') || name.includes('firefox') || name.includes('helper')) {
      browserCpu += p.cpu;
      browserMem += p.mem;
    } else if (name.includes('code') || name.includes('idea') || name.includes('pycharm') || name.includes('webstorm') || name.includes('node') || name.includes('git')) {
      devCpu += p.cpu;
      devMem += p.mem;
    }
  });

  const topCpu = [...processes].sort((a, b) => b.cpu - a.cpu).slice(0, 10);
  const topMem = [...processes].sort((a, b) => b.mem - a.mem).slice(0, 10);

  return {
    topCpu,
    topMem,
    categories: {
      cloudSync: { cpu: Math.round(cloudSyncCpu * 10) / 10, mem: Math.round(cloudSyncMem * 10) / 10 },
      browser: { cpu: Math.round(browserCpu * 10) / 10, mem: Math.round(browserMem * 10) / 10 },
      dev: { cpu: Math.round(devCpu * 10) / 10, mem: Math.round(devMem * 10) / 10 }
    }
  };
}

// Terminate a process by PID
export async function killProcess(pid) {
  await execAsync(`kill -9 ${pid}`);
}

// Retrieve focus sync presets status
export async function getFocusStatus() {
  const googleRunning = await exists('/Applications/Google Drive.app') 
    ? (await execAsync('pgrep -f "Google Drive"').then(() => true).catch(() => false))
    : false;
    
  const oneDriveRunning = await exists('/Applications/OneDrive.app')
    ? (await execAsync('pgrep -f "OneDrive"').then(() => true).catch(() => false))
    : false;

  return {
    googleDrive: { installed: await exists(APP_PATHS.googleDrive), running: googleRunning },
    oneDrive: { installed: await exists(APP_PATHS.oneDrive), running: oneDriveRunning }
  };
}

// Apply focus sync preset
export async function setFocusPreset(preset) {
  const actions = [];
  if (preset === 'coding' || preset === 'cinema') {
    actions.push('Stopping cloud syncs to maximize CPU/RAM hygiene.');
    await execAsync('pkill -f "Google Drive"').catch(() => {});
    await execAsync('pkill -f "OneDrive"').catch(() => {});
  } else if (preset === 'sync') {
    if (await exists(APP_PATHS.googleDrive)) {
      actions.push('Starting Google Drive.');
      await execAsync('open -a "Google Drive"').catch(() => {});
    }
    if (await exists(APP_PATHS.oneDrive)) {
      actions.push('Starting OneDrive.');
      await execAsync('open -a "OneDrive"').catch(() => {});
    }
  }
  return { success: true, actions };
}

// Get process detailed metadata for modal dialogs
export function getProcessInfo(name, comm) {
  const cleanName = name.toLowerCase().trim();
  let info = PROCESS_DIRECTORY[cleanName];
  
  if (!info) {
    const key = Object.keys(PROCESS_DIRECTORY).find(k => cleanName.includes(k) || k.includes(cleanName));
    if (key) {
      info = PROCESS_DIRECTORY[key];
    }
  }

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

  return { name, ...info };
}
