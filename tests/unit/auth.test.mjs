import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerAuth } from '../../dist/js/auth.js';

function fauxGoogle() {
  const etat = { demandes: 0, revoques: [], prochain: 1 };
  const google = { accounts: { oauth2: {
    initTokenClient: (cfg) => ({
      requestAccessToken: () => {
        etat.demandes++;
        const n = etat.prochain++;
        queueMicrotask(() => cfg.callback({ access_token: `jeton-${n}`, expires_in: 3600 }));
      }
    }),
    revoke: (j) => etat.revoques.push(j)
  } } };
  return { google, etat };
}

test('N-02 : connexion donne un jeton gardé en mémoire', async () => {
  const { google } = fauxGoogle();
  const auth = creerAuth({ clientId: 'x', portees: 'p', google });
  assert.equal(auth.estConnecte(), false);
  assert.equal(await auth.connecter(), 'jeton-1');
  assert.equal(auth.estConnecte(), true);
  assert.equal(await auth.jetonValide(), 'jeton-1');
});

test('N-02 : renouvellement avant la fin de l\'heure', async () => {
  const { google, etat } = fauxGoogle();
  let t = 0;
  const auth = creerAuth({ clientId: 'x', portees: 'p', google, maintenant: () => t });
  await auth.connecter();
  t = 50 * 60 * 1000;
  assert.equal(await auth.jetonValide(), 'jeton-1');
  t = 56 * 60 * 1000;
  assert.equal(await auth.jetonValide(), 'jeton-2');
  assert.equal(etat.demandes, 2);
});

test('jeton exigé avant connexion', async () => {
  const { google } = fauxGoogle();
  const auth = creerAuth({ clientId: 'x', portees: 'p', google });
  await assert.rejects(auth.jetonValide(), /non-connecte/);
});

test('déconnexion révoque et oublie le jeton', async () => {
  const { google, etat } = fauxGoogle();
  const auth = creerAuth({ clientId: 'x', portees: 'p', google });
  await auth.connecter();
  auth.deconnecter();
  assert.deepEqual(etat.revoques, ['jeton-1']);
  assert.equal(auth.estConnecte(), false);
});

test('N-02 : aucun stockage navigateur dans le code', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../dist/js/auth.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /localStorage|sessionStorage|document\.cookie|indexedDB/);
});
