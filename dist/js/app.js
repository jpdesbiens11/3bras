// Vue Entrée de 3eBras (MVP 0) : connexion Google, puis dossier + classeur.
import { CONFIG } from './config.js?v=1.0.2';
import { T } from './textes.js?v=1.0.2';
import { el, vider } from './el.js?v=1.0.2';
import { creerAuth } from './auth.js?v=1.0.2';
import { creerDrive } from './drive.js?v=1.0.2';
import { ouvrirOuCreer, lienClasseur, lienDossier } from './store.js?v=1.0.2';

const racine = document.getElementById('app');
let auth = null;

function entete() {
  return el('header', { class: 'entete', 'data-new': '1.0.0-entete' },
    el('img', { src: 'icone.svg', alt: '', width: 56, height: 56, class: 'logo' }),
    el('h1', {}, '3eBras'),
    el('p', { class: 'slogan' }, T.slogan));
}

function afficher(...contenu) {
  vider(racine).append(el('div', { class: 'carte' }, entete(), ...contenu),
    el('footer', { class: 'pied' }, `v${CONFIG.version}`));
}

function attendreGoogle(delaiMs = 10000) {
  return new Promise((res, rej) => {
    const debut = Date.now();
    (function verifier() {
      if (globalThis.google?.accounts?.oauth2) return res(globalThis.google);
      if (Date.now() - debut > delaiMs) return rej(new Error('google-indisponible'));
      setTimeout(verifier, 100);
    })();
  });
}

function vueAccueil() {
  if (!CONFIG.clientId) {
    afficher(el('p', { class: 'avis', role: 'alert', 'data-new': '1.0.0-id-manquant' }, T.idClientManquant));
    return;
  }
  const bouton = el('button', { class: 'bouton principal', type: 'button', disabled: true,
    'data-new': '1.0.0-connexion', onclick: () => connecter() }, T.attenteGoogle);
  afficher(bouton, el('p', { class: 'aide' }, T.connexionAide));
  attendreGoogle().then((google) => {
    auth = creerAuth({ clientId: CONFIG.clientId, portees: CONFIG.portees, google });
    bouton.disabled = false;
    bouton.textContent = T.connexion;
  }).catch(vueErreur);
}

function vueTravail(message) {
  afficher(el('p', { class: 'travail', role: 'status' }, el('span', { class: 'roue', 'aria-hidden': 'true' }), message));
}

function vueErreur(err) {
  console.error(err);
  afficher(
    el('h2', {}, T.erreurTitre),
    el('p', { class: 'avis', role: 'alert' }, String(err?.message || err)),
    el('button', { class: 'bouton', type: 'button', onclick: vueAccueil }, T.reessayer));
}

function vuePrete({ nouveau, classeur, dossier }, courriel) {
  afficher(
    el('h2', { 'data-new': '1.0.0-pret' }, T.pretTitre),
    el('p', {}, nouveau ? T.pretNouveau : T.pretExistant),
    el('div', { class: 'actions' },
      el('a', { class: 'bouton principal', href: lienClasseur(classeur.id), target: '_blank', rel: 'noopener' }, T.ouvrirClasseur),
      dossier && el('a', { class: 'bouton', href: lienDossier(dossier.id), target: '_blank', rel: 'noopener' }, T.ouvrirDossier)),
    courriel && el('p', { class: 'aide' }, T.connecteEn(courriel)),
    el('p', { class: 'aide' }, T.aVenir),
    el('button', { class: 'bouton discret', type: 'button', onclick: () => { auth.deconnecter(); vueAccueil(); } }, T.deconnexion));
}

async function connecter() {
  try {
    await auth.connecter();
    const drive = creerDrive({ jetonValide: auth.jetonValide });
    const textes = { recherche: T.recherche, creation: T.creation };
    const biblio = await ouvrirOuCreer(drive, {
      nomDossier: CONFIG.nomDossier, nomClasseur: CONFIG.nomClasseur, version: CONFIG.version
    }, (e) => vueTravail(textes[e]));
    let courriel = '';
    try { courriel = (await drive.moi()).email || ''; } catch { /* facultatif */ }
    vuePrete(biblio, courriel);
  } catch (err) {
    vueErreur(err);
  }
}

vueAccueil();
