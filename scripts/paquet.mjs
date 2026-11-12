// Paquet à déployer sur Hostinger (D-G-031) : node scripts/paquet.mjs
// → paquet/superchef-<version>.zip, avec index.html à la racine de l'archive (à vider dans public_html),
//   le .htaccess de hostinger/ et les notes de version (comme sur Pages).
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { creerZip } from './zip.mjs';

const racine = new URL('..', import.meta.url).pathname;
const version = JSON.parse(await readFile(join(racine, 'package.json'), 'utf8')).version;

async function lister(dossier) {
  const sortie = [];
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name);
    if (e.isDirectory()) sortie.push(...await lister(p)); else if (e.name !== '.DS_Store') sortie.push(p);
  }
  return sortie;
}

const dist = join(racine, 'dist');
const entrees = [];
for (const f of (await lister(dist)).sort()) entrees.push({ nom: relative(dist, f).split(sep).join('/'), donnees: await readFile(f) });
entrees.push({ nom: '.htaccess', donnees: await readFile(join(racine, 'hostinger/.htaccess')) });
for (const f of (await readdir(join(racine, 'docs/releases'))).filter((x) => x.endsWith('.json')).sort()) {
  entrees.push({ nom: `releases/${f}`, donnees: await readFile(join(racine, 'docs/releases', f)) });
}

const zip = creerZip(entrees);
await mkdir(join(racine, 'paquet'), { recursive: true });
const sortie = join(racine, 'paquet', `superchef-${version}.zip`);
await writeFile(sortie, zip);
console.log(`${relative(racine, sortie)} : ${entrees.length} fichiers, ${(zip.length / 1024).toFixed(0)} Ko, sha256 ${createHash('sha256').update(zip).digest('hex')}`);
