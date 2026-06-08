import MiniChart from './js/components/MiniChart.js';
import PieChart from './js/components/PieChart.js';
import { formatBytes, formatGB, escapeHtml } from './js/utils/helpers.js';

// Global UI State
let activePreset = 'sync';
let activeProcessTab = 'cpu';
let processData = { topCpu: [], topMem: [] };
let cacheData = {};
let selectedCaches = new Set();
let latestStats = null;
let dialogTargetPid = null;
let currentDiskPath = null;
let currentHomePath = '';

// Initialize Charts
const cpuChart = new MiniChart('cpu-chart', 30, '#6366f1', 'percent');
const ramChart = new MiniChart('ram-chart', 30, '#8b5cf6', 'ram');
const swapChart = new MiniChart('swap-chart', 30, '#ec4899', 'swap');
const ramPieChart = new PieChart('ram-pie-chart');

// DOM Caching Registry
const DOM = {};

function cacheDOM() {
  DOM.cpuTotalVal = document.getElementById('cpu-total-val');
  DOM.cpuGaugeFill = document.getElementById('cpu-gauge-fill');
  DOM.load1m = document.getElementById('load-1m');
  DOM.load5m = document.getElementById('load-5m');
  DOM.load15m = document.getElementById('load-15m');
  
  DOM.ramPctVal = document.getElementById('ram-pct-val');
  DOM.ramGaugeFill = document.getElementById('ram-gauge-fill');
  DOM.ramActive = document.getElementById('ram-active');
  DOM.ramWired = document.getElementById('ram-wired');
  DOM.ramCompressed = document.getElementById('ram-compressed');
  DOM.ramCached = document.getElementById('ram-cached');
  DOM.ramFree = document.getElementById('ram-free');
  
  DOM.swapVal = document.getElementById('swap-val');
  DOM.swapGaugeFill = document.getElementById('swap-gauge-fill');
  DOM.swapWarning = document.getElementById('swap-warning');
  
  DOM.diskCard = document.getElementById('disk-card');
  DOM.diskPctVal = document.getElementById('disk-pct-val');
  DOM.diskProgressFill = document.getElementById('disk-progress-fill');
  DOM.diskFree = document.getElementById('disk-free');
  DOM.diskUsed = document.getElementById('disk-used');
  DOM.diskTotal = document.getElementById('disk-total');
  DOM.diskAlertBox = document.getElementById('disk-alert-box');
  
  DOM.batteryPctVal = document.getElementById('battery-pct-val');
  DOM.batteryCondition = document.getElementById('battery-condition');
  DOM.batteryCapacity = document.getElementById('battery-capacity');
  DOM.batteryCycles = document.getElementById('battery-cycles');
  DOM.batteryChargingStatus = document.getElementById('battery-charging-status');

  DOM.activePresetText = document.getElementById('active-preset-text');
  DOM.currentPresetBadge = document.getElementById('current-preset-badge');
  DOM.presetSync = document.getElementById('preset-sync');
  DOM.presetCoding = document.getElementById('preset-coding');
  DOM.presetCinema = document.getElementById('preset-cinema');
  
  DOM.catSyncCpu = document.getElementById('cat-sync-cpu');
  DOM.catSyncMem = document.getElementById('cat-sync-mem');
  DOM.catBrowserCpu = document.getElementById('cat-browser-cpu');
  DOM.catBrowserMem = document.getElementById('cat-browser-mem');
  DOM.catDevCpu = document.getElementById('cat-dev-cpu');
  DOM.catDevMem = document.getElementById('cat-dev-mem');
  
  DOM.processListBody = document.getElementById('process-list-body');
  DOM.cacheListBody = document.getElementById('cache-list-body');
  DOM.tabCpu = document.getElementById('tab-cpu');
  DOM.tabMem = document.getElementById('tab-mem');
  
  DOM.cleanerActionsBar = document.getElementById('cleaner-actions-bar');
  DOM.selectedCacheSummary = document.getElementById('selected-cache-summary');
  DOM.selectAllCaches = document.getElementById('select-all-caches');
  DOM.btnScan = document.getElementById('btn-scan');
  DOM.btnClean = document.getElementById('btn-clean');
  
  DOM.infoProcName = document.getElementById('info-proc-name');
  DOM.infoProcRisk = document.getElementById('info-proc-risk');
  DOM.infoProcDesc = document.getElementById('info-proc-desc');
  DOM.infoSafenessPct = document.getElementById('info-safeness-pct');
  DOM.infoSafenessRing = document.getElementById('info-safeness-ring');
  DOM.infoSafenessDesc = document.getElementById('info-safeness-desc');
  DOM.btnDialogTerminate = document.getElementById('btn-dialog-terminate');
  DOM.processInfoDialog = document.getElementById('process-info-dialog');
  
  DOM.pieLegend = document.getElementById('pie-legend');

  // Disk Analyzer DOM items
  DOM.diskAnalyzerDialog = document.getElementById('disk-analyzer-dialog');
  DOM.btnCloseDiskDialog = document.getElementById('btn-close-disk-dialog');
  DOM.btnCloseDiskDialogSec = document.getElementById('btn-close-disk-dialog-sec');
  DOM.diskBreadcrumbs = document.getElementById('disk-breadcrumbs');
  DOM.diskBreakdownBar = document.getElementById('disk-breakdown-bar');
  DOM.diskBreakdownLegend = document.getElementById('disk-breakdown-legend');
  DOM.diskListBody = document.getElementById('disk-list-body');
  DOM.diskLoading = document.getElementById('disk-loading');
  DOM.diskTable = document.getElementById('disk-table');

  // AI Analysis DOM items
  DOM.aiAnalysisDialog = document.getElementById('ai-analysis-dialog');
  DOM.btnCloseAiDialog = document.getElementById('btn-close-ai-dialog');
  DOM.aiFileName = document.getElementById('ai-file-name');
  DOM.aiSafenessPct = document.getElementById('ai-safeness-pct');
  DOM.aiLoading = document.getElementById('ai-loading');
}

function setText(element, val) {
  if (element) {
    element.innerText = val;
  }
}

// UI Update Subroutines
function updateCpuUI(cpu) {
  const cpuTotal = Math.round(cpu.user + cpu.system);
  setText(DOM.cpuTotalVal, `${cpuTotal}%`);
  if (DOM.cpuGaugeFill) DOM.cpuGaugeFill.style.width = `${cpuTotal}%`;
  setText(DOM.load1m, cpu.loadAvg[0].toFixed(2));
  setText(DOM.load5m, cpu.loadAvg[1].toFixed(2));
  setText(DOM.load15m, cpu.loadAvg[2].toFixed(2));
  cpuChart.addData(cpuTotal);
}

function updateRamUI(memory) {
  const ramPct = Math.round((memory.used / memory.total) * 100);
  setText(DOM.ramPctVal, `${ramPct}%`);
  if (DOM.ramGaugeFill) DOM.ramGaugeFill.style.width = `${ramPct}%`;
  
  const totalRAM_GB = memory.total / (1024 * 1024 * 1024);
  ramChart.totalRamGB = totalRAM_GB;

  setText(DOM.ramActive, formatGB(memory.active));
  setText(DOM.ramWired, formatGB(memory.wired));
  setText(DOM.ramCompressed, formatGB(memory.compressed));
  setText(DOM.ramCached, formatGB(memory.inactive));
  setText(DOM.ramFree, formatGB(memory.free));
  ramChart.addData(ramPct);
}

function updateSwapUI(swap) {
  const swapGB = swap.used / (1024 * 1024 * 1024);
  setText(DOM.swapVal, `${swapGB.toFixed(2)} GB`);
  
  const swapMax = Math.max(swap.total, 1024 * 1024 * 1024);
  const swapPct = Math.round((swap.used / swapMax) * 100);
  if (DOM.swapGaugeFill) DOM.swapGaugeFill.style.width = `${swapPct}%`;
  
  if (DOM.swapWarning) {
    DOM.swapWarning.style.display = swapGB > 0.5 ? 'flex' : 'none';
  }
  swapChart.addData(swapGB);
}

function updateDiskUI(disk) {
  setText(DOM.diskPctVal, `${disk.percentage}%`);
  if (DOM.diskProgressFill) {
    DOM.diskProgressFill.style.width = `${disk.percentage}%`;
    DOM.diskProgressFill.classList.toggle('warning', disk.percentage >= 90);
  }
  
  if (DOM.diskPctVal) DOM.diskPctVal.classList.toggle('danger', disk.percentage >= 90);
  if (DOM.diskFree) DOM.diskFree.classList.toggle('critical-text', disk.percentage >= 90);
  if (DOM.diskAlertBox) {
    DOM.diskAlertBox.style.display = disk.percentage >= 90 ? 'flex' : 'none';
  }
  
  setText(DOM.diskUsed, formatBytes(disk.used));
  setText(DOM.diskFree, formatBytes(disk.free));
  setText(DOM.diskTotal, formatBytes(disk.total));
}

function updateBatteryUI(battery) {
  setText(DOM.batteryPctVal, `${battery.percentage}%`);
  setText(DOM.batteryCondition, battery.condition);
  setText(DOM.batteryCapacity, `${battery.maxCapacity}%`);
  setText(DOM.batteryCycles, battery.cycleCount);
  setText(DOM.batteryChargingStatus, battery.isCharging ? 'Charging' : 'On Battery');
}

// Controller Functions
async function updateStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    latestStats = data;

    updateCpuUI(data.cpu);
    updateRamUI(data.memory);
    updateSwapUI(data.swap);
    updateDiskUI(data.disk);
    updateBatteryUI(data.battery);

    updatePieChart();
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

async function updatePresetStatus() {
  try {
    const res = await fetch('/api/focus/status');
    const status = await res.json();

    const google = status.googleDrive;
    const one = status.oneDrive;

    DOM.presetSync?.classList.remove('active');
    DOM.presetCoding?.classList.remove('active');
    DOM.presetCinema?.classList.remove('active');

    if ((google.installed && google.running) || (one.installed && one.running)) {
      activePreset = 'sync';
      setText(DOM.activePresetText, 'Sync Active');
      if (DOM.currentPresetBadge) {
        DOM.currentPresetBadge.style.color = 'var(--color-success)';
        DOM.currentPresetBadge.style.background = 'rgba(16, 185, 129, 0.1)';
        DOM.currentPresetBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      }
      DOM.presetSync?.classList.add('active');
    } else {
      activePreset = 'coding';
      setText(DOM.activePresetText, 'Zen Focus Active');
      if (DOM.currentPresetBadge) {
        DOM.currentPresetBadge.style.color = 'var(--accent-primary)';
        DOM.currentPresetBadge.style.background = 'rgba(99, 102, 241, 0.1)';
        DOM.currentPresetBadge.style.borderColor = 'var(--border-color-active)';
      }
      DOM.presetCoding?.classList.add('active');
    }
  } catch (error) {
    console.error('Error checking preset status:', error);
  }
}

async function setPreset(preset) {
  try {
    DOM.presetSync?.classList.remove('active');
    DOM.presetCoding?.classList.remove('active');
    DOM.presetCinema?.classList.remove('active');
    
    const btn = DOM[`preset${preset.charAt(0).toUpperCase() + preset.slice(1)}`];
    if (btn) btn.classList.add('active');

    const res = await fetch('/api/focus/preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset })
    });
    
    await res.json();
    setTimeout(updatePresetStatus, 800);
  } catch (error) {
    console.error('Error setting preset:', error);
  }
}

async function updateProcesses() {
  try {
    const res = await fetch('/api/processes');
    processData = await res.json();

    setText(DOM.catSyncCpu, `${processData.categories.cloudSync.cpu}%`);
    setText(DOM.catSyncMem, `${processData.categories.cloudSync.mem}%`);
    
    setText(DOM.catBrowserCpu, `${processData.categories.browser.cpu}%`);
    setText(DOM.catBrowserMem, `${processData.categories.browser.mem}%`);
    
    setText(DOM.catDevCpu, `${processData.categories.dev.cpu}%`);
    setText(DOM.catDevMem, `${processData.categories.dev.mem}%`);

    renderProcessList();
    updatePieChart();
  } catch (error) {
    console.error('Error updating processes:', error);
  }
}

function renderProcessList() {
  const tbody = DOM.processListBody;
  if (!tbody) return;
  
  const items = activeProcessTab === 'cpu' ? processData.topCpu : processData.topMem;

  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" align="center" class="muted-text">No processes found</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(p => {
    const escapedName = escapeHtml(p.name);
    const escapedComm = escapeHtml(p.comm);
    return `
      <tr>
        <td>${p.pid}</td>
        <td class="proc-name" title="${escapedComm}">
          ${escapedName}
          <button class="info-bubble" data-name="${escapedName}" data-comm="${escapedComm}" data-pid="${p.pid}" title="Process Info">ⓘ</button>
        </td>
        <td align="right" class="${p.cpu > 50 ? 'critical-text' : ''}">${p.cpu.toFixed(1)}%</td>
        <td align="right">${p.mem.toFixed(1)}%</td>
        <td align="center">
          <button class="btn-kill" data-pid="${p.pid}">Terminate</button>
        </td>
      </tr>
    `;
  }).join('');
}

function switchProcessTab(tab) {
  activeProcessTab = tab;
  DOM.tabCpu?.classList.toggle('active', tab === 'cpu');
  DOM.tabMem?.classList.toggle('active', tab === 'mem');
  renderProcessList();
}

async function killProcess(pid) {
  if (!confirm(`Are you sure you want to terminate process ID ${pid}?`)) return;
  try {
    const res = await fetch('/api/processes/kill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid })
    });
    const result = await res.json();
    if (result.success) {
      updateProcesses();
    } else {
      alert(`Error: ${result.error}`);
    }
  } catch (error) {
    alert(`Failed to send kill signal: ${error.message}`);
  }
}

async function scanCaches() {
  const btn = DOM.btnScan;
  if (btn) {
    btn.innerText = 'Scanning...';
    btn.disabled = true;
  }

  try {
    const res = await fetch('/api/clean/scan');
    cacheData = await res.json();

    const tbody = DOM.cacheListBody;
    if (!tbody) return;
    
    const keys = Object.keys(cacheData);

    tbody.innerHTML = keys.map(key => {
      const cache = cacheData[key];
      const isChecked = selectedCaches.has(key) ? 'checked' : '';
      const formattedSize = formatBytes(cache.size);
      const displayName = key.toUpperCase();
      const statusText = cache.exists ? '' : '<span class="muted-text">(not found)</span>';
      
      return `
        <tr>
          <td>
            <input type="checkbox" class="cache-checkbox" data-key="${key}" ${isChecked} 
              ${cache.size === 0 ? 'disabled' : ''}>
          </td>
          <td><strong>${displayName}</strong> ${statusText}</td>
          <td class="path-text">${cache.path}</td>
          <td align="right"><strong>${formattedSize}</strong></td>
        </tr>
      `;
    }).join('');

    updateCacheSummary();
  } catch (error) {
    console.error('Error scanning caches:', error);
  } finally {
    if (btn) {
      btn.innerText = 'Scan Caches';
      btn.disabled = false;
    }
  }
}

function onCacheCheckboxChange(cb) {
  const key = cb.getAttribute('data-key');
  if (cb.checked) {
    selectedCaches.add(key);
  } else {
    selectedCaches.delete(key);
  }
  updateCacheSummary();
}

function toggleSelectAllCaches(headerCb) {
  const checkboxes = document.querySelectorAll('.cache-checkbox:not([disabled])');
  checkboxes.forEach(cb => {
    cb.checked = headerCb.checked;
    const key = cb.getAttribute('data-key');
    if (headerCb.checked) {
      selectedCaches.add(key);
    } else {
      selectedCaches.delete(key);
    }
  });
  updateCacheSummary();
}

function updateCacheSummary() {
  const actionsBar = DOM.cleanerActionsBar;
  const summaryText = DOM.selectedCacheSummary;
  if (!actionsBar) return;
  
  if (selectedCaches.size === 0) {
    actionsBar.style.display = 'none';
    return;
  }

  let totalSize = 0;
  selectedCaches.forEach(key => {
    if (cacheData[key]) {
      totalSize += cacheData[key].size;
    }
  });

  setText(summaryText, `Selected: ${selectedCaches.size} items (${formatBytes(totalSize)})`);
  actionsBar.style.display = 'flex';
}

async function runCleanup() {
  if (selectedCaches.size === 0) return;
  const listKeys = Array.from(selectedCaches);
  
  if (!confirm(`Are you sure you want to clean up the selected cache directories?\n\nThis will delete compiled cache/package data. The systems will recreate these automatically when needed.`)) {
    return;
  }

  const btn = DOM.btnClean;
  if (btn) {
    btn.innerText = 'Cleaning...';
    btn.disabled = true;
  }

  try {
    const res = await fetch('/api/clean/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caches: listKeys })
    });
    const result = await res.json();
    
    if (result.success) {
      alert(`Successfully cleared caches!\nCleaned: ${result.cleaned.join(', ')}`);
      selectedCaches.clear();
      if (DOM.selectAllCaches) DOM.selectAllCaches.checked = false;
      await scanCaches();
      await updateStats();
    } else {
      alert(`Cleanup errors occurred:\n${result.errors.join('\n')}`);
      await scanCaches();
    }
  } catch (error) {
    alert(`Failed to complete cleanup: ${error.message}`);
  } finally {
    if (btn) {
      btn.innerText = 'Clean Selected Caches';
      btn.disabled = false;
    }
  }
}

async function handleInfoClick(btn) {
  const name = btn.getAttribute('data-name');
  const comm = btn.getAttribute('data-comm');
  const pid = parseInt(btn.getAttribute('data-pid'), 10);
  await showProcessInfo(name, comm, pid);
}

function getSafenessAssessment(score) {
  if (score === 0) {
    return 'Critical macOS system component. Terminating this process is impossible or will crash your computer instantly.';
  } else if (score < 50) {
    return 'High-risk system process. Terminating this can lead to system instability, automatic logout, or failure of background services.';
  } else if (score < 90) {
    return 'Medium-risk process. Safe to terminate if frozen, but might interrupt specific user tasks or background sync processes.';
  } else {
    return 'Safe to terminate. User application or tool. Closing this will free up resources without affecting macOS stability.';
  }
}

async function showProcessInfo(name, comm, pid) {
  dialogTargetPid = pid;
  
  setText(DOM.infoProcName, name);
  setText(DOM.infoProcRisk, 'Loading...');
  setText(DOM.infoProcDesc, 'Fetching details...');
  setText(DOM.infoSafenessPct, '0%');
  
  const ring = DOM.infoSafenessRing;
  if (ring) {
    ring.style.strokeDashoffset = '213.6';
    ring.style.stroke = 'var(--color-text-muted)';
  }
  
  setText(DOM.infoSafenessDesc, 'Analyzing safety rating...');
  
  const terminateBtn = DOM.btnDialogTerminate;
  if (terminateBtn) terminateBtn.disabled = true;
  
  const dialog = DOM.processInfoDialog;
  if (dialog) dialog.showModal();
  
  try {
    const res = await fetch(`/api/processes/info?name=${encodeURIComponent(name)}&comm=${encodeURIComponent(comm)}`);
    if (!res.ok) throw new Error('Failed to fetch info');
    
    const info = await res.json();
    
    setText(DOM.infoProcRisk, info.risk || 'Unknown Process');
    setText(DOM.infoProcDesc, info.description || 'No description available for this process.');
    
    const safeness = typeof info.safeness === 'number' ? info.safeness : 85;
    setText(DOM.infoSafenessPct, `${safeness}%`);
    setText(DOM.infoSafenessDesc, getSafenessAssessment(safeness));
    
    let strokeColor = 'var(--color-success)';
    if (safeness < 50) {
      strokeColor = 'var(--color-danger)';
    } else if (safeness < 90) {
      strokeColor = 'var(--color-warning)';
    }
    
    if (ring) {
      ring.style.stroke = strokeColor;
      const offset = 213.6 * (1 - safeness / 100);
      setTimeout(() => {
        ring.style.strokeDashoffset = offset;
      }, 50);
    }
    
    if (terminateBtn) {
      terminateBtn.disabled = safeness === 0;
    }
  } catch (err) {
    console.error('Error fetching process info:', err);
    setText(DOM.infoProcRisk, 'Error');
    setText(DOM.infoProcDesc, 'Could not load details from the ZenMac service.');
    setText(DOM.infoSafenessDesc, 'Error retrieving safety score.');
  }
}

function closeProcessInfo() {
  if (DOM.processInfoDialog) DOM.processInfoDialog.close();
  dialogTargetPid = null;
}

async function terminateFromDialog() {
  if (!dialogTargetPid) return;
  const pid = dialogTargetPid;
  const name = DOM.infoProcName?.innerText || 'Process';
  
  if (!confirm(`Are you sure you want to terminate ${name} (PID: ${pid})?`)) return;
  
  try {
    const res = await fetch('/api/processes/kill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid })
    });
    const result = await res.json();
    if (result.success) {
      closeProcessInfo();
      updateProcesses();
    } else {
      alert(`Error: ${result.error}`);
    }
  } catch (error) {
    alert(`Failed to send kill signal: ${error.message}`);
  }
}

function updatePieChart() {
  if (!latestStats || !processData || !processData.categories) return;
  
  const total = latestStats.memory.total;
  const totalGB = total / (1024 * 1024 * 1024);
  
  const wired = latestStats.memory.wired / (1024 * 1024 * 1024);
  const compressed = latestStats.memory.compressed / (1024 * 1024 * 1024);
  const cached = latestStats.memory.inactive / (1024 * 1024 * 1024);
  const free = latestStats.memory.free / (1024 * 1024 * 1024);
  const active = latestStats.memory.active / (1024 * 1024 * 1024);
  
  const browser = (processData.categories.browser.mem / 100) * totalGB;
  const dev = (processData.categories.dev.mem / 100) * totalGB;
  const cloudSync = (processData.categories.cloudSync.mem / 100) * totalGB;
  
  const otherApps = Math.max(0, active - (browser + dev + cloudSync));
  const core = wired + compressed;
  
  const pieData = [
    { label: 'Core System', val: core, color: '#ef4444' },
    { label: 'Browser/Web', val: browser, color: '#f59e0b' },
    { label: 'IDEs & Dev', val: dev, color: '#6366f1' },
    { label: 'Cloud Sync', val: cloudSync, color: '#10b981' },
    { label: 'Other Apps', val: otherApps, color: '#8b5cf6' },
    { label: 'Cached Memory', val: cached, color: '#06b6d4' },
    { label: 'Free Memory', val: free, color: '#8a92b2' }
  ];
  
  ramPieChart.updateData(pieData);
  
  const legend = DOM.pieLegend;
  if (legend) {
    legend.innerHTML = pieData.map((item, idx) => {
      const pct = ((item.val / totalGB) * 100).toFixed(0);
      return `
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${item.color}"></div>
          <div class="legend-label">${item.label}</div>
          <div class="legend-value">${item.val.toFixed(2)} GB (${pct}%)</div>
        </div>
      `;
    }).join('');
  }
}

// Disk Usage Analyzer Functions
async function showDiskAnalyzer(targetPath = '') {
  const dialog = DOM.diskAnalyzerDialog;
  if (dialog) dialog.showModal();

  if (DOM.diskLoading) DOM.diskLoading.style.display = 'flex';
  if (DOM.diskTable) DOM.diskTable.style.opacity = '0.3';

  try {
    const url = `/api/disk/scan?path=${encodeURIComponent(targetPath)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to scan path');
    
    const data = await res.json();
    currentDiskPath = data.path;
    currentHomePath = data.home || '';

    renderDiskBreadcrumbs(data.path);
    
    const validItems = data.items.filter(item => item.size > 0 || item.isLibrary);
    const totalSize = validItems.reduce((acc, item) => acc + item.size, 0);

    renderDiskVisualBreakdown(validItems, totalSize);
    renderDiskTable(validItems, totalSize);
  } catch (error) {
    console.error('Error scanning directory:', error);
    if (DOM.diskListBody) {
      DOM.diskListBody.innerHTML = `<tr><td colspan="4" align="center" class="critical-text">Error: ${error.message}</td></tr>`;
    }
  } finally {
    if (DOM.diskLoading) DOM.diskLoading.style.display = 'none';
    if (DOM.diskTable) DOM.diskTable.style.opacity = '1';
  }
}

function renderDiskBreadcrumbs(currentPath) {
  const container = DOM.diskBreadcrumbs;
  if (!container) return;

  let html = `<span class="breadcrumb-item" data-path="${currentHomePath}">~ (Home)</span>`;
  
  if (currentPath !== currentHomePath && currentPath.startsWith(currentHomePath)) {
    const relative = currentPath.slice(currentHomePath.length).split('/').filter(Boolean);
    let currentAccumulated = currentHomePath;
    
    for (const part of relative) {
      currentAccumulated += '/' + part;
      html += ` <span class="breadcrumb-separator">></span> <span class="breadcrumb-item" data-path="${currentAccumulated}">${part}</span>`;
    }
  }
  
  container.innerHTML = html;
  
  const items = container.querySelectorAll('.breadcrumb-item');
  if (items.length > 0) {
    const last = items[items.length - 1];
    last.classList.add('active');
  }
}

function renderDiskVisualBreakdown(items, totalSize) {
  const bar = DOM.diskBreakdownBar;
  const legend = DOM.diskBreakdownLegend;
  if (!bar || !legend) return;

  bar.innerHTML = '';
  legend.innerHTML = '';

  if (items.length === 0 || totalSize === 0) {
    bar.style.display = 'none';
    legend.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  legend.style.display = 'flex';

  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
  const topItems = items.slice(0, 5);
  let accumulatedPct = 0;

  topItems.forEach((item, idx) => {
    const color = colors[idx % colors.length];
    const pct = (item.size / totalSize) * 100;
    accumulatedPct += pct;

    if (pct > 1) {
      const segment = document.createElement('div');
      segment.className = 'disk-breakdown-segment';
      segment.style.width = `${pct}%`;
      segment.style.backgroundColor = color;
      segment.title = `${item.name}: ${formatBytes(item.size)} (${pct.toFixed(1)}%)`;
      bar.appendChild(segment);
    }

    const legendItem = document.createElement('div');
    legendItem.className = 'disk-legend-item';
    legendItem.innerHTML = `
      <div class="disk-legend-dot" style="background-color: ${color}"></div>
      <span class="disk-legend-name">${item.name}</span>
      <span class="disk-legend-size">${formatBytes(item.size)} (${pct.toFixed(0)}%)</span>
    `;
    legend.appendChild(legendItem);
  });

  const remainingPct = 100 - accumulatedPct;
  if (remainingPct > 1 && items.length > 5) {
    const segment = document.createElement('div');
    segment.className = 'disk-breakdown-segment';
    segment.style.width = `${remainingPct}%`;
    segment.style.backgroundColor = '#8a92b2';
    segment.title = `Other: ${remainingPct.toFixed(1)}%`;
    bar.appendChild(segment);

    const legendItem = document.createElement('div');
    legendItem.className = 'disk-legend-item';
    legendItem.innerHTML = `
      <div class="disk-legend-dot" style="background-color: #8a92b2"></div>
      <span class="disk-legend-name">Other files</span>
      <span class="disk-legend-size">${remainingPct.toFixed(0)}%</span>
    `;
    legend.appendChild(legendItem);
  }
}

function renderDiskTable(items, totalSize) {
  const tbody = DOM.diskListBody;
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" align="center" class="muted-text">This directory is empty</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((item) => {
    const icon = item.isDirectory ? '📁' : '📄';
    const isClickable = item.isDirectory && !item.isLibrary;
    const nameClass = isClickable ? 'disk-item-name directory' : 'disk-item-name';
    
    const sizeStr = item.isLibrary ? 'System Managed' : formatBytes(item.size);
    const pct = totalSize > 0 ? (item.size / totalSize) * 100 : 0;
    
    const isProtected = item.path === currentHomePath || 
                        item.name === 'Library' ||
                        item.name === 'Desktop' ||
                        item.name === 'Documents' ||
                        item.name === 'Downloads' ||
                        item.name === 'Applications' ||
                        item.name === 'Movies' ||
                        item.name === 'Music' ||
                        item.name === 'Pictures';

    const deleteBtnHtml = isProtected 
      ? `<button class="btn-disk-action delete" disabled title="System folder cannot be deleted" style="opacity: 0.3; cursor: not-allowed;">Delete</button>`
      : `<button class="btn-disk-action delete" data-path="${escapeHtml(item.path)}" data-name="${escapeHtml(item.name)}">Delete</button>`;

    return `
      <tr>
        <td>
          <div class="${nameClass}" data-path="${escapeHtml(item.path)}">
            <span class="disk-icon">${icon}</span>
            <span>${escapeHtml(item.name)}</span>
          </div>
        </td>
        <td align="right" style="font-family: monospace; font-weight: 600;">${sizeStr}</td>
        <td>
          <div class="disk-pct-bar-container" title="${pct.toFixed(1)}%">
            <div class="disk-pct-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </td>
        <td align="center">
          <div class="disk-actions-cell">
            <button class="btn-disk-action ai" data-path="${escapeHtml(item.path)}" data-name="${escapeHtml(item.name)}">🤖 AI</button>
            <button class="btn-disk-action reveal" data-path="${escapeHtml(item.path)}">Reveal</button>
            ${deleteBtnHtml}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function revealInFinder(path) {
  try {
    const res = await fetch('/api/disk/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    if (!res.ok) throw new Error('Reveal failed');
  } catch (err) {
    alert(`Could not open path in Finder: ${err.message}`);
  }
}

async function deleteDiskItem(path, name) {
  const confirm1 = confirm(`WARNING: Are you sure you want to permanently delete "${name}"?\n\nThis will delete the file or directory and all its contents recursively. This action CANNOT be undone.`);
  if (!confirm1) return;
  
  const confirm2 = confirm(`FINAL CONFIRMATION: Click OK to delete "${name}".\nPath: ${path}`);
  if (!confirm2) return;

  try {
    const res = await fetch('/api/disk/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    const result = await res.json();
    if (result.success) {
      await showDiskAnalyzer(currentDiskPath);
      await updateStats();
    } else {
      alert(`Deletion failed: ${result.error}`);
    }
  } catch (err) {
    alert(`Failed to delete item: ${err.message}`);
  }
}

function closeDiskAnalyzer() {
  if (DOM.diskAnalyzerDialog) DOM.diskAnalyzerDialog.close();
}

// AI Analysis Functions
async function showAiAnalysis(targetPath, name) {
  const dialog = DOM.aiAnalysisDialog;
  if (dialog) dialog.showModal();

  if (DOM.aiLoading) DOM.aiLoading.style.display = 'flex';
  const resultContent = document.getElementById('ai-result-content');
  if (resultContent) resultContent.style.display = 'none';

  setText(DOM.aiFileName, name);

  try {
    const res = await fetch('/api/disk/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetPath })
    });

    if (res.status === 412) {
      const data = await res.json();
      alert(`AI key missing:\n\n${data.instructions}`);
      closeAiAnalysis();
      return;
    }

    if (!res.ok) throw new Error('AI analysis failed');

    const data = await res.json();

    setText(document.getElementById('ai-classification'), data.classification || 'Unknown');
    setText(document.getElementById('ai-purpose'), data.purpose || 'No description available.');
    setText(DOM.aiSafenessPct, `${data.safeness || 0}%`);
    setText(document.getElementById('ai-assessment'), data.assessment || 'No safety advice.');

    const ring = document.getElementById('ai-safeness-ring');
    if (ring) {
      ring.style.strokeDashoffset = '213.6';
      
      const safeness = typeof data.safeness === 'number' ? data.safeness : 85;
      let strokeColor = 'var(--color-success)';
      if (safeness < 50) {
        strokeColor = 'var(--color-danger)';
      } else if (safeness < 90) {
        strokeColor = 'var(--color-warning)';
      }
      ring.style.stroke = strokeColor;
      
      const offset = 213.6 * (1 - safeness / 100);
      setTimeout(() => {
        ring.style.strokeDashoffset = offset;
      }, 50);
    }

    if (resultContent) resultContent.style.display = 'block';
  } catch (error) {
    console.error('Error getting AI analysis:', error);
    alert(`Could not load AI analysis: ${error.message}`);
    closeAiAnalysis();
  } finally {
    if (DOM.aiLoading) DOM.aiLoading.style.display = 'none';
  }
}

function closeAiAnalysis() {
  if (DOM.aiAnalysisDialog) DOM.aiAnalysisDialog.close();
}

async function init() {
  cacheDOM();

  DOM.presetCoding?.addEventListener('click', () => setPreset('coding'));
  DOM.presetCinema?.addEventListener('click', () => setPreset('cinema'));
  DOM.presetSync?.addEventListener('click', () => setPreset('sync'));
  
  DOM.btnScan?.addEventListener('click', scanCaches);
  DOM.btnClean?.addEventListener('click', runCleanup);
  
  DOM.selectAllCaches?.addEventListener('change', (e) => toggleSelectAllCaches(e.target));
  
  DOM.tabCpu?.addEventListener('click', () => switchProcessTab('cpu'));
  DOM.tabMem?.addEventListener('click', () => switchProcessTab('mem'));
  
  document.querySelectorAll('.btn-close-dialog').forEach(btn => btn.addEventListener('click', closeProcessInfo));
  document.querySelector('.btn-close-dialog-sec')?.addEventListener('click', closeProcessInfo);
  DOM.btnDialogTerminate?.addEventListener('click', terminateFromDialog);
  
  DOM.cacheListBody?.addEventListener('change', (e) => {
    const cb = e.target.closest('.cache-checkbox');
    if (cb) {
      onCacheCheckboxChange(cb);
    }
  });
  
  DOM.processListBody?.addEventListener('click', (e) => {
    const killBtn = e.target.closest('.btn-kill');
    if (killBtn) {
      const pid = parseInt(killBtn.getAttribute('data-pid'), 10);
      killProcess(pid);
    }
    
    const infoBtn = e.target.closest('.info-bubble');
    if (infoBtn) {
      handleInfoClick(infoBtn);
    }
  });

  if (DOM.processInfoDialog && !('closedBy' in HTMLDialogElement.prototype)) {
    DOM.processInfoDialog.addEventListener('click', (event) => {
      if (event.target !== DOM.processInfoDialog) return;
      
      const rect = DOM.processInfoDialog.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      
      if (!isDialogContent) {
        closeProcessInfo();
      }
    });
  }

  // Disk Analyzer Bindings
  DOM.diskCard?.addEventListener('click', () => showDiskAnalyzer());
  DOM.btnCloseDiskDialog?.addEventListener('click', closeDiskAnalyzer);
  DOM.btnCloseDiskDialogSec?.addEventListener('click', closeDiskAnalyzer);
  
  DOM.diskBreadcrumbs?.addEventListener('click', (e) => {
    const item = e.target.closest('.breadcrumb-item');
    if (item && !item.classList.contains('active')) {
      const p = item.getAttribute('data-path') || '';
      showDiskAnalyzer(p);
    }
  });

  DOM.diskListBody?.addEventListener('click', (e) => {
    const dirItem = e.target.closest('.disk-item-name.directory');
    if (dirItem) {
      const p = dirItem.getAttribute('data-path');
      showDiskAnalyzer(p);
      return;
    }

    const revealBtn = e.target.closest('.btn-disk-action.reveal');
    if (revealBtn) {
      const p = revealBtn.getAttribute('data-path');
      revealInFinder(p);
      return;
    }

    const deleteBtn = e.target.closest('.btn-disk-action.delete');
    if (deleteBtn && !deleteBtn.disabled) {
      const p = deleteBtn.getAttribute('data-path');
      const name = deleteBtn.getAttribute('data-name');
      deleteDiskItem(p, name);
      return;
    }

    const aiBtn = e.target.closest('.btn-disk-action.ai');
    if (aiBtn) {
      const p = aiBtn.getAttribute('data-path');
      const name = aiBtn.getAttribute('data-name');
      showAiAnalysis(p, name);
      return;
    }
  });

  if (DOM.diskAnalyzerDialog && !('closedBy' in HTMLDialogElement.prototype)) {
    DOM.diskAnalyzerDialog.addEventListener('click', (event) => {
      if (event.target !== DOM.diskAnalyzerDialog) return;
      
      const rect = DOM.diskAnalyzerDialog.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      
      if (!isDialogContent) {
        closeDiskAnalyzer();
      }
    });
  }

  // AI Dialog Close Bindings
  DOM.btnCloseAiDialog?.addEventListener('click', closeAiAnalysis);
  document.getElementById('btn-close-ai-dialog-sec')?.addEventListener('click', closeAiAnalysis);

  if (DOM.aiAnalysisDialog && !('closedBy' in HTMLDialogElement.prototype)) {
    DOM.aiAnalysisDialog.addEventListener('click', (event) => {
      if (event.target !== DOM.aiAnalysisDialog) return;
      
      const rect = DOM.aiAnalysisDialog.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      
      if (!isDialogContent) {
        closeAiAnalysis();
      }
    });
  }

  await updateStats();
  await updatePresetStatus();
  await updateProcesses();
  await scanCaches();

  setInterval(updateStats, 3000);
  setInterval(updateProcesses, 4000);
  setInterval(updatePresetStatus, 8000);
}

window.onload = init;
