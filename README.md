# ZenMac: M1 Hygiene & Performance Dashboard

ZenMac is a lightweight local dashboard and control center designed specifically for macOS M1 developers to maintain excellent hardware, memory, and storage hygiene. It helps ensure your Mac runs optimally, extends SSD lifespan (by warning on and minimizing swap usage), and helps reclaim precious storage space (especially critical if your disk is near capacity).

---

## Key Features

1. **Focus Presets (Sync Toggle)**:
   - **Zen Coding Mode**: Temporarily suspends Google Drive and Microsoft OneDrive background processes. Frees up active CPU cycles and RAM to keep your IDE and development environment fast.
   - **Cinema Mode**: Suspends cloud sync services so you can stream movies with zero background stutter.
   - **Sync & Idle**: Launches/resumes your cloud drives to sync backups once you are done working or watching.

2. **Real-time Hardware Monitors**:
   - **CPU Load & load averages**: Highlighting total core usage.
   - **RAM Breakdown**: Real-time display of active, wired, compressed, and free RAM.
   - **Swap Usage**: Monitored closely to reduce excessive SSD write cycles (a key wear factor for M1 Macs).
   - **Battery Health**: Tracks Maximum Capacity %, battery cycle counts, current charge, and health condition.
   - **Disk Storage Alert**: Triggers a persistent critical alert if storage is near capacity (e.g. >90%), which limits swap operations.

3. **Developer Cache Cleaner**:
   - Scans common package and compiler cache directories:
     - **Homebrew Cache** (`~/Library/Caches/Homebrew`)
     - **npm Cache** (`~/.npm`)
     - **pip Cache** (`~/Library/Caches/pip`)
     - **Yarn Cache** (`~/Library/Caches/Yarn`)
     - **CocoaPods Cache** (`~/Library/Caches/CocoaPods`)
     - **Xcode DerivedData** (`~/Library/Developer/Xcode/DerivedData`)
     - **VS Code ShipIt Updater Cache** (`~/Library/Caches/com.microsoft.VSCode.ShipIt`)
     - **JetBrains System Cache** (`~/Library/Caches/JetBrains`)
   - Allows safe, one-click cleaning of selected caches, easily freeing up **10GB+** of disk space!

4. **Process Hygiene Inspector**:
   - Lists top CPU or RAM consuming processes.
   - Summarizes resource usage by categories: Cloud Sync, Browsers & Streaming, IDEs & Dev Tools.
   - Let's you force-terminate (kill) unresponsive or heavy processes directly from the browser.

---

## System Requirements

- macOS (optimized for Apple Silicon M1)
- Node.js (v16+)
- Google Drive or Microsoft OneDrive (optional, to utilize preset toggling)

---

## Getting Started

### 1. Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/blackstrype/mac-hygiene-dashboard.git
cd mac-hygiene-dashboard
npm install
```

### 2. Start the Server

Start the local Express server:

```bash
npm start
```

### 3. Open the Dashboard

Open your browser and navigate to:
[http://localhost:3000](http://localhost:3000)
