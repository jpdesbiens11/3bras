// Couche de données : le classeur Google remplace les bases Notion de Gordon Rams.ai.
// Toutes les écritures passent par ecrireParId (N-07) ou ajouterUn.
import { S, DAYS, BASE_DAYS, GAP_DAYS, iso, weekLabel } from './etat.js?v=1.6.1';
import { lireOnglets, ecrireParId, ajouterUn } from './store.js?v=1.6.1';
import { ficheDeLigne } from './cuisine.js?v=1.6.1';

const T_REC = 'Recettes', T_PLAN = 'Plans de semaine', T_INV = 'Inventaire', T_BIL = 'Bilans';
const oui = (v) => /^(oui|true|vrai|1|__yes__)$/i.test(String(v || '').trim());
const nb = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return v === '' || v == null || Number.isNaN(n) ? null : n; };
const liste = (v) => String(v || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const ctx = () => S.ctx;
const ecrire = (titre, obj, valeurs) => ecrireParId(ctx().drive, ctx().classeurId, titre, obj, valeurs);
const ajout = (titre, obj) => ajouterUn(ctx().drive, ctx().classeurId, titre, obj);
export const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export const toRecipe = (row) => ({
  id: row.id, row, name: row.Nom || 'Sans nom', statut: row.Statut || 'À trier', prot: row['Protéine'] || null, cuisine: row.Cuisine || null,
  weeknight: oui(row['Soir de semaine']), time: nb(row['Temps total (min)']), portions: nb(row.Portions),
  complete: oui(row['Fiche complète']) || (!!String(row['Étapes'] || '').trim() && !!String(row['Ingrédients'] || '').trim()),
  sous: row['Tâches sous-chef'] || '', note: nb(row['Note globale /10']), fixe: DAYS.indexOf(row['Jour fixe'] || ''),
  last: String(row['Dernière fois cuisinée'] || '').slice(0, 10) || null,
  tools: liste(row.Outils), isNew: liste(row['Étiquettes']).includes('New'), type: row.Type || null,
  ingText: row['Ingrédients'] || '', stepsText: row['Étapes'] || '', lien: row['Lien source'] || ''
});

export function rebuildPools() {
  const book = S.book || [];
  const soupers = book.filter((r) => r.type === 'Souper');
  S.all = Object.fromEntries(soupers.map((r) => [r.id, r]));
  S.recipes = soupers.filter((r) => r.statut === 'Au livre' || r.statut === 'À trier');
  S.desserts = book.filter((r) => r.type === 'Dessert' && r.statut !== 'Déclassée').sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  S.byId = Object.fromEntries(book.map((r) => [r.id, r]));
  S.fixed = {}; soupers.filter((r) => r.fixe >= 0 && r.statut !== 'Déclassée').forEach((r) => { if (!S.fixed[r.fixe]) S.fixed[r.fixe] = r.id; });
}

// Une lecture groupée au démarrage : recettes, plans, inventaire.
export async function chargerTout() {
  const t = await lireOnglets(ctx().drive, ctx().classeurId, [T_REC, T_PLAN, T_INV]);
  S.book = t[T_REC].filter((r) => r.id).map(toRecipe);
  S.planAll = t[T_PLAN].filter((r) => r.id);
  S.inv.items = t[T_INV].filter((r) => r.id).map(toItem).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  rebuildPools();
}

export const getRecipe = (id) => {
  if (S.pages[id]) return S.pages[id];
  const r = S.byId[id];
  return (S.pages[id] = r ? ficheDeLigne(r) : { ing: [], steps: [], sous: [] });
};

/* ---------- plans de semaine : une ligne par souper (et par dessert) ---------- */
const semaineDe = (r) => String(r['Semaine du'] || '').slice(0, 10);
export function loadPlan() {
  const w = iso(S.weekStart);
  const rows = (S.planAll || []).filter((r) => semaineDe(r) === w);
  S.planRows = rows;
  if (!rows.some((r) => r['Recette id'])) return false;
  S.plan = DAYS.map((d) => { const x = rows.find((r) => !oui(r.Dessert) && r.Jour === d && r['Recette id']); return x ? x['Recette id'] : null; });
  S.on = DAYS.map((d, i) => i < BASE_DAYS || !!S.plan[i]);
  const maison = rows.map((r) => r['Déjà à la maison']).find(Boolean) || '';
  S.have = new Set(String(maison).split(';').map((x) => x.trim()).filter(Boolean));
  S.dess = rows.filter((r) => oui(r.Dessert) && r['Recette id']).map((r) => ({ id: r['Recette id'], day: Math.max(0, DAYS.indexOf(r.Jour)) }));
  S.pins = new Set(S.plan.map((id, i) => (id && (S.fixed[i] === id || oui(rows.find((r) => r.Jour === DAYS[i] && !oui(r.Dessert))?.['Épinglé'])) ? i : -1)).filter((i) => i >= 0));
  return true;
}
export function loadRecent() {
  const a = new Date(S.weekStart); a.setDate(a.getDate() - GAP_DAYS);
  const b = new Date(S.weekStart); b.setDate(b.getDate() + GAP_DAYS);
  const w = iso(S.weekStart);
  S.recent = new Set((S.planAll || []).filter((r) => { const d = semaineDe(r); return d > iso(a) && d < iso(b) && d !== w && !oui(r.Dessert); })
    .map((r) => r['Recette id']).filter(Boolean));
}

export async function savePlan() {
  const w = iso(S.weekStart), titre = weekLabel(), maison = [...S.have].join('; ');
  const rows = (S.planAll || []).filter((r) => semaineDe(r) === w);
  for (const [i, d] of DAYS.entries()) {
    const rid = (S.on[i] && S.plan[i]) || '';
    const ex = rows.find((r) => !oui(r.Dessert) && r.Jour === d);
    const val = { 'Recette id': rid, 'Épinglé': S.pins.has(i) ? 'oui' : 'non', Titre: titre };
    if (ex) { if (ex['Recette id'] !== rid || ex['Épinglé'] !== val['Épinglé'] || ex.Titre !== titre) await ecrire(T_PLAN, ex, val); }
    else if (rid) S.planAll.push(await ajout(T_PLAN, { id: `p-${w}-${slug(d)}`, 'Semaine du': w, Jour: d, Dessert: false, 'Déjà à la maison': maison, ...val }));
  }
  const voulus = new Map((S.dess || []).map((x) => [x.id, DAYS[x.day]]));
  for (const r of rows.filter((x) => oui(x.Dessert))) {
    const jour = voulus.get(r['Recette id']);
    if (jour) { if (r.Jour !== jour) await ecrire(T_PLAN, r, { Jour: jour }); voulus.delete(r['Recette id']); }
    else if (r['Recette id']) await ecrire(T_PLAN, r, { 'Recette id': '' });
  }
  for (const [rid, jour] of voulus) {
    S.planAll.push(await ajout(T_PLAN, { id: `p-${w}-dessert-${slug(rid)}`, 'Semaine du': w, Jour: jour, 'Recette id': rid, Dessert: true, Titre: titre, 'Déjà à la maison': maison }));
  }
  loadPlan();
}
export async function saveHave() {
  const maison = [...S.have].join('; ');
  for (const r of S.planRows || []) if (r['Déjà à la maison'] !== maison) await ecrire(T_PLAN, r, { 'Déjà à la maison': maison });
}

/* ---------- recettes ---------- */
export async function majRecette(r, valeurs) {
  await ecrire(T_REC, r.row, valeurs);
  const n = toRecipe(r.row); Object.assign(r, n); delete S.pages[r.id];
}

/* ---------- inventaire ---------- */
export const toItem = (r) => ({ row: r, id: r.id, name: r.Nom || 'Sans nom', zone: r.Zone || 'Garde-manger', qty: nb(r['Quantité']) || 0, unit: r['Unité'] || '', dept: r['Département'] || null, essential: oui(r.Essentiel) });
export const majQuantite = (it, q) => ecrire(T_INV, it.row, { 'Quantité': q });
export async function ajouterArticle(nom, zone, dept, qty) {
  const row = await ajout(T_INV, { id: `i-${slug(nom)}-${Date.now().toString(36)}`, Nom: nom, Zone: zone, 'Quantité': qty, 'Département': dept });
  const it = toItem(row); S.inv.items.push(it); S.inv.items.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return it;
}

/* ---------- bilans ---------- */
export const ajouterBilan = (obj) => ajout(T_BIL, obj);
export const semainePrecedente = (debut) => (S.planAll || []).filter((r) => semaineDe(r) === iso(debut) && !oui(r.Dessert)).map((r) => r['Recette id']).filter(Boolean);

/* ---------- ajouter une recette (bouton + Recette) ---------- */
export async function ajouterRecette(obj) {
  const row = await ajout(T_REC, { id: `r-${slug(obj.Nom)}-${Date.now().toString(36)}`, ...obj });
  const r = toRecipe(row); S.book.push(r); rebuildPools();
  return r;
}
