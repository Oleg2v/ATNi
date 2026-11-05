// Measures the compressed weight of the first load: index.html + CSS + JS chunks referenced by index.html (not lazy chunks).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { join } from 'node:path';
const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)].map((m) => m[1]);
// modulepreload + script + css
let totalGz = 0, totalBr = 0, totalRaw = 0;
const rows = [];
const add = (name, buf) => { const gz = gzipSync(buf).length, br = brotliCompressSync(buf).length; totalGz += gz; totalBr += br; totalRaw += buf.length; rows.push({ file: name, raw: buf.length, gzip: gz, brotli: br }); };
add('index.html', Buffer.from(html));
for (const r of refs) add(r, readFileSync(join(dist, r)));
// the lazily loaded chunks, for information
const lazy = readdirSync(join(dist, 'assets')).filter((f) => !refs.includes(`assets/${f}`)).map((f) => ({ file: `assets/${f} (lazy)`, raw: statSync(join(dist, 'assets', f)).size, gzip: gzipSync(readFileSync(join(dist, 'assets', f))).length }));
console.table(rows);
console.log(`FIRST LOAD: raw ${(totalRaw / 1024).toFixed(1)} KB · gzip ${(totalGz / 1024).toFixed(1)} KB · brotli ${(totalBr / 1024).toFixed(1)} KB (budget: 250 KB gzip JS)`);
const js = rows.filter((r) => r.file.endsWith('.js')).reduce((s, r) => s + r.gzip, 0);
console.log(`FIRST LOAD JS gzip: ${(js / 1024).toFixed(1)} KB`);
console.table(lazy);
