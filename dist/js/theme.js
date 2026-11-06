// Thème choisi, appliqué avant l'affichage (comme dans Gordon Rams.ai). Le thème seul est gardé sur l'appareil.
try { var k = localStorage.getItem('3ebras-skin'); if (k === 'magazine' || k === 'ardoise') document.documentElement.setAttribute('data-skin', k); } catch (_) {}
