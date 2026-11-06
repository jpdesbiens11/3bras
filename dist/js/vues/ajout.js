// « + Recette » : même feuille que Gordon Rams.ai (lien, photo ou fichier, texte collé, type, aperçu, ajouter au livre).
// Hors de claude.ai, l'app n'a pas Claude : le texte, Word et PDF sont lus ici ; une photo ou un lien seul passent
// par l'app Claude, dont on colle la réponse dans la boîte de texte (D-G-004, D-G-026).
import { S, $, TYPES, PROTS, CUIS, OUTILS, toast, errText, render } from '../etat.js?v=1.4.0';
import { el, ico, vider } from '../el.js?v=1.4.0';
import { ajouterRecette } from '../donnees.js?v=1.4.0';
import { lireDocx, lirePdf, parseLoose, parseTexte } from '../lecture.js?v=1.4.0';

const SRC_CAT = ['Famille', 'Ricardo', 'Di Stasio', 'Recettes du Québec', 'Labriski', 'Trois fois par jour', 'Web autre'];
const A = { files: [], result: null, busy: false };

export function openAdd() {
  if ($('#addsheet')) return;
  A.result = null; A.files = [];
  const n = el('div', { id: 'addsheet', class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  n.append(
    el('div', { class: 'sheet-bar' }, el('div', { class: 'wrap' }, el('span', { class: 'label' }, 'Ajouter une recette'),
      el('button', { class: 'btn icon', 'data-addclose': '', 'aria-label': 'Fermer' }, ico('left')))),
    el('div', { class: 'wrap' }, el('h2', {}, 'Nouvelle recette'),
      el('p', { style: 'color:var(--muted);max-width:60ch;margin:0' }, 'Donne un PDF, un fichier Word, une photo ou une capture d\'écran, ou colle le texte. 3Bras la met au format du livre, puis tu l\'ajoutes à ton classeur.'),
      el('form', { class: 'addf', id: 'addform' },
        el('div', {}, el('label', { for: 'add-url' }, 'Lien de la recette (facultatif)'), el('input', { id: 'add-url', type: 'url', inputmode: 'url', placeholder: 'https://…', autocomplete: 'off' }),
          el('p', { class: 'hint' }, 'Avec un fichier, une capture ou du texte, le lien sert de source. Donné seul, le lien est envoyé à Claude, qui lit la page et te renvoie la fiche.')),
        el('div', {}, el('span', { class: 'lbl' }, 'Photo ou fichier'),
          el('div', { class: 'pick' },
            el('label', { class: 'btn primary pickbtn' }, ico('camera'), 'Prendre une photo', el('input', { id: 'add-cam', class: 'pickin', type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': 'Prendre une photo ou choisir une image' })),
            el('label', { class: 'btn pickbtn' }, ico('file'), 'Galerie ou fichier', el('input', { id: 'add-file', class: 'pickin', type: 'file', multiple: true, accept: 'image/*,.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain' }))),
          el('div', { class: 'chips', id: 'add-chips' }),
          el('p', { class: 'hint' }, 'Photo du livre ou capture d\'écran (une recette sur deux pages : prends 2 photos). Aussi PDF, Word (.docx) ou texte.')),
        el('div', {}, el('label', { for: 'add-text' }, 'Ou colle le texte (ou la réponse de Claude)'), el('textarea', { id: 'add-text', placeholder: 'Ingrédients, étapes…' })),
        el('div', {}, el('label', { for: 'add-type' }, 'Type'), el('select', { id: 'add-type' }, TYPES.map((t) => el('option', {}, t)))),
        el('div', { class: 'add-acts' }, el('button', { class: 'btn primary', type: 'submit', id: 'add-go', 'data-new': '1.4.0-convertir' }, ico('file'), 'Convertir')),
        el('div', { class: 'add-status', id: 'add-status', 'aria-live': 'polite' })),
      el('div', { class: 'add-prev', id: 'add-prev' })));
  document.body.append(n); document.body.style.overflow = 'hidden';
}
export function closeAdd() { $('#addsheet')?.remove(); if (!S.preview) document.body.style.overflow = ''; }
function addStatus(msg, err) { const s = $('#add-status'); if (s) { vider(s).append(...[].concat(msg || '')); s.classList.toggle('err', !!err); } }

export function paintChips() {
  const n = $('#add-chips'); if (!n) return;
  vider(n).append(...A.files.map((f, i) => el('span', { class: 'fchip' }, ico(f.type.startsWith('image/') ? 'camera' : 'file'),
    f.name.length > 28 ? f.name.slice(0, 25) + '…' : f.name, el('button', { type: 'button', 'data-chipdel': i, 'aria-label': `Retirer ${f.name}` }, '×'))));
  if (A.files.length) addStatus(`${A.files.length} élément(s) prêt(s). Touche « Convertir ».`);
}
export function addFiles(list) { A.files = A.files.concat([...(list || [])]).slice(-8); paintChips(); }
export function removeFile(i) { A.files.splice(i, 1); paintChips(); }

// Consigne pour Claude : même règles que Gordon Rams.ai, réponse JSON à coller dans 3Bras.
function consigne(type, url, nbImages) {
  return `Tu convertis une recette pour mon livre de recettes familial 3Bras. Écris en français québécois.

Règles :
- Ingrédients : reprends fidèlement chaque ingrédient et sa quantité. Mesures métriques d'abord, impériales entre parenthèses quand la source les donne. Regroupe par composante (ex. « Marinade », « Sauce ») seulement si la recette en a plusieurs.
- Étapes : réécris-les dans tes propres mots, en phrases courtes, dans le même ordre, avec les mêmes temps et températures (°C puis °F). Écris les durées en minutes dans l'étape (ex. « 25 minutes »).
- N'invente aucune quantité, température ni durée absente de la source ; liste ce qui manque dans "a_verifier".
- Tâches sous-chef : 2 ou 3 tâches simples et sécuritaires pour un enfant.
- Laisse tomber la publicité, l'histoire, les commentaires et les valeurs nutritives.
- Type : ${type}.

Réponds avec seulement un objet JSON (que je vais copier dans l'app) :
{"nom": "…", "type": "${TYPES.join('" | "')}", "proteine": "${PROTS.join('" | "')}" ou null, "cuisine": "${CUIS.join('" | "')}" ou null, "portions": nombre ou null, "temps_total_min": nombre ou null, "outils": [sous-ensemble de ${JSON.stringify(OUTILS)}], "source_nom": "auteur, site ou livre, ou Inconnue", "source_categorie": "${SRC_CAT.join('" | "')}", "ingredients": [{"groupe": null ou "…", "items": ["…"]}], "etapes": ["…"], "sous_chef": ["…"], "a_verifier": "…"}

${url ? `Lien de la recette (lis cette page) : ${url}\n` : ''}${nbImages ? `Recette : voir ${nbImages > 1 ? `les ${nbImages} photos jointes` : 'la photo jointe'}.` : ''}`;
}
async function versClaude(type, url, images) {
  const texte = consigne(type, url, images.length);
  try {
    if (images.length && navigator.canShare && navigator.canShare({ files: images })) { await navigator.share({ files: images, text: texte, title: 'Recette pour 3Bras' }); }
    else window.open(`https://claude.ai/new?q=${encodeURIComponent(texte)}`, '_blank', 'noopener');
  } catch (e) { if (!(e && e.name === 'AbortError')) window.open(`https://claude.ai/new?q=${encodeURIComponent(texte)}`, '_blank', 'noopener'); }
  addStatus([el('b', {}, 'Claude prend le relais. '), images.length && !(navigator.canShare && navigator.canShare({ files: images })) ? 'Joins ta photo dans Claude. ' : '',
    'Quand il répond, copie sa réponse, colle-la dans la boîte « Ou colle le texte » ci-dessus, puis touche « Convertir ».']);
}

function normRecipe(d, url, type) {
  const pick = (v, list) => (list.includes(v) ? v : null);
  const ing = (Array.isArray(d.ingredients) ? d.ingredients : []).map((g) => ({ groupe: g && g.groupe ? String(g.groupe) : null, items: (g && Array.isArray(g.items) ? g.items : []).map(String).filter(Boolean) })).filter((g) => g.items.length);
  return {
    nom: String(d.nom || 'Nouvelle recette').slice(0, 120), type: pick(d.type, TYPES) || type,
    proteine: pick(d.proteine, PROTS), cuisine: pick(d.cuisine, CUIS),
    portions: Number(d.portions) > 0 ? Math.round(Number(d.portions)) : null, temps: Number(d.temps_total_min || d.temps) > 0 ? Math.round(Number(d.temps_total_min || d.temps)) : null,
    outils: (Array.isArray(d.outils) ? d.outils : []).filter((o) => OUTILS.includes(o)),
    source_nom: String(d.source_nom || 'Inconnue'), source_cat: pick(d.source_categorie || d.source_cat, SRC_CAT) || 'Web autre',
    ingredients: ing, etapes: (Array.isArray(d.etapes) ? d.etapes : []).map(String).filter(Boolean),
    sous: (Array.isArray(d.sous_chef || d.sous) ? (d.sous_chef || d.sous) : []).map(String).filter(Boolean),
    a_verifier: String(d.a_verifier || ''), url
  };
}

export async function convertRecipe() {
  if (A.busy) return;
  const url = $('#add-url').value.trim(), files = [...A.files], pasted = $('#add-text').value.trim(), type = $('#add-type').value;
  const lien = /^https?:\/\/\S+\.\S+/.test(url) ? url : '';
  const images = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
  // Réponse de Claude collée : on la lit directement.
  const json = pasted && parseLoose(pasted);
  if (json && (json.nom || json.ingredients)) {
    if (json.erreur) { addStatus('Claude : ' + json.erreur, true); return; }
    A.result = normRecipe(json, lien, type); addStatus('Fiche de Claude lue. Vérifie-la, puis ajoute-la.'); renderAddPreview(); return;
  }
  if (images.length || (!files.length && !pasted && lien)) { await versClaude(type, lien, images); return; }
  if (!files.length && !pasted) { addStatus('Ajoute un lien, un fichier, une capture ou colle le texte de la recette.', true); return; }
  A.busy = true; $('#add-go').disabled = true; vider($('#add-prev'));
  try {
    let text = pasted ? pasted + '\n\n' : '';
    for (const f of files) {
      const n = f.name.toLowerCase();
      if (n.endsWith('.pdf') || f.type === 'application/pdf') { addStatus('Lecture du PDF…'); text += await lirePdf(f).catch(() => { throw { local: 'Ce PDF ne se lit pas ici (texte en image ou police spéciale). Colle son texte, ou prends-en une capture : Claude la lira.' }; }); }
      else if (n.endsWith('.docx')) { addStatus('Lecture du fichier Word…'); text += await lireDocx(f).catch(() => { throw { local: 'Impossible de lire ce fichier Word. Enregistre-le en .docx ou colle son texte.' }; }); }
      else if (n.endsWith('.doc')) throw { local: 'Les anciens fichiers .doc ne sont pas lus : enregistre-le en .docx ou colle le texte.' };
      else text += await f.text();
      text += '\n';
    }
    const r = parseTexte(text.slice(0, 40000), type);
    if (!r.ingredients.length && !r.etapes.length) throw { local: 'Aucune recette trouvée dans ce texte. Essaie avec Claude : prends une capture ou donne le lien.' };
    A.result = { ...r, url: lien };
    addStatus('Recette lue. Vérifie et corrige la fiche, puis ajoute-la.');
    renderAddPreview();
  } catch (e) { addStatus(e && e.local ? e.local : 'La lecture a été interrompue. Réessaie.', true); }
  A.busy = false; const g = $('#add-go'); if (g) g.disabled = false;
}

function renderAddPreview() {
  const r = A.result, box = $('#add-prev'); if (!box || !r) return;
  const meta = [r.type, r.proteine, r.temps ? r.temps + ' min' : null, r.portions ? r.portions + ' portions' : null, r.source_nom].filter(Boolean);
  const ingTexte = r.ingredients.flatMap((g) => [g.groupe ? `## ${g.groupe}` : null, ...g.items]).filter(Boolean).join('\n');
  vider(box).append(el('div', { class: 'frame', style: 'padding:16px' },
    el('label', { class: 'sr', for: 'add-name' }, 'Nom de la recette'),
    el('input', { id: 'add-name', class: 'name-in', value: r.nom, style: 'width:100%;border:1px solid var(--line);background:transparent;color:var(--fg);padding:4px 8px;border-radius:var(--radius)' }),
    el('div', { class: 'meta' }, meta.map((m) => el('span', {}, m))),
    el('div', { class: 'sheet', style: 'position:static;padding:0;overflow:visible;background:transparent' },
      el('h4', {}, 'Ingrédients'), el('ul', {}, r.ingredients.map((g) => [g.groupe && el('li', { class: 'grp' }, g.groupe), g.items.map((i) => el('li', {}, i))])),
      el('h4', {}, 'Étapes'), el('ol', {}, r.etapes.map((x) => el('li', {}, x))),
      r.sous.length && [el('h4', {}, 'Tâches sous-chef'), el('ul', {}, r.sous.map((x) => el('li', {}, x)))],
      r.a_verifier && el('p', { class: 'hint', style: 'margin-top:12px' }, `À vérifier : ${r.a_verifier}`)),
    el('details', { class: 'tagedit' }, el('summary', {}, ico('check'), 'Corriger le texte'),
      el('div', { class: 'addf' },
        el('div', {}, el('label', { for: 'add-ing' }, 'Ingrédients (un par ligne, « ## Groupe » pour un groupe)'), el('textarea', { id: 'add-ing', value: ingTexte })),
        el('div', {}, el('label', { for: 'add-eta' }, 'Étapes (une par ligne)'), el('textarea', { id: 'add-eta', value: r.etapes.join('\n') })))),
    el('div', { class: 'add-acts', style: 'margin-top:16px' }, el('button', { class: 'btn primary', id: 'add-save', type: 'button' }, ico('save'), 'Ajouter au livre'))));
}

export async function saveRecipe(apres) {
  const r = A.result; if (!r) return;
  r.nom = ($('#add-name')?.value.trim()) || r.nom;
  const ing = $('#add-ing')?.value, eta = $('#add-eta')?.value;
  const lignes = (t) => String(t).split('\n').map((x) => x.trim()).filter(Boolean);
  const btn = $('#add-save'); if (btn) btn.disabled = true; addStatus('Ajout dans ton classeur…');
  try {
    const rec = await ajouterRecette({
      Nom: r.nom, Type: r.type, Statut: 'À trier', 'Étiquettes': 'New', Source: r.source_cat, 'Fiche complète': true,
      'Protéine': r.proteine || '', Cuisine: r.cuisine || '', Portions: r.portions || '', 'Temps total (min)': r.temps || '',
      'Soir de semaine': !!(r.temps && r.temps <= 45), Outils: r.outils.join(', '),
      'Ingrédients': ing !== undefined ? lignes(ing) : r.ingredients.flatMap((g) => [g.groupe ? `## ${g.groupe}` : null, ...g.items]).filter(Boolean),
      'Étapes': eta !== undefined ? lignes(eta) : r.etapes,
      'Tâches sous-chef': r.sous.length ? r.sous : ['Aider à mesurer les ingrédients'],
      'À vérifier': ('Ajoutée depuis l\'app, à essayer. ' + r.a_verifier).trim(),
      'Lien source': /^https:\/\/\S+$/.test(r.url || '') ? r.url : '',
      Notes: [`D'après ${r.source_nom}.${r.portions ? ` ${r.portions} portions.` : ''} Ajoutée avec 3Bras.`]
    });
    closeAdd(); render();
    toast(`Ajoutée au livre : ${rec.name}`, { label: 'Voir', fn: () => apres(rec.id) });
  } catch (e) { if (btn) btn.disabled = false; addStatus(errText(e), true); }
}
