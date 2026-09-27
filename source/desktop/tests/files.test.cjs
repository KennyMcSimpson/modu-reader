const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { readDocument, resolveImage, decodeText, externalUrl, fileArguments, TEXT_LIMIT } = require('../files.cjs');

test('real local files: Chinese paths, BOM, GB18030 and useful size/type errors', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'modu-files-'));
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

test('image references stay within the selected document folder', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'modu-images-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const docs = path.join(dir, 'docs');
  await fs.mkdir(path.join(docs, 'images'), { recursive: true });
  await fs.writeFile(path.join(docs, 'images', '图 片.png'), 'image fixture');
  await fs.writeFile(path.join(dir, 'private.png'), 'outside');
  await fs.writeFile(path.join(docs, 'private.txt'), 'private');
  const doc = path.join(docs, 'note.md');
  const image = await resolveImage(doc, 'images/%E5%9B%BE%20%E7%89%87.png');
  assert.equal(image.mime, 'image/png');
  for (const ref of ['../private.png', '%2e%2e/private.png', '..\\private.png', 'file:///private.png', 'C:\\private.png', '/private.png', '//server/private.png', 'private.txt']) {
    await assert.rejects(resolveImage(doc, ref), undefined, ref);
  }
  // Windows junctions do not require the symlink privilege.
  await fs.symlink(dir, path.join(docs, 'escape'), 'junction');
  await assert.rejects(resolveImage(doc, 'escape/private.png'), /outside/);
});

test('only explicit web/mail links can leave the reader', () => {
  for (const link of ['javascript:alert(1)', 'file:///C:/private.txt', 'powershell:run', 'ms-settings:privacy', '//example.com', 'data:text/html,hello']) assert.equal(externalUrl(link), null);
  assert.equal(externalUrl('https://example.com/docs'), 'https://example.com/docs');
  assert.equal(externalUrl('mailto:friend@example.com'), 'mailto:friend@example.com');
  assert.deepEqual(fileArguments(['--flag', 'MoDu Reader.exe', '中文 笔记.md', 'other.png'], process.cwd()), [path.resolve('中文 笔记.md')]);
});
