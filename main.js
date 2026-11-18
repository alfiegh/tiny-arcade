// Tiny Arcade — Electron main process
const { app, BrowserWindow, Menu, ipcMain, powerSaveBlocker } = require('electron');
const path = require('path');

const windowed = process.argv.includes('--windowed');
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: !windowed,
    backgroundColor: '#1b1440',
    title: 'Tiny Arcade',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      // Gamepad presses don't count as a "user gesture" for audio, so let sound start straight away
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

// A tiny menu so parents keep Cmd+Q / fullscreen shortcuts even in fullscreen
Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'Tiny Arcade', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] },
  { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'reload' }, { role: 'toggleDevTools' }] },
]));

ipcMain.on('quit', () => app.quit());
ipcMain.on('toggle-fullscreen', () => win && win.setFullScreen(!win.isFullScreen()));

app.whenReady().then(() => {
  powerSaveBlocker.start('prevent-display-sleep'); // no screen dimming mid-game
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
