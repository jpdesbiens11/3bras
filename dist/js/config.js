// Configuration publique de 3Bras. Aucun secret ici (P-11, D-04).
// L'ID client OAuth « Application Web » est public par nature.
export const CONFIG = Object.freeze({
  version: '1.6.0',
  clientId: '437109324574-b0kdk554tldhsj1gjllnhu42m1gueorr.apps.googleusercontent.com',
  portees: 'openid email https://www.googleapis.com/auth/drive.file',
  // Gemini par Firebase AI Logic (D-G-029). Valeurs publiques, aucun secret ; null = sans IA dans l'app.
  // { apiKey, projectId, appId, recaptcha: '<clé de site reCAPTCHA v3>', modele: 'gemini-3.5-flash' }
  ia: null,
  nomDossier: '3eBras',
  nomClasseur: '3eBras — Livre',
  versionSchema: 1
});
