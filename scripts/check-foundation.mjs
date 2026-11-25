import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = 'scripts/fondasi.json';
const staged = process.argv.includes('--staged');
const git = (...args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
const read = path => staged ? git('show', ':' + path) : readFileSync(new URL('../' + path, import.meta.url));
let acuan;
try {
  acuan = git('show', 'HEAD:' + manifest);
} catch {
  // Salinan tanpa riwayat Git dan commit awal memakai manifes yang disertakan.
  acuan = read(manifest);
}
const normalize = (path, buf) => /\.(?:docx|png|jpg|woff2)$/.test(path) ? buf : buf.toString('utf8').replace(/\r\n/g, '\n');
const hash = (path, buf) => createHash('sha256').update(normalize(path, buf)).digest('hex');
const daftar = JSON.parse(acuan);
const gagal = [];
if (hash(manifest, acuan) !== hash(manifest, read(manifest))) gagal.push(manifest);
for (const [path, nilai] of Object.entries(daftar)) {
  try {
    if (hash(path, read(path)) !== nilai) gagal.push(path);
  } catch { gagal.push(path); }
}
if (gagal.length) {
  console.error('Fondasi berubah. Minta persetujuan pemilik proyek untuk:', gagal.join(', '));
  process.exitCode = 1;
} else {
  console.log(`Fondasi sesuai acuan (${Object.keys(daftar).length} berkas).`);
}
