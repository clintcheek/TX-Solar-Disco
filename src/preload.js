const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  runExtraction: (opts) => ipcRenderer.invoke('run-extraction', opts),
  onProgress: (callback) => ipcRenderer.on('progress', (_event, value) => callback(value))
});
