const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, shell, screen } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const {
  readDocument, resolveImage, resolveLinkedDocument, listFolderDocuments,
  createFileWatcher, migrateLegacyState, fileArguments, externalUrl, isInside,
} = require('./files.cjs');

const APP_ID = 'io.github.kennymcsimpson.inkglass';
const indexFile = path.join(__dirname, '../dist/desktop/index.html');
const indexURL = pathToFileURL(indexFile).href;
const icon = path.join(__dirname, 'assets/icon.png');
const TEST_USER_DATA = process.env.INKGLASS_TEST_USER_DATA || process.env.MODU_TEST_USER_DATA || '';
let win;
let state = { recent: [], window: { width: 1260, height: 850 }, liveWatch: true, alwaysOnTop: false };
let stateFile;
let pending = [];
let pendingErrors = [];
let rendererReady = false;
let writeQueue = Promise.resolve();
let openingQueue = Promise.resolve();
let activeFolderRoot = null;
const documents = new Map();
const byPath = new Map();
const watchers = new Map();

app.setName('Inkglass');
app.setAppUserModelId(APP_ID);
if (!app.isPackaged && process.env.NODE_ENV === 'test' && TEST_USER_DATA) app.setPath('userData', TEST_USER_DATA);
protocol.registerSchemesAsPrivileged([{ scheme: 'inkglass-media', privileges: { secure: true, standard: true, supportFetchAPI: true } }]);

function saveState() {
  const data = JSON.stringify(state, null, 2);
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    if (!stateFile) return;
    await fs.mkdir(path.dirname(stateFile), { recursive: true });
    await fs.writeFile(stateFile + '.tmp', data);
    await fs.rename(stateFile + '.tmp', stateFile);
  }).catch(() => {});
}
function send(channel, payload) { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); }
function report(error) { const message = error instanceof Error ? error.message : String(error); if (rendererReady) send('inkglass:error', message); else pendingErrors.push(message); }
function deliver(batch) { if (rendererReady) send('inkglass:documents', batch); else pending.push(...batch); }

function setNativeAlwaysOnTop(enabled) {
  if (!win || win.isDestroyed()) return;
  // Electron's default Windows "floating" level is not reported as always-on-top
  // by current desktop builds. The torn-off level maps to the native topmost style.
  if (process.platform === 'win32' && enabled) win.setAlwaysOnTop(true, 'torn-off');
  else win.setAlwaysOnTop(enabled === true);
}

function stopWatcher(id) {
  const existing = watchers.get(id);
  if (existing) { existing.close(); watchers.delete(id); }
}
function stopAllWatchers() {
  for (const w of watchers.values()) w.close();
  watchers.clear();
}
function ensureWatcher(id, filePath, initialContent) {
  stopWatcher(id);
  if (!state.liveWatch || !documents.has(id)) return;
  const watcher = createFileWatcher(filePath, initialContent, updated => {
    send('inkglass:document-updated', { id, ...updated, watched: true });
  });
  watchers.set(id, watcher);
}

function queueOpen(paths, fragment = '') {
  openingQueue = openingQueue.catch(() => {}).then(async () => {
    const batch = [];
    for (const filename of paths.slice(0, 50)) {
      try {
        const data = await readDocument(filename);
        const id = byPath.get(data.path) || randomUUID();
        byPath.set(data.path, id);
        documents.set(id, data.path);
        ensureWatcher(id, data.path, data.content);
        batch.push({ id, ...data, ...(fragment ? { fragment } : {}) });
        state.recent = [data.path, ...state.recent.filter(p => p !== data.path)].slice(0, 15);
        app.addRecentDocument(data.path);
      } catch (error) { report(error); }
    }
    if (batch.length) { saveState(); buildMenu(); deliver(batch); }
  });
  return openingQueue;
}

async function openDialog() {
  const selected = await dialog.showOpenDialog(win, {
    title: 'Open Markdown',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Markdown & Text', extensions: ['md', 'markdown', 'mdown', 'txt'] }],
  });
  if (!selected.canceled) await queueOpen(selected.filePaths);
}

async function openFolderDialog() {
  const selected = await dialog.showOpenDialog(win, {
    title: 'Open Folder (Read-Only)',
    properties: ['openDirectory'],
  });
  if (selected.canceled || !selected.filePaths[0]) return null;
  const listing = await listFolderDocuments(selected.filePaths[0]);
  activeFolderRoot = listing.root;
  return listing;
}

async function exportPdfDialog(suggestedName = 'document.pdf') {
  if (!win || win.isDestroyed()) return { canceled: true };
  const safeBase = String(suggestedName || 'document').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.(md|markdown|mdown|txt)$/i, '');
  const selected = await dialog.showSaveDialog(win, {
    title: 'Export PDF',
    defaultPath: (safeBase || 'document') + '.pdf',
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  });
  if (selected.canceled || !selected.filePath) return { canceled: true };
  const pdfBuffer = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
  await fs.writeFile(selected.filePath, pdfBuffer);
  return { ok: true, path: selected.filePath };
}

function trusted(event) {
  if (!win || event.sender !== win.webContents || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url.split('#')[0] !== indexURL) throw new Error('Untrusted sender');
}
function handle(channel, callback) { ipcMain.handle(channel, async (event, ...args) => { trusted(event); return callback(...args); }); }
function focusWindow() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }

function buildMenu() {
  const action = name => () => send('inkglass:action', name);
  const recents = state.recent.map(filename => ({ label: path.basename(filename).replaceAll('&', '&&'), sublabel: path.dirname(filename), click: () => queueOpen([filename]) }));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '&File', submenu: [
      { id: 'open', label: 'Open Documents…', accelerator: 'CmdOrCtrl+O', click: openDialog },
      { id: 'open-folder', label: 'Open Folder (Read-Only)…', accelerator: 'CmdOrCtrl+Shift+O', click: action('open-folder') },
      { label: 'Open Recent', submenu: [...recents, { type: 'separator' }, { label: 'Clear Recent Files', enabled: !!recents.length, click: () => { state.recent = []; app.clearRecentDocuments(); saveState(); buildMenu(); } }] },
      { label: 'Paste Markdown…', accelerator: 'CmdOrCtrl+Shift+V', click: action('paste') },
      { id: 'reload-document', label: 'Reload Current File', accelerator: 'F5', click: action('reload') },
      { id: 'export-pdf', label: 'Export PDF…', accelerator: 'CmdOrCtrl+P', click: action('export-pdf') },
      { label: 'Close Document', accelerator: 'CmdOrCtrl+W', click: action('close') },
      { type: 'separator' }, { role: 'quit', label: 'Quit' },
    ] },
    { label: '&Edit', submenu: [
      { role: 'undo', label: 'Undo' }, { role: 'redo', label: 'Redo' }, { type: 'separator' },
      { role: 'cut', label: 'Cut' }, { role: 'copy', label: 'Copy' },
      { id: 'copy-citation', label: 'Copy Quote with Citation', accelerator: 'CmdOrCtrl+Shift+C', click: action('copy-citation') },
      { role: 'paste', label: 'Paste' }, { role: 'selectAll', label: 'Select All' },
      { type: 'separator' },
      { id: 'find', label: 'Find…', accelerator: 'CmdOrCtrl+F', click: action('find') },
      { id: 'quick-jump', label: 'Quick Jump…', accelerator: 'CmdOrCtrl+K', click: action('quick-jump') },
    ] },
    { label: '&View', submenu: [
      { id: 'live-watch', label: 'Live Watch External Changes', type: 'checkbox', checked: state.liveWatch, click: item => {
        state.liveWatch = item.checked;
        saveState();
        if (!state.liveWatch) stopAllWatchers();
        else { for (const [id, filePath] of documents.entries()) { void readDocument(filePath).then(d => ensureWatcher(id, filePath, d.content)).catch(() => {}); } }
        send('inkglass:action', state.liveWatch ? 'watch-on' : 'watch-off');
      } },
      { id: 'always-on-top', label: 'Always on Top', type: 'checkbox', checked: state.alwaysOnTop, accelerator: 'CmdOrCtrl+Shift+T', click: item => {
        state.alwaysOnTop = item.checked;
        setNativeAlwaysOnTop(state.alwaysOnTop);
        saveState();
        send('inkglass:action', state.alwaysOnTop ? 'pin-on' : 'pin-off');
      } },
      { label: 'Focus Mode', accelerator: 'CmdOrCtrl+Shift+F', click: action('focus') },
      { role: 'togglefullscreen', label: 'Fullscreen' }, { type: 'separator' },
      { role: 'resetZoom', label: 'Reset Zoom' }, { role: 'zoomIn', label: 'Zoom In' }, { role: 'zoomOut', label: 'Zoom Out' },
    ] },
    { label: '&Help', submenu: [
      { label: 'GitHub', click: () => shell.openExternal('https://github.com/KennyMcSimpson/Inkglass') },
      { label: 'About Inkglass', click: () => dialog.showMessageBox(win, { type: 'info', title: 'Inkglass', message: `Inkglass ${app.getVersion()}`, detail: 'A calm, offline Windows Markdown reader built for living AI, research, and repository docs.\nRead-only by design — your source files are never modified.\nThird-party licenses are in the application\'s THIRD_PARTY_NOTICES folder.' }) },
    ] },
  ]));
}

async function createWindow() {
  let bounds = state.window;
  const validPosition = Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && screen.getAllDisplays().some(({ workArea: a }) => bounds.x + bounds.width > a.x && bounds.x < a.x + a.width && bounds.y + bounds.height > a.y && bounds.y < a.y + a.height);
  win = new BrowserWindow({
    width: Math.max(860, Math.min(bounds.width || 1260, 2400)), height: Math.max(580, Math.min(bounds.height || 850, 1800)),
    ...(validPosition ? { x: bounds.x, y: bounds.y } : {}), minWidth: 720, minHeight: 540,
    title: 'Inkglass', backgroundColor: '#ffffff', icon, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: false },
  });
  setNativeAlwaysOnTop(state.alwaysOnTop);
  win.webContents.setWindowOpenHandler(({ url }) => { const safe = externalUrl(url); if (safe) void shell.openExternal(safe).catch(report); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => { if (url.split('#')[0] !== indexURL) { event.preventDefault(); const safe = externalUrl(url); if (safe) void shell.openExternal(safe).catch(report); } });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  win.webContents.on('did-start-loading', () => { rendererReady = false; });
  win.webContents.on('render-process-gone', (_event, details) => { if (details.reason !== 'clean-exit') void dialog.showMessageBox({ type: 'error', message: 'Reader stopped unexpectedly', detail: 'Restart Inkglass. Your original files have not been changed.' }); });
  win.on('close', () => { state.window = { ...win.getNormalBounds(), maximized: win.isMaximized() }; saveState(); });
  win.on('closed', () => { win = null; rendererReady = false; });
  win.once('ready-to-show', () => { if (state.window.maximized) win.maximize(); win.show(); });
  await win.loadFile(indexFile);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event, argv, cwd) => { void queueOpen(fileArguments(argv.slice(1), cwd)); focusWindow(); });
  app.on('open-file', (event, filename) => { event.preventDefault(); void queueOpen([filename]); });
  app.whenReady().then(async () => {
    const userDataDir = app.getPath('userData');
    if (!TEST_USER_DATA) {
      try {
        await migrateLegacyState(path.join(app.getPath('appData'), 'MoDu Reader'), userDataDir);
      } catch {}
    }
    stateFile = path.join(userDataDir, 'desktop-state.json');
    try {
      const saved = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      state = {
        recent: Array.isArray(saved.recent) ? saved.recent.filter(p => typeof p === 'string' && p.length < 32768).slice(0, 15) : [],
        window: saved.window && typeof saved.window === 'object' ? saved.window : state.window,
        liveWatch: typeof saved.liveWatch === 'boolean' ? saved.liveWatch : true,
        alwaysOnTop: saved.alwaysOnTop === true,
      };
    } catch {}
    protocol.handle('inkglass-media', async request => {
      try {
        const u = new URL(request.url); const filename = documents.get(u.hostname);
        if (!filename || !['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 403 });
        const ref = u.searchParams.has('ref') ? u.searchParams.get('ref') : u.pathname.slice(1);
        const boundary = activeFolderRoot && isInside(activeFolderRoot, filename) ? activeFolderRoot : null;
        const image = await resolveImage(filename, ref, boundary);
        const data = await fs.readFile(image.path);
        if (data.byteLength > 20 * 1024 * 1024) return new Response(null, { status: 413 });
        return new Response(request.method === 'HEAD' ? null : data, { headers: { 'content-type': image.mime, 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'", 'x-content-type-options': 'nosniff' } });
      } catch { return new Response(null, { status: 404 }); }
    });
    handle('inkglass:open', () => openDialog());
    handle('inkglass:open-folder', () => openFolderDialog());
    handle('inkglass:refresh-folder', async () => {
      if (!activeFolderRoot) return null;
      const listing = await listFolderDocuments(activeFolderRoot);
      activeFolderRoot = listing.root;
      return listing;
    });
    handle('inkglass:close-folder', () => {
      activeFolderRoot = null;
      return { ok: true };
    });
    handle('inkglass:open-folder-file', async targetPath => {
      if (!activeFolderRoot || typeof targetPath !== 'string' || targetPath.length > 32768) throw new Error('No active folder selected');
      const real = await fs.realpath(targetPath);
      if (!isInside(activeFolderRoot, real)) throw new Error('File is outside the active folder');
      await queueOpen([real]);
    });
    handle('inkglass:recent', () => state.recent.map(filePath => ({ path: filePath, name: path.basename(filePath), dir: path.dirname(filePath) })));
    handle('inkglass:open-recent', async targetPath => {
      if (typeof targetPath !== 'string' || !state.recent.includes(targetPath)) throw new Error('File is not in the recent files list');
      await queueOpen([targetPath]);
    });
    handle('inkglass:open-linked', async (sourceId, href) => {
      const sourcePath = documents.get(sourceId);
      if (!sourcePath) throw new Error('Open a local file to follow relative Markdown links');
      const boundary = activeFolderRoot && isInside(activeFolderRoot, sourcePath) ? activeFolderRoot : null;
      const resolved = await resolveLinkedDocument(sourcePath, href, boundary);
      await queueOpen([resolved.path], resolved.fragment);
      return { ok: true, fragment: resolved.fragment };
    });
    handle('inkglass:close-file', id => {
      const filePath = documents.get(id);
      stopWatcher(id);
      if (filePath) { documents.delete(id); byPath.delete(filePath); }
    });
    handle('inkglass:ready', () => {
      rendererReady = true;
      const batch = pending; pending = [];
      if (batch.length) send('inkglass:documents', batch);
      for (const message of pendingErrors) send('inkglass:error', message);
      pendingErrors = [];
      return { version: app.getVersion(), liveWatch: state.liveWatch, alwaysOnTop: state.alwaysOnTop };
    });
    handle('inkglass:drop', paths => { if (!Array.isArray(paths) || paths.length > 50 || paths.some(p => typeof p !== 'string' || p.length > 32768)) throw new Error('Invalid files'); return queueOpen(paths); });
    handle('inkglass:reload', id => { const filename = documents.get(id); if (!filename) throw new Error('Unknown document'); return queueOpen([filename]); });
    handle('inkglass:live-watch', enabled => {
      state.liveWatch = enabled === true;
      saveState(); buildMenu();
      if (!state.liveWatch) stopAllWatchers();
      else { for (const [id, filePath] of documents.entries()) { void readDocument(filePath).then(d => ensureWatcher(id, filePath, d.content)).catch(() => {}); } }
      return { liveWatch: state.liveWatch };
    });
    handle('inkglass:pin', enabled => {
      state.alwaysOnTop = enabled === true;
      setNativeAlwaysOnTop(state.alwaysOnTop);
      saveState(); buildMenu();
      return { alwaysOnTop: state.alwaysOnTop };
    });
    handle('inkglass:export-pdf', suggestedName => exportPdfDialog(suggestedName));
    buildMenu();
    await createWindow();
    await queueOpen(fileArguments(process.argv.slice(app.isPackaged ? 1 : 2), process.cwd()));
  }).catch(error => { dialog.showErrorBox('Inkglass', error.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  let flushed = false;
  app.on('before-quit', event => {
    if (flushed) return;
    event.preventDefault();
    stopAllWatchers();
    if (win && !win.isDestroyed()) state.window = { ...win.getNormalBounds(), maximized: win.isMaximized() };
    saveState();
    void writeQueue.finally(() => { flushed = true; app.quit(); });
  });
}
