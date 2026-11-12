// Stock de base (D-G-039) : liste à cocher pour remplir l'onglet Inventaire du classeur.
// Deux sources : les essentiels courants (dist/kits/stock-base.json) et les ingrédients de garde-manger
// (épices, épicerie sèche, conserves) des recettes du livre. Rien n'est préchargé dans l'app : seul ce qui
// est coché est écrit, par l'import validé (D-G-016). Sans DOM : testé à part.
import { norm } from './etat.js?v=1.12.0';
import { niceName, deptOf, zoneOf, ingKey, neverBuy } from './cuisine.js?v=1.12.0';
import { FORMAT, valider } from './import.js?v=1.12.0';
import { VERSION_SCHEMA } from './schema.js?v=1.12.0';
import { slug } from './donnees.js?v=1.12.0';

const PLACARD = ['Épices', 'Épicerie sèche', 'Conserves'];
const GENERIQUES = new Set(['pate', 'pates', 'sauce', 'huile', 'riz', 'epices', 'assaisonnement']);
const MOTS_VIDES = new Set(['de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'en', 'a', 'au', 'aux', 'et']);
const mots = (s) => norm(s).replace(/[’']/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !MOTS_VIDES.has(w)).map((w) => w.replace(/[sx]$/, ''));
// a couvre b si tous les mots de a sont dans b (« Farine tout usage » couvre « Farine tout usage non blanchie »).
export const couvre = (a, b) => { const wa = mots(a), wb = new Set(mots(b)); return wa.length > 0 && wa.every((w) => wb.has(w)); };

// Nom d'article propre tiré d'une ligne d'ingrédient, ou [] (eau, vin…).
export function nomsArticles(ligne) {
  if (neverBuy(ingKey(ligne))) return [];
  let n = niceName(ligne)
    .replace(/^(pincée|pincées|trait|traits|filet|soupçon|cuillère|tasse)s?\s+(de\s+|d['’]\s*)/i, '')
    .replace(/\s+(pour|au goût|facultatif|en garniture|ou plus).*$/i, '')
    .replace(/\s+(cuit|cuite|cuits|cuites|râpée?s?|hachée?s?|grillée?s?)\b.*$/i, '')
    .replace(/\s+en\s+(fines\s+)?(lanières|dés|cubes|morceaux|tranches|poudre fine)\b.*$/i, '')
    .replace(/\s+de\s+\d.*$/, '')
    .trim();
  const alt = n.split(/\s+ou\s+/i)[0];               // « Gochujang ou sriracha » → « Gochujang »
  if (!GENERIQUES.has(norm(alt))) n = alt;
  if (!n || GENERIQUES.has(norm(n))) return [];
  if (/^sel et poivre/i.test(n)) return ['Sel', 'Poivre'];
  n = n.charAt(0).toUpperCase() + n.slice(1);
  return n.length > 40 ? [] : [n];
}

// recettes : [{ ingText }] → [{ Nom, Zone, Département, recettes: n }] par ordre d'usage.
export function articlesDeRecettes(recettes) {
  const vus = new Map();
  for (const r of recettes) {
    const dansCelleCi = new Set();
    for (const l of String(r.ingText || '').split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('## '))) {
      const dept = deptOf(l); if (!PLACARD.includes(dept)) continue;
      for (const nom of nomsArticles(l)) {
        const cle = [...vus.keys()].find((k) => couvre(vus.get(k).Nom, nom) || couvre(nom, vus.get(k).Nom)) || norm(nom);
        const e = vus.get(cle) || { Nom: nom, Zone: zoneOf(dept), 'Département': dept, recettes: 0 };
        if (!dansCelleCi.has(cle)) { e.recettes++; dansCelleCi.add(cle); }
        vus.set(cle, e);
      }
    }
  }
  return [...vus.values()].sort((a, b) => b.recettes - a.recettes || a.Nom.localeCompare(b.Nom, 'fr'));
}

// Liste à cocher : essentiels (cochés) puis ingrédients des recettes (non cochés : à toi de dire si tu en as).
// existe(nom) : l'article est déjà dans l'inventaire → ni coché ni réécrit.
export function preparerStock(base, deRecettes, existe = () => false) {
  const out = base.map((a) => ({ ...a, source: 'base', recettes: 0 }));
  for (const r of deRecettes) {
    const deja = out.find((a) => couvre(a.Nom, r.Nom) || couvre(r.Nom, a.Nom));
    if (deja) deja.recettes += r.recettes; else out.push({ ...r, Essentiel: r['Département'] !== 'Conserves', source: 'recettes' });
  }
  return out.map((a) => { const present = existe(a.Nom); return { ...a, deja: present, choisi: !present && a.source === 'base' }; });
}

// Lignes de l'onglet Inventaire pour les articles cochés (ids stables i-base-… : ré-ajouter n'ajoute rien).
export function lignesInventaire(articles) {
  const ids = new Set();
  return articles.map((a) => {
    const base = `i-base-${slug(a.Nom) || 'article'}`; let id = base, k = 2;
    while (ids.has(id)) id = `${base}-${k++}`; ids.add(id);
    return { id, Nom: a.Nom, Zone: a.Zone, 'Quantité': 1, 'Département': a['Département'], Essentiel: !!a.Essentiel };
  });
}
export const fichierStock = (rows, jour) => valider({ format: FORMAT, version: 1, schema: VERSION_SCHEMA, genere_le: jour, source: 'stock-base', inventaire: rows });
