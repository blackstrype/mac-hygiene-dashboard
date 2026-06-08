import path from 'path';
import os from 'os';

export const home = os.homedir();

export const CACHE_PATHS = {
  homebrew: path.join(home, 'Library/Caches/Homebrew'),
  npm: path.join(home, '.npm'),
  pip: path.join(home, 'Library/Caches/pip'),
  yarn: path.join(home, 'Library/Caches/Yarn'),
  cocoapods: path.join(home, 'Library/Caches/CocoaPods'),
  xcode: path.join(home, 'Library/Developer/Xcode/DerivedData'),
  vscode_shipit: path.join(home, 'Library/Caches/com.microsoft.VSCode.ShipIt'),
  jetbrains: path.join(home, 'Library/Caches/JetBrains')
};

export const APP_PATHS = {
  googleDrive: '/Applications/Google Drive.app',
  oneDrive: '/Applications/OneDrive.app'
};
