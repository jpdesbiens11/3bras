// Connexion Google (Google Identity Services, flux jeton).
// N-02 : le jeton vit en mémoire seulement, jamais dans le stockage du navigateur.
// Il dure une heure ; on le renouvelle sans invite quelques minutes avant la fin.

const MARGE_MS = 5 * 60 * 1000;

export function creerAuth({ clientId, portees, google = globalThis.google, maintenant = () => Date.now() }) {
  let jeton = null;
  let expireA = 0;
  let client = null;
  let enAttente = null;

  function obtenirClient() {
    if (client) return client;
    if (!google?.accounts?.oauth2) throw new Error('google-indisponible');
    client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: portees,
      callback: (rep) => {
        const p = enAttente; enAttente = null;
        if (!p) return;
        if (rep.error) { p.rejeter(new Error(rep.error)); return; }
        jeton = rep.access_token;
        expireA = maintenant() + Number(rep.expires_in || 3600) * 1000;
        p.resoudre(jeton);
      },
      error_callback: (err) => {
        const p = enAttente; enAttente = null;
        p?.rejeter(new Error(err?.type || 'erreur-google'));
      }
    });
    return client;
  }

  function demander(invite) {
    if (enAttente) return enAttente.promesse;
    let resoudre, rejeter;
    const promesse = new Promise((res, rej) => { resoudre = res; rejeter = rej; });
    enAttente = { promesse, resoudre, rejeter };
    obtenirClient().requestAccessToken({ prompt: invite });
    return promesse;
  }

  return {
    // Premier appel : clic sur le bouton (Google exige un geste de l'utilisateur).
    connecter: () => demander(''),
    // Renvoie un jeton valide, renouvelé au besoin.
    async jetonValide() {
      if (jeton && maintenant() < expireA - MARGE_MS) return jeton;
      if (!jeton) throw new Error('non-connecte');
      return demander('');
    },
    estConnecte: () => Boolean(jeton) && maintenant() < expireA,
    deconnecter() {
      if (jeton && google?.accounts?.oauth2?.revoke) google.accounts.oauth2.revoke(jeton, () => {});
      jeton = null; expireA = 0;
    }
  };
}
