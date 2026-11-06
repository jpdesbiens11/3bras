import { test } from 'node:test';
import assert from 'node:assert/strict';
import relais, { verifier, texteDePage, MODELE } from '../../relais/worker.js';

const req = (corps, origine = 'https://jpdesbiens11.github.io', methode = 'POST', chemin = '/convertir') =>
  new Request(`https://3bras-relais.exemple.workers.dev${chemin}`, { method: methode, headers: { Origin: origine, 'Content-Type': 'application/json' }, body: methode === 'POST' ? JSON.stringify(corps) : undefined });

function fauxFetch(appels) {
  return async (url, opts) => {
    appels.push({ url: String(url), opts });
    if (String(url).startsWith('https://api.anthropic.com')) return new Response(JSON.stringify({ model: MODELE, content: [{ type: 'text', text: '{"nom":"Pâté chinois"}' }] }), { status: 200 });
    return new Response('<html><script type="application/ld+json">{"@type":"Recipe","name":"Tarte"}</script><p>Bonjour</p></html>', { status: 200 });
  };
}

test('relais : origine non permise refusée, aucune clé utilisée', async () => {
  const appels = [];
  const r = await relais.fetch(req({ type: 'Souper', texte: 'x' }, 'https://pirate.exemple'), { ANTHROPIC_API_KEY: 'k' }, {}, fauxFetch(appels));
  assert.equal(r.status, 403);
  assert.equal(appels.length, 0);
});

test('relais : texte → Claude avec la consigne du livre, la clé reste côté relais', async () => {
  const appels = [];
  const r = await relais.fetch(req({ type: 'Souper', texte: 'Pâté chinois : bœuf, maïs, patates' }), { ANTHROPIC_API_KEY: 'cle-secrete' }, {}, fauxFetch(appels));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://jpdesbiens11.github.io');
  assert.equal((await r.json()).texte, '{"nom":"Pâté chinois"}');
  const corps = JSON.parse(appels[0].opts.body);
  assert.equal(corps.model, MODELE);
  assert.match(corps.messages[0].content.at(-1).text, /Tâches sous-chef/);
  assert.equal(appels[0].opts.headers['x-api-key'], 'cle-secrete');
});

test('relais : lien seul → la page est lue (schema.org d\'abord)', async () => {
  const appels = [];
  await relais.fetch(req({ type: 'Dessert', url: 'https://www.exemple.com/tarte' }), { ANTHROPIC_API_KEY: 'k' }, {}, fauxFetch(appels));
  assert.equal(appels[0].url, 'https://www.exemple.com/tarte');
  assert.match(JSON.parse(appels[1].opts.body).messages[0].content.at(-1).text, /schema\.org[\s\S]*"name":"Tarte"[\s\S]*Bonjour/);
});

test('relais : demandes invalides refusées', () => {
  assert.equal(verifier({ type: 'Pizza', texte: 'x' }), 'type');
  assert.equal(verifier({ type: 'Souper' }), 'vide');
  assert.equal(verifier({ type: 'Souper', url: 'http://non-https.com' }), 'url');
  assert.equal(verifier({ type: 'Souper', images: [{ media_type: 'image/svg+xml', data: 'x' }] }), 'images');
  assert.equal(verifier({ type: 'Souper', texte: 'x'.repeat(40001) }), 'texte');
  assert.equal(verifier({ type: 'Souper', images: [{ media_type: 'image/jpeg', data: 'abc' }] }), null);
});

test('relais : texte visible d\'une page sans script ni menu', () => {
  const t = texteDePage('<nav>Menu</nav><h1>Soupe</h1><script>pub()</script><p>Ingrédients&nbsp;: eau</p>');
  assert.doesNotMatch(t, /Menu|pub\(\)/);
  assert.match(t, /Soupe\s+Ingrédients : eau/);
});
