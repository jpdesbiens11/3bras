// Déplacer les soupers d'un soir à l'autre (D-G-049) : règle pure, testée dans Node.
// Déposer le souper du soir `de` sur le soir `sur` : les deux soirs échangent leur souper. Un soir libre le reçoit,
// et le soir quitté devient libre (il n'est plus planifié). Un souper déplacé est « choisi par toi » sur son nouveau
// soir : « Piger le reste » ne le remplace pas.
export function echanger(etat, de, sur) {
  if (de === sur || sur === null || sur === undefined || !etat.plan[de]) return etat;
  const plan = [...etat.plan], on = [...etat.on], pins = new Set(etat.pins);
  [plan[de], plan[sur]] = [plan[sur], plan[de]];
  for (const i of [de, sur]) {
    on[i] = !!plan[i];
    if (plan[i]) pins.add(i); else pins.delete(i);
  }
  return { ...etat, plan, on, pins };
}

/** Ce qui a changé entre deux plans, pour l'annoncer : [[soir, ancien id, nouvel id]]. */
export const differences = (avant, apres) => avant.map((id, i) => [i, id || null, apres[i] || null]).filter(([, a, b]) => a !== b);
