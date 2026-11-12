// Générateur de recettes de départ (D-G-035) : l'app écrit une consigne pour Claude (Sonnet 5.5) d'après
// les cuisines et les mots-clés choisis ; la personne colle la réponse (plusieurs Fiches SuperChef),
// coche ce qu'elle garde, et les recettes entrent « À trier » par l'import validé (D-G-016).
// Sans DOM : testé à part.
import { norm, TYPES, PROTS, CUIS, OUTILS } from './etat.js?v=1.17.0';
import { parseTexte, parseLoose, ENTETE_FICHE } from './lecture.js?v=1.17.0';
import { FORMAT, FORMATS, valider, estKitRepas } from './import.js?v=1.17.0';
import { VERSION_SCHEMA } from './schema.js?v=1.17.0';
import { slug } from './donnees.js?v=1.17.0';

export const NOMBRES = Object.freeze([5, 10, 15, 20]);
export const TYPES_LOT = Object.freeze(['Souper', 'Dessert', 'Soupe', 'Déjeuner', 'Accompagnement', 'Collation', 'Mélange']);
export const MAX_FICHES = 40;
export const DEMANDE_VIDE = Object.freeze({ cuisines: [], motsCles: '', type: 'Souper', nombre: 10, portions: 4, soirs: true, eviter: '' });

const propre = (s, n = 300) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// d : { cuisines[], motsCles, type, nombre, portions, soirs, eviter } ; noms : recettes déjà au livre.
export function consigneGenerateur(d, noms = []) {
  const n = NOMBRES.includes(+d.nombre) ? +d.nombre : 10;
  const cuisines = (d.cuisines || []).filter((c) => CUIS.includes(c));
  const type = d.type === 'Mélange' ? 'surtout des soupers, avec quelques desserts et soupes' : (TYPES.includes(d.type) ? d.type : 'Souper');
  const deja = [...new Set(noms.map((x) => propre(x, 80)).filter(Boolean))].slice(0, 80);
  return `Tu es le sous-chef de SuperChef.ai, l'app de recettes d'une famille québécoise. Prépare ${n} recettes pour remplir son livre. Français québécois.

Ce que la famille veut :
- Cuisines : ${cuisines.length ? cuisines.join(', ') : 'variées, au choix'}
- Mots-clés : ${propre(d.motsCles) || 'aucun'}
- Type : ${type}
- ${Math.max(1, Math.min(20, Math.round(+d.portions) || 4))} portions par recette
- ${d.soirs ? 'Surtout des soirs de semaine : 45 minutes ou moins au total.' : 'Temps de préparation au choix.'}
- À éviter (allergies, aliments, outils) : ${propre(d.eviter) || 'rien de particulier'}
${deja.length ? `- Déjà dans le livre, ne les propose pas : ${deja.join(' ; ')}\n` : ''}
Choix des recettes :
- Des classiques reconnus et variés (protéines, méthodes de cuisson). Si tu peux consulter le web, base chaque recette sur une recette réputée, de préférence d'un site québécois (Ricardo, Trois fois par jour, Recettes du Québec, Coup de pouce), et donne son lien ; sinon, écris une version classique avec « Source : Version classique (Claude) » sans lien.
- Jamais de recettes de kits repas (Goodfood, Chef Cook It, HelloFresh).

Règles de rédaction :
- Ingrédients : un par ligne, commençant par « - », métrique d'abord, impérial entre parenthèses (« - 250 ml (1 tasse) de lait »). « Groupe : » seulement s'il y a plusieurs composantes.
- Étapes : numérotées, phrases courtes, dans tes propres mots, °C puis °F, durées en minutes (« Cuire 25 minutes »). Si un ingrédient sert à plusieurs étapes, écris dans chaque étape la quantité utilisée.
- SOUS-CHEF : 2 ou 3 tâches simples et sécuritaires pour un enfant.
- N'invente aucune quantité, température ni durée qui manque à la source : écris-la sous À VÉRIFIER.
- Valeurs permises, écrites exactement ainsi :
  Type : ${TYPES.join(', ')}
  Protéine : ${PROTS.join(', ')} (ou Aucune pour un dessert)
  Cuisine : ${CUIS.join(', ')} (la plus proche)
  Outils : ${OUTILS.join(', ')} (seulement ceux utilisés)

Livraison : une phrase d'au plus une ligne, puis TOUTES les fiches dans UN SEUL bloc de code (pour les copier d'un seul toucher), l'une après l'autre, chacune exactement dans ce format :

FICHE SUPERCHEF
Nom : …
Type : …
Protéine : …
Cuisine : …
Portions : …
Temps total : … min
Outils : …
Source : …
Lien : https://…

INGRÉDIENTS
- …

ÉTAPES
1. …

SOUS-CHEF
- …

À VÉRIFIER
- (rien, ou ce qui manque à la source)`;
}

// Réponse collée → [{ r (fiche lue), valide }]. Accepte aussi un fichier d'import JSON collé tel quel.
export function lireReponse(texte, typeDefaut = 'Souper') {
  const brut = String(texte || '').trim();
  if (!brut) return { fiches: [], json: null };
  const j = /^[{[]/.test(brut) || /^```json/i.test(brut) ? parseLoose(brut) : null;
  if (j && FORMATS.includes(j.format)) return { fiches: [], json: valider(j) };
  const lignes = brut.replace(/```\w*/g, '').split(/\r?\n/);
  const debuts = lignes.map((l, i) => (ENTETE_FICHE.test(norm(l.trim())) ? i : -1)).filter((i) => i >= 0);
  const blocs = debuts.length ? debuts.map((d, k) => lignes.slice(d, debuts[k + 1] ?? lignes.length).join('\n')) : [lignes.join('\n')];
  const fiches = blocs.slice(0, MAX_FICHES).map((b) => parseTexte(b, typeDefaut))
    .map((r) => ({ r, valide: !!(r.ingredients.length && r.etapes.length) }));
  return { fiches, json: null, tronque: blocs.length > MAX_FICHES };
}

// Fiche lue → ligne de « Recettes ». Id stable (g-<nom>) : recoller la même réponse n'ajoute rien.
export function ligneRecette(r, { lot, jour }, idsPris = new Set()) {
  const base = `g-${slug(r.nom) || 'recette'}`; let id = base, k = 2;
  while (idsPris.has(id)) id = `${base}-${k++}`;
  idsPris.add(id);
  return {
    id, Nom: r.nom, Type: r.type, Statut: 'À trier', 'Étiquettes': 'New', Source: r.source_cat, 'Fiche complète': true,
    'Protéine': r.proteine || '', Cuisine: r.cuisine || '', Portions: r.portions || '', 'Temps total (min)': r.temps || '',
    'Soir de semaine': !!(r.temps && r.temps <= 45), Outils: r.outils.join(', '),
    'Ingrédients': r.ingredients.flatMap((g) => [g.groupe ? `## ${g.groupe}` : null, ...g.items]).filter(Boolean),
    'Étapes': r.etapes, 'Tâches sous-chef': r.sous.length ? r.sous : ['Aider à mesurer les ingrédients'],
    'À vérifier': r.a_verifier || '', 'Lien source': r.lien || '',
    Notes: [`D'après ${r.source_nom}.${r.portions ? ` ${r.portions} portions.` : ''} Créée avec Claude (${lot || 'lot'}, ${jour}).`]
  };
}

// Prépare la liste à cocher : déjà au livre (par le nom) et kits repas ne sont pas cochés.
export function preparerChoix(fiches, nomsLivre, ctx) {
  const deja = new Set(nomsLivre.map((x) => norm(x).trim()));
  const ids = new Set();
  return fiches.map(({ r, valide }) => {
    const row = valide ? ligneRecette(r, ctx, ids) : null;
    const kit = !!row && estKitRepas(row), present = deja.has(norm(r.nom).trim());
    return { r, row, valide, kit, deja: present, choisi: valide && !kit && !present };
  });
}

// Fichier d'import pour les recettes cochées, validé comme tout import (D-G-016).
export const fichierImport = (rows, jour) => valider({ format: FORMAT, version: 1, schema: VERSION_SCHEMA, genere_le: jour, source: 'claude', recettes: rows });

// D-G-045 : créer une recette avec Gemini à partir d'une simple description (pas de site source).
// garde : noms des articles du garde-manger à utiliser si possible.
export function consigneCreation(demande, type, garde = []) {
  const g = [...new Set(garde.map((x) => propre(x, 60)).filter(Boolean))].slice(0, 60);
  return `Tu es le sous-chef de SuperChef.ai, l'app de recettes d'une famille québécoise. Crée UNE recette d'après la demande de la famille. Français québécois.

Demande : « ${propre(demande, 600)} »
Type : ${TYPES.includes(type) ? type : 'Souper'} (ou celui qui convient mieux à la demande)
${g.length ? `Au garde-manger (utilise-en le plus possible, sans obligation) : ${g.join(', ')}\n` : ''}
Règles :
- Une recette réaliste et éprouvée, inspirée des classiques ; 4 portions sauf si la demande dit autrement.
- Ingrédients : un par ligne, commençant par « - », métrique d'abord, impérial entre parenthèses. « Groupe : » seulement s'il y a plusieurs composantes.
- Étapes : numérotées, phrases courtes, °C puis °F, durées en minutes (« Cuire 25 minutes »). Si un ingrédient sert à plusieurs étapes, écris dans chaque étape la quantité utilisée.
- SOUS-CHEF : 2 ou 3 tâches simples et sécuritaires pour un enfant.
- C'est une recette créée, pas une source vérifiée : sous À VÉRIFIER, note ce qui mérite un essai (cuisson, temps, quantités).
- Jamais de recettes de kits repas.
- Valeurs permises, écrites exactement ainsi :
  Type : ${TYPES.join(', ')}
  Protéine : ${PROTS.join(', ')} (ou Aucune pour un dessert)
  Cuisine : ${CUIS.join(', ')} (la plus proche)
  Outils : ${OUTILS.join(', ')} (seulement ceux utilisés)

Réponds avec seulement la fiche, dans ce format :

FICHE SUPERCHEF
Nom : …
Type : …
Protéine : …
Cuisine : …
Portions : …
Temps total : … min
Outils : …
Source : Gemini

INGRÉDIENTS
- …

ÉTAPES
1. …

SOUS-CHEF
- …

À VÉRIFIER
- …`;
}
