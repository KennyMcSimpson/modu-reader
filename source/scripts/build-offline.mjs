import { build } from "vite";
import react from "@vitejs/plugin-react";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = path.join(root, "dist/assets");
const packages = new Set();
await build({
  root,
  configFile: false,
  publicDir: false,
  plugins: [react(), {
    name: "record-distribution-licenses",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        for (const moduleId of Object.keys(chunk.modules)) {
          const normalized = moduleId.replaceAll("\\", "/");
          const index = normalized.lastIndexOf("/node_modules/");
          if (index < 0) continue;
          const rest = normalized.slice(index + 14).split("/");
          const name = rest[0].startsWith("@") ? rest.slice(0, 2).join("/") : rest[0];
          packages.add(normalized.slice(0, index + 14) + name);
        }
      }
    },
  }],
  resolve: {alias: {"@": root}},
  define: {"process.env.NODE_ENV": JSON.stringify("production")},
  build: {
    outDir: output,
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 10000000,
    lib: {entry: path.join(root, "src/main.tsx"), name: "ModuReader", formats: ["iife"], fileName: "modu-reader"},
    rolldownOptions: {output: {codeSplitting: false}},
  },
});
const names = await readdir(output);
const jsFiles = names.filter(name => /\.js$/.test(name));
if (jsFiles.length !== 1) throw new Error("Expected a single offline script.");
const js = (await readFile(path.join(output, jsFiles[0]), "utf8")).replace(/[ \t]+$/gm, "");
const css = (await Promise.all(names.filter(name => /\.css$/.test(name)).map(name => readFile(path.join(output, name), "utf8")))).join("\n").replace(/[ \t]+$/gm, "");
const favicon = "data:image/svg+xml;base64," + Buffer.from(await readFile(path.join(root, "public/favicon.svg"))).toString("base64");
const html = `<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="墨读 MoDu Reader · A local-first offline Markdown reader."><title>墨读 MoDu Reader · Offline Markdown Reader</title><link rel="icon" href="${favicon}"><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body><div id="root"></div><noscript>请启用 JavaScript / Enable JavaScript to use the reader.</noscript><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
const destination = path.join(root, "dist/墨读.html");
await writeFile(destination, html);

// Preserve the licenses of packages actually included in this offline bundle.
const notices = path.join(root, "dist/THIRD_PARTY_NOTICES");
await mkdir(notices, {recursive: true});
const summary = [];
for (const dir of [...packages].sort()) {
  try {
    const pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
    const licenseFiles = (await readdir(dir)).filter(name => /^(licen[sc]e|copying|notice)([.-]|$)/i.test(name));
    let licenseText = `${pkg.name} ${pkg.version}\nLicense: ${JSON.stringify(pkg.license || "See source package")}\n`;
    for (const name of licenseFiles) {
      try {licenseText += `\n===== ${name} =====\n` + await readFile(path.join(dir, name), "utf8");} catch {}
    }
    await writeFile(path.join(notices, `${pkg.name.replaceAll("/", "__")}@${pkg.version}.txt`), licenseText);
    summary.push({name: pkg.name, version: pkg.version, license: pkg.license, licenseFiles});
  } catch {}
}
await writeFile(path.join(notices, "packages.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({file: destination, bytes: Buffer.byteLength(html), packages: summary.length}));
