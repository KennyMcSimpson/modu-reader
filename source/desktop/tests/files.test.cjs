const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  readDocument,
  resolveImage,
  resolveLinkedDocument,
  listFolderDocuments,
  createFileWatcher,
  migrateLegacyState,
  decodeText,
  externalUrl,
  fileArguments,
  TEXT_LIMIT,
} = require('../files.cjs');

test('real local files: Unicode paths, BOM, GB18030 and useful size/type errors', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkglass-files-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, '中文 笔记.md');
  await fs.writeFile(file, Buffer.concat([Buffer.from([255, 254]), Buffer.from('# 你好\r\n正文', 'utf16le')]));
  assert.equal((await readDocument(file)).content, '# 你好\n正文');
  assert.equal((await readDocument(file)).encoding, 'UTF-16 LE');
  assert.equal(decodeText(Buffer.from([0xd6, 0xd0, 0xce, 0xc4])).content, '中文');
  assert.equal(decodeText(Buffer.from([0xfe, 0xff, 0x4e, 0x2d])).content, '中');
  await fs.writeFile(file, Buffer.alloc(TEXT_LIMIT + 1, 65));
  await assert.rejects(readDocument(file), /2 MB/);
  await fs.writeFile(file, '\0binary');
  await assert.rejects(readDocument(file), /Not a text/);
  const other = path.join(dir, 'not-a-document.exe');
  await fs.writeFile(other, 'text');
  await assert.rejects(readDocument(other), /Unsupported/);
});

test('image and linked-document references stay within authorized folder boundaries', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkglass-images-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const docs = path.join(dir, 'docs');
  const sub = path.join(docs, 'nested');
  await fs.mkdir(path.join(docs, 'images'), { recursive: true });
  await fs.mkdir(sub, { recursive: true });
  await fs.writeFile(path.join(docs, 'images', '图 片.png'), 'image fixture');
  await fs.writeFile(path.join(dir, 'private.png'), 'outside');
  await fs.writeFile(path.join(dir, 'outside.md'), '# Secret');
  await fs.writeFile(path.join(docs, 'private.txt'), 'private');
  await fs.writeFile(path.join(docs, 'note.md'), '# Note');
  await fs.writeFile(path.join(docs, 'guide.md'), '# Guide');
  await fs.writeFile(path.join(docs, 'v2.0.md'), '# Release 2.0');
  await fs.writeFile(path.join(sub, 'child.md'), '# Child');
  await fs.writeFile(path.join(sub, 'README.md'), '# Nested Index');
  await fs.writeFile(path.join(docs, 'bad.exe'), 'nope');
  const doc = path.join(docs, 'note.md');
  const childDoc = path.join(sub, 'child.md');

  const image = await resolveImage(doc, 'images/%E5%9B%BE%20%E7%89%87.png');
  assert.equal(image.mime, 'image/png');
  for (const ref of ['../private.png', '%2e%2e/private.png', '..\\private.png', 'file:///private.png', 'C:\\private.png', '/private.png', '//server/private.png', 'private.txt', '%ZZ.png']) {
    await assert.rejects(resolveImage(doc, ref), undefined, ref);
  }

  // Cross-subdirectory relative image is rejected without a folder boundary, allowed inside docs/,
  // and rejected when attempting to escape docs/.
  await assert.rejects(resolveImage(childDoc, '../images/%E5%9B%BE%20%E7%89%87.png'), /outside/);
  const crossSubImage = await resolveImage(childDoc, '../images/%E5%9B%BE%20%E7%89%87.png', docs);
  assert.equal(crossSubImage.mime, 'image/png');
  assert.equal(crossSubImage.path, await fs.realpath(path.join(docs, 'images', '图 片.png')));
  await assert.rejects(resolveImage(childDoc, '../../private.png', docs), /outside/);

  // Relative Markdown links inside the document folder work, including fragments.
  const linked = await resolveLinkedDocument(doc, './nested/child.md#section-1');
  assert.equal(linked.path, await fs.realpath(childDoc));
  assert.equal(linked.fragment, 'section-1');

  // Directory links resolve README.md and extensionless links resolve .md within the authorized boundary.
  const dirLinked = await resolveLinkedDocument(doc, './nested/#overview', docs);
  assert.equal(dirLinked.path, await fs.realpath(path.join(sub, 'README.md')));
  assert.equal(dirLinked.fragment, 'overview');
  const dirNoSlash = await resolveLinkedDocument(doc, './nested', docs);
  assert.equal(dirNoSlash.path, await fs.realpath(path.join(sub, 'README.md')));
  const extless = await resolveLinkedDocument(doc, './guide#start', docs);
  assert.equal(extless.path, await fs.realpath(path.join(docs, 'guide.md')));
  assert.equal(extless.fragment, 'start');
  const extlessParent = await resolveLinkedDocument(childDoc, '../guide', docs);
  assert.equal(extlessParent.path, await fs.realpath(path.join(docs, 'guide.md')));
  const dottedExtless = await resolveLinkedDocument(doc, './v2.0#notes', docs);
  assert.equal(dottedExtless.path, await fs.realpath(path.join(docs, 'v2.0.md')));
  assert.equal(dottedExtless.fragment, 'notes');
  await assert.rejects(resolveLinkedDocument(childDoc, '../../outside', docs), /outside/);

  // Sibling upward link is rejected without a folder boundary, but allowed when bounded by docs/.
  await assert.rejects(resolveLinkedDocument(childDoc, '../guide.md'), /outside/);
  const withinFolder = await resolveLinkedDocument(childDoc, '../guide.md#intro', docs);
  assert.equal(withinFolder.path, await fs.realpath(path.join(docs, 'guide.md')));
  assert.equal(withinFolder.fragment, 'intro');

  // Escaping even the folder boundary or pointing to non-text/absolute paths is rejected.
  for (const ref of ['../outside.md', '../../outside.md', '%2e%2e/outside.md', 'file:///C:/outside.md', 'C:\\outside.md', '/outside.md', 'bad.exe', '%ZZ.md']) {
    await assert.rejects(resolveLinkedDocument(doc, ref, docs), undefined, ref);
  }

  // Windows junctions do not require elevated symlink privileges.
  await fs.writeFile(path.join(dir, 'README.md'), '# Outside Root');
  await fs.symlink(dir, path.join(docs, 'escape'), 'junction');
  await assert.rejects(resolveImage(doc, 'escape/private.png'), /outside/);
  await assert.rejects(resolveImage(childDoc, '../escape/private.png', docs), /outside/);
  await assert.rejects(resolveLinkedDocument(doc, 'escape/outside.md', docs), /escapes|outside/);
  await assert.rejects(resolveLinkedDocument(doc, 'escape/', docs), /escapes|outside/);
  await assert.rejects(resolveLinkedDocument(doc, 'escape/outside', docs), /escapes|outside/);
});

test('read-only folder walker respects bounds and skips ignored/hidden directories', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkglass-folder-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.mkdir(path.join(dir, '.git'), { recursive: true });
  await fs.mkdir(path.join(dir, 'node_modules', 'pkg'), { recursive: true });
  await fs.mkdir(path.join(dir, 'guides', 'deep', 'level3'), { recursive: true });
  await fs.writeFile(path.join(dir, 'README.md'), '# Root');
  await fs.writeFile(path.join(dir, 'guides', 'a.md'), '# A');
  await fs.writeFile(path.join(dir, 'guides', 'deep', 'b.md'), '# B');
  await fs.writeFile(path.join(dir, 'guides', 'deep', 'level3', 'c.md'), '# C');
  await fs.writeFile(path.join(dir, '.git', 'HEAD.md'), '# Ignored');
  await fs.writeFile(path.join(dir, 'node_modules', 'pkg', 'README.md'), '# Ignored');
  await fs.writeFile(path.join(dir, 'binary.exe'), 'nope');

  const full = await listFolderDocuments(dir, { maxDepth: 2, maxFiles: 10 });
  const rels = full.files.map(f => f.relativePath);
  assert.deepEqual(rels.sort(), ['README.md', 'guides/a.md', 'guides/deep/b.md']);
  assert.equal(full.truncated, false);

  const capped = await listFolderDocuments(dir, { maxDepth: 4, maxFiles: 2 });
  assert.equal(capped.files.length, 2);
  assert.equal(capped.truncated, true);
});

test('file watcher detects live edits, deduplicates unchanged content, and closes cleanly', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkglass-watch-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'plan.md');
  await fs.writeFile(file, '# Plan\n\nInitial version.\n');

  const updates = [];
  let resolveUpdate;
  const updatedPromise = new Promise(resolve => { resolveUpdate = resolve; });
  const watcher = createFileWatcher(file, '# Plan\n\nInitial version.\n', next => {
    updates.push(next.content);
    resolveUpdate(next);
  }, 60);
  t.after(() => watcher.close());

  // Identical write should not trigger an update.
  await fs.writeFile(file, '# Plan\n\nInitial version.\n');
  await new Promise(r => setTimeout(r, 150));
  assert.equal(updates.length, 0);

  // Real content update should notify callback.
  await fs.writeFile(file, '# Plan\n\nUpdated by AI agent.\n');
  const received = await Promise.race([
    updatedPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Watcher did not fire in time')), 4000)),
  ]);
  assert.match(received.content, /Updated by AI agent/);
  assert.equal(updates.length, 1);

  // Closing the watcher must stop further notifications.
  watcher.close();
  await fs.writeFile(file, '# Plan\n\nAfter close.\n');
  await new Promise(r => setTimeout(r, 150));
  assert.equal(updates.length, 1);
});

test('migrateLegacyState non-destructively copies desktop-state.json without overwriting existing state', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkglass-migrate-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const legacyDir = path.join(dir, 'MoDu Reader');
  const targetDir = path.join(dir, 'Inkglass');
  await fs.mkdir(legacyDir, { recursive: true });
  const legacyState = JSON.stringify({ recent: ['E:\\notes\\plan.md'], liveWatch: true, alwaysOnTop: false });
  await fs.writeFile(path.join(legacyDir, 'desktop-state.json'), legacyState, 'utf8');

  const first = await migrateLegacyState(legacyDir, targetDir);
  assert.equal(first.migrated, true);
  assert.equal(await fs.readFile(path.join(targetDir, 'desktop-state.json'), 'utf8'), legacyState);
  assert.equal(await fs.readFile(path.join(legacyDir, 'desktop-state.json'), 'utf8'), legacyState);

  const updatedState = JSON.stringify({ recent: ['E:\\notes\\new.md'], liveWatch: false, alwaysOnTop: true });
  await fs.writeFile(path.join(targetDir, 'desktop-state.json'), updatedState, 'utf8');
  const second = await migrateLegacyState(legacyDir, targetDir);
  assert.equal(second.migrated, false);
  assert.equal(await fs.readFile(path.join(targetDir, 'desktop-state.json'), 'utf8'), updatedState);
});

test('only explicit web/mail links can leave the reader', () => {
  for (const link of ['javascript:alert(1)', 'file:///C:/private.txt', 'powershell:run', 'ms-settings:privacy', '//example.com', 'data:text/html,hello']) assert.equal(externalUrl(link), null);
  assert.equal(externalUrl('https://example.com/docs'), 'https://example.com/docs');
  assert.equal(externalUrl('mailto:friend@example.com'), 'mailto:friend@example.com');
  assert.deepEqual(fileArguments(['--flag', 'Inkglass.exe', '中文 笔记.md', 'other.png'], process.cwd()), [path.resolve('中文 笔记.md')]);
});
