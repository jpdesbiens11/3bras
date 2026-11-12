// Thème choisi, appliqué avant l'affichage (comme dans Gordon Rams.ai). Le thème seul est gardé sur l'appareil.
// D-G-030 : les préférences gardées sous l'ancien nom (3bras-*, 3ebras-*) passent une fois sous superchef-*.
try {
  var cles = [];
  for (var i = 0; i < localStorage.length; i++) cles.push(localStorage.key(i));
  cles.forEach(function (c) {
    var m = /^3e?bras-(.+)$/.exec(c || ''); if (!m) return;
    if (localStorage.getItem('superchef-' + m[1]) === null) localStorage.setItem('superchef-' + m[1], localStorage.getItem(c));
    localStorage.removeItem(c);
  });
} catch (_) {}
// D-G-046 : « Carnet » devient le thème par défaut ; un appareil resté sur l'ancien défaut (Plan technique) y passe une fois.
var SKINS = ['carnet', 'magazine', 'ardoise'];
try {
  var k = localStorage.getItem('superchef-skin');
  if (!localStorage.getItem('superchef-theme-carnet')) { if (k === null || k === 'plan') k = 'carnet'; localStorage.setItem('superchef-skin', k); localStorage.setItem('superchef-theme-carnet', '1'); }
  if (SKINS.indexOf(k) >= 0) document.documentElement.setAttribute('data-skin', k);
} catch (_) { document.documentElement.setAttribute('data-skin', 'carnet'); }
