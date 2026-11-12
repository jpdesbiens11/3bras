// Adapter une recette du livre avec Gemini (D-G-033) : consigne, valeurs à écrire, retour à l'originale.
// Sans DOM : testé à part. La version adaptée remplace la recette ; la toute première version est
// gardée une seule fois dans « Originale » (JSON), et chaque changement est noté dans « Adaptations ».

export const CHAMPS_ORIGINALE = Object.freeze(['Ingrédients', 'Étapes', 'Portions', 'Temps total (min)', 'Tâches sous-chef']);

export const RACCOURCIS = Object.freeze([
  ['Quantités dans les étapes', 'Quand un ingrédient sert à plusieurs étapes, écris dans chaque étape la quantité à utiliser.'],
  ['Moins sucré', 'Moins sucré.'],
  ['Moins salé', 'Moins salé.'],
  ['Plus épicé', 'Plus épicé.'],
  ['Sans lactose', 'Sans produits laitiers, avec des remplacements simples.'],
  ['Pour 2', 'Pour 2 portions.'],
  ['Pour 6', 'Pour 6 portions.'],
  ['Doubler', 'Doubler la recette.']
]);

// D-G-036 : au poêle, les raccourcis de la cuisine passent en premier (la personne finit la phrase).
export const RACCOURCIS_CUISSON = Object.freeze([
  ['Il me manque…', 'Il me manque '],
  ['Remplacer…', 'Remplacer '],
  ['Moins de temps', 'Je manque de temps : raccourcis la suite sans changer le résultat.']
]);

// etape : numéro (1…) de l'étape où la famille est rendue quand elle adapte au poêle, sinon null.
export function consigneAdaptation(fiche, demande, etape = null) {
  return `Tu adaptes une recette du livre de recettes d'une famille québécoise (app SuperChef.ai). Français québécois.

Changement demandé par la famille : « ${String(demande).slice(0, 600)} »
${etape ? `\nLa famille cuisine en ce moment et elle est rendue à l'étape ${etape}.${etape > 1 ? ` Ne change pas les étapes déjà faites (1 à ${etape - 1}) sauf si c'est indispensable.` : ''} Garde le même nombre d'étapes si possible et adapte surtout la suite.\n` : ''}
Règles :
- Applique seulement ce changement. Garde tout le reste identique : mêmes ingrédients, mêmes étapes, mêmes temps et températures.
- Ajuste les quantités touchées, métrique d'abord, impérial entre parenthèses si la recette le donne.
- Si un ingrédient sert à plusieurs étapes, écris dans chaque étape la quantité utilisée (« Ajouter 15 ml (1 c. à soupe) de beurre », « le reste du beurre »).
- Mets à jour Portions et Temps total s'ils changent.
- Si le changement touche la cuisson, la sécurité ou une pâtisserie délicate, dis-le sous À VÉRIFIER.
- Sous CHANGEMENTS, résume en 1 à 4 lignes courtes ce que tu as changé.

Réponds avec seulement la fiche complète, dans le même format, suivie de CHANGEMENTS :

${fiche}

CHANGEMENTS
- …`;
}

const ajouterLigne = (avant, ligne) => [String(avant || '').trim(), ligne].filter(Boolean).join('\n');
const ingredientsEnLignes = (groupes) => groupes.flatMap((g) => [g.groupe ? `## ${g.groupe}` : null, ...g.items]).filter(Boolean);

// row : ligne de « Recettes » ; res : résultat de parseTexte ; jour : AAAA-MM-JJ.
export function valeursAdaptees(row, res, demande, jour) {
  const v = {
    'Ingrédients': ingredientsEnLignes(res.ingredients),
    'Étapes': res.etapes,
    Adaptations: ajouterLigne(row.Adaptations, `${jour} · ${String(demande).trim()}${res.changements?.length ? ` → ${res.changements.join(' ; ')}` : ''}`)
  };
  if (res.portions) v.Portions = res.portions;
  if (res.temps) v['Temps total (min)'] = res.temps;
  if (res.sous?.length) v['Tâches sous-chef'] = res.sous;
  if (res.a_verifier) v['À vérifier'] = ajouterLigne(row['À vérifier'], res.a_verifier);
  if (!String(row.Originale || '').trim()) {
    v.Originale = JSON.stringify({ le: jour, ...Object.fromEntries(CHAMPS_ORIGINALE.map((c) => [c, String(row[c] ?? '')])) });
  }
  return v;
}

// Valeurs qui remettent la recette originale, ou null si rien d'utilisable n'est gardé.
export function valeursOriginales(row, jour) {
  let o;
  try { o = JSON.parse(String(row.Originale || '')); } catch { return null; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const v = Object.fromEntries(CHAMPS_ORIGINALE.filter((c) => typeof o[c] === 'string').map((c) => [c, o[c]]));
  if (!v['Ingrédients'] && !v['Étapes']) return null;
  v.Adaptations = ajouterLigne(row.Adaptations, `${jour} · retour à la recette originale`);
  return v;
}

// Ce qu'il faut réécrire pour annuler un retour à l'originale.
export const valeursActuelles = (row) => Object.fromEntries([...CHAMPS_ORIGINALE, 'Adaptations'].map((c) => [c, String(row[c] ?? '')]));
