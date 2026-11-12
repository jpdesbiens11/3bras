// Paquet Hostinger (D-G-031) : l'archive se relit fichier par fichier, et le .htaccess protège le site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { creerZip, crc32 } from '../../scripts/zip.mjs';

// Relit une archive par son répertoire central, comme le ferait Hostinger.
function lireZip(buf) {
  const fin = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(fin >= 0, 'fin de répertoire central');
  const n = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const sortie = {};
  for (let i = 0; i < n; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const crc = buf.readUInt32LE(p + 16), taille = buf.readUInt32LE(p + 20), lg = buf.readUInt16LE(p + 28);
    const nom = buf.toString('utf8', p + 46, p + 46 + lg), local = buf.readUInt32LE(p + 42);
    const debut = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const donnees = inflateRawSync(buf.subarray(debut, debut + taille));
    assert.equal(crc32(donnees), crc, nom);
    sortie[nom] = donnees.toString('utf8');
    p += 46 + lg;
  }
  return sortie;
}

test('D-G-031 : archive zip relue à l\'identique (noms accentués compris)', () => {
  const entrees = [
    { nom: 'index.html', donnees: Buffer.from('<!DOCTYPE html><title>SuperChef.ai</title>') },
    { nom: 'kits/québécois.json', donnees: Buffer.from('{"format":"superchef-import"}'.repeat(50)) },
    { nom: '.htaccess', donnees: Buffer.from('') }
  ];
  const lu = lireZip(creerZip(entrees));
  assert.deepEqual(Object.keys(lu), entrees.map((e) => e.nom));
  for (const e of entrees) assert.equal(lu[e.nom], e.donnees.toString('utf8'));
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('D-G-031 : le .htaccess force HTTPS et durcit les en-têtes', async () => {
  const h = await readFile(new URL('../../hostinger/.htaccess', import.meta.url), 'utf8');
  assert.match(h, /RewriteRule \^ https:\/\/%\{HTTP_HOST\}%\{REQUEST_URI\} \[L,R=301\]/);
  for (const e of ['X-Content-Type-Options "nosniff"', 'X-Frame-Options "DENY"', 'Referrer-Policy', 'Strict-Transport-Security']) assert.ok(h.includes(e), e);
  assert.match(h, /Options -Indexes/);
  assert.match(h, /\\\.\(html\|js\|css\|json\)\$">\s*Header set Cache-Control "no-cache"/);
});
