// Gemini par Firebase AI Logic (D-G-029) : convertit une recette (texte, photo, PDF, lien) en fiche du livre.
// Aucune clé secrète dans l'app : la configuration Firebase est publique, la clé Gemini reste chez Google,
// et App Check (Fraud Defense, anciennement reCAPTCHA Enterprise) n'accepte que les appels qui viennent de 3Bras.
// La bibliothèque Firebase est chargée seulement à la première conversion.
import { CONFIG } from './config.js?v=1.6.1';

let modele = null;

export const iaDisponible = () => !!(CONFIG.ia && CONFIG.ia.apiKey && CONFIG.ia.projectId && CONFIG.ia.appId && CONFIG.ia.recaptcha);

async function obtenirModele() {
  if (modele) return modele;
  const [{ initializeApp }, { initializeAppCheck, ReCaptchaEnterpriseProvider }, { getAI, getGenerativeModel, GoogleAIBackend }] = await Promise.all([
    import('../vendor/firebase/firebase-app.js'),
    import('../vendor/firebase/firebase-app-check.js'),
    import('../vendor/firebase/firebase-ai.js')
  ]);
  const { apiKey, projectId, appId, recaptcha } = CONFIG.ia;
  const app = initializeApp({ apiKey, projectId, appId, authDomain: `${projectId}.firebaseapp.com` }, '3bras');
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(recaptcha), isTokenAutoRefreshEnabled: true });
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  modele = { ai, getGenerativeModel };
  return modele;
}

// parties : [{ texte }] ou [{ mimeType, data (base64) }] ; url : lien à lire par Gemini (outil URL context).
export async function convertirAvecGemini(consigne, parties, url) {
  const { ai, getGenerativeModel } = await obtenirModele();
  const m = getGenerativeModel(ai, {
    model: CONFIG.ia.modele || 'gemini-3.5-flash',
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    ...(url ? { tools: [{ urlContext: {} }] } : {})
  });
  const contenu = [
    ...parties.filter((p) => p.data).map((p) => ({ inlineData: { mimeType: p.mimeType, data: p.data } })),
    consigne
  ];
  const rep = await m.generateContent(contenu);
  return rep.response.text();
}

// Message clair pour les erreurs de Google.
export function erreurIA(e) {
  const t = String((e && (e.code || e.message)) || '');
  if (/app-check|appCheck|attestation|recaptcha/i.test(t)) return 'La vérification anti-robot de Google a échoué. Recharge la page et réessaie.';
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(t)) return 'La limite gratuite de Gemini est atteinte pour le moment. Réessaie plus tard, ou passe par le projet Claude 3Bras.';
  if (/SAFETY|blocked/i.test(t)) return 'Gemini a refusé ce contenu. Essaie avec le texte de la recette.';
  if (/fetch|network|Failed to fetch/i.test(t)) return 'Pas de réseau pour joindre Gemini. Réessaie dans un moment.';
  return `Gemini n'a pas pu convertir la recette (${t.slice(0, 80)}).`;
}
