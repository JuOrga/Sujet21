// Étiquetage d'amas connexes par parcours en profondeur — identifie le corps
// du joueur comme composante connexe du graphe de voisinage (§3.1, §13).

export function labelComponents(
  count: number,
  labels: Int32Array,
  forEachNeighbor: (i: number, cb: (j: number) => void) => void,
  stack: Int32Array,
): number {
  labels.fill(-1, 0, count)
  let next = 0
  const visit = (j: number) => {
    if (labels[j] === -1) {
      labels[j] = next
      stack[top++] = j
    }
  }
  let top = 0
  for (let i = 0; i < count; i++) {
    if (labels[i] !== -1) continue
    top = 0
    labels[i] = next
    stack[top++] = i
    while (top > 0) {
      const p = stack[--top]
      forEachNeighbor(p, visit)
    }
    next++
  }
  return next
}
