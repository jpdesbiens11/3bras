// Construction du DOM sans innerHTML (P-2, N-03).
// el('a', { href: '#', class: 'x', onclick: fn }, 'texte', autreNoeud)
export function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [cle, val] of Object.entries(attrs || {})) {
    if (val === undefined || val === null || val === false) continue;
    if (cle.startsWith('on') && typeof val === 'function') {
      n.addEventListener(cle.slice(2), val);
    } else if (cle === 'class') {
      n.className = val;
    } else {
      n.setAttribute(cle, val === true ? '' : String(val));
    }
  }
  for (const e of enfants.flat()) {
    if (e === undefined || e === null || e === false) continue;
    n.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return n;
}

export function vider(n) {
  while (n.firstChild) n.firstChild.remove();
  return n;
}
