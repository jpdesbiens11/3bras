// Règles du dépôt vérifiées à chaque version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const DIST = new URL('../../dist/', import.meta.url).pathname;

async function lister(dossier) {
  const sortie = [];
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name);
    if (e.isDirectory()) sortie.push(...await lister(p)); else sortie.push(p);
  }
  return sortie;
}

const tous = await lister(DIST);
// dist/vendor : bibliothèques tierces servies par l'app (D-G-029), vérifiées à part.
const fichiers = tous.filter((f) => !f.includes('/vendor/'));
const vendor = tous.filter((f) => f.includes('/vendor/') && f.endsWith('.js'));
const code = fichiers.filter((f) => ['.js', '.css'].includes(extname(f)));
const pages = fichiers.filter((f) => extname(f) === '.html');

test('N-10 / P-3 : fichiers JS et CSS sous 500 lignes', async () => {
  for (const f of code) {
    const n = (await readFile(f, 'utf8')).split('\n').length;
    assert.ok(n < 500, `${f} : ${n} lignes`);
  }
});

test('N-03 / P-2 : aucun innerHTML, outerHTML, insertAdjacentHTML ni eval', async () => {
  for (const f of code.filter((x) => x.endsWith('.js'))) {
    const src = await readFile(f, 'utf8');
    assert.doesNotMatch(src, /\.innerHTML|\.outerHTML|insertAdjacentHTML|\beval\(|new Function\(/, f);
  }
});

test('P-1 : aucune ressource externe sauf Google Identity', async () => {
  for (const f of [...code, ...pages]) {
    const src = await readFile(f, 'utf8');
    const urls = (src.match(/https?:\/\/[^\s'"`);]+/g) || []).map((u) => u.endsWith('/') ? u : `${u}/`);
    for (const u of urls) {
      if (u === 'http://www.w3.org/2000/svg/') continue; // espace de noms SVG, pas une ressource
      if (u === 'https://…/') continue; // texte d'exemple dans un champ
      if (u.startsWith('https://claude.ai/new')) continue; // lien ouvert dans un nouvel onglet (D-G-026), pas une ressource chargée
      assert.match(u, /^https:\/\/(accounts\.google\.com|www\.googleapis\.com|sheets\.googleapis\.com|docs\.google\.com|drive\.google\.com|firebasevertexai\.googleapis\.com|content-firebaseappcheck\.googleapis\.com|www\.google\.com\/recaptcha|www\.gstatic\.com\/recaptcha|recaptcha\.google\.com\/recaptcha)\//, `${f} : ${u}`); // + Gemini et App Check (D-G-029)
    }
  }
});

test('D-07 / N-03 : chaque page porte la CSP et la Referrer-Policy', async () => {
  for (const f of pages) {
    const src = await readFile(f, 'utf8');
    const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(src)?.[1];
    assert.ok(csp, `${f} sans CSP`);
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self' https:\/\/accounts\.google\.com\/gsi\/client( https:\/\/www\.google\.com\/recaptcha\/ https:\/\/www\.gstatic\.com\/recaptcha\/)?;/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    assert.match(src, /<meta name="referrer"/);
  }
});

test('N-05 : chaque fichier local porte ?v=<version> (cache de Pages)', async () => {
  const version = /version: '([^']+)'/.exec(await readFile(join(DIST, 'js/config.js'), 'utf8'))[1];
  const html = await readFile(join(DIST, 'index.html'), 'utf8');
  for (const ref of html.match(/(?:href|src)="(?:css|js)\/[^"]+"/g)) assert.match(ref, new RegExp(`\\?v=${version}"$`), ref);
  for (const f of code.filter((x) => x.endsWith('.js'))) {
    for (const imp of (await readFile(f, 'utf8')).match(/from '\.\.?\/[^']+'/g) || []) {
      assert.match(imp, new RegExp(`\\.js\\?v=${version}'$`), `${f} : ${imp}`);
    }
  }
});

test('P-11 / N-04 : aucun secret, portée drive.file seulement', async () => {
  const cfg = (await readFile(join(DIST, 'js/config.js'), 'utf8')).replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(cfg, /secret|GOCSPX-|sk-ant-/i);
  // Seule clé permise : la clé de navigateur Firebase (publique par conception, protégée par App Check, D-G-029).
  for (const m of cfg.matchAll(/apiKey:\s*'([^']*)'/g)) assert.match(m[1], /^AIza[\w-]{35}$/);
  assert.match(cfg, /auth\/drive\.file'/);
  assert.doesNotMatch(cfg, /auth\/drive'|auth\/drive\.readonly|spreadsheets'/);
});

test('D-G-029 : bibliothèques tierces servies par l\'app, sans import distant', async () => {
  assert.deepEqual(vendor.map((f) => f.split('/').pop()).sort(), ['firebase-ai.js', 'firebase-app-check.js', 'firebase-app.js']);
  for (const f of vendor) {
    const src = await readFile(f, 'utf8');
    assert.doesNotMatch(src, /(from|import)\s*\(?\s*["']https?:/, f);
  }
});
