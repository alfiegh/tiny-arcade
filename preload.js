const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tinyArcade', {
  isElectron: true,
  quit: () => ipcRenderer.send('quit'),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
});
