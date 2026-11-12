// Partager une recette en PDF (D-G-048), avec les choix du « Partager » de Dynamite | Agile (D-O-038).
// Au téléphone : la feuille de partage du système, PDF joint (texto, Messenger, WhatsApp, courriel, Drive…).
// Ailleurs : cette feuille. Chaque choix télécharge d'abord le PDF (un lien mailto: ou web ne peut pas joindre de fichier),
// puis ouvre l'appli ou le site avec un court message. « Lien Google Drive » dépose le PDF dans le dossier SuperChef.ai
// (Exports), lisible par qui a le lien : les messages portent alors le lien, et le code QR le passe au téléphone.
// Rien ne part de la page par lui-même : chaque choix ouvre l'appli de la personne.
import { S, $, toast, errText } from '../etat.js?v=1.20.0';
import { el, ico, vider } from '../el.js?v=1.20.0';
import { getRecipe } from '../donnees.js?v=1.20.0';
import { pdfRecette, nomFichier } from '../fiche-pdf.js?v=1.20.0';
import { qrCanvas } from '../qr.js?v=1.20.0';
import { TYPE_DOSSIER } from '../drive.js?v=1.20.0';

const enc = encodeURIComponent;
const TYPE = 'application/pdf';
const auTelephone = () => window.matchMedia('(pointer: coarse)').matches;
const lignes = (t) => String(t || '').split('\n').map((l) => l.trim()).filter(Boolean);

export function donneesPdf(id, quand = new Date()) {
  const r = S.byId[id], d = getRecipe(id);
  return {
    nom: r.name,
    infos: [r.time && `${Math.round(r.time)} min`, r.portions && `${Math.round(r.portions)} portions`, r.type, r.prot, r.cuisine].filter(Boolean),
    ingredients: d.ing.map((x) => ({ groupe: x.group || '', texte: x.text })),
    etapes: d.steps, sous: d.sous, adaptations: lignes(r.row?.Adaptations),
    source: /^https:\/\/\S+$/.test(r.lien || '') ? r.lien : '',
    date: new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }).format(quand)
  };
}

let P = null;   // { id, fichier, octets, pages, lien, enCours, erreur, url }
export const partageOuvert = () => !!P;

function preparer(id) {
  const { octets, pages } = pdfRecette(donneesPdf(id));
  return { id, octets, pages, fichier: new File([octets], nomFichier(S.byId[id].name), { type: TYPE }), lien: '', enCours: false, erreur: '' };
}
const peutJoindre = (f) => { try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [f] })); } catch (_) { return false; } };

function quoi() {
  const r = S.byId[P.id], l = P.lien;
  return {
    lien: l, sujet: `Recette : ${r.name}`,
    corps: l ? `Voici la recette « ${r.name} » : ${l}\n\nPartagé avec SuperChef.ai` : `Voici la recette « ${r.name} » en PDF (pièce jointe).\n\nPartagé avec SuperChef.ai`,
    court: l ? `Recette : ${r.name} — ${l} — SuperChef.ai` : `Recette : ${r.name} (PDF joint) — SuperChef.ai`
  };
}

/* [groupe, nom, adresse(w, téléphone) -> url, ou null pour « montrer le code QR »] */
const WAYS = [
  ['Courriel', 'Application de courriel', (w) => `mailto:?subject=${enc(w.sujet)}&body=${enc(w.corps)}`],
  ['Courriel', 'Gmail', (w) => `https://mail.google.com/mail/?view=cm&fs=1&su=${enc(w.sujet)}&body=${enc(w.corps)}`],
  ['Courriel', 'Outlook (web)', (w) => `https://outlook.office.com/mail/deeplink/compose?subject=${enc(w.sujet)}&body=${enc(w.corps)}`],
  ['Messages', 'Texto', (w, tel) => (tel ? `sms:?&body=${enc(w.court)}` : null)],
  ['Messages', 'Messenger', (w, tel) => (tel && w.lien ? `fb-messenger://share/?link=${enc(w.lien)}` : 'https://www.messenger.com/')],
  ['Messages', 'WhatsApp', (w) => `https://wa.me/?text=${enc(w.court)}`],
  ['Messages', 'Telegram', (w) => `https://t.me/share/url?url=${enc(w.lien || w.court)}${w.lien ? `&text=${enc(w.sujet)}` : ''}`],
  ['Messages', 'Teams', (w) => (w.lien ? `https://teams.microsoft.com/share?href=${enc(w.lien)}&msgText=${enc(w.sujet)}` : 'https://teams.microsoft.com/')]
];
export const NB_CHOIX = WAYS.length;

export async function partagerRecette(id) {
  if (!S.byId[id]) return;
  P = preparer(id);
  if (auTelephone() && peutJoindre(P.fichier)) {
    try { await navigator.share({ files: [P.fichier], title: S.byId[id].name, text: quoi().court }); P = null; return; } catch (e) { if (e && e.name === 'AbortError') { P = null; return; } }
  }
  dessiner(true);
}
export function closePartage() {
  if (P?.url) URL.revokeObjectURL(P.url);
  P = null; $('#partage')?.remove();
  document.body.style.overflow = ($('#sheet') || $('#comptesheet')) ? 'hidden' : '';
}

const urlPdf = () => (P.url ||= URL.createObjectURL(P.fichier));
function cliquer(attrs) { const a = el('a', { href: urlPdf(), ...attrs }); document.body.append(a); a.click(); a.remove(); }
const telecharger = () => cliquer({ download: P.fichier.name });
function ouvrir(url) { if (/^https:/.test(url)) window.open(url, '_blank', 'noopener'); else window.location.href = url; }
async function copier(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (_) {
    const f = el('textarea', { class: 'pt-cache', readonly: true }, t); document.body.append(f); f.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_e) { ok = false; }
    f.remove(); return ok;
  }
}
function eclairerQr() { const q = $('#pt-qr'); if (!q) return; q.classList.remove('pt-flash'); void q.offsetWidth; q.classList.add('pt-flash'); }

async function creerLien() {
  if (P.enCours || !S.ctx) return;
  P.enCours = true; P.erreur = ''; dessiner();
  const p = P;
  try {
    const drive = S.ctx.drive, role = `partage:${p.id}`;
    const [deja] = await drive.chercher({ role, type: TYPE });
    let f;
    if (deja) f = await drive.remplacerContenu(deja.id, { type: TYPE, octets: p.octets, nom: p.fichier.name });
    else {
      const [exports] = await drive.chercher({ role: 'sous-dossier:Exports', type: TYPE_DOSSIER });
      f = await drive.televerser({ nom: p.fichier.name, type: TYPE, octets: p.octets, parent: exports?.id || S.ctx.dossier?.id, role });
    }
    await drive.partagerLien(f.id);
    p.lien = f.webViewLink || `https://drive.google.com/file/d/${enc(f.id)}/view`;
  } catch (e) {
    p.erreur = e && e.statut === 403
      ? 'Google refuse de créer un lien pour ce fichier (règle de ton compte ou de ton organisation). Télécharge le PDF et joins-le au message.'
      : `Google Drive n'a pas créé le lien : ${errText(e)}`;
  }
  p.enCours = false;
  if (P === p) dessiner();
}

async function choisir(k) {
  const [, nom, adresse] = WAYS[k];
  const url = adresse(quoi(), auTelephone());
  if (url === null) {   // texto, à l'ordinateur
    if (!P.lien && S.ctx) await creerLien();
    if (P?.lien) { eclairerQr(); toast('Un ordinateur n\'envoie pas de texto : vise le code QR avec ton téléphone, puis partage le lien.'); }
    else toast('Un ordinateur n\'envoie pas de texto : télécharge le PDF et envoie-le de ton téléphone.');
    return;
  }
  if (P.lien) {
    ouvrir(url);
    toast((await copier(P.lien)) ? `Lien copié aussi : si ${nom} ne s'ouvre pas, colle-le dans le message.` : `${nom} s'ouvre avec le lien du PDF.`);
  } else {
    telecharger(); ouvrir(url);
    toast(`PDF téléchargé : joins-le au message dans ${nom} (il est dans Téléchargements).`);
  }
}

/** Clics de la feuille ; vrai si le bouton lui appartient. */
export function clicPartage(b) {
  const d = b.dataset;
  if (d.ptclose !== undefined) closePartage();
  else if (!P) return false;
  else if (d.ptdl !== undefined) { telecharger(); toast(`${P.fichier.name} : téléchargé.`); }
  else if (d.ptvoir !== undefined) cliquer({ target: '_blank', rel: 'noopener' });
  else if (d.ptway !== undefined) choisir(+d.ptway);
  else if (d.ptautres !== undefined) navigator.share({ files: [P.fichier], title: S.byId[P.id].name, text: quoi().court }).catch(() => {});
  else if (d.ptlien !== undefined) creerLien();
  else if (d.ptcopier !== undefined) copier(P.lien).then((ok) => toast(ok ? 'Lien copié : colle-le où tu veux.' : 'Copie le lien avec Ctrl+C.'));
  else return false;
  return true;
}

function blocLien(tel) {
  let qr = null;
  if (P.lien && !tel) { try { qr = qrCanvas(P.lien, 180); } catch (_) { qr = el('p', { class: 'hint' }, 'Lien trop long pour un code QR : copie-le.'); } }
  return el('section', { class: 'pt-lien frame', 'data-new': '1.17.0-lien-drive' }, el('h3', {}, 'Lien Google Drive'),
    P.lien ? [
      el('div', { class: 'pt-row' }, el('input', { type: 'text', readonly: true, value: P.lien, id: 'pt-url', 'aria-label': 'Lien du PDF' }),
        el('button', { class: 'btn primary', type: 'button', 'data-ptcopier': '' }, 'Copier le lien')),
      qr && el('div', { class: 'pt-qr', id: 'pt-qr' }, qr, el('p', { class: 'hint' }, 'Vers ton téléphone : vise ce code avec l\'appareil photo, ouvre le lien, puis partage-le (texto, Messenger…).')),
      el('p', { class: 'hint' }, 'Toute personne qui a ce lien peut lire le PDF, sans compte. Tu peux retirer le partage dans ton Drive (dossier SuperChef.ai › Exports).')
    ] : [
      el('p', { class: 'hint' }, 'Pour un texto, le code QR ou un message sans pièce jointe : le PDF va dans ton dossier SuperChef.ai (Exports), avec un lien lisible par qui l\'a. Rien d\'autre n\'est partagé.'),
      P.erreur && el('p', { class: 'notice warn', role: 'alert' }, P.erreur),
      el('button', { class: 'btn', type: 'button', 'data-ptlien': '', disabled: P.enCours }, ico('share'), P.enCours ? 'Création du lien…' : 'Créer le lien Google Drive')
    ]);
}

function dessiner(neuf = false) {
  const r = S.byId[P.id], tel = auTelephone();
  let n = $('#partage');
  if (!n) { n = el('div', { id: 'partage', class: 'sheet partage', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pt-h' }); document.body.append(n); }
  document.body.style.overflow = 'hidden';
  const groupes = [...new Set(WAYS.map((x) => x[0]))];
  vider(n).append(
    el('div', { class: 'sheet-bar' }, el('div', { class: 'wrap' }, el('span', { class: 'label' }, 'Partager la recette'),
      el('button', { class: 'btn icon', type: 'button', 'data-ptclose': '', 'aria-label': 'Fermer le partage' }, '×'))),
    el('div', { class: 'wrap pt-corps', 'data-new': '1.17.0-partage-pdf' },
      el('h2', { id: 'pt-h' }, r.name),
      el('div', { class: 'pt-fichier frame' }, ico('file'),
        el('span', {}, P.fichier.name, el('small', {}, `PDF · ${P.pages} page${P.pages > 1 ? 's' : ''} · ${Math.max(1, Math.round(P.fichier.size / 1024))} Ko`)),
        el('button', { class: 'btn', type: 'button', 'data-ptvoir': '' }, 'Voir'),
        el('button', { class: 'btn primary', type: 'button', 'data-ptdl': '' }, 'Télécharger')),
      el('div', { class: 'pt-cols' },
        el('div', {}, groupes.map((g) => el('div', { class: 'pt-groupe' }, el('p', { class: 'pt-nom' }, g),
          el('div', { class: 'pt-ways', role: 'group', 'aria-label': g }, WAYS.map((x, k) => x[0] === g
            && el('button', { class: 'btn', type: 'button', 'data-ptway': String(k), title: x[2](quoi(), tel) === null ? 'Sur un ordinateur : le code QR passe le lien au téléphone' : null }, x[1]))))),
        peutJoindre(P.fichier) && el('div', { class: 'pt-ways' }, el('button', { class: 'btn', type: 'button', 'data-ptautres': '' }, ico('share'), 'Autres applications…'))),
        S.ctx && blocLien(tel)),
      el('p', { class: 'hint' }, P.lien ? 'Chaque choix met le lien du PDF dans le message (et le copie) : pas besoin de pièce jointe.'
        : 'Chaque choix télécharge d\'abord le PDF : glisse-le dans le message, ou joins-le depuis Téléchargements. Avec le lien Google Drive, le message contient le lien.')));
  if (neuf) n.querySelector('[data-ptclose]')?.focus({ preventScroll: true });
}
