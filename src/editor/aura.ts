/**
 * LE CONTOUR D'UNE AURA, tel que l'éditeur le trace.
 *
 * Le solveur mesure l'aura d'une surface à sa FORME PHYSIQUE (formeContact
 * sur formePhysique) : une chaudière rayonne depuis sa rampe dessinée, une
 * conduite depuis son tuyau et ses brides — plus depuis leur boîte. L'éditeur,
 * lui, traçait toujours le rectangle arrondi autour de la boîte : sur une
 * rampe, l'aura dessinée débordait de l'aura réelle sur tout le long côté, et
 * davantage aux coins d'une chaudière compacte, qui est ronde (signalé à la
 * refonte de la chaudière, #459). Le concepteur plaçait ses pièces sur une
 * portée qui n'existait pas.
 *
 * Pour une forme qui n'est pas un rectangle, on trace donc l'iso-distance de
 * la forme elle-même, par carrés marchants sur le même champ que le solveur :
 * ce que l'éditeur montre est ce que le jeu mesure.
 */

import { formeContact, type FormeBox, type FormeContact } from '../game/formes'

export type Point = { x: number; y: number }

/** Les contours fermés où la distance à la forme vaut `portee`, en MONDE. */
export function contourAura(forme: FormeBox, portee: number): Point[][] {
  // l'emprise de la boîte, rotation comprise, élargie de la portée et d'une
  // marge : tout contour s'y referme
  const cx = (forme.minX + forme.maxX) / 2
  const cy = (forme.minY + forme.maxY) / 2
  const hx = (forme.maxX - forme.minX) / 2
  const hy = (forme.maxY - forme.minY) / 2
  const rad = ((forme.angle ?? 0) * Math.PI) / 180
  const ca = Math.abs(Math.cos(rad))
  const sa = Math.abs(Math.sin(rad))
  const ex = hx * ca + hy * sa
  const ey = hx * sa + hy * ca
  // LE PAS : l'iso-distance d'une union de pièces arrondies n'a que des
  // arcs de rayon ≥ portée — un maillage au huitième de la portée la suit
  // à moins d'un demi-unité ; 120 mailles au plus par côté bornent le coût
  // d'une très longue pièce
  const h = Math.max(2, portee / 8, (2 * Math.max(ex, ey) + 2 * portee) / 120)
  const marge = portee + 2 * h
  const x0 = cx - ex - marge
  const y0 = cy - ey - marge
  const nx = Math.ceil((2 * (ex + marge)) / h)
  const ny = Math.ceil((2 * (ey + marge)) / h)
  const c: FormeContact = { dist: 0, nx: 0, ny: 1 }
  const v = new Float64Array((nx + 1) * (ny + 1))
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      formeContact(x0 + i * h, y0 + j * h, forme, c)
      v[j * (nx + 1) + i] = c.dist - portee
    }
  const val = (i: number, j: number): number => v[j * (nx + 1) + i]

  // chaque arête coupée porte UN point, partagé par ses deux mailles :
  // c'est ce qui permet de chaîner les segments en contours fermés
  const points = new Map<string, Point>()
  const point = (cle: string, i0: number, j0: number, i1: number, j1: number): string => {
    if (!points.has(cle)) {
      const a = val(i0, j0)
      const b = val(i1, j1)
      const t = a / (a - b)
      points.set(cle, { x: x0 + (i0 + (i1 - i0) * t) * h, y: y0 + (j0 + (j1 - j0) * t) * h })
    }
    return cle
  }
  const voisins = new Map<string, string[]>()
  const relie = (a: string, b: string): void => {
    ;(voisins.get(a) ?? voisins.set(a, []).get(a)!).push(b)
    ;(voisins.get(b) ?? voisins.set(b, []).get(b)!).push(a)
  }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const dedans = [val(i, j) < 0, val(i + 1, j) < 0, val(i + 1, j + 1) < 0, val(i, j + 1) < 0]
      // les quatre arêtes de la maille : bas, droite, haut, gauche
      const aretes: (() => string)[] = [
        () => point(`h${i},${j}`, i, j, i + 1, j),
        () => point(`v${i + 1},${j}`, i + 1, j, i + 1, j + 1),
        () => point(`h${i},${j + 1}`, i, j + 1, i + 1, j + 1),
        () => point(`v${i},${j}`, i, j, i, j + 1),
      ]
      const coupees: number[] = []
      for (let k = 0; k < 4; k++) if (dedans[k] !== dedans[(k + 1) % 4]) coupees.push(k)
      if (coupees.length === 2) relie(aretes[coupees[0]](), aretes[coupees[1]]())
      else if (coupees.length === 4) {
        // le col : le centre de la maille tranche — dedans, les deux coins
        // dedans se rejoignent ; dehors, ils restent séparés
        const centre = (val(i, j) + val(i + 1, j) + val(i + 1, j + 1) + val(i, j + 1)) / 4 < 0
        const [a, b, cc, d] = aretes.map((f) => f())
        if (centre === dedans[0]) {
          relie(a, b)
          relie(cc, d)
        } else {
          relie(d, a)
          relie(b, cc)
        }
      }
    }

  // le chaînage : de proche en proche jusqu'à revenir au départ
  const contours: Point[][] = []
  const vus = new Set<string>()
  for (const depart of voisins.keys()) {
    if (vus.has(depart)) continue
    const boucle: Point[] = []
    let prec = ''
    let cur = depart
    while (!vus.has(cur)) {
      vus.add(cur)
      boucle.push(points.get(cur)!)
      const suiv = voisins.get(cur)!.find((n) => n !== prec && !vus.has(n))
      if (!suiv) break
      prec = cur
      cur = suiv
    }
    if (boucle.length > 2) contours.push(boucle)
  }
  return contours
}
