// Relais Claude de 3Bras. Une seule route : POST /convertir.
// L'app envoie le contenu d'une recette (texte, photos, PDF, lien) ; le relais construit lui-même la consigne,
// appelle Claude et renvoie sa réponse. Il ne sert à rien d'autre : ce n'est pas un accès général à Claude.

export const ORIGINES = ['https://jpdesbiens11.github.io', 'http://localhost:4173'];
export const MODELE = 'claude-sonnet-5-5';
const TYPES = ['Souper', 'Soupe', 'Accompagnement', 'Déjeuner', 'Dessert', 'Collation', 'Base & sauce'];
const PROTS = ['Bœuf', 'Porc', 'Poulet', 'Veau', 'Poisson & fruits de mer', 'Végé', 'Œufs'];
const CUIS = ['Québécoise', 'Italienne', 'Asiatique', 'Mexicaine', 'Indienne', 'Méditerranéenne', 'Classique'];
const OUTILS = ['Four', 'Mijoteuse', 'Instant Pot', 'BBQ', 'Wok', 'Sous-vide', 'Robot culinaire', 'Air fryer', 'Grill à panini'];
const SRC_CAT = ['Famille', 'Ricardo', 'Di Stasio', 'Recettes du Québec', 'Labriski', 'Trois fois par jour', 'Web autre'];
const IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_CORPS = 14 * 1024 * 1024;

const entetes = (origine) => ({ 'Access-Control-Allow-Origin': origine, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' });
const json = (statut, corps, origine) => new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json', ...(origine ? entetes(origine) : {}) } });

export function consigne(type, url, texte, nbImages, nbPdf) {
  return `Tu convertis une recette pour le livre de recettes familial 3Bras (une famille où les enfants aident comme sous-chefs). Écris en français québécois.

Règles :
- Ingrédients : reprends fidèlement chaque ingrédient et sa quantité. Mesures métriques d'abord, impériales entre parenthèses quand la source les donne. Regroupe par composante (ex. « Marinade », « Sauce ») seulement si la recette en a plusieurs.
- Étapes : réécris-les dans tes propres mots, en phrases courtes, dans le même ordre, avec les mêmes temps et températures (°C puis °F). Ne recopie pas les phrases de la source. Écris les durées en minutes dans l'étape (ex. « 25 minutes »).
- N'invente aucune quantité, température ni durée absente de la source ; liste ce qui manque dans "a_verifier".
- Tâches sous-chef : 2 ou 3 tâches simples et sécuritaires pour un enfant (mesurer, mélanger, râper, rincer, enfiler…).
- Laisse tomber la publicité, l'histoire, les commentaires et les valeurs nutritives.
- Type demandé : ${type}.

Réponds avec seulement un objet JSON de cette forme :
{"nom": "…", "type": "${TYPES.join('" | "')}", "proteine": "${PROTS.join('" | "')}" ou null, "cuisine": "${CUIS.join('" | "')}" ou null, "portions": nombre ou null, "temps_total_min": nombre ou null, "outils": [sous-ensemble de ${JSON.stringify(OUTILS)}], "source_nom": "nom de l'auteur, du site ou du livre, ou Inconnue", "source_categorie": "${SRC_CAT.join('" | "')}", "ingredients": [{"groupe": null ou "…", "items": ["…"]}], "etapes": ["…"], "sous_chef": ["…"], "a_verifier": "…"}
Si le contenu n'est pas une recette, réponds {"erreur": "raison courte"}.

Lien de la recette (source) : ${url || 'aucun'}
${nbImages ? `${nbImages} image(s) jointe(s) : photos ou captures de la recette.\n` : ''}${nbPdf ? `${nbPdf} PDF joint(s).\n` : ''}Contenu de la recette :
"""
${texte || '(voir les pièces jointes)'}
"""`;
}

// Page web → texte : la fiche schema.org « Recipe » si la page en a une, sinon le texte visible.
export function texteDePage(html) {
  const ld = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).filter((s) => /Recipe/.test(s));
  const visible = html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|li|h\d|div|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return (ld.length ? `Données de recette de la page (schema.org) :\n${ld.join('\n').slice(0, 20000)}\n\nTexte de la page :\n` : '') + visible.slice(0, 40000 - Math.min(20000, ld.join('').length));
}

export function verifier(d) {
  if (!d || typeof d !== 'object') return 'corps';
  if (!TYPES.includes(d.type)) return 'type';
  if (d.texte != null && (typeof d.texte !== 'string' || d.texte.length > 40000)) return 'texte';
  if (d.url != null && d.url !== '' && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(d.url)) return 'url';
  const imgs = d.images || [], pdfs = d.pdfs || [];
  if (!Array.isArray(imgs) || imgs.length > 5 || imgs.some((i) => !IMAGES.includes(i?.media_type) || typeof i.data !== 'string' || i.data.length > 7_000_000)) return 'images';
  if (!Array.isArray(pdfs) || pdfs.length > 2 || pdfs.some((p) => typeof p?.data !== 'string' || p.data.length > 11_000_000)) return 'pdfs';
  if (!d.texte && !d.url && !imgs.length && !pdfs.length) return 'vide';
  return null;
}

export default {
  async fetch(req, env, ctx, f = fetch) {
    const origine = req.headers.get('Origin') || '';
    const permise = ORIGINES.includes(origine);
    if (req.method === 'OPTIONS') return new Response(null, { status: permise ? 204 : 403, headers: permise ? entetes(origine) : {} });
    if (!permise) return json(403, { erreur: 'origine non permise' });
    if (req.method !== 'POST' || new URL(req.url).pathname !== '/convertir') return json(404, { erreur: 'route' }, origine);
    if (Number(req.headers.get('Content-Length') || 0) > MAX_CORPS) return json(413, { erreur: 'trop gros' }, origine);
    if (env.LIMITE) {
      const { success } = await env.LIMITE.limit({ key: req.headers.get('CF-Connecting-IP') || 'inconnu' });
      if (!success) return json(429, { erreur: 'Trop de conversions d\'un coup : attends une minute.' }, origine);
    }
    let d; try { d = await req.json(); } catch { return json(400, { erreur: 'JSON' }, origine); }
    const pb = verifier(d); if (pb) return json(400, { erreur: `demande invalide (${pb})` }, origine);

    let texte = d.texte || '';
    const imgs = d.images || [], pdfs = d.pdfs || [];
    if (d.url && !texte && !imgs.length && !pdfs.length) {
      try {
        const page = await f(d.url, { headers: { 'User-Agent': '3Bras-relais/1.0 (conversion de recette)', Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(10000) });
        if (!page.ok) return json(422, { erreur: `La page a répondu ${page.status}. Colle le texte ou prends une capture.` }, origine);
        texte = texteDePage((await page.text()).slice(0, 2_000_000));
      } catch { return json(422, { erreur: 'La page ne se lit pas d\'ici. Colle le texte ou prends une capture.' }, origine); }
    }
    const contenu = [
      ...imgs.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.media_type, data: i.data } })),
      ...pdfs.map((p) => ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.data } })),
      { type: 'text', text: consigne(d.type, d.url || '', texte, imgs.length, pdfs.length) }
    ];
    const rep = await f('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODELE, max_tokens: 4096, messages: [{ role: 'user', content: contenu }] })
    });
    if (!rep.ok) {
      const s = rep.status;
      return json(502, { erreur: s === 429 || s === 529 ? 'Claude est occupé. Réessaie dans un moment.' : s === 400 ? 'Claude n\'a pas pu lire ce contenu (photo trop grosse ou format).' : `Claude a répondu ${s}.` }, origine);
    }
    const r = await rep.json();
    const sortie = (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    return json(200, { texte: sortie, modele: r.model }, origine);
  }
};
