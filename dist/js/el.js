// Construction du DOM sans innerHTML (P-2, N-03).
// el('a', { href: '#', class: 'x', onclick: fn, style: 'margin:0' }, 'texte', autreNoeud)
// Les attributs data-* servent aux gestionnaires délégués, comme dans Gordon Rams.ai.
const SVG = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [cle, val] of Object.entries(attrs || {})) {
    if (val === undefined || val === null || val === false) continue;
    if (cle.startsWith('on') && typeof val === 'function') n.addEventListener(cle.slice(2), val);
    else if (cle === 'class') n.className = val;
    else if (cle === 'style') n.style.cssText = val;          // CSSOM : permis par la CSP
    else if (cle === 'value' && 'value' in n) n.value = val;
    else if (cle === 'checked' || cle === 'disabled' || cle === 'selected' || cle === 'open' || cle === 'hidden') n[cle] = !!val;
    else n.setAttribute(cle, val === true ? '' : String(val));
  }
  ajouter(n, enfants);
  return n;
}

export function ajouter(n, enfants) {
  for (const e of enfants.flat(Infinity)) {
    if (e === undefined || e === null || e === false || e === '' || e === 0) continue; // 0 : reste d'un « liste.length && … » ; afficher un nombre = String(n)
    n.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return n;
}

export function vider(n) {
  while (n.firstChild) n.firstChild.remove();
  return n;
}

// Icône du sprite de index.html : <svg class="ico"><use href="#i-nom"/></svg>
export function ico(nom, cls = '') {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('class', `ico ${cls}`.trim());
  s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(SVG, 'use');
  u.setAttribute('href', `#i-${nom}`);
  s.append(u);
  return s;
}

// Étoile pleine des notes (même tracé que l'artefact).
export function svgEtoile() {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', 'M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z');
  s.append(p);
  return s;
}

// Grande fourchette de la dernière étape.
export function svgGrand(nom) {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('class', 'big'); s.setAttribute('viewBox', '0 0 24 24');
  const u = document.createElementNS(SVG, 'use'); u.setAttribute('href', `#i-${nom}`);
  s.append(u);
  return s;
}
