// D-G-049 : déplacer les soupers d'un soir à l'autre (règle d'échange).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { echanger, differences } from '../../dist/js/deplacement.js';

const base = () => ({ plan: ['a', 'b', 'c', 'd', null, null, null], on: [true, true, true, true, false, false, false], pins: new Set([2]), choisi: null });

test('D-G-049 : déposer un souper sur un autre soir échange les deux, et les deux sont « choisis par toi »', () => {
  const e = echanger(base(), 0, 2);
  assert.deepEqual(e.plan, ['c', 'b', 'a', 'd', null, null, null]);
  assert.deepEqual([...e.pins].sort(), [0, 2]);
  assert.deepEqual(e.on, base().on);
  assert.equal(e.choisi, null);                                   // le reste de l'état suit
});

test('D-G-049 : un soir libre reçoit le souper, le soir quitté devient libre', () => {
  const e = echanger(base(), 1, 4);
  assert.deepEqual(e.plan, ['a', null, 'c', 'd', 'b', null, null]);
  assert.deepEqual(e.on, [true, false, true, true, true, false, false]);
  assert.ok(e.pins.has(4) && !e.pins.has(1));
});

test('D-G-049 : on peut jongler, revenir en arrière, et rien ne bouge hors cible', () => {
  const b = base();
  assert.equal(echanger(b, 0, 0), b);
  assert.equal(echanger(b, 0, null), b);
  assert.equal(echanger(b, 5, 1), b);                              // un soir vide ne se déplace pas
  let e = echanger(b, 0, 3); e = echanger(e, 3, 0);
  assert.deepEqual(e.plan, b.plan);
  assert.ok(!Object.is(e.plan, b.plan));
  assert.deepEqual(differences(b.plan, echanger(b, 0, 4).plan), [[0, 'a', null], [4, null, 'a']]);
});
