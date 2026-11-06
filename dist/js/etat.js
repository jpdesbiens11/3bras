// État et constantes partagés, repris de Gordon Rams.ai.
import { el } from './el.js?v=1.2.2';

export const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export const BASE_DAYS = 4; // dimanche au mercredi par défaut ; jeudi à samedi au besoin
export const STEPS = [
  { n: '01', id: 'tri', label: 'Livre' },
  { n: '02', id: 'livre', label: 'Garde-manger', short: ['Garde-', 'manger'] },
  { n: '03', id: 'semaine', label: 'Semaine' },
  { n: '04', id: 'provigo', label: 'Provigo' },
  { n: '05', id: 'poele', label: 'Au poêle' },
  { n: '06', id: 'bilan', label: 'Bilan' }
];
export const READY = new Set(STEPS.map((s) => s.id));
export const DEPTS = ['Fruits et légumes', 'Boulangerie', 'Viandes', 'Poissonnerie', 'Charcuterie et fromages', 'Produits laitiers et œufs', 'Épicerie sèche', 'Conserves', 'Épices', 'Surgelés', 'Entretien'];
export const ZONES = ['Frigo', 'Congélateur', 'Garde-manger', 'Épices', 'Outils'];
export const TYPES = ['Souper', 'Soupe', 'Accompagnement', 'Déjeuner', 'Dessert', 'Collation', 'Base & sauce'];
export const PROTS = ['Bœuf', 'Porc', 'Poulet', 'Veau', 'Poisson & fruits de mer', 'Végé', 'Œufs'];
export const CUIS = ['Québécoise', 'Italienne', 'Asiatique', 'Mexicaine', 'Indienne', 'Méditerranéenne', 'Classique'];
export const OUTILS = ['Four', 'Mijoteuse', 'Instant Pot', 'BBQ', 'Wok', 'Sous-vide', 'Robot culinaire', 'Air fryer', 'Grill à panini'];
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const GAP_DAYS = 21;

export const S = {
  ctx: null, err: null,
  recipes: [], byId: {}, book: [], all: {}, desserts: [], fixed: {},
  weekStart: null, plan: [null, null, null, null, null, null, null], on: [true, true, true, true, false, false, false],
  pins: new Set(), picker: null, dess: [], dpick: null, planRows: [], saved: true, loading: true, saving: false,
  view: 'semaine',
  cook: { id: null, data: null, idx: 0, loading: false, err: null },
  timers: {}, wake: null, pages: {},
  tri: { list: null, idx: 0, loading: false, last: null }, lib: { mode: 'browse', q: '', type: 'Tous', statut: 'Tous' },
  inv: { items: null, loading: false },
  prov: { lines: null, loading: false, checked: {} }, have: new Set(),
  bil: { items: null, loading: false, form: {}, done: {} },
  preview: null, recent: new Set(), swapped: null
};

export const $ = (s) => document.querySelector(s);
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae');
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function toast(msg, action) {
  const t = $('#toast');
  t.textContent = msg;
  if (action) t.append(el('button', { type: 'button', onclick: () => { t.hidden = true; action.fn(); } }, action.label));
  t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, action ? 5000 : 2600);
}

export function computeWeek(maintenant = new Date()) {
  const d = new Date(maintenant); d.setHours(0, 0, 0, 0);
  const wd = d.getDay(); // 0 dim, 6 sam — semaine de souper : dimanche au mercredi
  d.setDate(d.getDate() + (wd <= 3 ? -wd : 7 - wd));
  return d;
}
export function dayDate(i) { const d = new Date(S.weekStart); d.setDate(d.getDate() + i); return d; }
export function weekLabel() {
  const last = Math.max(...S.on.map((v, i) => (v ? i : 0))); const a = dayDate(0), b = dayDate(last);
  return a.getMonth() === b.getMonth() ? `Semaine du ${a.getDate()} au ${b.getDate()} ${MOIS[b.getMonth()]}` : `Semaine du ${a.getDate()} ${MOIS[a.getMonth()]} au ${b.getDate()} ${MOIS[b.getMonth()]}`;
}

export function errText(e) {
  const s = e && e.statut;
  if (e && e.message === 'non-connecte') return 'Ta session Google est terminée. Reconnecte-toi.';
  if (s === 401) return 'La connexion Google a expiré. Reconnecte-toi.';
  if (s === 403) return 'Google refuse l\'accès à ce fichier (portée drive.file).';
  if (s === 404) return 'Le classeur est introuvable dans ton Drive.';
  if (s === 429) return 'Google demande de ralentir. Réessaie dans un moment.';
  if (s >= 500) return 'Google ne répond pas pour l\'instant. Réessaie dans un moment.';
  if (e && e.conflit) return 'Le classeur a changé ailleurs (autre appareil). Recharge la page.';
  return `Problème avec Google (${(e && e.message) || 'inconnu'}).`;
}

export const starsOf = (r) => (r && r.note ? Math.max(0, Math.min(5, Math.round(r.note / 2))) : 0);
export const starLabel = (n) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '');
export const toolsOf = (r) => (Array.isArray(r.tools) ? r.tools : []);

// Les vues appellent render() ; app.js branche le vrai rendu au démarrage (évite les imports circulaires).
export const hooks = { render: () => {}, renderSheet: () => {}, setView: () => {} };
export const render = () => hooks.render();
export const renderSheet = () => hooks.renderSheet();
