const { contextBridge, ipcRenderer, webUtils } = require('electron');

const subscribe = (channel, callback) => {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('moduDesktop', Object.freeze({
  platform: process.platform,
  openFiles: () => ipcRenderer.invoke('modu:open'),
  openFolder: () => ipcRenderer.invoke('modu:open-folder'),
  openFolderFile: targetPath => ipcRenderer.invoke('modu:open-folder-file', targetPath),
  openLinked: (sourceId, href) => ipcRenderer.invoke('modu:open-linked', sourceId, href),
  closeFile: id => ipcRenderer.invoke('modu:close-file', id),
  ready: () => ipcRenderer.invoke('modu:ready'),
  reloadFile: id => ipcRenderer.invoke('modu:reload', id),
  setLiveWatch: enabled => ipcRenderer.invoke('modu:live-watch', enabled),
  setAlwaysOnTop: enabled => ipcRenderer.invoke('modu:pin', enabled),
  exportPdf: suggestedName => ipcRenderer.invoke('modu:export-pdf', suggestedName),
  onDocuments: callback => subscribe('modu:documents', callback),
  onDocumentUpdated: callback => subscribe('modu:document-updated', callback),
  onAction: callback => subscribe('modu:action', callback),
  onError: callback => subscribe('modu:error', callback),
}));

// Only a real OS file drop may provide paths; no arbitrary filesystem IPC is
// exposed through the renderer bridge.
window.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); }, true);
window.addEventListener('drop', event => {
  if (!event.isTrusted || !event.dataTransfer?.files.length) return;
  event.preventDefault();
  const paths = [...event.dataTransfer.files].filter(file => /\.(md|markdown|mdown|txt)$/i.test(file.name)).slice(0, 50).map(file => webUtils.getPathForFile(file)).filter(Boolean);
  if (paths.length) void ipcRenderer.invoke('modu:drop', paths).catch(() => {});
}, true);
