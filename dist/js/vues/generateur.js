// « Créer des recettes avec Claude » (D-G-035) : 1. ce que tu veux, 2. la consigne à donner à Claude,
// 3. sa réponse collée, cochée, puis ajoutée « À trier ». La personne garde la main à chaque étape.
// « Créer des recettes avec Gemini » (D-G-054) : même demande, mais Gemini écrit les fiches lui-même (lots de 5),
// sans copier-coller ; on coche ensuite ce qui entre dans le livre.
import { S, $, CUIS, iso, toast, norm } from '../etat.js?v=1.23.1';
import { el, ico, vider } from '../el.js?v=1.23.1';
import { importer } from '../import.js?v=1.23.1';
import { NOMBRES, TYPES_LOT, DEMANDE_VIDE, PAR_LOT_GEMINI, consigneGenerateur, consigneGemini, lireReponse, preparerChoix, fichierImport } from '../generateur.js?v=1.23.1';
import { ecrireAvecGemini, erreurIA } from '../ia.js?v=1.23.1';

const CLE = 'superchef-generateur'; // la demande reste sur l'appareil le temps d'aller dans Claude
let G = null; // { d: demande, items: [], res, par: 'Claude' | 'Gemini', occupe, avance }
const lireDemande = () => { try { return { ...DEMANDE_VIDE, ...JSON.parse(localStorage.getItem(CLE) || '{}') }; } catch (_) { return { ...DEMANDE_VIDE }; } };
const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(G.d)); } catch (_) {} };
const consigne = () => consigneGenerateur(G.d, (S.book || []).map((r) => r.name));
const lot = () => [G.d.cuisines.join(', '), G.d.motsCles].filter(Boolean).join(' · ') || 'recettes variées';

export const genOuvert = () => !!G;
export function openGen(par = 'Claude') { G = { d: lireDemande(), items: [], res: null, par, occupe: false, avance: '' }; paint(); }
const parGemini = () => G?.par === 'Gemini';
export function closeGen() { G = null; $('#gensheet')?.remove(); document.body.style.overflow = ($('#comptesheet') || $('#sheet')) ? 'hidden' : ''; }

const etape = (n, titre, ...k) => el('section', { class: 'gen-etape' }, el('h3', {}, el('b', {}, n), titre), ...k);
function paint() {
  let n = $('#gensheet');
  if (!n) { n = el('div', { id: 'gensheet', class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gen-h' }); document.body.append(n); }
  document.body.style.overflow = 'hidden';
  const d = G.d;
  vider(n).append(
    el('div', { class: 'sheet-bar' }, el('div', { class: 'wrap' }, el('span', { class: 'label' }, 'Recettes de départ'),
      el('button', { class: 'btn icon', 'data-genclose': '', 'aria-label': 'Fermer' }, ico('left')))),
    el('div', { class: 'wrap gen' }, el('h2', { id: 'gen-h' }, `Créer des recettes avec ${G.par}`),
      el('p', { class: 'gen-intro' }, parGemini()
        ? 'Choisis ce que vous aimez : Gemini écrit les fiches tout seul, sans copier-coller. Tu choisis ensuite ce qui entre dans ton livre.'
        : 'Choisis ce que vous aimez, donne la consigne à Claude (Sonnet 5.5), puis colle sa réponse ici. Tu choisis ce qui entre dans ton livre.'),
      etape('1', 'Ce que vous voulez',
        el('div', { class: 'raccourcis', role: 'group', 'aria-label': 'Cuisines' }, CUIS.map((c) => el('button', { type: 'button', class: 'btn', 'data-gencuis': c, 'aria-pressed': String(d.cuisines.includes(c)) }, c))),
        el('div', { class: 'addf' },
          el('div', {}, el('label', { for: 'gen-mots' }, 'Mots-clés (facultatif)'), el('input', { id: 'gen-mots', value: d.motsCles, placeholder: 'Ex. mijoteuse, poisson, libanaise, réconfortant…', autocomplete: 'off' })),
          el('div', {}, el('label', { for: 'gen-eviter' }, 'À éviter : allergies, aliments, outils (facultatif)'), el('input', { id: 'gen-eviter', value: d.eviter, placeholder: 'Ex. noix, coriandre, friteuse', autocomplete: 'off' })),
          el('div', { class: 'gen-ligne' },
            el('div', {}, el('label', { for: 'gen-type' }, 'Type'), el('select', { id: 'gen-type' }, TYPES_LOT.map((t) => el('option', { value: t, selected: t === d.type }, t)))),
            el('div', {}, el('label', { for: 'gen-portions' }, 'Portions'), el('input', { id: 'gen-portions', type: 'number', min: 1, max: 20, inputmode: 'numeric', value: d.portions }))),
          el('div', { class: 'raccourcis', role: 'group', 'aria-label': 'Nombre de recettes' }, NOMBRES.map((x) => el('button', { type: 'button', class: 'btn', 'data-gennb': x, 'aria-pressed': String(x === d.nombre) }, `${x} recettes`))),
          el('label', { class: 'gen-coche' }, el('input', { id: 'gen-soirs', type: 'checkbox', checked: d.soirs }), 'Surtout des soirs de semaine (45 min ou moins)'))),
      parGemini() ? etape('2', 'Gemini écrit les recettes',
        el('div', { class: 'add-acts' }, el('button', { class: 'btn primary', id: 'gen-gemini', type: 'button', disabled: G.occupe }, ico('chef'),
          G.occupe ? 'Gemini écrit…' : `Créer ${d.nombre} recettes avec Gemini`),
          G.occupe && el('button', { class: 'btn', id: 'gen-stop', type: 'button' }, 'Arrêter')),
        el('p', { class: 'hint', id: 'gen-avance', 'aria-live': 'polite' }, G.avance || `Par lots de ${PAR_LOT_GEMINI} : compte de 20 à 60 secondes par lot. Les recettes déjà dans ton livre ne reviennent pas.`),
        el('div', { id: 'gen-liste', 'aria-live': 'polite' }, liste())) : null,
      !parGemini() && etape('2', 'Donne la consigne à Claude',
        el('label', { class: 'sr', for: 'gen-consigne' }, 'Consigne pour Claude'),
        el('textarea', { id: 'gen-consigne', class: 'gen-consigne', readonly: true, value: consigne() }),
        el('div', { class: 'add-acts' },
          el('button', { class: 'btn primary', id: 'gen-copier', type: 'button' }, ico('file'), 'Copier la consigne'),
          typeof navigator !== 'undefined' && navigator.share && el('button', { class: 'btn', id: 'gen-partager', type: 'button' }, ico('share'), 'Envoyer à l\'app Claude'),
          el('a', { class: 'btn', href: 'https://claude.ai/new', target: '_blank', rel: 'noopener noreferrer' }, 'Ouvrir Claude')),
        el('p', { class: 'hint' }, 'Dans Claude, choisis Sonnet 5.5 et colle la consigne. Quand il a fini, touche « Copier » sur son bloc de code, puis reviens ici.')),
      !parGemini() && etape('3', 'Colle la réponse de Claude',
        el('label', { class: 'sr', for: 'gen-reponse' }, 'Réponse de Claude'),
        el('textarea', { id: 'gen-reponse', placeholder: 'FICHE SUPERCHEF\nNom : …' }),
        el('div', { class: 'add-acts' },
          el('button', { class: 'btn primary', id: 'gen-lire', type: 'button' }, ico('check'), 'Lire les recettes'),
          typeof navigator !== 'undefined' && navigator.clipboard?.readText && el('button', { class: 'btn', id: 'gen-coller', type: 'button' }, 'Coller et lire')),
        el('div', { id: 'gen-liste', 'aria-live': 'polite' }, liste()))));
}

export function majDemande() {
  if (!G) return;
  const v = (id) => $(`#${id}`);
  Object.assign(G.d, { motsCles: v('gen-mots')?.value || '', eviter: v('gen-eviter')?.value || '', type: v('gen-type')?.value || 'Souper',
    portions: +(v('gen-portions')?.value) || 4, soirs: !!v('gen-soirs')?.checked });
  garder(); const c = $('#gen-consigne'); if (c) c.value = consigne();
}
export function basculerCuisine(c) { if (!G) return; const s = new Set(G.d.cuisines); s.has(c) ? s.delete(c) : s.add(c); G.d.cuisines = CUIS.filter((x) => s.has(x)); majDemande(); paintBoutons('[data-gencuis]', (b) => G.d.cuisines.includes(b.dataset.gencuis)); }
export function choisirNombre(x) {
  if (!G) return; G.d.nombre = +x; majDemande(); paintBoutons('[data-gennb]', (b) => +b.dataset.gennb === G.d.nombre);
  const g = $('#gen-gemini'); if (g && !G.occupe) vider(g).append(ico('chef'), `Créer ${G.d.nombre} recettes avec Gemini`);
}
const paintBoutons = (sel, on) => document.querySelectorAll(`#gensheet ${sel}`).forEach((b) => b.setAttribute('aria-pressed', String(on(b))));

export async function copierConsigne() {
  const t = consigne();
  try { await navigator.clipboard.writeText(t); toast('Consigne copiée. Colle-la dans Claude.'); }
  catch (_) { const c = $('#gen-consigne'); c?.select(); toast('Sélectionne la consigne et copie-la (Ctrl+C ou toucher prolongé).'); }
}
export async function partagerConsigne() { try { await navigator.share({ title: 'Recettes pour SuperChef.ai', text: consigne() }); } catch (_) { /* partage annulé */ } }
export async function collerReponse() {
  try { const t = await navigator.clipboard.readText(); const z = $('#gen-reponse'); if (z) z.value = t; lireRecettes(); }
  catch (_) { toast('Colle la réponse dans la boîte (toucher prolongé, puis Coller).'); }
}

export function lireRecettes() {
  if (!G) return;
  const { fiches, json, tronque } = lireReponse($('#gen-reponse')?.value, G.d.type === 'Mélange' ? 'Souper' : G.d.type);
  if (json) { G.items = json.ok ? json.donnees.recettes.map((row) => ({ r: { nom: row.Nom, type: row.Type, ingredients: [], etapes: [] }, row, valide: true, kit: false, deja: false, choisi: true })) : []; G.res = json.ok ? null : json.erreurs[0]; }
  else { G.items = preparerChoix(fiches, (S.book || []).map((r) => r.name), { lot: lot(), jour: iso(new Date()) }); G.res = tronque ? 'Seules les 40 premières fiches sont lues.' : null; }
  vider($('#gen-liste')).append(liste());
}
// D-G-054 : lots de 5 jusqu'au nombre voulu ; les fiches déjà écrites (ou au livre) sont données à Gemini pour ne pas revenir.
// D-G-055 : le texte arrive en flux ; on montre ce qui est écrit, les secondes, et on peut arrêter (on garde ce qui est fini).
export async function creerAvecGemini() {
  if (!G || G.occupe) return;
  majDemande();
  const g = G, voulu = g.d.nombre, livre = (S.book || []).map((r) => r.name), vus = new Set(livre.map((x) => norm(x).trim()));
  const fiches = [], debut = Date.now(), type = g.d.type === 'Mélange' ? 'Souper' : g.d.type;
  let enFlux = '';
  Object.assign(g, { occupe: true, items: [], res: null, arret: false, ctrl: new AbortController(), avance: '' });
  const garderFiches = (texte) => {
    for (const f of lireReponse(texte, type).fiches) {
      const k = norm(f.r.nom).trim();
      if (!f.valide || !f.r.nom || vus.has(k) || fiches.length >= voulu) continue;   // seulement des fiches complètes, nouvelles
      vus.add(k);
      f.r.source_nom = 'Gemini'; f.r.source_cat = 'Web autre'; f.r.lien = '';   // pas de web ici : aucun lien n'est sûr
      f.r.a_verifier = ['Recette créée par Gemini : à essayer et à ajuster.', f.r.a_verifier].filter(Boolean).join(' ');
      fiches.push(f);
    }
    g.items = preparerChoix(fiches, livre, { lot: lot(), jour: iso(new Date()), par: 'Gemini' });
    const l = $('#gen-liste'); if (l && G === g) vider(l).append(liste());
  };
  const dire = () => {
    if (G !== g) return;
    const s = Math.round((Date.now() - debut) / 1000), enCours = Math.max(0, (enFlux.match(/FICHE SUPERCHEF/gi) || []).length - 1);
    g.avance = !enFlux ? `Gemini réfléchit… ${s} s` : `Gemini écrit les recettes… ${Math.min(voulu, fiches.length + enCours)} sur ${voulu} · ${s} s`;
    const a = $('#gen-avance'); if (a) a.textContent = g.avance;
  };
  paint(); dire();
  const minuterie = setInterval(dire, 1000);
  try {
    for (let essai = 0; fiches.length < voulu && !g.arret && essai < Math.ceil(voulu / PAR_LOT_GEMINI) + 1; essai++) {
      enFlux = '';
      const texte = await ecrireAvecGemini(consigneGemini(g.d, [...livre, ...fiches.map((f) => f.r.nom)]), { max: 12000, signal: g.ctrl.signal, suivi: (t) => { enFlux = t; } });
      if (G !== g) return;   // feuille fermée pendant l'appel
      garderFiches(texte); enFlux = '';
    }
  } catch (e) {
    if (G !== g) return;
    if (enFlux) garderFiches(enFlux);                                   // on garde les fiches finies avant l'arrêt
    if (!g.arret) g.res = erreurIA(e);
  } finally { clearInterval(minuterie); }
  if (G !== g) return;
  const k = fiches.length;
  g.avance = g.arret ? `Arrêté : ${k} recette${k > 1 ? 's' : ''} gardée${k > 1 ? 's' : ''}.`
    : k ? `${k} recette${k > 1 ? 's' : ''} écrite${k > 1 ? 's' : ''} par Gemini en ${Math.round((Date.now() - debut) / 1000)} s. Vérifie-les avant de les ajouter.`
      : g.res ? '' : 'Gemini n\'a renvoyé aucune fiche complète. Précise ta demande et réessaie.';
  g.occupe = false; paint();
}
export function arreterGemini() { if (G?.occupe) { G.arret = true; G.ctrl?.abort(); } }

export function cocher(i, on) { const x = G?.items[+i]; if (x) { x.choisi = on; const b = $('#gen-ajouter'); if (b) b.textContent = texteAjout(); } }
const nbChoisis = () => G.items.filter((x) => x.choisi).length;
const texteAjout = () => { const k = nbChoisis(); return k ? `Ajouter ${k} recette${k > 1 ? 's' : ''} au livre` : 'Coche au moins une recette'; };

function liste() {
  if (!G.items.length) return G.res ? el('p', { class: 'hint err', role: 'alert' }, G.res) : null;
  const meta = (r) => [r.type, r.cuisine, r.temps && `${r.temps} min`, r.portions && `${r.portions} portions`, r.source_nom && r.source_nom !== 'Inconnue' && r.source_nom].filter(Boolean).join(' · ');
  return el('div', { class: 'gen-res' },
    el('p', {}, `${G.items.length} recette${G.items.length > 1 ? 's' : ''} lue${G.items.length > 1 ? 's' : ''}. Décoche celles que tu ne veux pas.`),
    G.res && el('p', { class: 'hint' }, G.res),
    G.items.map((x, i) => el('div', { class: `gen-item${x.choisi ? ' on' : ''}` },
      el('label', {}, el('input', { type: 'checkbox', 'data-genpick': i, checked: x.choisi, disabled: !x.valide || x.kit }),
        el('span', {}, el('b', {}, x.r.nom), el('small', {}, meta(x.r)))),
      el('div', { class: 'chips' }, x.deja && el('span', { class: 'chip' }, 'Déjà dans ton livre'), x.kit && el('span', { class: 'chip warn' }, 'Kit repas : refusée'),
        !x.valide && el('span', { class: 'chip warn' }, 'Fiche incomplète'), x.r.a_verifier && el('span', { class: 'chip' }, 'À vérifier')),
      x.r.ingredients.length > 0 && el('details', {}, el('summary', {}, 'Voir la fiche'),
        el('div', { class: 'label' }, 'Ingrédients'), el('ul', {}, x.r.ingredients.flatMap((g) => [g.groupe && el('li', { class: 'grp' }, g.groupe), ...g.items.map((t) => el('li', {}, t))])),
        el('div', { class: 'label' }, 'Étapes'), el('ol', {}, x.r.etapes.map((t) => el('li', {}, t)))))),
    el('div', { class: 'add-acts' }, el('button', { class: 'btn primary', id: 'gen-ajouter', type: 'button' }, ico('save'), texteAjout())),
    el('div', { id: 'gen-fin', 'aria-live': 'polite' }));
}

export async function ajouterChoisis(apres) {
  const rows = G.items.filter((x) => x.choisi && x.row).map((x) => x.row), fin = $('#gen-fin'), b = $('#gen-ajouter');
  if (!rows.length) { toast('Coche au moins une recette.'); return; }
  const v = fichierImport(rows, iso(new Date()), parGemini() ? 'gemini' : 'claude');
  if (!v.ok) { vider(fin).append(el('p', { class: 'hint err' }, `Ces fiches ne passent pas la vérification : ${v.erreurs[0]}`)); return; }
  if (b) b.disabled = true; vider(fin).append(el('p', { class: 'label' }, 'Écriture dans ton classeur…'));
  try {
    const r = await importer(S.ctx.drive, S.ctx.classeurId, v.donnees);
    const k = r.creees.recettes;
    vider(fin).append(el('p', {}, `${k} recette${k > 1 ? 's' : ''} ajoutée${k > 1 ? 's' : ''} « À trier »${r.deja.recettes ? ` (${r.deja.recettes} déjà là)` : ''}.`),
      el('button', { class: 'btn', id: 'gen-trier', type: 'button' }, ico('right'), 'Aller les trier dans 01 Livre'));
    toast(`${k} recette${k > 1 ? 's' : ''} ajoutée${k > 1 ? 's' : ''} au livre`); await apres();
  } catch (e) { vider(fin).append(el('p', { class: 'hint err' }, `Oups : ${e.message}. Réessaie : rien ne sera dédoublé.`)); }
  if (b) b.disabled = false;
}
