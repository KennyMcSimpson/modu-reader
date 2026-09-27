import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packages = new Set();
const csp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https: http: modu-media:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
await build({
  root, configFile: false, base: './',
  plugins: [react(), {
    name: 'desktop-csp-and-licenses',
    transformIndexHtml: { order: 'post', handler: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }] },
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const moduleId of Object.keys(chunk.modules)) {
          const id = moduleId.replaceAll('\\', '/');
          const i = id.lastIndexOf('/node_modules/');
          if (i < 0) continue;
          const segments = id.slice(i + 14).split('/');
          packages.add(id.slice(0, i + 14) + (segments[0].startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]));
        }
      }
    },
  }],
  resolve: { alias: { '@': root } },
  build: { outDir: 'dist/desktop', emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 1600 },
});

// The renderer is already bundled. A small staging directory avoids shipping
// development dependencies or a duplicate React node_modules tree.
const stage = path.join(root, 'dist/app');
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp(path.join(root, 'desktop'), path.join(stage, 'desktop'), { recursive: true, filter: source => !source.includes(`${path.sep}tests`) && !source.endsWith('.nsh') });
await cp(path.join(root, 'dist/desktop'), path.join(stage, 'dist/desktop'), { recursive: true });
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: 'modu-reader', version: pkg.version, description: pkg.description, author: pkg.author, license: 'MIT', main: 'desktop/main.cjs' }, null, 2));

const notices = path.join(root, 'dist/THIRD_PARTY_NOTICES');
await rm(notices, { recursive: true, force: true });
await mkdir(notices, { recursive: true });
const manifest = [];
for (const dir of [...packages].sort()) {
  const dependency = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  const names = (await readdir(dir)).filter(name => /^(licen[sc]e|copying|notice)([.-]|$)/i.test(name));
  let text = `${dependency.name} ${dependency.version}\nLicense: ${JSON.stringify(dependency.license || 'See source package')}\n`;
  for (const name of names) { try { text += `\n===== ${name} =====\n${await readFile(path.join(dir, name), 'utf8')}`; } catch {} }
  await writeFile(path.join(notices, `${dependency.name.replaceAll('/', '__')}@${dependency.version}.txt`), text);
  manifest.push({ name: dependency.name, version: dependency.version, license: dependency.license });
}
await writeFile(path.join(notices, 'packages.json'), JSON.stringify(manifest, null, 2));
console.log(`Desktop renderer staged at ${stage}; ${manifest.length} dependency notices preserved.`);
