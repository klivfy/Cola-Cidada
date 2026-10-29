import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const output = 'dist';
const rootFiles = ['index.html', 'sw.js', 'manifest.webmanifest', 'icon.svg', '_headers', 'fonts/OFL-Inter.txt'];
const directories = new Map([
  ['src', new Set(['.js', '.css', '.json'])],
  ['fonts', new Set(['.woff2'])],
  ['fotos', new Set(['.jpg', '.jpeg', '.png', '.webp'])],
  ['bandeiras', new Set(['.png', '.jpg', '.webp'])],
  ['partidos', new Set(['.png', '.jpg', '.webp'])],
]);
const maxAssetBytes = 25 * 1024 * 1024;
const excludedMetadata = new Set(['fonts/OFL-Inter.txt', 'fonts/icon-names.txt']);
let count = 0;
let totalBytes = 0;

async function addFile(path) {
  const info = await stat(path);
  if (!info.isFile() || info.size > maxAssetBytes) throw new Error(`Asset inválido ou acima de 25 MiB: ${path}`);
  const target = join(output, path);
  await mkdir(join(target, '..'), { recursive: true });
  await copyFile(path, target);
  count += 1;
  totalBytes += info.size;
}

async function addDirectory(path, extensions) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) await addDirectory(file, extensions);
    else if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) await addFile(file);
    else if (!excludedMetadata.has(file)) throw new Error(`Arquivo inesperado no pacote público: ${relative('.', file)}`);
  }
}

await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const file of rootFiles) await addFile(file);
for (const [path, extensions] of directories) await addDirectory(path, extensions);
console.log(`Pacote público: ${count} arquivos, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB em ${output}/`);
