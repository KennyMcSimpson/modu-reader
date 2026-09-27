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
await writeFile(path.join(fixture, 'images', '本地 图片.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAF0lEQVR4nGN82ejPQAgwEVQxqmgAFAEAEL0B0TGFd2QAAAAASUVORK5CYII=', 'base64'));
const filename = path.join(fixture, '中文 file.md');
await writeFile(filename, '# Desktop smoke test\n\n离线阅读验证。SearchNeedle is here.\n\n![local image](images/本地%20图片.png)\n\n## Features\n\n| A | B |\n|---|---|\n| one | two |\n\nInline $E=mc^2$.\n\n```js\nconst local = true;\n```\n\n```mermaid\ngraph TD\n  A[Local file] --> B[Desktop reader]\n```\n\n<script>window.injected=true</script>\n');
const executable = process.env.MODU_EXECUTABLE;
const launchArgs = executable ? [filename] : ['.', filename];
let app;
const errors = [];
const network = [];
try {
  app = await electron.launch({ ...(executable ? { executablePath: path.resolve(executable) } : {}), args: launchArgs, timeout: 90000, env: { ...process.env, NODE_ENV: 'test', MODU_TEST_USER_DATA: path.join(fixture, 'profile') } });
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  await page.getByRole('heading', { name: 'Desktop smoke test', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.evaluate(() => window.injected), undefined);
  const prefs = await app.evaluate(({ BrowserWindow }) => {
    const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration };
  });
  assert.deepEqual(prefs, { sandbox: true, contextIsolation: true, nodeIntegration: false });
  await page.waitForFunction(() => { const image = document.querySelector('article img'); return image?.complete && image.naturalWidth > 0; });
  assert.equal(await page.locator('article table').count(), 1);
  assert.equal(await page.locator('article .katex').count(), 1);
  await page.locator('.mermaid-diagram, .diagram-block').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.locator('article .mermaid-rendered svg, article .mermaid-diagram svg, article .diagram-block svg').first().waitFor({ timeout: 30000 });
  // Exercise native menu commands through the same handler as Ctrl+F / F5.
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('find').click());
  await page.locator('.desktop-find input').fill('SearchNeedle');
  await page.waitForFunction(() => /1\s*\/\s*1/.test(document.querySelector('.find-count')?.textContent || ''));
  await page.locator('.desktop-find input').press('Escape');
  await writeFile(filename, '# Updated on disk\n\nReloaded with F5.');
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('reload-document').click());
  await page.getByRole('heading', { name: 'Updated on disk', exact: true }).waitFor();
  await page.locator('.locale-option').filter({ hasText: /^EN$/ }).click();
  assert.equal(await page.getByRole('button', { name: /Open file/ }).count() > 0, true);
  await page.getByRole('button', { name: /Paste text/ }).click();
  await page.locator('#paste-name').fill('Pasted note');
  await page.locator('#paste-content').fill('# Pasted title\n\nOffline paste works.');
  await page.getByRole('button', { name: /Start reading/ }).click();
  await page.getByRole('heading', { name: 'Pasted title' }).waitFor();
  // A second launch must reuse the running application and deliver its file.
  const secondFile = path.join(fixture, 'second.md');
  await writeFile(secondFile, '# Second instance\n\nOpened from the operating system.');
  const childArgs = executable ? [secondFile] : ['.', secondFile];
  await new Promise((resolve, reject) => {
    const child = spawn(executable || app.process().spawnfile, childArgs, { env: { ...process.env, NODE_ENV: 'test', MODU_TEST_USER_DATA: path.join(fixture, 'profile') }, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Second instance did not exit')); }, 20000);
    child.on('error', reject); child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Second instance exit ${code}`)); });
  });
  await page.getByRole('heading', { name: 'Second instance', exact: true }).waitFor();
  // Verify the native open dialog path without requiring interactive CI input.
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, filename);
  await page.getByRole('button', { name: /Open file/ }).click();
  await page.getByRole('heading', { name: 'Updated on disk', exact: true }).waitFor();
  // Capture the existing welcome layout as visual evidence of the packaged app.
  await page.getByRole('button', { name: 'Welcome to MoDu', exact: true }).click();
  await page.screenshot({ path: path.join(results, 'windows-reader.png') });
  assert.deepEqual(errors, [], 'Renderer must have no uncaught errors');
  assert.deepEqual(network, [], 'Local documents must not trigger remote requests');
  await writeFile(path.join(results, 'smoke.json'), JSON.stringify({ platform: process.platform, executable: executable || 'development', checks: ['real-executable', 'command-line-open', 'native-dialog', 'relative-image', 'table', 'math', 'mermaid', 'find', 'reload', 'bilingual-ui', 'paste', 'second-instance', 'sandbox', 'offline'], errors, network }, null, 2));
  console.log('Desktop smoke checks passed.');
} catch (error) {
  if (app) { try { const page = await app.firstWindow(); await page.screenshot({ path: path.join(results, 'failure.png') }); await writeFile(path.join(results, 'failure.html'), await page.content()); } catch {} }
  throw error;
} finally {
  if (app) await app.close();
  await rm(fixture, { recursive: true, force: true });
}
