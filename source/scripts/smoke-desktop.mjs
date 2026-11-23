import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const fixture = await mkdtemp(path.join(os.tmpdir(), 'modu-smoke-'));
const results = path.resolve('test-results');
await mkdir(results, { recursive: true });
await mkdir(path.join(fixture, 'images'));
await writeFile(path.join(fixture, 'images', 'local image.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAF0lEQVR4nGN82ejPQAgwEVQxqmgAFAEAEL0B0TGFd2QAAAAASUVORK5CYII=', 'base64'));
const linkedFile = path.join(fixture, 'linked.md');
await writeFile(linkedFile, '# Linked Document\n\n## Details\n\nReached via relative Markdown link.\n');
const filename = path.join(fixture, '中文 file.md');
await writeFile(
  filename,
  '---\ntitle: Desktop Smoke\nstatus: verified\ntags: [offline, windows]\n---\n\n# Desktop smoke test\n\nOffline reading check. SearchNeedle is here. SearchNeedle is here again.\n\n> [!TIP]\n> GitHub Alerts render natively without external plugins.\n\nSee [linked doc](./linked.md#details) for details.\n\n![local image](images/local%20image.png)\n\n## Features\n\n| A | B |\n|---|---|\n| one | two |\n\nInline $E=mc^2$.\n\n$$\n\\frac{1}{2} + \\sqrt{x}\n$$\n\n```js\nconst local = true;\n```\n\n```mermaid\ngraph TD\n  A[Local file] --> B[Desktop reader]\n```\n\n<script>window.__moduUntrustedMarkdownExecuted=true</script>\n',
);
const expectedPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const executable = process.env.MODU_EXECUTABLE;
const launchArgs = executable ? [filename] : ['.', filename];
let app;
const errors = [];
const network = [];
try {
  app = await electron.launch({ ...(executable ? { executablePath: path.resolve(executable) } : {}), args: launchArgs, timeout: 90000, env: { ...process.env, NODE_ENV: 'test', MODU_TEST_USER_DATA: path.join(fixture, 'profile') } });
  const page = await app.firstWindow();
  assert.equal(await app.evaluate(({ app }) => app.getVersion()), expectedPackage.version, 'The running app must match the release version');
  assert.equal(await app.evaluate(() => process.versions.electron), expectedPackage.devDependencies.electron, 'The running desktop runtime must match the pinned Electron dependency');
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  await page.getByRole('heading', { name: 'Desktop smoke test', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.evaluate(() => window.__moduUntrustedMarkdownExecuted), undefined);
  const prefs = await app.evaluate(({ BrowserWindow }) => {
    const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration };
  });
  assert.deepEqual(prefs, { sandbox: true, contextIsolation: true, nodeIntegration: false });

  // Verify Frontmatter metadata card and GitHub Alert callout.
  assert.equal(await page.locator('.frontmatter-card').count(), 1);
  assert.equal(await page.locator('.gh-alert-tip').count(), 1);

  await page.waitForFunction(() => { const image = document.querySelector('article img'); return image?.complete && image.naturalWidth > 0; });
  assert.equal(await page.locator('article table').count(), 1);
  assert.equal(await page.locator('article .katex').count(), 2);
  assert.equal(await page.locator('article .katex-display').count(), 1);
  assert.equal(await page.locator('article .katex-error').count(), 0);
  assert.equal(await page.locator('article .katex-mathml').count(), 2);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('article .katex-html').first().evaluate(el => getComputedStyle(el).fontFamily.includes('KaTeX')), true);
  await page.locator('.diagram-block').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.locator('article .diagram-svg svg').first().waitFor({ timeout: 30000 });
  assert.match((await page.locator('.diagram-svg').textContent()) || '', /Local file/);
  assert.match((await page.locator('.diagram-svg').textContent()) || '', /Desktop reader/);

  // Verify Split view shows both rendered article and source panel.
  await page.getByRole('tab', { name: 'Split', exact: true }).click();
  await page.locator('.split-panel pre').waitFor();
  await page.getByRole('tab', { name: 'Read', exact: true }).click();

  // Exercise native menu commands through the same handler as Ctrl+F.
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('find').click());
  await page.locator('.desktop-find input').fill('SearchNeedle');
  await page.waitForFunction(() => /1\s*\/\s*2/.test(document.querySelector('.find-count')?.textContent || ''));
  assert.equal(await page.evaluate(() => CSS.highlights.get('modu-find').size), 2);
  await page.locator('.desktop-find input').press('Enter');
  await page.waitForFunction(() => /2\s*\/\s*2/.test(document.querySelector('.find-count')?.textContent || ''));
  await page.locator('.desktop-find input').press('Shift+Enter');
  await page.waitForFunction(() => /1\s*\/\s*2/.test(document.querySelector('.find-count')?.textContent || ''));
  await page.locator('.desktop-find input').press('Escape');

  // Verify relative Markdown link traversal and exact Back navigation.
  await page.getByRole('link', { name: 'linked doc' }).click();
  await page.getByRole('heading', { name: 'Linked Document', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Back (Alt+Left)', exact: true }).click();
  await page.getByRole('heading', { name: 'Desktop smoke test', exact: true }).waitFor();

  // Verify Read-Only Folder drawer opens bounded local folder listing.
  await app.evaluate(({ dialog }, dir) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] }); }, fixture);
  await page.getByRole('button', { name: 'Open folder', exact: true }).click();
  await page.locator('.folder-file-item').filter({ hasText: 'linked.md' }).click();
  await page.getByRole('heading', { name: 'Linked Document', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Back (Alt+Left)', exact: true }).click();
  await page.getByRole('heading', { name: 'Desktop smoke test', exact: true }).waitFor();

  // Verify Always on Top native toggle reports topmost state on Windows.
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('always-on-top').click());
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isAlwaysOnTop()), true);
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('always-on-top').click());
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isAlwaysOnTop()), false);

  // Verify Export PDF writes a real PDF document without interactive dialogs.
  const exportedPdf = path.join(fixture, 'exported.pdf');
  await app.evaluate(({ dialog }, dest) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: dest }); }, exportedPdf);
  await page.getByRole('button', { name: 'Export PDF (Ctrl+P)', exact: true }).click();
  let pdfBuf = null;
  for (let i = 0; i < 40; i++) {
    try { const buf = await readFile(exportedPdf); if (buf.length > 5) { pdfBuf = buf; break; } } catch {}
    await page.waitForTimeout(250);
  }
  assert.ok(pdfBuf, 'Export PDF did not create output file in time');
  assert.equal(pdfBuf.subarray(0, 5).toString('ascii'), '%PDF-', 'Export PDF must write a valid PDF header');

  // Verify Live Diff-Watch automatically reloads external disk changes without pressing F5.
  await writeFile(filename, '# Desktop smoke test\n\n## `Live` Section\n\nUpdated automatically on disk.\n');
  await page.getByRole('heading', { name: 'Live Section', exact: true }).waitFor({ timeout: 10000 });
  await page.locator('.live-diff-bar').waitFor({ timeout: 10000 });
  assert.equal(await page.locator('article h2[data-changed="true"]').count(), 1);

  // Verify manual F5 reload still works cleanly.
  await writeFile(filename, '# Updated on disk\n\nReloaded with F5.');
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('reload-document').click());
  await page.getByRole('heading', { name: 'Updated on disk', exact: true }).waitFor();

  // Verify Paste Markdown flow.
  await page.getByRole('button', { name: /Paste text/ }).click();
  await page.locator('#paste-name').fill('Pasted note');
  await page.locator('#paste-content').fill('# Pasted title\n\nOffline paste works.');
  await page.getByRole('button', { name: /Start reading/ }).click();
  await page.getByRole('heading', { name: 'Pasted title' }).waitFor();

  // A second launch must reuse the running application and deliver its file.
  const secondFile = path.join(fixture, 'second.md');
  await writeFile(secondFile, '# Second instance\n\nOpened from the operating system.');
  const childArgs = executable ? [secondFile] : ['.', secondFile];
  // Playwright may launch Electron through cmd.exe on Windows.
  const childExecutable = executable || await app.evaluate(() => process.execPath);
  await new Promise((resolve, reject) => {
    const child = spawn(childExecutable, childArgs, { env: { ...process.env, NODE_ENV: 'test', MODU_TEST_USER_DATA: path.join(fixture, 'profile') }, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Second instance did not exit')); }, 20000);
    child.on('error', reject); child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Second instance exit ${code}`)); });
  });
  await page.getByRole('heading', { name: 'Second instance', exact: true }).waitFor();

  // Verify the native open dialog path without requiring interactive CI input.
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, filename);
  await page.getByRole('button', { name: /Open file/ }).click();
  await page.getByRole('heading', { name: 'Updated on disk', exact: true }).waitFor();

  // Capture the welcome layout as visual evidence of the packaged app.
  await page.getByRole('button', { name: 'Welcome to MoDu', exact: true }).click();
  await page.screenshot({ path: path.join(results, 'windows-reader.png') });
  assert.deepEqual(errors, [], 'Renderer must have no uncaught errors');
  assert.deepEqual(network, [], 'Local documents must not trigger remote requests');
  await writeFile(path.join(results, 'smoke.json'), JSON.stringify({
    platform: process.platform,
    executable: executable || 'development',
    checks: [
      'real-executable', 'version-match', 'command-line-open', 'native-dialog',
      'frontmatter', 'github-alerts', 'relative-image', 'table', 'math', 'mermaid',
      'split-view', 'find', 'relative-md-link', 'live-diff-watch', 'reload',
      'paste', 'second-instance', 'sandbox', 'offline',
    ],
    errors,
    network,
  }, null, 2));
  console.log('Desktop smoke checks passed.');
} catch (error) {
  if (app) { try { const page = await app.firstWindow(); await page.screenshot({ path: path.join(results, 'failure.png') }); await writeFile(path.join(results, 'failure.html'), await page.content()); } catch {} }
  console.error(JSON.stringify({ rendererErrors: errors, remoteRequests: network }));
  throw error;
} finally {
  if (app) await app.close();
  await rm(fixture, { recursive: true, force: true });
}
