// D-G-048 : PDF de la recette (fait dans la page), code QR, dépôt du PDF dans le Drive avec un lien.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { winAnsi, largeur, couper, cheminSvg } from '../../dist/js/pdf.js';
import { pdfRecette, nomFichier } from '../../dist/js/fiche-pdf.js';
import { qr } from '../../dist/js/qr.js';
import { creerDrive } from '../../dist/js/drive.js';
import { creerDriveSimule } from './drive-simule.mjs';

const latin1 = (o) => Buffer.from(o).toString('latin1');
const RECETTE = {
  nom: 'Pâté chinois', infos: ['45 min', '6 portions', 'Bœuf'], date: '12 novembre 2026',
  ingredients: [{ groupe: 'Purée', texte: '1,5 kg de pommes de terre' }, { groupe: 'Purée', texte: '½ tasse de lait' }, { groupe: '', texte: '1 boîte de maïs en crème' }],
  etapes: ['Faire revenir l\'oignon.', 'Étager : bœuf, maïs, purée.', 'Cuire 30 min à 375 °F.'],
  sous: ['Peler les pommes de terre'], adaptations: ['2026-11-10 : sans lactose'], source: 'https://www.ricardocuisine.com/recettes/5541-pate-chinois'
};

test('D-G-048 : texte en WinAnsi (accents, guillemets, fractions), emoji retirés', () => {
  assert.deepEqual(winAnsi('é’œ«»'), [0xe9, 0x92, 0x9c, 0xab, 0xbb]);
  assert.deepEqual(winAnsi('⅓ t'), [...Buffer.from('1/3 t')]);
  assert.deepEqual(winAnsi('thé 🍅.'), [...Buffer.from('th'), 0xe9, 0x2e]);
  assert.deepEqual(winAnsi('a b'), [0x61, 0xa0, 0x62]);
  assert.deepEqual(winAnsi('文'), [63]);
});

test('D-G-048 : largeurs Helvetica et coupure des lignes', () => {
  assert.equal(Math.round(largeur('Hello', 10) * 100) / 100, 22.78);
  assert.ok(largeur('Pâté', 12, true) > largeur('Pâté', 12));
  const t = 'Faire revenir l\'oignon et l\'ail dans l\'huile d\'olive à feu moyen pendant cinq minutes en remuant souvent';
  const l = couper(t, 200, 10.5);
  assert.ok(l.length > 1);
  for (const x of l) assert.ok(largeur(x, 10.5) <= 200, x);
  assert.equal(l.join(' '), t);
  assert.ok(couper('x'.repeat(200), 100, 10).every((x) => largeur(x, 10) <= 100));
  assert.equal(cheminSvg('M11 18 V25 H23 Z'), '11 18 m 11 25 l 23 25 l h');
});

test('D-G-048 : PDF valide (table xref, longueurs des flux), texte, lien et pied de page', () => {
  const { octets, pages } = pdfRecette(RECETTE, new Date('2026-11-12T12:00:00Z'));
  const s = latin1(octets);
  assert.equal(pages, 1);
  assert.match(s, /^%PDF-1\.4\n/);
  assert.match(s, /%%EOF\n$/);
  const xref = Number(/startxref\n(\d+)\n%%EOF/.exec(s)[1]);
  assert.ok(s.startsWith('xref', xref));
  const entrees = s.slice(xref).split('\n').filter((l) => /^\d{10} 00000 n $/.test(l)).map((l) => Number(l.slice(0, 10)));
  entrees.forEach((pos, i) => assert.ok(s.startsWith(`${i + 1} 0 obj`, pos), `objet ${i + 1}`));
  for (const m of s.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const debut = m.index + m[0].length;
    assert.equal(s.indexOf('\nendstream', debut) - debut, Number(m[1]));
  }
  assert.match(s, /\(P\\342t\\351 chinois\) Tj/);                       // accents en octal WinAnsi
  assert.match(s, /\(Super\) Tj/);
  assert.match(s, /\(T\\342ches sous-chef\) Tj/);
  assert.match(s, /\(Adaptations de la famille\) Tj/);
  assert.match(s, /\/S \/URI \/URI \(https:\/\/www\.ricardocuisine\.com\/recettes\/5541-pate-chinois\)/);
  assert.match(s, /\(Page 1 sur 1\) Tj/);
  assert.match(s, /\/Title <FEFF0050[0-9A-F]+>/);
  assert.match(s, /\/BaseFont \/Helvetica \/Encoding \/WinAnsiEncoding/);
  assert.doesNotMatch(s, /FontFile|\/Image/);                            // rien d'intégré : polices standard, pas d'image
});

test('D-G-048 : longue recette sur plusieurs pages, sans section vide', () => {
  const longue = { ...RECETTE, sous: [], adaptations: [], source: '', etapes: Array.from({ length: 40 }, (_, i) => `Étape ${i + 1} : ${'mélanger doucement '.repeat(8)}`) };
  const { octets, pages } = pdfRecette(longue);
  const s = latin1(octets);
  assert.ok(pages >= 3, `${pages} pages`);
  assert.equal((s.match(/\/Type \/Page \//g) || []).length, pages);
  assert.match(s, new RegExp(`\\(Page ${pages} sur ${pages}\\) Tj`));
  assert.doesNotMatch(s, /Tâches|T\\342ches|Adaptations|Recette d'origine|\/URI/);
});

test('D-G-048 : nom de fichier sûr', () => {
  assert.equal(nomFichier('Pâté chinois « Œuf » #2 !'), 'pate-chinois-oeuf-2-superchef.pdf');
  assert.equal(nomFichier(''), 'recette-superchef.pdf');
  assert.ok(nomFichier('x'.repeat(200)).length <= 75);
});

test('D-G-048 : code QR d\'un lien Drive (repris de Dynamite | Agile)', () => {
  const c = qr('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456/view?usp=drivesdk');
  const n = c.size;
  assert.equal(n, c.version * 4 + 17);
  const ligne = (y, x0) => Array.from({ length: 7 }, (_, i) => (c.dark(x0 + i, y) ? '1' : '0')).join('');
  for (const [x0, y0] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    assert.equal(ligne(y0, x0), '1111111'); assert.equal(ligne(y0 + 1, x0), '1000001'); assert.equal(ligne(y0 + 3, x0), '1011101');
  }
  assert.equal(c.dark(8, n - 8), true);
});

test('D-G-048 : le PDF va dans le Drive (multipart), le lien est lisible par qui l\'a, puis remplacé sur place', async () => {
  const sim = creerDriveSimule();
  const drive = creerDrive({ jetonValide: async () => 'jeton-test', fetch: sim.fetch });
  const { octets } = pdfRecette(RECETTE);
  const f = await drive.televerser({ nom: 'pate-chinois-superchef.pdf', type: 'application/pdf', octets, parent: 'dossier1', role: 'partage:r1' });
  const enr = sim.fichiers.find((x) => x.id === f.id);
  assert.deepEqual([enr.name, enr.mimeType, enr.parents[0], enr.appProperties['3ebras']], ['pate-chinois-superchef.pdf', 'application/pdf', 'dossier1', 'partage:r1']);
  assert.ok(enr.contenu.startsWith('%PDF-1.4') && enr.contenu.endsWith('%%EOF\n'));
  assert.equal(enr.contenu.length, octets.length);
  await drive.partagerLien(f.id);
  assert.deepEqual(enr.permissions, [{ role: 'reader', type: 'anyone' }]);
  assert.deepEqual((await drive.chercher({ role: 'partage:r1', type: 'application/pdf' })).map((x) => x.id), [f.id]);
  const g = await drive.remplacerContenu(f.id, { type: 'application/pdf', octets, nom: 'pate-chinois-2-superchef.pdf' });
  assert.equal(g.id, f.id);
  assert.equal(enr.versions, 2);
  assert.equal(enr.name, 'pate-chinois-2-superchef.pdf');
  const envoi = sim.appels.find((a) => a.url.includes('uploadType=multipart'));
  assert.match(envoi.url, /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?/);
});
