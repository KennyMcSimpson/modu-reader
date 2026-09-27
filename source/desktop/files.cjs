const fs = require('node:fs/promises');
const path = require('node:path');

const TEXT_EXT = new Set(['.md', '.markdown', '.mdown', '.txt']);
const IMAGE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif' };
const TEXT_LIMIT = 2 * 1024 * 1024;
const IMAGE_LIMIT = 20 * 1024 * 1024;

function decodeText(bytes) {
  let text, encoding = 'UTF-8';
  if (bytes[0] === 255 && bytes[1] === 254) { encoding = 'UTF-16 LE'; text = new TextDecoder('utf-16le').decode(bytes); }
  else if (bytes[0] === 254 && bytes[1] === 255) { encoding = 'UTF-16 BE'; text = new TextDecoder('utf-16be').decode(bytes); }
  else { try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { encoding = 'GB18030'; text = new TextDecoder('gb18030').decode(bytes); } }
  if (text.includes('\0')) throw new Error('这不是文本文件 / Not a text file');
  return { content: text.replace(/\r\n?/g, '\n'), encoding };
}

async function readDocument(filename) {
  const real = await fs.realpath(filename);
  if (!TEXT_EXT.has(path.extname(real).toLowerCase())) throw new Error('不支持的文件类型 / Unsupported file type');
  const stat = await fs.stat(real);
  if (!stat.isFile() || stat.size > TEXT_LIMIT) throw new Error('文件超过 2 MB 或不是普通文件 / File exceeds 2 MB or is not a regular file');
  const bytes = await fs.readFile(real);
  if (bytes.length > TEXT_LIMIT) throw new Error('文件超过 2 MB / File exceeds 2 MB');
  return { path: real, name: path.basename(real), ...decodeText(bytes), modifiedAt: stat.mtimeMs };
}

function isInside(root, filename) {
  const relative = path.relative(root, filename);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

async function resolveImage(documentPath, rawReference) {
  if (typeof rawReference !== 'string' || rawReference.length > 4096 || rawReference.includes('\0')) throw new Error('Invalid image reference');
  let reference = decodeURIComponent(rawReference.split(/[?#]/)[0]).replaceAll('\\', '/');
  if (!reference || reference.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(reference)) throw new Error('Only document-relative images are allowed');
  const root = await fs.realpath(path.dirname(documentPath));
  const candidate = path.resolve(root, reference);
  if (!isInside(root, candidate)) throw new Error('Image is outside the document folder');
  const real = await fs.realpath(candidate);
  if (!isInside(root, real)) throw new Error('Image symlink is outside the document folder');
  const mime = IMAGE_TYPES[path.extname(real).toLowerCase()];
  if (!mime) throw new Error('Unsupported image type');
  const stat = await fs.stat(real);
  if (!stat.isFile() || stat.size > IMAGE_LIMIT) throw new Error('Image exceeds 20 MB');
  return { path: real, mime };
}

function fileArguments(argv, cwd) {
  return argv.filter(arg => typeof arg === 'string' && !arg.startsWith('-') && TEXT_EXT.has(path.extname(arg).toLowerCase())).map(arg => path.resolve(cwd, arg));
}
function externalUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try { const u = new URL(value); return ['https:', 'http:', 'mailto:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
module.exports = { decodeText, readDocument, resolveImage, fileArguments, externalUrl, isInside, TEXT_LIMIT, IMAGE_LIMIT };
