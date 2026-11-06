// Coquille de 3eBras : connexion Google, puis navigation entre les vues.
import { CONFIG } from './config.js?v=1.1.0';
import { T } from './textes.js?v=1.1.0';
import { el, vider } from './el.js?v=1.1.0';
import { creerAuth } from './auth.js?v=1.1.0';
import { creerDrive } from './drive.js?v=1.1.0';
import { ouvrirOuCreer, lienClasseur, lienDossier } from './store.js?v=1.1.0';
import { vueLivre } from './vues/livre.js?v=1.1.0';
import { vueImporter } from './vues/importer.js?v=1.1.0';

const racine = document.getElementById('app');
const VUES = { livre: vueLivre, importer: vueImporter };
let auth = null;

function entete() {
  return el('header', { class: 'entete' },
    el('img', { src: 'icone.svg', alt: '', width: 56, height: 56, class: 'logo' }),
    el('h1', {}, '3eBras'),
    el('p', { class: 'slogan' }, T.slogan));
}

function afficher(...contenu) {
  document.body.classList.remove('connecte');
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
    afficher(el('p', { class: 'avis', role: 'alert' }, T.idClientManquant));
    return;
  }
  const bouton = el('button', { class: 'bouton principal', type: 'button', disabled: true,
    onclick: () => connecter() }, T.attenteGoogle);
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

// Coquille connectée : onglets en bas au téléphone, panneau à gauche à l'ordinateur.
function coquille(ctx) {
  document.body.classList.add('connecte');
  const zone = el('main', { class: 'zone-vue', id: 'vue', tabindex: '-1' });
  const boutons = {};
  const nav = el('nav', { class: 'nav', 'aria-label': T.navPrincipale, 'data-new': '1.1.0-nav' },
    el('span', { class: 'nav-marque' }, el('img', { src: 'icone.svg', alt: '', width: 32, height: 32 }), '3eBras'),
    ...Object.keys(VUES).map((cle) => (boutons[cle] = el('button', { type: 'button', class: 'nav-item',
      onclick: () => ctx.aller(cle) }, cle === 'livre' ? T.navLivre : T.navImporter))),
    el('a', { class: 'nav-item', href: lienClasseur(ctx.classeurId), target: '_blank', rel: 'noopener' }, T.navDrive),
    el('details', { class: 'nav-pied', open: matchMedia('(min-width: 1024px)').matches },
      el('summary', { class: 'nav-item' }, T.navCompte),
      el('div', { class: 'nav-compte' },
        ctx.courriel && el('span', { class: 'aide' }, T.connecteEn(ctx.courriel)),
        ctx.messageMigration && el('span', { class: 'aide' }, ctx.messageMigration),
        ctx.dossier && el('a', { class: 'aide', href: lienDossier(ctx.dossier.id), target: '_blank', rel: 'noopener' }, T.ouvrirDossier),
        el('button', { type: 'button', class: 'bouton discret', onclick: () => { auth.deconnecter(); vueAccueil(); } }, T.deconnexion),
        el('span', { class: 'aide' }, `v${CONFIG.version}`))));

  ctx.aller = async (cle) => {
    for (const [k, b] of Object.entries(boutons)) b.setAttribute('aria-current', k === cle ? 'page' : 'false');
    vider(zone).className = `zone-vue vue-${cle}`;
    try { await VUES[cle](ctx, zone); } catch (err) { console.error(err); vider(zone).append(el('p', { class: 'avis', role: 'alert' }, `${T.erreurTitre} ${err.message}`)); }
  };
  vider(racine).append(nav, zone);
  return ctx.aller('livre');
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
    const m = biblio.migration;
    await coquille({ drive, classeurId: biblio.classeur.id, dossier: biblio.dossier, courriel,
      messageMigration: m && m.apres > m.avant ? T.migration(m.avant, m.apres) : '' });
  } catch (err) {
    vueErreur(err);
  }
}

vueAccueil();
