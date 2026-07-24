const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('localRunnerDesktop', {
  getState: () => ipcRenderer.invoke('runner:get-state'),
  start: () => ipcRenderer.invoke('runner:start'),
  stop: () => ipcRenderer.invoke('runner:stop'),
  saveConfig: (config) => ipcRenderer.invoke('runner:save-config', config),
  connectPlatform: () => ipcRenderer.invoke('runner:connect-platform'),
  disconnectPlatform: () => ipcRenderer.invoke('runner:disconnect-platform'),
  openLogs: () => ipcRenderer.invoke('runner:open-logs'),
  onState: (callback) => {
    const listener = (_, state) => callback(state);
    ipcRenderer.on('runner:state', listener);
    return () => ipcRenderer.off('runner:state', listener);
  },
});
