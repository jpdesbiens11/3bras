// Configuration publique de 3Bras. Aucun secret ici (P-11, D-04).
// L'ID client OAuth « Application Web » est public par nature.
export const CONFIG = Object.freeze({
  version: '1.5.0',
  clientId: '437109324574-b0kdk554tldhsj1gjllnhu42m1gueorr.apps.googleusercontent.com',
  portees: 'openid email https://www.googleapis.com/auth/drive.file',
  // Relais Claude (D-G-027) : adresse publique, aucun secret. Vide = conversion par l'app Claude.
  relais: 'https://3bras-relais.jpdesbiens11.workers.dev',
  nomDossier: '3eBras',
  nomClasseur: '3eBras — Livre',
  versionSchema: 1
});
