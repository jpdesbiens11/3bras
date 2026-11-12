// Minuteurs : plusieurs à la fois, sons maison, écran verrouillé, écran allumé. Repris de Gordon Rams.ai.
import { S, $, toast, render } from './etat.js?v=1.21.0';
import { el, ico, vider } from './el.js?v=1.21.0';

let audioCtx = null, master = null;
export function ac() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (_) {} return audioCtx; }
function out(c) { if (!master) { const comp = c.createDynamicsCompressor(); master = c.createGain(); master.gain.value = 2.2; master.connect(comp); comp.connect(c.destination); } return master; }
function note(f, t0, dur, type, vol) {
  const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.value = f; o.connect(g); g.connect(out(c));
  const t = c.currentTime + t0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.35, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
}
export const SOUNDS = {
  ding: { nom: 'Ding de cuisine', play() { [[1318, 0], [1046, 0.45]].forEach(([f, t]) => { note(f, t, 1.2, 'sine', 0.4); note(f * 2.01, t, 0.6, 'sine', 0.08); }); } },
  fanfare: { nom: 'Fanfare', play() { [[523, 0], [659, 0.14], [784, 0.28], [1046, 0.42], [784, 0.62], [1046, 0.76]].forEach(([f, t], i) => note(f, t, i === 5 ? 0.7 : 0.18, 'triangle', 0.32)); } },
  arcade: { nom: 'Arcade 8 bits', play() { [[392, 0], [523, 0.09], [659, 0.18], [784, 0.27], [659, 0.36], [784, 0.45], [1046, 0.54]].forEach(([f, t], i) => note(f, t, i === 6 ? 0.4 : 0.08, 'square', 0.12)); } },
  coucou: { nom: 'Coucou', play() { [0, 1.0].forEach((b) => { note(740, b, 0.32, 'sine', 0.4); note(587, b + 0.36, 0.5, 'sine', 0.4); }); } },
  tambour: { nom: 'Roulement et cymbale', play() { const c = ac(); if (!c) return; for (let i = 0; i < 14; i++) note(110 + ((i % 2) * 14), i * 0.05, 0.06, 'triangle', 0.25); note(1568, 0.75, 0.9, 'square', 0.05); note(2093, 0.75, 0.9, 'sawtooth', 0.03); } }
};
export function soundKey() { try { const k = localStorage.getItem('superchef-son'); return SOUNDS[k] ? k : 'ding'; } catch (_) { return 'ding'; } }
export function setSound(k) { try { localStorage.setItem('superchef-son', k); } catch (_) {} }
function alarm() { try { SOUNDS[soundKey()].play(); } catch (_) {} try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); } catch (_) {} }

export const fmt = (s) => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
let tid = 0;
export function addTimer(label, secs, recipe) {
  ac(); bgStart(); const id = 't' + (++tid);
  S.timers[id] = { label, total: secs, left: secs, running: true, at: Date.now(), done: false, rings: 0, nextRing: 0, recipe: recipe || null };
  renderTray(); if (S.view === 'poele') render(); toast(`Minuteur lancé : ${label} (${fmt(secs)})`);
}
function tick() {
  const now = Date.now(); let any = false;
  for (const k in S.timers) {
    const t = S.timers[k];
    if (t.running) { t.left -= (now - t.at) / 1000; t.at = now; any = true; if (t.left <= 0) { t.left = 0; t.running = false; t.done = true; t.rings = 0; t.nextRing = now; } }
    if (t.done && t.rings < 60 && now >= t.nextRing) { alarm(); t.rings++; t.nextRing = now + 5000; if (t.rings === 1) { renderTray(); if (S.view === 'poele') render(); } }
  }
  if (any) paintTimers();
  bgSync();
}
/* ---------- arrière-plan : son discret en boucle + écran verrouillé (Media Session) ---------- */
let bgAudio = null, bgUrl = null, lastMeta = '';
function quietWav() {
  const sr = 8000, n = sr * 6, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round((Math.random() * 2 - 1) * 3), true);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}
function bgStart() {
  try {
    if (!bgAudio) { bgUrl = bgUrl || quietWav(); bgAudio = new Audio(bgUrl); bgAudio.loop = true; bgAudio.volume = 0.05; bgAudio.setAttribute('playsinline', ''); }
    if (bgAudio.paused) bgAudio.play().catch(() => {});
    if ('mediaSession' in navigator) {
      const ms = navigator.mediaSession;
      const ack = () => { for (const k in S.timers) if (S.timers[k].done) delete S.timers[k]; renderTray(); if (S.view === 'poele') render(); setTimeout(() => { if (Object.keys(S.timers).length && bgAudio) bgAudio.play().catch(() => {}); }, 300); };
      ['play', 'pause', 'stop'].forEach((a) => { try { ms.setActionHandler(a, a === 'play' ? () => bgAudio && bgAudio.play() : ack); } catch (_) {} });
    }
  } catch (_) {}
}
function bgStop() { try { bgAudio && bgAudio.pause(); if ('mediaSession' in navigator) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } } catch (_) {} }
function bgSync() {
  const ids = Object.keys(S.timers); if (!ids.length) { if (bgAudio && !bgAudio.paused) bgStop(); return; }
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  const list = ids.map((k) => S.timers[k]).sort((a, b) => (b.done - a.done) || (a.left - b.left)), first = list[0];
  const title = first.done ? `PRÊT : ${first.label}` : `${fmt(first.left)} · ${first.label}`;
  const artist = list.length > 1 ? list.slice(1).map((t) => `${t.done ? 'prêt' : fmt(t.left)} ${t.label}`).join(' | ') : 'SuperChef.ai';
  if (title + artist === lastMeta) return; lastMeta = title + artist;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: first.done ? 'Touche pause pour arrêter l\'alarme' : 'Minuteurs SuperChef.ai' });
    navigator.mediaSession.playbackState = 'playing';
    if (navigator.mediaSession.setPositionState && !first.done) navigator.mediaSession.setPositionState({ duration: first.total, position: Math.min(first.total, first.total - first.left), playbackRate: 1 });
  } catch (_) {}
}
setInterval(tick, 500);
function paintTimers() { document.querySelectorAll('[data-tleft]').forEach((n) => { const t = S.timers[n.dataset.tleft]; if (t) n.textContent = fmt(t.left); }); }
export function toggleTimer(k) { const t = S.timers[k]; if (!t) return; ac(); if (t.done) { dismissTimer(k); return; } t.running = !t.running; t.at = Date.now(); renderTray(); if (S.view === 'poele') render(); }
export function dismissTimer(k) { delete S.timers[k]; lastMeta = ''; renderTray(); bgSync(); if (S.view === 'poele') render(); }
export function renderTray() {
  let tray = $('#tray'); const ids = Object.keys(S.timers);
  if (!ids.length) { if (tray) tray.remove(); document.body.classList.remove('has-tray'); return; }
  if (!tray) { tray = el('div', { id: 'tray', class: 'tray', 'aria-label': 'Minuteurs' }); document.body.append(tray); }
  document.body.classList.add('has-tray');
  vider(tray).append(el('div', { class: 'wrap tray-in' }, ids.map((k) => {
    const t = S.timers[k];
    return el('div', { class: `tchip ${t.done ? 'done' : t.running ? '' : 'paused'}` },
      el('button', { class: 'tmain', 'data-ttog': k, 'aria-label': `${t.done ? 'Arrêter l\'alarme' : t.running ? 'Pause' : 'Reprendre'} ${t.label}` },
        ico(t.done ? 'check' : t.running ? 'pause' : 'play'), el('span', { class: 'tl' }, t.label), el('b', { 'data-tleft': k }, fmt(t.left)),
        t.done && el('span', { class: 'tok' }, 'Prêt !')),
      el('button', { class: 'tx', 'data-tdel': k, 'aria-label': `Supprimer le minuteur ${t.label}` }, '×'));
  })));
}
/* ---------- écran allumé (wake lock) ---------- */
export async function wakeOn() {
  if (S.view !== 'poele' || S.wake) return;
  try { S.wake = await navigator.wakeLock.request('screen'); S.wake.addEventListener('release', () => { S.wake = null; paintLock(); }); } catch (_) { S.wake = null; }
  paintLock();
}
export function wakeOff() { try { S.wake && S.wake.release(); } catch (_) {} S.wake = null; }
export function paintLock() { const n = $('#lock'); if (n) vider(n).append(ico('sun'), S.wake ? 'Écran allumé' : 'Garde l\'écran allumé dans tes réglages'); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { wakeOn(); ac(); tick(); } });
