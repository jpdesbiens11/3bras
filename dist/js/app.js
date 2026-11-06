// 3Bras : coquille de Gordon Rams.ai (en-tête, 6 étapes, feuilles), branchée sur Google Drive.
import { CONFIG } from './config.js?v=1.6.0';
import { S, $, STEPS, READY, DAYS, hooks, computeWeek, render, toast, errText } from './etat.js?v=1.6.0';
import { el, ico, vider } from './el.js?v=1.6.0';
import { creerAuth } from './auth.js?v=1.6.0';
import { creerDrive } from './drive.js?v=1.6.0';
import { ouvrirOuCreer, noterProprietaire } from './store.js?v=1.6.0';
import { chargerTout, loadPlan, loadRecent } from './donnees.js?v=1.6.0';
import { draftWeek, swap, toggleDay, setFixed } from './planif.js?v=1.6.0';
import { ac, addTimer, toggleTimer, dismissTimer, setSound, soundKey, SOUNDS, wakeOn, wakeOff, paintLock } from './minuteurs.js?v=1.6.0';
import { noticeWarn, setStars, setTag, setStatut } from './vues/commun.js?v=1.6.0';
import { viewWeek, savePlan, openPicker, closePicker, pickList, choosePick, openDessert, closeDessert, renderDessert, dessertList, addDessert, removeDessert } from './vues/semaine.js?v=1.6.0';
import { openPreview, closePreview, renderSheet, toggleHave, partagerRecette } from './vues/fiche.js?v=1.6.0';
import { viewTri, loadTri, decide } from './vues/livre.js?v=1.6.0';
import { viewInv, setQty, addInv } from './vues/garde-manger.js?v=1.6.0';
import { viewProvigo, buildProvigo, toggleGrocery } from './vues/provigo.js?v=1.6.0';
import { viewCook, openCook, go, served, applyInvOff } from './vues/poele.js?v=1.6.0';
import { viewBilan, loadBilan, saveBilan } from './vues/bilan.js?v=1.6.0';
import { openAdd, closeAdd, addFiles, removeFile, convertRecipe, saveRecipe } from './vues/ajout.js?v=1.6.0';
import { openCompte, closeCompte, lireImport, chargerKits } from './vues/compte.js?v=1.6.0';

let auth = null;
// Mémoire de l'utilisateur sur l'appareil : son courriel seulement, jamais le jeton (N-02).
const CLE_COMPTE = '3bras-compte';
const compteMemorise = () => { try { return localStorage.getItem(CLE_COMPTE) || ''; } catch (_) { return ''; } };
const memoriser = (c) => { try { c ? localStorage.setItem(CLE_COMPTE, c) : localStorage.removeItem(CLE_COMPTE); } catch (_) {} };
const VUES = { semaine: viewWeek, poele: viewCook, tri: viewTri, livre: viewInv, provigo: viewProvigo, bilan: viewBilan };

function renderSteps() {
  vider($('#steps')).append(...STEPS.map((s) => el('button', { type: 'button', 'data-go': s.id, class: READY.has(s.id) ? '' : 'later', 'aria-current': S.view === s.id ? 'page' : null },
    el('b', {}, s.n), el('i', {}, s.short ? [el('span', { class: 'lg' }, s.label), el('span', { class: 'sh' }, s.short[0], el('br'), s.short[1])] : s.label))));
}
function viewConnexion() {
  const memo = compteMemorise();
  if (!CONFIG.clientId) return [el('div', { class: 'frame connexion' }, el('p', { role: 'alert' }, 'L\'ID client Google n\'est pas encore configuré (js/config.js).'))];
  if (memo) {
    return [el('div', { class: 'frame connexion' },
      el('h3', {}, 'Content de te revoir'),
      el('p', {}, `Ton livre est prêt dans le Drive de ${memo}. Un toucher et on repart.`),
      el('button', { class: 'btn primary', id: 'connexion', disabled: !auth }, ico('users'), auth ? 'Continuer' : 'On attend Google…'),
      el('button', { class: 'btn', id: 'autrecompte' }, 'Utiliser un autre compte'))];
  }
  return [el('div', { class: 'frame connexion' },
    el('h3', {}, 'Ton livre t\'attend'),
    el('p', {}, 'Tes recettes vivent dans ton Google Drive. 3Bras ne voit que les fichiers qu\'il crée. À ta première connexion, il crée ton livre.'),
    el('button', { class: 'btn primary', id: 'connexion', disabled: !auth }, ico('users'), auth ? 'Se connecter avec Google' : 'On attend Google…'))];
}
function doRender() {
  renderSteps();
  const kids = [];
  if (S.err) kids.push(noticeWarn(S.err, S.ctx ? null : el('button', { class: 'btn', id: 'connexion' }, 'Réessayer')));
  kids.push(...(!S.ctx ? viewConnexion() : (VUES[S.view] || viewWeek)()));
  vider($('#main')).append(...kids);
  if (S.view === 'poele') paintLock();
  $('#sync').textContent = !S.ctx ? (S.err ? 'Hors ligne' : 'Connexion à Google…') : S.loading ? 'Lecture du livre…' : `${S.recipes.length} soupers dans le livre`;
  $('#comptebtn').hidden = !S.ctx;
  $('#addbtn').hidden = !S.ctx;
}
hooks.render = doRender;
hooks.renderSheet = renderSheet;

/* ---------- thème ---------- */
function applySkin(k) {
  if (k === 'magazine' || k === 'ardoise') document.documentElement.setAttribute('data-skin', k);
  else { document.documentElement.removeAttribute('data-skin'); k = 'plan'; }
  try { localStorage.setItem('3ebras-skin', k); } catch (_) {}
  const sel = $('#skin'); if (sel) sel.value = k;
}

/* ---------- événements (délégués, comme dans Gordon Rams.ai) ---------- */
document.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  // Compte mémorisé : le premier toucher (une étape, par exemple) reconnecte, comme le bouton Continuer.
  if (!S.ctx && auth && compteMemorise() && b.id !== 'autrecompte' && b.id !== 'connexion') connecter();
  if (d.go) { setView(d.go); return; }
  if (b.id === 'connexion') { connecter(); return; }
  if (b.id === 'autrecompte') { memoriser(''); render(); connecter(true); return; }
  if (b.id === 'comptebtn') { openCompte(); return; }
  if (b.id === 'addbtn') { openAdd(); return; }
  if (d.addclose !== undefined) { closeAdd(); return; }
  if (d.chipdel !== undefined) { removeFile(+d.chipdel); return; }
  if (b.id === 'add-save') { saveRecipe((id) => openPreview(id)); return; }
  if (d.compteclose !== undefined) { closeCompte(); return; }
  if (d.kit) { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); return; }
  if (b.id === 'chargerkits') { chargerKits(recharger); return; }
  if (b.id === 'deconnexion') { auth?.deconnecter(); memoriser(''); closeCompte(); S.ctx = null; S.book = []; render(); return; }
  if (!S.ctx) return;
  if (d.swap) { swap(+d.swap); return; }
  if (d.dtog) { toggleDay(+d.dtog); return; }
  if (b.id === 'adddess') { openDessert(); return; }
  if (d.dclose !== undefined) { closeDessert(); return; }
  if (d.dday) { S.dpick.day = +d.dday; renderDessert(); return; }
  if (d.dadd) { addDessert(d.dadd); return; }
  if (d.ddel) { removeDessert(d.ddel); return; }
  if (d.pick) { openPicker(+d.pick); return; }
  if (d.pickclose !== undefined) { closePicker(); return; }
  if (d.pickid) { choosePick(d.pickid); return; }
  if (d.unfix) { const i = +d.unfix; closePicker(); setFixed(i, null); return; }
  if (d.cook) { if (S.preview) closePreview(); if (S.view !== 'poele') setView('poele'); openCook(d.cook); return; }
  if (d.partager) { partagerRecette(d.partager); return; }
  if (d.ttog) { toggleTimer(d.ttog); return; }
  if (d.tdel) { dismissTimer(d.tdel); return; }
  if (d.havebtn) { toggleHave(d.havebtn); return; }
  if (d.star) { setStars(d.star, +d.n); return; }
  if (d.tag && S.preview) { setTag(S.preview.id, d.tag, d.v); return; }
  if (d.setstatut && S.preview) { setStatut(S.preview.id, d.setstatut); return; }
  if (d.libmode) { S.lib.mode = d.libmode; if (S.lib.mode === 'tri') loadTri(true); render(); return; }
  if (d.libtype) { S.lib.type = d.libtype; render(); return; }
  if (d.libstat) { S.lib.statut = d.libstat; render(); return; }
  if (d.tadd) { addTimer(d.tlabel || 'Minuteur', +d.tadd, S.cook.id); return; }
  if (b.id === 'sndtest') { ac(); SOUNDS[($('#snd') || {}).value || soundKey()].play(); return; }
  if (b.id === 'save') savePlan();
  else if (b.id === 'redraw') { draftWeek(); render(); }
  else if (b.id === 'prev') go(-1);
  else if (b.id === 'next') go(1);
  else if (b.id === 'served') served();
  else if (b.id === 'rebuild') buildProvigo();
  else if (d.preview) openPreview(d.preview, d.day);
  else if (b.hasAttribute('data-close')) closePreview();
  else if (d.sheetswap !== undefined) { const i = +d.sheetswap; swap(i); if (S.plan[i]) openPreview(S.plan[i], i); }
  else if (b.id === 'invoff') applyInvOff();
  else if (d.decide) decide(d.decide);
  else if (d.qty) { const it = (S.inv.items || []).find((i) => i.id === d.qty); if (it) setQty(it, it.qty + (+d.d)); }
  else if (d.bf) { const f = S.bil.form[d.bf]; f[d.k] = Math.min(10, Math.max(1, f[d.k] + (+d.d))); render(); }
  else if (d.brest) { S.bil.form[d.brest].rest = d.v; render(); }
  else if (d.bsave) saveBilan(d.bsave);
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'lib-q') { S.lib.q = t.value; const pos = t.selectionStart; render(); const i = $('#lib-q'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (_) {} } return; }
  if (t.id === 'd-q' && S.dpick) { S.dpick.q = t.value; const l = $('#dlist'); if (l) vider(l).append(...dessertList()); return; }
  if (t.id === 'pick-q' && S.picker) { S.picker.q = t.value; const l = $('#picklist'); if (l) vider(l).append(...pickList()); }
});
document.addEventListener('change', (e) => {
  const t = e.target, d = t.dataset || {};
  if (d.gro !== undefined) toggleGrocery(d.gro);
  if (d.breal) S.bil.form[d.breal].real = t.value;
  if (t.id === 'skin') applySkin(t.value);
  if (t.id === 'snd') setSound(t.value);
  if (d.got !== undefined && S.cook.got) { const k = +d.got; t.checked ? S.cook.got.add(k) : S.cook.got.delete(k); t.closest('label')?.classList.toggle('on', t.checked); }
  if (d.have !== undefined) toggleHave(d.have, t.checked);
  if (t.id === 'pick-every' && S.picker) S.picker.every = t.checked;
  if (t.id === 'fichier-import') { lireImport(t.files[0], recharger); t.value = ''; }
  if (t.id === 'add-cam' || t.id === 'add-file') { addFiles(t.files); t.value = ''; }
});
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'addform') { e.preventDefault(); convertRecipe(); return; }
  if (e.target.id !== 'addinv') return; e.preventDefault();
  if (await addInv($('#inv-name').value, $('#inv-zone').value)) toast('Ajouté à l\'inventaire');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (S.preview) { closePreview(); return; } if (S.dpick) { closeDessert(); return; } if (S.picker) { closePicker(); return; } if ($('#comptesheet')) { closeCompte(); return; } if ($('#addsheet')) { closeAdd(); return; }
  }
  if (S.view !== 'poele' || !S.cook.data) return;
  if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
});
/* coller une image (capture copiée) dans la feuille d'ajout, comme dans Gordon Rams.ai */
document.addEventListener('paste', (e) => {
  if (!$('#addsheet')) return;
  const files = [...((e.clipboardData && e.clipboardData.items) || [])].filter((i) => i.kind === 'file' && /^image\//.test(i.type)).map((i) => i.getAsFile()).filter(Boolean);
  if (!files.length) return; e.preventDefault();
  addFiles(files.map((f, k) => new File([f], f.name && f.name !== 'image.png' ? f.name : `image-collee-${Date.now()}-${k}.png`, { type: f.type })));
});
let sx = null, sy = null;
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#cook') || e.target.closest('button,input,label')) { sx = null; return; } sx = e.clientX; sy = e.clientY; });
document.addEventListener('pointerup', (e) => {
  if (sx === null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 1 : -1);
});

function setView(v) {
  S.view = v; try { history.replaceState(null, '', '#' + v); } catch (_) { location.hash = v; }
  if (v === 'poele') wakeOn(); else wakeOff();
  if (S.ctx && !S.loading) {
    if (v === 'tri' && S.lib.mode === 'tri') loadTri();
    if (v === 'provigo' && !S.prov.lines) buildProvigo();
    if (v === 'bilan' && !S.bil.items) loadBilan();
  }
  render(); window.scrollTo(0, 0);
}
hooks.setView = setView;
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (STEPS.some((s) => s.id === v) && v !== S.view) setView(v); });

/* ---------- démarrage ---------- */
async function boot() {
  S.err = null; S.loading = true; render();
  try {
    await chargerTout();
    loadRecent();
    if (!loadPlan()) draftWeek(); else { S.saved = true; S.swapped = DAYS.map(() => new Set()); }
  } catch (e) { S.err = errText(e); }
  S.loading = false; S.prov.lines = null; S.bil.items = null; S.tri.list = null; S.pages = {};
  setView(S.view);
}
async function recharger() { await boot(); }

let enCours = false;
async function connecter(autreCompte) {
  if (enCours || !auth) return;
  enCours = true;
  try {
    S.err = null;
    await (autreCompte ? auth.choisirCompte() : auth.connecter(compteMemorise()));
    const drive = creerDrive({ jetonValide: auth.jetonValide });
    $('#sync').textContent = 'Ouverture de ta bibliothèque…';
    const b = await ouvrirOuCreer(drive, { nomDossier: CONFIG.nomDossier, nomClasseur: CONFIG.nomClasseur, version: CONFIG.version });
    let courriel = '';
    try { courriel = (await drive.moi()).email || ''; } catch (_) { /* facultatif */ }
    memoriser(courriel);
    noterProprietaire(drive, b.classeur.id, { courriel, version: CONFIG.version }).catch(() => {});
    const m = b.migration;
    S.ctx = { drive, classeurId: b.classeur.id, dossier: b.dossier, courriel,
      messageMigration: m && m.apres > m.avant ? `Classeur mis à jour (schéma ${m.avant} → ${m.apres}).` : '' };
    await boot();
    if (!S.book.length) { toast('Ton livre est vide : choisis un kit pour démarrer.'); openCompte(true); }
  } catch (e) { console.error(e); S.err = errText(e); render(); }
  enCours = false;
}

(function start() {
  S.weekStart = computeWeek();
  applySkin(document.documentElement.getAttribute('data-skin') || 'plan');
  const v = location.hash.slice(1); if (STEPS.some((s) => s.id === v)) S.view = v;
  render();
  if (!CONFIG.clientId) return;
  const debut = Date.now();
  (function attendre() {
    if (globalThis.google?.accounts?.oauth2) { auth = creerAuth({ clientId: CONFIG.clientId, portees: CONFIG.portees, google: globalThis.google }); render(); return; }
    if (Date.now() - debut > 10000) { S.err = 'Google ne répond pas. Vérifie ta connexion, puis recharge la page.'; render(); return; }
    setTimeout(attendre, 100);
  })();
})();
