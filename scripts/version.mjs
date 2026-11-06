// Change la version partout : node scripts/version.mjs 1.0.3
// config.js, package.json, et le ?v= de chaque fichier local (index.html et imports JS),
// pour que le navigateur prenne la nouvelle version au lieu de sa copie en cache.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v || '')) { console.error('Usage : node scripts/version.mjs X.Y.Z'); process.exit(1); }

const racine = new URL('..', import.meta.url).pathname;
async function remplacer(fichier, motif, rempl) {
  const p = join(racine, fichier);
  await writeFile(p, (await readFile(p, 'utf8')).replace(motif, rempl));
}

await remplacer('dist/js/config.js', /version: '[^']+'/, `version: '${v}'`);
await remplacer('package.json', /"version": "[^"]+"/, `"version": "${v}"`);
await remplacer('dist/index.html', /\?v=[\d.]+/g, `?v=${v}`);
for (const f of await readdir(join(racine, 'dist/js'), { recursive: true })) {
  if (f.endsWith('.js')) await remplacer(`dist/js/${f}`, /\.js\?v=[\d.]+'/g, `.js?v=${v}'`);
}
console.log(`Version ${v} appliquée.`);
