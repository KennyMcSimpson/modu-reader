const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, shell, screen } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { readDocument, resolveImage, fileArguments, externalUrl } = require('./files.cjs');

const APP_ID = 'io.github.kennymcsimpson.modu';
const indexFile = path.join(__dirname, '../dist/desktop/index.html');
const indexURL = pathToFileURL(indexFile).href;
const icon = path.join(__dirname, 'assets/icon.png');
let win;
let state = { recent: [], window: { width: 1260, height: 850 }, locale: 'zh' };
let stateFile;
let pending = [];
let pendingErrors = [];
let rendererReady = false;
let writeQueue = Promise.resolve();
let openingQueue = Promise.resolve();
const documents = new Map();
const byPath = new Map();

app.setName('MoDu Reader');
app.setAppUserModelId(APP_ID);
if (!app.isPackaged && process.env.NODE_ENV === 'test' && process.env.MODU_TEST_USER_DATA) app.setPath('userData', process.env.MODU_TEST_USER_DATA);
protocol.registerSchemesAsPrivileged([{ scheme: 'modu-media', privileges: { secure: true, standard: true, supportFetchAPI: true } }]);

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
function report(error) { const message = error instanceof Error ? error.message : String(error); if (rendererReady) send('modu:error', message); else pendingErrors.push(message); }
function deliver(batch) { if (rendererReady) send('modu:documents', batch); else pending.push(...batch); }
function queueOpen(paths) {
  openingQueue = openingQueue.catch(() => {}).then(async () => {
    const batch = [];
    for (const filename of paths.slice(0, 50)) {
      try {
        const data = await readDocument(filename);
        const id = byPath.get(data.path) || randomUUID();
        byPath.set(data.path, id); documents.set(id, data.path);
        batch.push({ id, ...data });
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
    title: state.locale === 'en' ? 'Open Markdown' : '打开 Markdown 文档',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Markdown & Text', extensions: ['md', 'markdown', 'mdown', 'txt'] }],
  });
  if (!selected.canceled) await queueOpen(selected.filePaths);
}
function trusted(event) {
  if (!win || event.sender !== win.webContents || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url.split('#')[0] !== indexURL) throw new Error('Untrusted sender');
}
function handle(channel, callback) { ipcMain.handle(channel, async (event, ...args) => { trusted(event); return callback(...args); }); }
function focusWindow() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }

function buildMenu() {
  const en = state.locale === 'en';
  const t = (zh, eng) => en ? eng : zh;
  const action = name => () => send('modu:action', name);
  const recents = state.recent.map(filename => ({ label: path.basename(filename).replaceAll('&', '&&'), sublabel: path.dirname(filename), click: () => queueOpen([filename]) }));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: t('文件(&F)', '&File'), submenu: [
      { id: 'open', label: t('打开文档…', 'Open documents…'), accelerator: 'CmdOrCtrl+O', click: openDialog },
      { label: t('最近打开', 'Open recent'), submenu: [...recents, { type: 'separator' }, { label: t('清空记录', 'Clear recent files'), enabled: !!recents.length, click: () => { state.recent = []; app.clearRecentDocuments(); saveState(); buildMenu(); } }] },
      { label: t('粘贴文本…', 'Paste Markdown…'), accelerator: 'CmdOrCtrl+Shift+V', click: action('paste') },
      { id: 'reload-document', label: t('重新读取当前文件', 'Reload current file'), accelerator: 'F5', click: action('reload') },
      { label: t('关闭当前文档', 'Close document'), accelerator: 'CmdOrCtrl+W', click: action('close') },
      { type: 'separator' }, { role: 'quit', label: t('退出', 'Quit') },
    ] },
    { label: t('编辑(&E)', '&Edit'), submenu: [
      { role: 'undo', label: t('撤销', 'Undo') }, { role: 'redo', label: t('重做', 'Redo') }, { type: 'separator' },
      { role: 'cut', label: t('剪切', 'Cut') }, { role: 'copy', label: t('复制', 'Copy') }, { role: 'paste', label: t('粘贴', 'Paste') }, { role: 'selectAll', label: t('全选', 'Select all') },
      { type: 'separator' }, { id: 'find', label: t('查找…', 'Find…'), accelerator: 'CmdOrCtrl+F', click: action('find') },
    ] },
    { label: t('视图(&V)', '&View'), submenu: [
      { label: t('专注模式', 'Focus mode'), accelerator: 'CmdOrCtrl+Shift+F', click: action('focus') },
      { role: 'togglefullscreen', label: t('全屏', 'Fullscreen') }, { type: 'separator' },
      { role: 'resetZoom', label: t('重置界面缩放', 'Reset zoom') }, { role: 'zoomIn', label: t('放大界面', 'Zoom in') }, { role: 'zoomOut', label: t('缩小界面', 'Zoom out') },
    ] },
    { label: t('帮助(&H)', '&Help'), submenu: [
      { label: 'GitHub', click: () => shell.openExternal('https://github.com/KennyMcSimpson/modu-reader') },
      { label: t('关于墨读', 'About MoDu Reader'), click: () => dialog.showMessageBox(win, { type: 'info', title: 'MoDu Reader', message: `墨读 MoDu Reader ${app.getVersion()}`, detail: t('Windows 桌面 Markdown 阅读器。文档在本地处理，无需账号。\n开源组件许可证位于应用安装目录的 THIRD_PARTY_NOTICES 文件夹。', 'A Windows desktop Markdown reader. Your documents stay local; no account is required.\nThird-party licenses are in the application\'s THIRD_PARTY_NOTICES folder.') }) },
    ] },
  ]));
}

async function createWindow() {
  let bounds = state.window;
  const validPosition = Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && screen.getAllDisplays().some(({ workArea: a }) => bounds.x + bounds.width > a.x && bounds.x < a.x + a.width && bounds.y + bounds.height > a.y && bounds.y < a.y + a.height);
  win = new BrowserWindow({
    width: Math.max(860, Math.min(bounds.width || 1260, 2400)), height: Math.max(580, Math.min(bounds.height || 850, 1800)),
    ...(validPosition ? { x: bounds.x, y: bounds.y } : {}), minWidth: 720, minHeight: 540,
    title: '墨读 · MoDu Reader', backgroundColor: '#ffffff', icon, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: false },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { const safe = externalUrl(url); if (safe) void shell.openExternal(safe).catch(report); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => { if (url.split('#')[0] !== indexURL) { event.preventDefault(); const safe = externalUrl(url); if (safe) void shell.openExternal(safe).catch(report); } });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  win.webContents.on('did-start-loading', () => { rendererReady = false; });
  win.webContents.on('render-process-gone', (_event, details) => { if (details.reason !== 'clean-exit') void dialog.showMessageBox({ type: 'error', message: '阅读窗口意外退出 / Reader stopped', detail: '请关闭并重新打开墨读。你的原始文件没有被更改。\nRestart MoDu Reader. Your original files have not been changed.' }); });
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
    stateFile = path.join(app.getPath('userData'), 'desktop-state.json');
    try { const saved = JSON.parse(await fs.readFile(stateFile, 'utf8')); state = { recent: Array.isArray(saved.recent) ? saved.recent.filter(p => typeof p === 'string' && p.length < 32768).slice(0, 15) : [], window: saved.window && typeof saved.window === 'object' ? saved.window : state.window, locale: saved.locale === 'en' ? 'en' : 'zh' }; } catch {}
    protocol.handle('modu-media', async request => {
      try {
        const u = new URL(request.url); const filename = documents.get(u.hostname);
        if (!filename || !['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 403 });
        const image = await resolveImage(filename, u.pathname.slice(1));
        const data = await fs.readFile(image.path);
        if (data.byteLength > 20 * 1024 * 1024) return new Response(null, { status: 413 });
        return new Response(request.method === 'HEAD' ? null : data, { headers: { 'content-type': image.mime, 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'", 'x-content-type-options': 'nosniff' } });
      } catch { return new Response(null, { status: 404 }); }
    });
    handle('modu:open', () => openDialog());
    handle('modu:ready', () => { rendererReady = true; const batch = pending; pending = []; if (batch.length) send('modu:documents', batch); for (const message of pendingErrors) send('modu:error', message); pendingErrors = []; return { version: app.getVersion() }; });
    handle('modu:drop', paths => { if (!Array.isArray(paths) || paths.length > 50 || paths.some(p => typeof p !== 'string' || p.length > 32768)) throw new Error('Invalid files'); return queueOpen(paths); });
    handle('modu:reload', id => { const filename = documents.get(id); if (!filename) throw new Error('Unknown document'); return queueOpen([filename]); });
    handle('modu:locale', locale => { if (!['zh', 'en'].includes(locale)) return; state.locale = locale; buildMenu(); saveState(); });
    buildMenu();
    await createWindow();
    await queueOpen(fileArguments(process.argv.slice(app.isPackaged ? 1 : 2), process.cwd()));
  }).catch(error => { dialog.showErrorBox('MoDu Reader', error.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  let flushed = false;
  app.on('before-quit', event => {
    if (flushed) return;
    event.preventDefault();
    if (win && !win.isDestroyed()) state.window = { ...win.getNormalBounds(), maximized: win.isMaximized() };
    saveState();
    void writeQueue.finally(() => { flushed = true; app.quit(); });
  });
}
