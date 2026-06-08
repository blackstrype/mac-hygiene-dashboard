export const PROCESS_DIRECTORY = {
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
    risk: 'User Application/Runtime'
  },
  'python3': {
    description: 'Python 3 interpreter. Runs scripts or local tools. Safe to terminate, which will stop the active script execution.',
    safeness: 95,
    risk: 'User Application/Runtime'
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
