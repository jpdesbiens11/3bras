// D-G-037 : messages clairs pour les erreurs de Gemini.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erreurIA } from '../../dist/js/ia.js';

test('D-G-037 : un jeton App Check refusé donne un message clair, pas le texte brut de Google', () => {
  const brut = { code: 'AI/fetch-error', message: 'AI: Error fetching from https://firebasevertexai.googleapis.com/v1beta/projects/bras-933fe/models/gemini-3.5-flash-lite:generateContent: [401 ] Firebase App Check token is invalid. (AI/fetch-error)' };
  const t = erreurIA(brut);
  assert.match(t, /vérification anti-robot de Google a échoué/);
  assert.doesNotMatch(t, /firebasevertexai|401/);
  assert.match(erreurIA({ code: 'appCheck/initial-throttle', message: 'AppCheck: 400 error.' }), /anti-robot/);
  assert.match(erreurIA({ message: '[429] RESOURCE_EXHAUSTED' }), /limite gratuite/);
});
