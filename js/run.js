"use strict";

// La réserve (pool) et la boucle de run (§7). Plutôt que d'enchaîner « tableau
// 1, tableau 2, … » dans un ordre fixe, on tire chaque tableau dans une réserve
// dont la composition dépend de la profondeur :
//
//   - Les premiers tableaux (phase d'amorce) sont tirés AU HASARD uniquement
//     parmi les plus faciles ET sans transfo (difficulty 1, transforms []).
//   - Plus la run avance, plus le plafond de difficulté monte : les paliers 2
//     puis 3, et donc les tableaux qui exigent glace ou vapeur, entrent dans
//     la réserve, tandis que les plus faciles en sortent.
//
// Chaque tableau franchi remet le corps à la capacité de base ; le surplus est
// mis en bonbonne (§7.2). Une dispersion termine la run.
const Run = (() => {
  const catalog = LEVELS;
  const INTRO = 2;                                   // tableaux d'amorce (T1, sans transfo)
  const RAMP = 2;                                    // + un palier tous les 2 tableaux
  const MAX_TIER = catalog.reduce((m, l) => Math.max(m, l.difficulty), 1);

  let depth = 0, banked = 0, current = null, recent = [];

  // Plafond de difficulté à une profondeur donnée : 1,1,2,2,3,3,…
  function ceilingAt(d) { return Math.min(MAX_TIER, 1 + Math.floor(d / RAMP)); }
  // Plancher : les tableaux d'un palier de plus de deux crans sous le plafond
  // sortent de la réserve — la run cesse de proposer l'antichambre en fin de course.
  function floorAt(d) { return Math.max(1, ceilingAt(d) - 1); }

  // Composition de la réserve à la profondeur d.
  function poolFor(d) {
    if (d < INTRO) {
      return catalog.filter((L) => L.difficulty === 1 && L.transforms.length === 0);
    }
    const c = ceilingAt(d), f = floorAt(d);
    return catalog.filter((L) => L.difficulty >= f && L.difficulty <= c);
  }

  // Tirage pondéré dans la réserve : léger biais vers le palier plafond (la run
  // « pousse » vers le haut), et on évite de rejouer le tableau précédent tant
  // qu'une alternative existe. `rnd` (0..1) permet un tirage déterministe en test.
  function pick(d, avoidId, rnd) {
    const pool = poolFor(d);
    let choices = pool.filter((L) => L.id !== avoidId);
    if (choices.length === 0) choices = pool.slice();  // réserve réduite à un seul tableau
    const c = ceilingAt(d);
    const weights = choices.map((L) => (L.difficulty === c ? 2 : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = (rnd == null ? Math.random() : rnd) * total;
    for (let i = 0; i < choices.length; i++) {
      r -= weights[i];
      if (r <= 0) return choices[i];
    }
    return choices[choices.length - 1];
  }

  function start(rnd) {
    depth = 0; banked = 0; recent = [];
    current = pick(0, null, rnd);
    recent.push(current.id);
    return current;
  }

  // Tableau suivant : met le surplus en bonbonne, avance d'un cran, retire.
  function advance(surplusLitres, rnd) {
    banked += Math.max(0, surplusLitres || 0);
    depth++;
    const avoid = current ? current.id : null;
    current = pick(depth, avoid, rnd);
    recent.push(current.id);
    return current;
  }

  return {
    start, advance, pick, poolFor, ceilingAt,
    current: () => current,
    depth: () => depth,
    banked: () => banked,
    maxTier: () => MAX_TIER,
    intro: () => INTRO,
    catalog: () => catalog,
  };
})();
