// Lecture des fiches : ingrédients, étapes, minuteurs, rayons Provigo. Repris de Gordon Rams.ai.
import { norm, S } from './etat.js?v=1.2.0';

const STOP = new Set('avec dans pour plus sans tasse tasses cuillere cuilleres soupe environ facultatif hache hachee hachees haches finement coupe coupee coupees coupes cubes tranche tranches gousse gousses grosse gros petit petite moyen moyenne boite pelees pelee goutt bien chaud froid frais fraiche litre litres paquet morceaux reserve rincee rinces egoutte'.split(' '));
export function keywords(line) {
  return norm(line).replace(/\(.*?\)/g, ' ').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w)).slice(0, 4);
}
const lignes = (t) => String(t || '').split('\n').map((l) => l.trim()).filter(Boolean);

// Fiche lue du classeur : « ## Groupe » ouvre un groupe d'ingrédients.
export function ficheDeLigne(r) {
  let group = null; const ing = [];
  for (const l of lignes(r.ingText)) {
    if (l.startsWith('## ')) { group = l.slice(3).trim(); continue; }
    ing.push({ text: l, group, kw: keywords(l) });
  }
  return { ing, steps: lignes(r.stepsText).filter((l) => !l.startsWith('## ')), sous: lignes(r.sous) };
}

export function stepIngredients(step, ing) {
  const s = norm(step);
  return ing.filter((i) => i.kw.some((k) => s.includes(k.slice(0, Math.max(4, k.length - 2)))));
}
export function sousFor(step, idx, sous) {
  if (!sous.length) return null;
  const s = norm(step);
  const hit = sous.find((t) => keywords(t).some((k) => s.includes(k.slice(0, Math.max(4, k.length - 2)))));
  return hit || sous[idx % sous.length];
}
/* durées dans une étape : « 25 minutes », « 10 à 12 min », « 1 heure », « 1 h 30 » */
export function stepDurations(step) {
  const s = norm(step), out = []; const re = /(\d+)(?:\s*(?:a|-|ou)\s*(\d+))?\s*(minutes?|min\b|heures?|h\b)(?:\s*(\d+))?/g; let m;
  while ((m = re.exec(s))) {
    const lo = +m[1], hi = m[2] ? +m[2] : null; if (!lo) continue; const hr = /^h/.test(m[3]);
    const secs = hr ? lo * 3600 + (m[4] ? +m[4] * 60 : 0) : lo * 60;
    const lbl = hi ? `${lo} à ${hi} ${hr ? 'h' : 'min'}` : hr ? `${lo} h${m[4] ? ' ' + m[4] : ''}` : `${lo} min`;
    if (secs >= 30 && secs <= 6 * 3600 && !out.some((o) => o.secs === secs)) out.push({ secs, lbl });
  }
  return out.slice(0, 3);
}
/* étape qui bloque la suite (repos, refroidissement, marinade, levée) */
const BLOCK_RE = /(laisser|faire)\s+(reposer|refroidir|tiedir|lever|mariner|macerer|gonfler|hydrater|degorger)|refrigerer|au frigo|congeler|mariner|reposer\s+\d/;
export const isBlocking = (step) => BLOCK_RE.test(norm(step));
/* ingrédients de chaque étape ; ceux qu'aucune étape ne nomme (sel, poivre…) vont à la 1re étape */
export function stepPlan(d) {
  if (d._plan) return d._plan;
  const per = d.steps.map((st) => stepIngredients(st, d.ing).map((x) => d.ing.indexOf(x)));
  const used = new Set(per.flat()); const extra = d.ing.map((x, k) => k).filter((k) => !used.has(k));
  return (d._plan = { per, extra });
}

/* ---------- ingrédients : clé, département, zone ---------- */
const UNIT_RE = /^(?:\d+[\d.,/]*|[½¼¾⅓⅔]|à|a|ou|environ|ml|l|litres?|g|kg|lb|oz|tasses?|c\.|à|soupe|thé|the|cuill(?:\.|ères?)|pincées?|traits?|filets?|boîtes?|boites?|paquets?|sachets?|gousses?|tranches?|branches?|bouquets?|morceaux?|feuilles?|grosses?|gros|petites?|petits?|moyennes?|moyens?|grandes?|grands?|tiges?|bottes?|un|une|de|d|du|des|le|la|les|l)$/;
export function ingKey(text) {
  const s = norm(text).replace(/\(.*?\)/g, ' ').replace(/[’']/g, ' ').split(/,(?!\d)/)[0];
  const words = s.replace(/[^a-z0-9.,/½¼¾ ]/g, ' ').split(/\s+/).filter(Boolean);
  let i = 0; while (i < words.length && UNIT_RE.test(words[i])) i++;
  const rest = words.slice(i).filter((w) => !/^(de|d|du|des|en|a|au|aux|et|ou)$/.test(w));
  return rest.slice(0, 3).join(' ') || norm(text).slice(0, 24);
}
export function niceName(text) {
  let s = String(text).replace(/\(.*?\)/g, '').split(/,(?!\d)/)[0].trim().replace(/\b([dDlL])['’]/g, "$1' ");
  const words = s.split(/\s+/).filter(Boolean); let i = 0;
  while (i < words.length && UNIT_RE.test(norm(words[i]).replace(/[’'].*$/, '').replace(/[^a-z0-9.,/½¼¾]/g, ''))) i++;
  const out = words.slice(i).join(' ').replace(/\b([dDlL])' /g, "$1'").replace(/^(de |du |des )/i, '').trim();
  s = s.replace(/\b([dDlL])' /g, "$1'");
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : s;
}
const DEPT_RULES = [
  ['Épices', /piment de la jamaique|graines de (coriandre|cumin|fenouil|moutarde)|herbes de provence|ras el hanout|safran|clous? de girofle/],
  ['Fruits et légumes', /haricots verts|pois mange|gingembre|tofu|kale|pleurote|estragon|romarin|roquette|cresson|feves germees|germes de soya/],
  ['Conserves', /pate de tomates?|tomates en des|tomates broyees|lait de coco|en conserve/],
  ['Charcuterie et fromages', /parmigiano|reggiano|provolone/],
  ['Épicerie sèche', /fond de (veau|boeuf|volaille)/],
  ['Épicerie sèche', /arachide|chapelure|bouillon|farine|cassonade|\bsucre\b|\bmiel\b|vinaigre|\bhuile\b|sauce soya|ketchup|sauce chili|sauce poisson|sauce de poisson|teriyaki|hoisin|moutarde de dijon|moutarde a l|\briz\b|quinoa|\bpates?\b|spaghetti|penne|linguine|fettucine|rigatoni|coquilles|lasagne|vermicelle|nouilles|lentilles seches|tortillas chips|biscuits|cajou|noix|sesame|achiote|sirop|nectar|relish|mayonnaise|salsa|capres|olives/],
  ['Conserves', /boite|conserve|lait de coco|soupe condensee|jus de tomate|pate de tomate|sauce tomate|tomates en des|tomates broyees|haricots|pois chiches|lentilles|mais en creme/],
  ['Surgelés', /surgele|congele/],
  ['Poissonnerie', /saumon|crevette|poisson|\bthon\b|morue|petoncle|tilapia|aiglefin/],
  ['Charcuterie et fromages', /jambon|bacon|chorizo|pancetta|prosciutto|fromage|cheddar|parmesan|ricotta|mozzarella|feta|chevre|boursin|monterey|emmental|gruyere|saucisson/],
  ['Viandes', /boeuf|porc|poulet|veau|dinde|agneau|cotelettes?|cotes levees|filet mignon|hauts? de cuisse|poitrine|epaule|saucisse|rosbif|palette|escalope|cubes a ragout|interieur de ronde|\broti\b/],
  ['Produits laitiers et œufs', /\blait\b|creme|beurre|\boeufs?\b|yogourt|yaourt/],
  ['Boulangerie', /\bpains?\b|tortilla|naan|baguette|pita|vol au vent|vols au vent|croute|brioche|kaiser/],
  ['Épices', /cumin|paprika|origan|basilic seche|thym seche|\bcari\b|curry|garam|cardamome|cayenne|\bpoivre\b|\bsel\b|cannelle|muscade|laurier|piment broye|flocons de piment|assaisonnement|moutarde seche|poudre|epices|coriandre moulue|clou de girofle|herbes salees|curcuma/],
  ['Fruits et légumes', /oignon|\bail\b|carotte|celeri|poivron|tomate|laitue|romaine|epinard|brocoli|champignon|portobello|patate|pomme de terre|citron|lime|coriandre|persil|basilic|gingembre|concombre|radis|avocat|courgette|aubergine|\bchou\b|echalote|aneth|thym|citronnelle|\bmais\b|asperge|orange|pomme|jalapeno|piment|menthe|ciboulette|navet|panais|courge|haricots verts|pois mange|germes|fines herbes|bok choy|poireau/]
];
export function deptOf(text) { const s = norm(text).replace(/\(.*?\)/g, ' ').split(/,(?!\d)/)[0].replace(/[’']/g, ' '); for (const [d, re] of DEPT_RULES) if (re.test(s)) return d; return 'Épicerie sèche'; }
export function zoneOf(dept) { return dept === 'Épices' ? 'Épices' : dept === 'Surgelés' ? 'Congélateur' : ['Viandes', 'Poissonnerie', 'Charcuterie et fromages', 'Produits laitiers et œufs', 'Fruits et légumes'].includes(dept) ? 'Frigo' : 'Garde-manger'; }
const SIG_STOP = new Set(['de', 'des', 'du', 'les', 'aux', 'avec', 'pour', 'une', 'ordinaire']);
const QUALIFIERS = ['coco', 'arachide', 'amande', 'avoine', 'soya', 'sure', 'sesame', 'erable', 'poisson', 'chili', 'tomate', 'worcestershire', 'balsamique', 'cidre', 'riz', 'olive', 'canola', 'fume', 'moulue', 'broyee', 'fromage', 'dijon', 'condense', 'poulet', 'boeuf', 'legume'];
const sig = (s) => norm(s).replace(/\(.*?\)/g, ' ').replace(/[’']/g, ' ').replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !SIG_STOP.has(w)).map((w) => w.replace(/[sx]$/, ''));
const SYNONYMS = [[/levure chimique/g, 'poudre a pate'], [/parmigiano reggiano|parmigiano/g, 'parmesan'], [/^huile( de (canola|vegetale)| vegetale| canola)?$/, 'huile vegetale'], [/bicarbonate de sodium/g, 'bicarbonate soude']];
export function invMatch(key) {
  let k = norm(key); for (const [re, to] of SYNONYMS) k = k.replace(re, to);
  const kws = new Set(sig(k)); if (!kws.size) return null;
  let best = null, score = 0;
  for (const it of (S.inv.items || [])) {
    const iw = sig(it.name); if (!iw.length) continue;
    if (!iw.every((w) => kws.has(w))) continue;
    if (QUALIFIERS.some((q) => kws.has(q) && !iw.includes(q))) continue;
    if (iw.includes('oignon') && ['vert', 'rouge', 'echalote', 'perle'].some((q) => kws.has(q) && !iw.includes(q))) continue; // oignons verts et rouges : jamais en stock
    if (iw.length > score) { best = it; score = iw.length; }
  }
  return best;
}
/* riz, pâtes et bouillon : toujours à la maison, quelle que soit la sorte */
const STAPLE_RE = /\briz\b|\bpates?\b|spaghetti|spaghettini|penne|linguine|fettuc+ine|rigatoni|coquilles|macaroni|fusilli|rotini|farfalle|tagliatelle|lasagnes?\b|vermicelles?|nouilles|orzo|\bbouillon\b/;
const NOT_STAPLE_RE = /poudre (a )?pate|harissa|pate (de |a )?tomate|pate a pizza|feuillete|brisee|pate de cari|pate de curry|achiote|arachide|vinaigre/;
export const isStaple = (key) => STAPLE_RE.test(key) && !NOT_STAPLE_RE.test(key);
export const neverBuy = (key) => { const k = norm(key); return /^(eau|glacons?)\b/.test(k) || (/\b(vins?|bieres?)\b/.test(k) && !/vinaigre/.test(k)); };
