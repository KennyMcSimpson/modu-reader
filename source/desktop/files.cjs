const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const TEXT_EXT = new Set(['.md', '.markdown', '.mdown', '.txt']);
const IMAGE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif' };
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out', '.next', 'target', '.venv', 'venv', '__pycache__', 'release', '.cache']);
const TEXT_LIMIT = 2 * 1024 * 1024;
const IMAGE_LIMIT = 20 * 1024 * 1024;
const MAX_FOLDER_DEPTH = 4;
const MAX_FOLDER_FILES = 300;

function decodeText(bytes) {
  let text, encoding = 'UTF-8';
  if (bytes[0] === 255 && bytes[1] === 254) { encoding = 'UTF-16 LE'; text = new TextDecoder('utf-16le').decode(bytes); }
  else if (bytes[0] === 254 && bytes[1] === 255) { encoding = 'UTF-16 BE'; text = new TextDecoder('utf-16be').decode(bytes); }
  else { try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { encoding = 'GB18030'; text = new TextDecoder('gb18030').decode(bytes); } }
  if (text.includes('\0')) throw new Error('Not a text file');
  return { content: text.replace(/\r\n?/g, '\n'), encoding };
}

async function readDocument(filename) {
  const real = await fsp.realpath(filename);
  if (!TEXT_EXT.has(path.extname(real).toLowerCase())) throw new Error('Unsupported file type');
  const stat = await fsp.stat(real);
  if (!stat.isFile() || stat.size > TEXT_LIMIT) throw new Error('File exceeds 2 MB or is not a regular file');
  const bytes = await fsp.readFile(real);
  if (bytes.length > TEXT_LIMIT) throw new Error('File exceeds 2 MB');
  return { path: real, name: path.basename(real), ...decodeText(bytes), modifiedAt: stat.mtimeMs };
}

function isInside(root, filename) {
  const relative = path.relative(root, filename);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

async function resolveImage(documentPath, rawReference, boundaryRoot = null) {
  if (typeof rawReference !== 'string' || rawReference.length > 4096 || rawReference.includes('\0')) throw new Error('Invalid image reference');
  let reference;
  try { reference = decodeURIComponent(rawReference.split(/[?#]/)[0]).replaceAll('\\', '/'); }
  catch { throw new Error('Malformed image reference'); }
  if (!reference || reference.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(reference)) throw new Error('Only document-relative images are allowed');
  const docDir = await fsp.realpath(path.dirname(documentPath));
  const boundary = boundaryRoot ? await fsp.realpath(boundaryRoot) : docDir;
  if (!isInside(boundary, docDir)) throw new Error('Document is outside the active folder boundary');
  const candidate = path.resolve(docDir, reference);
  if (!isInside(boundary, candidate)) throw new Error('Image is outside the authorized folder');
  const real = await fsp.realpath(candidate);
  if (!isInside(boundary, real)) throw new Error('Image symlink is outside the authorized folder');
  const mime = IMAGE_TYPES[path.extname(real).toLowerCase()];
  if (!mime) throw new Error('Unsupported image type');
  const stat = await fsp.stat(real);
  if (!stat.isFile() || stat.size > IMAGE_LIMIT) throw new Error('Image exceeds 20 MB');
  return { path: real, mime };
}

async function resolveLinkedDocument(currentDocPath, rawReference, boundaryRoot = null) {
  if (typeof rawReference !== 'string' || rawReference.length > 4096 || rawReference.includes('\0')) throw new Error('Invalid document link');
  const hashIndex = rawReference.indexOf('#');
  const rawPath = hashIndex >= 0 ? rawReference.slice(0, hashIndex) : rawReference;
  const rawFragment = hashIndex >= 0 ? rawReference.slice(hashIndex + 1) : '';
  let reference;
  let fragment = '';
  try {
    reference = decodeURIComponent(rawPath.split('?')[0]).replaceAll('\\', '/');
    fragment = rawFragment ? decodeURIComponent(rawFragment) : '';
  } catch {
    throw new Error('Malformed document link');
  }
  if (!reference || reference.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(reference)) throw new Error('Only relative local Markdown links are allowed');
  const docDir = await fsp.realpath(path.dirname(currentDocPath));
  const boundary = boundaryRoot ? await fsp.realpath(boundaryRoot) : docDir;
  if (!isInside(boundary, docDir)) throw new Error('Document is outside the active folder boundary');
  const candidate = path.resolve(docDir, reference);
  if (!isInside(boundary, candidate)) throw new Error('Linked document is outside the authorized folder');

  let resolvedTarget = candidate;
  let stat = null;
  try {
    const realCandidate = await fsp.realpath(candidate);
    if (!isInside(boundary, realCandidate)) throw new Error('Linked document symlink escapes the authorized folder');
    const candidateStat = await fsp.stat(realCandidate);
    if (candidateStat.isDirectory()) {
      const entries = await fsp.readdir(realCandidate);
      const readmeName = entries.find(name => name.toLowerCase() === 'readme.md');
      if (readmeName) {
        resolvedTarget = path.join(realCandidate, readmeName);
      } else if (!reference.endsWith('/') && !TEXT_EXT.has(path.extname(candidate).toLowerCase())) {
        const mdFallback = candidate + '.md';
        if (!isInside(boundary, mdFallback)) throw new Error('Linked document is outside the authorized folder');
        try {
          await fsp.access(mdFallback);
          resolvedTarget = mdFallback;
        } catch {
          throw new Error('Linked directory does not contain a README.md');
        }
      } else {
        throw new Error('Linked directory does not contain a README.md');
      }
    } else {
      resolvedTarget = realCandidate;
      stat = candidateStat;
    }
  } catch (err) {
    if (err && err.code === 'ENOENT' && !reference.endsWith('/') && !TEXT_EXT.has(path.extname(candidate).toLowerCase())) {
      const mdCandidate = candidate + '.md';
      if (!isInside(boundary, mdCandidate)) throw new Error('Linked document is outside the authorized folder');
      resolvedTarget = mdCandidate;
    } else {
      throw err;
    }
  }

  const real = await fsp.realpath(resolvedTarget);
  if (!isInside(boundary, real)) throw new Error('Linked document symlink escapes the authorized folder');
  if (!TEXT_EXT.has(path.extname(real).toLowerCase())) throw new Error('Linked file is not a supported Markdown or text document');
  if (!stat) stat = await fsp.stat(real);
  if (!stat.isFile() || stat.size > TEXT_LIMIT) throw new Error('Linked document exceeds 2 MB or is not a regular file');
  return { path: real, fragment };
}

async function listFolderDocuments(folderPath, options = {}) {
  const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : MAX_FOLDER_DEPTH;
  const maxFiles = Number.isInteger(options.maxFiles) ? options.maxFiles : MAX_FOLDER_FILES;
  const root = await fsp.realpath(folderPath);
  const rootStat = await fsp.stat(root);
  if (!rootStat.isDirectory()) throw new Error('Selected path is not a folder');
  const files = [];
  const visitedDirs = new Set([root]);
  const visitedFiles = new Set();
  let truncated = false;

  async function walk(dir, depth) {
    if (depth > maxDepth || files.length >= maxFiles) {
      if (files.length >= maxFiles) truncated = true;
      return;
    }
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); }
    catch { return; }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
    for (const entry of entries) {
      if (files.length >= maxFiles) { truncated = true; return; }
      if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      let real;
      try { real = await fsp.realpath(full); } catch { continue; }
      if (!isInside(root, real)) continue;
      let stat;
      try { stat = await fsp.stat(real); } catch { continue; }
      if (stat.isDirectory()) {
        if (depth < maxDepth && !visitedDirs.has(real)) {
          visitedDirs.add(real);
          await walk(real, depth + 1);
        }
      } else if (stat.isFile() && TEXT_EXT.has(path.extname(real).toLowerCase()) && stat.size <= TEXT_LIMIT && !visitedFiles.has(real)) {
        visitedFiles.add(real);
        files.push({
          path: real,
          relativePath: path.relative(root, real).replaceAll('\\', '/'),
          name: path.basename(real),
          modifiedAt: stat.mtimeMs,
        });
      }
    }
  }

  await walk(root, 0);
  return { root, name: path.basename(root) || root, files, truncated };
}

function createFileWatcher(filePath, initialContent, onChange, debounceMs = 250) {
  const dir = path.dirname(filePath);
  const targetName = path.basename(filePath);
  const lowerTarget = process.platform === 'win32' ? targetName.toLowerCase() : targetName;
  let lastContent = initialContent;
  let timer = null;
  let closed = false;
  let watcher = null;
  let seq = 0;

  const check = async (retried = false) => {
    if (closed) return;
    const mySeq = ++seq;
    try {
      const next = await readDocument(filePath);
      if (closed || mySeq !== seq || next.content === lastContent) return;
      lastContent = next.content;
      onChange(next);
    } catch {
      // Transient atomic-save rename gaps get one bounded retry after settling.
      if (!closed && mySeq === seq && !retried) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { void check(true); }, Math.max(debounceMs, 250));
      }
    }
  };

  try {
    watcher = fs.watch(dir, { persistent: false }, (_eventType, filename) => {
      if (closed) return;
      if (filename) {
        const seen = process.platform === 'win32' ? String(filename).toLowerCase() : String(filename);
        if (seen !== lowerTarget) return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void check(); }, debounceMs);
    });
    watcher.on('error', () => {});
  } catch {
    watcher = null;
  }

  return {
    updateKnownContent(content) { lastContent = content; },
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      if (watcher) { try { watcher.close(); } catch {} watcher = null; }
    },
  };
}

function fileArguments(argv, cwd) {
  return argv.filter(arg => typeof arg === 'string' && !arg.startsWith('-') && TEXT_EXT.has(path.extname(arg).toLowerCase())).map(arg => path.resolve(cwd, arg));
}

function externalUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try { const u = new URL(value); return ['https:', 'http:', 'mailto:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}

async function migrateLegacyState(legacyDir, targetDir) {
  if (!legacyDir || !targetDir) return { migrated: false };
  const targetState = path.join(targetDir, 'desktop-state.json');
  const legacyState = path.join(legacyDir, 'desktop-state.json');
  try {
    await fsp.access(targetState);
    return { migrated: false };
  } catch {}
  try {
    await fsp.access(legacyState);
  } catch {
    return { migrated: false };
  }
  await fsp.mkdir(targetDir, { recursive: true });
  const tmpState = `${targetState}.migrate-${process.pid}.tmp`;
  try {
    await fsp.copyFile(legacyState, tmpState);
    await fsp.rename(tmpState, targetState);
  } finally {
    await fsp.unlink(tmpState).catch(() => {});
  }
  return { migrated: true };
}

module.exports = {
  decodeText, readDocument, resolveImage, resolveLinkedDocument, listFolderDocuments,
  createFileWatcher, migrateLegacyState, fileArguments, externalUrl, isInside, TEXT_LIMIT, IMAGE_LIMIT,
};
