// Lecture des fiches : ingrédients, étapes, minuteurs, rayons Provigo. Repris de Gordon Rams.ai.
import { norm, S } from './etat.js?v=1.23.1';

const STOP = new Set('avec dans pour plus sans tasse tasses cuillere cuilleres soupe environ facultatif hache hachee hachees haches finement coupe coupee coupees coupes cubes tranche tranches gousse gousses grosse gros petit petite moyen moyenne boite pelees pelee goutt bien chaud froid frais fraiche litre litres paquet morceaux reserve rincee rinces egoutte preparee preparees prepare prepares'.split(' '));
// D-G-050 : seul le nom compte (avant la virgule : « 4 gousses d'ail, coupées en deux » -> ail, pas « deux ») ;
// les mots courts d'aliments (ail, sel, eau, riz) sont gardés.
const COURTS = new Set(['ail', 'sel', 'eau', 'riz', 'vin']);
const motsDe = (s) => s.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => (w.length >= 4 && !STOP.has(w)) || COURTS.has(w));
export function keywords(line) {
  const sans = norm(line).replace(/\(.*?\)/g, ' ');
  const nom = motsDe(sans.split(/,(?!\d)/)[0]);
  return (nom.length ? nom : motsDe(sans)).slice(0, 4);
}
// Un mot de 4 lettres ou moins se cherche entier (« pois » n'est pas « poisson », « lait » n'est pas « laitue ») ;
// « sel » se trouve aussi dans « saler ». Les autres, par leur début (« oignon » dans « oignons »).
const rePlein = new Map();
export function motDans(s, k) {
  if (k.length > 4) return s.includes(k.slice(0, Math.max(4, k.length - 2)));
  if (!rePlein.has(k)) rePlein.set(k, new RegExp(`(^|[^a-z])${k}[sx]?([^a-z]|$)${k === 'sel' ? '|(^|[^a-z])sal(e|er|ee|ees|es|ez)([^a-z]|$)' : ''}`));
  return rePlein.get(k).test(s);
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

// « sauce » seul ne suffit pas quand la ligne a un nom plus précis (« Verser la sauce » n'est pas la sauce soya).
// « les ingrédients de la sauce », « les épices de l'assaisonnement » : toutes les lignes de ce groupe.
const FAIBLES = new Set(['sauce']);
export function stepIngredients(step, ing) {
  const s = norm(step);
  const groupes = new Set([...s.matchAll(/(?:ingredients|epices) (?:de la |de l'|du |des |de )([a-z]+)/g)].map((m) => m[1]));
  return ing.filter((i) => {
    if (i.group && groupes.size && [...groupes].some((g) => norm(i.group).split(/[^a-z]+/).some((w) => w.length >= 4 && motDans(g, w)))) return true;
    const kw = i.kw || keywords(i.text), forts = kw.filter((k) => !FAIBLES.has(k));
    return (forts.length ? forts : kw).some((k) => motDans(s, k));
  });
}
export function sousFor(step, idx, sous) {
  if (!sous.length) return null;
  const s = norm(step);
  const hit = sous.find((t) => keywords(t).some((k) => motDans(s, k)));
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
/* ingrédients de chaque étape ; ceux qu'aucune étape ne nomme (sel, poivre…) vont à la 1re étape.
   usage[k] : les étapes où sert l'ingrédient k (D-G-032 : un ingrédient partagé n'est pas tout mis d'un coup). */
/* D-G-050 : deux lignes du même ingrédient (sauce et marinade, par exemple) ne tombent pas ensemble dans une étape.
   On garde celle dont la quantité est écrite juste avant son nom dans l'étape (« 15 ml de jus de citron »), puis,
   s'il en reste plusieurs, celle du groupe de l'étape (le groupe des ingrédients sans double qu'elle nomme, ou celui
   de l'étape d'avant), sinon la première pas encore servie. */
const QTE_RE = /(\d+(?:[.,]\d+)?(?: \d\/\d)?|\d\/\d|[½¼¾⅓⅔])\s?(ml|cl|litres?|l|g|kg|lb|oz|tasses?|c\. a (?:soupe|the))(?![a-z])/;
const quantite = (t) => { const m = QTE_RE.exec(norm(t).replace(/[()]/g, ' ')); return m ? m[0] : null; };
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s/g, '\\s?');
function quantiteAvantNom(s, ing) {   // la quantité de la ligne figure dans les 45 caractères avant son nom
  const q = quantite(ing.text); if (!q) return false;
  const re = new RegExp(`(^|[^\\d.,/])${echapper(q)}(?![\\d])`);
  for (const k of ing.kw || keywords(ing.text)) {
    const p = k.length > 4 ? k.slice(0, Math.max(4, k.length - 2)) : k, mot = new RegExp(`(^|[^a-z])${p}`, 'g');
    let m; while ((m = mot.exec(s))) if (re.test(s.slice(Math.max(0, m.index - 45), m.index + 1))) return true;
  }
  return false;
}
const ASSAISON_RE = /^(sel|poivre|eau)\b/;   // le sel et le poivre de chaque groupe ne disent pas de quel groupe est l'étape
// « Lait, pour badigeonner », « eau chaude, pour le riz » : l'usage écrit après la virgule se retrouve dans l'étape.
function usageDans(s, texte) {
  const apres = norm(texte).replace(/\(.*?\)/g, ' ').split(/,(?!\d)/).slice(1).join(' ');
  return motsDe(apres).filter((w) => w.length >= 5 || COURTS.has(w)).some((w) => motDans(s, w));
}
function departager(d, per) {
  const cle = d.ing.map((x) => ingKey(x.text)), nb = new Map();
  cle.forEach((c) => nb.set(c, (nb.get(c) || 0) + 1));
  const servis = new Set();
  let contexte = null;
  // un groupe dont le nom n'est le nom d'aucune ligne (« Pâte », « Croûtons ») se reconnaît quand l'étape le nomme
  const motsLignes = new Set(d.ing.flatMap((x) => x.kw || keywords(x.text)));
  const nomsGroupes = [...new Set(d.ing.map((x) => x.group).filter(Boolean))].map((g) => [g, norm(g).split(/[^a-z]+/).filter((w) => w.length >= 4 && !motsLignes.has(w))]);
  return per.map((l, si) => {
    const s = norm(d.steps[si]);
    const votes = new Map();
    for (const k of l) if (nb.get(cle[k]) === 1 && d.ing[k].group && !ASSAISON_RE.test(cle[k])) votes.set(d.ing[k].group, (votes.get(d.ing[k].group) || 0) + 1);
    // groupe de l'étape : celui qui a le plus de lignes nommées ; à égalité, celui de l'étape d'avant s'il en est, sinon aucun
    let ici = contexte;
    for (const [g, mots] of nomsGroupes) if (mots.some((w) => motDans(s, w))) votes.set(g, (votes.get(g) || 0) + 2);
    if (votes.size) {
      const tri = [...votes].sort((a, b) => b[1] - a[1]), tete = tri.filter((v) => v[1] === tri[0][1]).map((v) => v[0]);
      ici = tete.length === 1 ? tete[0] : tete.includes(contexte) ? contexte : null;
      if (tete.length === 1) contexte = ici;
    }
    // « Pâte : au robot, … » : l'étape dit elle-même son groupe.
    const etiquette = /^\s*([^:]{3,40}?)\s*:/.exec(s)?.[1];
    const nomme = etiquette && d.ing.map((x) => x.group).find((g) => g && norm(g).startsWith(etiquette));
    if (nomme) contexte = ici = nomme;
    const choix = new Map();   // clé -> ligne gardée
    for (const k of l) {
      if (choix.has(cle[k])) continue;
      let c = l.filter((j) => cle[j] === cle[k]);
      if (c.length > 1) { const q = c.filter((j) => quantiteAvantNom(s, d.ing[j])); if (q.length) c = q; }
      if (c.length > 1) { const u = c.filter((j) => usageDans(s, d.ing[j].text)); if (u.length) c = u; }
      if (c.length > 1) { const g = c.filter((j) => ici && d.ing[j].group === ici); if (g.length) c = g; }
      if (c.length > 1) { const n = c.filter((j) => !servis.has(j)); if (n.length) c = n; }
      choix.set(cle[k], c[0]);
    }
    const garde = l.filter((k) => choix.get(cle[k]) === k);
    garde.forEach((k) => servis.add(k));
    return garde;
  });
}
/* D-G-050 : une ligne qu'aucune étape ne nomme va à l'étape qui en parle en général : « les épices », « la viande »,
   « les fromages », « les fines herbes », « les légumes », « le pain », « les noix », le nom de son groupe
   (« Préparer les crudités ») ou « tous les autres ingrédients ». */
const CATEGORIES = [
  [/\bepices?\b|assaisonnement/, /moulue?s?\b|sechee?s?\b|paprika|cumin|curcuma|cannelle|muscade|origan|thym|piment|cayenne|garam|cari|curry|cardamome|girofle|fenugrec|poivre|sel\b|chili|zaatar|sumac|laurier/],
  [/\bviandes?\b/, /boeuf|porc|veau|agneau|poulet|dinde|saucisse|bifteck|roti|palette|epaule|haut de cuisse|cuisses?\b|poitrine/],
  [/\bfromages?\b/, /fromage|cheddar|mozzarella|emmental|gruyere|parmesan|asiago|feta|provolone|ricotta|cottage|suisse|chevre/],
  [/fines herbes|\bherbes\b/, /coriandre|persil|basilic|aneth|ciboulette|menthe|estragon|cerfeuil/],
  [/\blegumes\b|\bcrudites\b/, /carottes?|celeri|oignons?|poivrons?|concombres?|laitue|romaine|tomates?|courgettes?|brocoli|chou|epinards|navet|radis|champignons|pleurotes|haricots verts|pois/],
  [/\bpains?\b|\bcroutons?\b/, /pain|pitas?|baguette|naans?|tortillas?|ciabatta/],
  [/\bnoix\b/, /amandes|cajou|pignons|noix|pacanes|pistaches|arachides/]
];
function rattacher(d, per) {
  const used = new Set(per.flat()), etapes = d.steps.map((st) => norm(st));
  const motsLignes = new Set(d.ing.flatMap((x) => x.kw || keywords(x.text)));
  for (const [k, x] of d.ing.entries()) {
    if (used.has(k)) continue;
    const nom = norm(x.text).replace(/\(.*?\)/g, ' ').split(/,(?!\d)/)[0];
    // un mot faible (« sauce BBQ ») : la dernière étape qui le dit (souvent « Servir avec la sauce »)
    const faibles = (x.kw || keywords(x.text)).filter((w) => FAIBLES.has(w));
    let si = faibles.length ? etapes.map((s, i) => (faibles.some((w) => motDans(s, w)) ? i : -1)).filter((i) => i >= 0).pop() ?? -1 : -1;
    // le nom de son groupe, s'il n'est pas déjà le nom d'un ingrédient (« Crudités », pas « Poulet et frites »)
    const mots = x.group ? norm(x.group).split(/[^a-z]+/).filter((w) => w.length >= 5 && !motsLignes.has(w)) : [];
    if (si < 0 && mots.length) si = etapes.findIndex((s) => mots.some((w) => motDans(s, w)));
    if (si < 0) for (const [re, ing] of CATEGORIES) if (ing.test(nom)) { si = etapes.findIndex((s) => re.test(s)); if (si >= 0) break; }
    if (si < 0) si = etapes.findIndex((s) => /(tous|toutes) les autres ingredients|le reste des ingredients/.test(s));
    if (si >= 0) { per[si] = [...per[si], k].sort((a, b) => a - b); used.add(k); }
  }
  return per;
}
export function stepPlan(d) {
  if (d._plan) return d._plan;
  const per = rattacher(d, departager(d, d.steps.map((st) => stepIngredients(st, d.ing).map((x) => d.ing.indexOf(x)))));
  const used = new Set(per.flat()); const extra = d.ing.map((x, k) => k).filter((k) => !used.has(k));
  const usage = d.ing.map((x, k) => per.map((l, si) => (l.includes(k) ? si : -1)).filter((si) => si >= 0));
  return (d._plan = { per, extra, usage });
}

/* D-G-032 : portion d'un ingrédient écrite dans l'étape (« Ajouter 15 ml (1 c. à soupe) de beurre »,
   « la moitié du fromage »). Renvoie le texte de l'étape tel qu'écrit, ou null. */
const NOMBRE = '(?:\\d+(?:[.,/]\\d+)?|[½¼¾⅓⅔])(?: ?(?:a|-|ou) ?\\d+(?:[.,]\\d+)?)?';
const UNITE = '(?:ml|cl|l|g|kg|lb|oz|tasses?|c\\. ?a (?:soupe|the)|c\\. ?[stc]\\.?|cuilleres? a (?:soupe|the)|pincees?|gousses?|tranches?|boites?|sachets?|enveloppes?)';
const PART = '(?:la moitie|le tiers|le quart|les deux tiers|les trois quarts|le reste|le restant)';
const PORTION_RE = new RegExp(`(?:${NOMBRE} ?${UNITE}?\\.?(?: ?\\([^)]*\\))? ?|${PART} )(?:de la |de l'|de |d'|du |des |la |le |les |l')?(?:[a-z-]+ )?$`);
function avecPositions(s) { // texte normalisé et, pour chaque caractère, sa position dans l'original
  let n = ''; const pos = [];
  for (let i = 0; i < s.length; i++) { const c = norm(s[i]).replace(/[’]/g, "'"); n += c; for (let k = 0; k < c.length; k++) pos.push(i); }
  pos.push(s.length);
  return { n, pos };
}
export function portionDansEtape(step, ing) {
  const { n, pos } = avecPositions(String(step));
  for (const k of ing.kw || keywords(ing.text)) {
    const p = k.length > 4 ? k.slice(0, Math.max(4, k.length - 2)) : k;     // mots en a-z seulement : rien à échapper
    const t = new RegExp(`(^|[^a-z])${p}`).exec(n); if (!t) continue;
    const i = t.index + t[1].length;
    const m = PORTION_RE.exec(n.slice(Math.max(0, i - 50), i)); if (!m) continue;
    const debut = i - m[0].length, fin = i + (/^[a-z-]*/.exec(n.slice(i))[0].length);
    return String(step).slice(pos[debut], pos[fin]).trim();
  }
  return null;
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
  ['Viandes', /boeuf|bifteck|surlonge|porc|poulet|veau|dinde|agneau|cotelettes?|cotes levees|filet mignon|hauts? de cuisse|poitrine|epaule|saucisse|rosbif|palette|escalope|cubes a ragout|interieur de ronde|\broti\b/],
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
