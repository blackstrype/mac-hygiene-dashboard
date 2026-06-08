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

// Initialize Charts
const cpuChart = new MiniChart('cpu-chart', 30, '#6366f1', 'percent');
const ramChart = new MiniChart('ram-chart', 30, '#8b5cf6', 'ram');
const swapChart = new MiniChart('swap-chart', 30, '#ec4899', 'swap');
const ramPieChart = new PieChart('ram-pie-chart');

// Fetch System Stats
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    latestStats = data;

    // 1. CPU
    const cpuTotal = Math.round(data.cpu.user + data.cpu.system);
    document.getElementById('cpu-total-val').innerText = `${cpuTotal}%`;
    document.getElementById('cpu-gauge-fill').style.width = `${cpuTotal}%`;
    document.getElementById('load-1m').innerText = data.cpu.loadAvg[0].toFixed(2);
    document.getElementById('load-5m').innerText = data.cpu.loadAvg[1].toFixed(2);
    document.getElementById('load-15m').innerText = data.cpu.loadAvg[2].toFixed(2);
    cpuChart.addData(cpuTotal);

    // 2. RAM
    const ramPct = Math.round((data.memory.used / data.memory.total) * 100);
    document.getElementById('ram-pct-val').innerText = `${ramPct}%`;
    document.getElementById('ram-gauge-fill').style.width = `${ramPct}%`;
    
    // Set chart total RAM dynamically
    const totalRAM_GB = data.memory.total / (1024 * 1024 * 1024);
    ramChart.totalRamGB = totalRAM_GB;

    document.getElementById('ram-active').innerText = formatGB(data.memory.active);
    document.getElementById('ram-wired').innerText = formatGB(data.memory.wired);
    document.getElementById('ram-compressed').innerText = formatGB(data.memory.compressed);
    document.getElementById('ram-cached').innerText = formatGB(data.memory.inactive);
    document.getElementById('ram-free').innerText = formatGB(data.memory.free);
    ramChart.addData(ramPct);

    // 3. Swap
    const swapGB = data.swap.used / (1024 * 1024 * 1024);
    document.getElementById('swap-val').innerText = `${swapGB.toFixed(2)} GB`;
    
    const swapMax = Math.max(data.swap.total, 1024 * 1024 * 1024); // at least 1GB for scale
    const swapPct = Math.round((data.swap.used / swapMax) * 100);
    document.getElementById('swap-gauge-fill').style.width = `${swapPct}%`;
    
    const swapWarning = document.getElementById('swap-warning');
    if (swapGB > 0.5) {
      swapWarning.style.display = 'flex';
    } else {
      swapWarning.style.display = 'none';
    }
    swapChart.addData(swapGB);

    // 4. Disk
    document.getElementById('disk-pct-val').innerText = `${data.disk.percentage}%`;
    const diskProgress = document.getElementById('disk-progress-fill');
    diskProgress.style.width = `${data.disk.percentage}%`;
    
    if (data.disk.percentage >= 90) {
      diskProgress.classList.add('warning');
      document.getElementById('disk-pct-val').classList.add('danger');
      document.getElementById('disk-free').classList.add('critical-text');
      document.getElementById('disk-alert-box').style.display = 'flex';
    } else {
      diskProgress.classList.remove('warning');
      document.getElementById('disk-pct-val').classList.remove('danger');
      document.getElementById('disk-free').classList.remove('critical-text');
      document.getElementById('disk-alert-box').style.display = 'none';
    }
    
    document.getElementById('disk-used').innerText = formatBytes(data.disk.used);
    document.getElementById('disk-free').innerText = formatBytes(data.disk.free);
    document.getElementById('disk-total').innerText = formatBytes(data.disk.total);

    // 5. Battery
    document.getElementById('battery-pct-val').innerText = `${data.battery.percentage}%`;
    document.getElementById('battery-condition').innerText = data.battery.condition;
    document.getElementById('battery-capacity').innerText = `${data.battery.maxCapacity}%`;
    document.getElementById('battery-cycles').innerText = data.battery.cycleCount;
    document.getElementById('battery-charging-status').innerText = data.battery.isCharging ? 'Charging' : 'On Battery';

    updatePieChart();
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
}

// Fetch Sync Preset Statuses
async function fetchPresetStatus() {
  try {
    const res = await fetch('/api/focus/status');
    const status = await res.json();

    const google = status.googleDrive;
    const one = status.oneDrive;

    const activeText = document.getElementById('active-preset-text');
    const badge = document.getElementById('current-preset-badge');

    // Remove old classes
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));

    if ((google.installed && google.running) || (one.installed && one.running)) {
      activePreset = 'sync';
      activeText.innerText = 'Sync Active';
      badge.style.color = 'var(--color-success)';
      badge.style.background = 'rgba(16, 185, 129, 0.1)';
      badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      const btn = document.getElementById('preset-sync');
      if (btn) btn.classList.add('active');
    } else {
      // Both are stopped (or not installed)
      activePreset = 'coding';
      activeText.innerText = 'Zen Focus Active';
      badge.style.color = 'var(--accent-primary)';
      badge.style.background = 'rgba(99, 102, 241, 0.1)';
      badge.style.borderColor = 'var(--border-color-active)';
      const btn = document.getElementById('preset-coding');
      if (btn) btn.classList.add('active');
    }
  } catch (error) {
    console.error('Error checking preset status:', error);
  }
}

// Trigger Preset change
async function setPreset(preset) {
  try {
    // Optimistic UI change
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`preset-${preset}`);
    if (btn) btn.classList.add('active');

    const res = await fetch('/api/focus/preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset })
    });
    
    await res.json();
    setTimeout(fetchPresetStatus, 800); // give macOS process a moment to launch/stop
  } catch (error) {
    console.error('Error setting preset:', error);
  }
}

// Fetch Processes
async function fetchProcesses() {
  try {
    const res = await fetch('/api/processes');
    processData = await res.json();

    // Update categories
    document.getElementById('cat-sync-cpu').innerText = `${processData.categories.cloudSync.cpu}%`;
    document.getElementById('cat-sync-mem').innerText = `${processData.categories.cloudSync.mem}%`;
    
    document.getElementById('cat-browser-cpu').innerText = `${processData.categories.browser.cpu}%`;
    document.getElementById('cat-browser-mem').innerText = `${processData.categories.browser.mem}%`;
    
    document.getElementById('cat-dev-cpu').innerText = `${processData.categories.dev.cpu}%`;
    document.getElementById('cat-dev-mem').innerText = `${processData.categories.dev.mem}%`;

    // Render list
    renderProcessList();
    updatePieChart();
  } catch (error) {
    console.error('Error fetching processes:', error);
  }
}

// Render Process Table
function renderProcessList() {
  const tbody = document.getElementById('process-list-body');
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

// Switch Process active tab
function switchProcessTab(tab) {
  activeProcessTab = tab;
  document.getElementById('tab-cpu').classList.toggle('active', tab === 'cpu');
  document.getElementById('tab-mem').classList.toggle('active', tab === 'mem');
  renderProcessList();
}

// Kill specific process
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
      fetchProcesses();
    } else {
      alert(`Error: ${result.error}`);
    }
  } catch (error) {
    alert(`Failed to send kill signal: ${error.message}`);
  }
}

// Scan Caches
async function scanCaches() {
  const btn = document.getElementById('btn-scan');
  btn.innerText = 'Scanning...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/clean/scan');
    cacheData = await res.json();

    const tbody = document.getElementById('cache-list-body');
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

    // Show/hide clean actions bar based on scan
    updateCacheSummary();
  } catch (error) {
    console.error('Error scanning caches:', error);
  } finally {
    btn.innerText = 'Scan Caches';
    btn.disabled = false;
  }
}

// Cache checkbox handlers
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
  const actionsBar = document.getElementById('cleaner-actions-bar');
  const summaryText = document.getElementById('selected-cache-summary');
  
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

  summaryText.innerText = `Selected: ${selectedCaches.size} items (${formatBytes(totalSize)})`;
  actionsBar.style.display = 'flex';
}

// Clean selected caches
async function runCleanup() {
  if (selectedCaches.size === 0) return;
  const listKeys = Array.from(selectedCaches);
  
  if (!confirm(`Are you sure you want to clean up the selected cache directories?\n\nThis will delete compiled cache/package data. The systems will recreate these automatically when needed.`)) {
    return;
  }

  const btn = document.getElementById('btn-clean');
  btn.innerText = 'Cleaning...';
  btn.disabled = true;

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
      document.getElementById('select-all-caches').checked = false;
      await scanCaches();
      await fetchStats(); // Refresh disk space
    } else {
      alert(`Cleanup errors occurred:\n${result.errors.join('\n')}`);
      await scanCaches();
    }
  } catch (error) {
    alert(`Failed to complete cleanup: ${error.message}`);
  } finally {
    btn.innerText = 'Clean Selected Caches';
    btn.disabled = false;
  }
}

// Dialog / Information Modal Logic
let dialogTargetPid = null;

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
  
  // Set dialog UI to loading state
  document.getElementById('info-proc-name').innerText = name;
  document.getElementById('info-proc-risk').innerText = 'Loading...';
  document.getElementById('info-proc-desc').innerText = 'Fetching details...';
  document.getElementById('info-safeness-pct').innerText = '0%';
  
  const ring = document.getElementById('info-safeness-ring');
  ring.style.strokeDashoffset = '213.6';
  ring.style.stroke = 'var(--color-text-muted)';
  
  document.getElementById('info-safeness-desc').innerText = 'Analyzing safety rating...';
  
  const terminateBtn = document.getElementById('btn-dialog-terminate');
  terminateBtn.disabled = true;
  
  // Open dialog modal
  const dialog = document.getElementById('process-info-dialog');
  dialog.showModal();
  
  try {
    const res = await fetch(`/api/processes/info?name=${encodeURIComponent(name)}&comm=${encodeURIComponent(comm)}`);
    if (!res.ok) throw new Error('Failed to fetch info');
    
    const info = await res.json();
    
    // Populate details
    document.getElementById('info-proc-risk').innerText = info.risk || 'Unknown Process';
    document.getElementById('info-proc-desc').innerText = info.description || 'No description available for this process.';
    
    const safeness = typeof info.safeness === 'number' ? info.safeness : 85;
    document.getElementById('info-safeness-pct').innerText = `${safeness}%`;
    
    // Safety assessment text
    document.getElementById('info-safeness-desc').innerText = getSafenessAssessment(safeness);
    
    // Determine stroke color
    let strokeColor = 'var(--color-success)';
    if (safeness < 50) {
      strokeColor = 'var(--color-danger)';
    } else if (safeness < 90) {
      strokeColor = 'var(--color-warning)';
    }
    
    ring.style.stroke = strokeColor;
    const offset = 213.6 * (1 - safeness / 100);
    // Force a minor delay or reflow for CSS transitions to work perfectly
    setTimeout(() => {
      ring.style.strokeDashoffset = offset;
    }, 50);
    
    // Enable terminate button if it is not 0% safeness
    if (safeness > 0) {
      terminateBtn.disabled = false;
    } else {
      terminateBtn.disabled = true;
    }
  } catch (err) {
    console.error('Error fetching process info:', err);
    document.getElementById('info-proc-risk').innerText = 'Error';
    document.getElementById('info-proc-desc').innerText = 'Could not load details from the ZenMac service.';
    document.getElementById('info-safeness-desc').innerText = 'Error retrieving safety score.';
  }
}

function closeProcessInfo() {
  const dialog = document.getElementById('process-info-dialog');
  dialog.close();
  dialogTargetPid = null;
}

async function terminateFromDialog() {
  if (!dialogTargetPid) return;
  const pid = dialogTargetPid;
  const name = document.getElementById('info-proc-name').innerText;
  
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
      fetchProcesses();
    } else {
      alert(`Error: ${result.error}`);
    }
  } catch (error) {
    alert(`Failed to send kill signal: ${error.message}`);
  }
}

// Light dismiss fallback for older browsers without closedby support
const infoDialog = document.getElementById('process-info-dialog');
if (infoDialog && !('closedBy' in HTMLDialogElement.prototype)) {
  infoDialog.addEventListener('click', (event) => {
    if (event.target !== infoDialog) return;
    
    const rect = infoDialog.getBoundingClientRect();
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

// Update memory allocation donut chart
function updatePieChart() {
  if (!latestStats || !processData || !processData.categories) return;
  
  const total = latestStats.memory.total;
  const totalGB = total / (1024 * 1024 * 1024);
  
  const wired = latestStats.memory.wired / (1024 * 1024 * 1024);
  const compressed = latestStats.memory.compressed / (1024 * 1024 * 1024);
  const cached = latestStats.memory.inactive / (1024 * 1024 * 1024);
  const free = latestStats.memory.free / (1024 * 1024 * 1024);
  const active = latestStats.memory.active / (1024 * 1024 * 1024);
  
  // Categories mem values are percentages of total RAM
  const browser = (processData.categories.browser.mem / 100) * totalGB;
  const dev = (processData.categories.dev.mem / 100) * totalGB;
  const cloudSync = (processData.categories.cloudSync.mem / 100) * totalGB;
  
  // Other apps is whatever is left of active memory
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
  
  // Render Pie Chart
  ramPieChart.updateData(pieData);
  
  // Render Legend
  const legend = document.getElementById('pie-legend');
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

// Initialize Polling & Bind Dynamic Events
async function init() {
  // Static event bindings
  document.getElementById('preset-coding').addEventListener('click', () => setPreset('coding'));
  document.getElementById('preset-cinema').addEventListener('click', () => setPreset('cinema'));
  document.getElementById('preset-sync').addEventListener('click', () => setPreset('sync'));
  
  document.getElementById('btn-scan').addEventListener('click', scanCaches);
  document.getElementById('btn-clean').addEventListener('click', runCleanup);
  
  document.getElementById('select-all-caches').addEventListener('change', (e) => toggleSelectAllCaches(e.target));
  
  document.getElementById('tab-cpu').addEventListener('click', () => switchProcessTab('cpu'));
  document.getElementById('tab-mem').addEventListener('click', () => switchProcessTab('mem'));
  
  // Dialog bindings
  document.querySelectorAll('.btn-close-dialog').forEach(btn => btn.addEventListener('click', closeProcessInfo));
  document.querySelector('.btn-close-dialog-sec').addEventListener('click', closeProcessInfo);
  document.getElementById('btn-dialog-terminate').addEventListener('click', terminateFromDialog);
  
  // Event Delegation for cache list body (checkboxes)
  document.getElementById('cache-list-body').addEventListener('change', (e) => {
    const cb = e.target.closest('.cache-checkbox');
    if (cb) {
      onCacheCheckboxChange(cb);
    }
  });
  
  // Event Delegation for process list body (terminate & info buttons)
  document.getElementById('process-list-body').addEventListener('click', (e) => {
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

  await fetchStats();
  await fetchPresetStatus();
  await fetchProcesses();
  
  // Scan caches automatically on load
  await scanCaches();

  // Setup loop
  setInterval(fetchStats, 3000);
  setInterval(fetchProcesses, 4000);
  setInterval(fetchPresetStatus, 8000);
}

// Start
window.onload = init;
