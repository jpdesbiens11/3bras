// D-G-025 / D-G-038 : chaque kit annoncé dans Compte existe et passe le vérificateur de kits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { verifierKit } from '../../scripts/valider-kit.mjs';
import { KITS } from '../../dist/js/vues/compte.js';

// Le kit Asiatique d'origine (1.3.0) a deux recettes sans lien d'inspiration : seule exception permise.
const LIENS_MANQUANTS_PERMIS = { asiatique: 2 };

test('D-G-038 / D-G-041 : les 10 kits de Compte sont publiés et valides', async () => {
  assert.deepEqual(KITS.map((k) => k.id), ['survie', 'quebecois', 'vege', 'mexicaine', 'asiatique', 'moyen-orient', 'indienne', 'russe', 'francaise', 'enfants']);
  for (const k of KITS) {
    const f = new URL(`../../dist/kits/${k.id}.json`, import.meta.url).pathname;
    assert.ok(existsSync(f), `kit ${k.id} absent`);
    const err = await verifierKit(f);
    const liens = err.filter((e) => /Lien source/.test(e)).length;
    assert.ok(liens <= (LIENS_MANQUANTS_PERMIS[k.id] || 0), `${k.id} : ${liens} liens manquants`);
    assert.deepEqual(err.filter((e) => !/Lien source/.test(e)), [], k.id);
  }
});

test('D-G-038 : aucun id de recette en double entre les kits', async () => {
  const { readFile } = await import('node:fs/promises');
  const ids = [];
  for (const k of KITS) ids.push(...JSON.parse(await readFile(new URL(`../../dist/kits/${k.id}.json`, import.meta.url), 'utf8')).recettes.map((r) => r.id));
  assert.equal(new Set(ids).size, ids.length);
});
