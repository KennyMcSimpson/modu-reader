const { contextBridge, ipcRenderer, webUtils } = require('electron');

const subscribe = (channel, callback) => {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('inkglassDesktop', Object.freeze({
  platform: process.platform,
  openFiles: () => ipcRenderer.invoke('inkglass:open'),
  openFolder: () => ipcRenderer.invoke('inkglass:open-folder'),
  refreshFolder: () => ipcRenderer.invoke('inkglass:refresh-folder'),
  closeFolder: () => ipcRenderer.invoke('inkglass:close-folder'),
  openFolderFile: targetPath => ipcRenderer.invoke('inkglass:open-folder-file', targetPath),
  openLinked: (sourceId, href) => ipcRenderer.invoke('inkglass:open-linked', sourceId, href),
  getRecent: () => ipcRenderer.invoke('inkglass:recent'),
  openRecent: targetPath => ipcRenderer.invoke('inkglass:open-recent', targetPath),
  closeFile: id => ipcRenderer.invoke('inkglass:close-file', id),
  ready: () => ipcRenderer.invoke('inkglass:ready'),
  reloadFile: id => ipcRenderer.invoke('inkglass:reload', id),
  setLiveWatch: enabled => ipcRenderer.invoke('inkglass:live-watch', enabled),
  setAlwaysOnTop: enabled => ipcRenderer.invoke('inkglass:pin', enabled),
  exportPdf: suggestedName => ipcRenderer.invoke('inkglass:export-pdf', suggestedName),
  onDocuments: callback => subscribe('inkglass:documents', callback),
  onDocumentUpdated: callback => subscribe('inkglass:document-updated', callback),
  onAction: callback => subscribe('inkglass:action', callback),
  onError: callback => subscribe('inkglass:error', callback),
}));

// Only a real OS file drop may provide paths; no arbitrary filesystem IPC is
// exposed through the renderer bridge.
window.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); }, true);
window.addEventListener('drop', event => {
  if (!event.isTrusted || !event.dataTransfer?.files.length) return;
  event.preventDefault();
  const paths = [...event.dataTransfer.files].filter(file => /\.(md|markdown|mdown|txt)$/i.test(file.name)).slice(0, 50).map(file => webUtils.getPathForFile(file)).filter(Boolean);
  if (paths.length) void ipcRenderer.invoke('inkglass:drop', paths).catch(() => {});
}, true);
