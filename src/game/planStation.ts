// LE DESSIN DU PLAN DE STATION : les données de station.ts, en SVG.
//
// Pourquoi du SVG et pas un canvas comme la mini-carte (carte.ts) : le plan
// se SURVOLE et se CLIQUE (chaque module est une cible), il porte du texte
// qui doit rester net à toutes les tailles, et son animation (le halo du
// module courant, la ligne de trajet) est bien plus légère en CSS qu'en
// boucle de rendu. Un canvas aurait redemandé un pipeline de dessin, des
// tests de collision au pointeur et une gestion du zoom : tout ce que le
// navigateur fait déjà pour du SVG.
//
// La fonction est PURE : elle rend une chaîne. Rien n'y touche au DOM, rien
// n'y lit l'état du jeu — c'est l'appelant qui dit où l'on en est. Un test
// peut donc vérifier le plan sans navigateur.

import {
  CASES,
  MODULES,
  MODULE_HUB,
  PANNEAUX,
  PLAN_HAUTEUR,
  PLAN_LARGEUR,
  POUTRE,
  RADIATEURS,
  caseDuRang,
  etatModule,
  type BoiteModule,
  type ModuleStation,
} from './station'

export interface OptionsPlan {
  /** les salles FRANCHIES de la descente en cours (0 : on n'est pas parti) */
  rang: number
  /** la longueur du plan de descente */
  longueur: number
  /** la profondeur record du poste — la marque du plus loin déjà atteint */
  record: number
  /** le secteur 4 est-il encore scellé ? (tout le récit n'est pas servi) */
  scelle: boolean
  /** le module mis en avant par le pointeur (0-based) — null : aucun */
  selection: number | null
}

const ech = (v: number): string => v.toFixed(1)

/** LE NOM D'UN MODULE, COUPÉ EN DEUX LIGNES AU BESOIN. Un fût fait 138
 *  unités et les noms en font jusqu'à deux cents : sur une seule ligne, ils
 *  se recouvraient d'un module à l'autre — « LE NŒUD D'AMARRAGE » mangeait
 *  « LES SERRES ». La coupe se fait au blanc le plus proche du milieu, pour
 *  que les deux lignes s'équilibrent, et jamais au-delà de deux lignes :
 *  au-delà, l'étiquette descendrait sur le sous-titre. */
export function coupeNom(nom: string, seuil = 14): [string] | [string, string] {
  if (nom.length <= seuil || !nom.includes(' ')) return [nom]
  const milieu = nom.length / 2
  let coupe = -1
  for (let i = 0; i < nom.length; i++)
    if (nom[i] === ' ' && (coupe < 0 || Math.abs(i - milieu) < Math.abs(coupe - milieu)))
      coupe = i
  return [nom.slice(0, coupe), nom.slice(coupe + 1)]
}

/** Le semis d'étoiles du fond. Tirage DÉTERMINISTE (générateur à graine
 *  fixe) : le plan doit être le même à chaque ouverture — un ciel qui
 *  change à chaque clic se remarque, et pour rien. */
function etoiles(): string {
  let h = 0x21215a17
  const suivant = (): number => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0
    return h / 2 ** 32
  }
  let out = ''
  for (let i = 0; i < 150; i++) {
    const x = suivant() * PLAN_LARGEUR
    const y = suivant() * PLAN_HAUTEUR
    const r = 0.5 + suivant() * 1.2
    const o = 0.16 + suivant() * 0.5
    out += `<circle cx="${ech(x)}" cy="${ech(y)}" r="${ech(r)}" fill="#cfe6ff" opacity="${o.toFixed(2)}"/>`
  }
  return `<g class="ps-ciel" aria-hidden="true">${out}</g>`
}

/** Un panneau solaire : le damier de cellules fait la lecture, pas le bleu. */
function panneau(b: BoiteModule, i: number): string {
  const colonnes = 6
  let cellules = ''
  for (let c = 1; c < colonnes; c++) {
    const x = b.x + (b.w / colonnes) * c
    cellules += `<line x1="${ech(x)}" y1="${b.y}" x2="${ech(x)}" y2="${b.y + b.h}"/>`
  }
  cellules += `<line x1="${b.x}" y1="${ech(b.y + b.h / 2)}" x2="${b.x + b.w}" y2="${ech(b.y + b.h / 2)}"/>`
  return (
    `<g class="ps-panneau" data-p="${i}">` +
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="2"/>` +
    `<g class="ps-cellules">${cellules}</g></g>`
  )
}

/** Le fût d'un module : coque, bande de teinte, nervures, hublot. */
function fut(m: ModuleStation, classe: string, i: number, badge: string): string {
  const b = m.boite
  const cx = b.x + b.w / 2
  let nervures = ''
  for (let n = 1; n <= 3; n++) {
    const x = b.x + (b.w / 4) * n
    nervures += `<line x1="${ech(x)}" y1="${ech(b.y + 7)}" x2="${ech(x)}" y2="${ech(b.y + b.h - 7)}"/>`
  }
  return (
    // la TEINTE voyage en propriété CSS : le style du module se règle
    // ensuite entièrement en feuille de style, sans qu'une couleur soit
    // écrite en dur dans le dessin
    `<g class="${classe}" data-mod="${i}" tabindex="0" role="button" ` +
    `style="--t:${m.teinte}" aria-label="${m.nom} — ${m.soustitre}">` +
    `<title>${m.nom} — ${m.soustitre}</title>` +
    // le halo : une couche séparée, pour qu'il s'allume sans repeindre la coque
    `<rect class="ps-halo" x="${b.x - 10}" y="${b.y - 10}" width="${b.w + 20}" height="${b.h + 20}" rx="18"/>` +
    `<rect class="ps-fut" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="13"/>` +
    `<rect class="ps-bande" x="${b.x + 9}" y="${ech(b.y + 7)}" width="${b.w - 18}" height="3" rx="1.5"/>` +
    `<g class="ps-nervures">${nervures}</g>` +
    `<circle class="ps-hublot" cx="${ech(cx)}" cy="${ech(b.y + b.h / 2 + 6)}" r="9"/>` +
    `<text class="ps-badge" x="${ech(cx)}" y="${ech(b.y - 26)}">${badge}</text>` +
    nomEnLignes(m.nom, cx, b.y + b.h + 24) +
    `<text class="ps-sous" x="${ech(cx)}" y="${ech(b.y + b.h + 56)}">${m.soustitre}</text>` +
    `</g>`
  )
}

/** Le nom posé sur une ou deux lignes, centré sur le fût. */
function nomEnLignes(nom: string, cx: number, y: number): string {
  const lignes = coupeNom(nom)
  return (
    `<text class="ps-nom" x="${ech(cx)}" y="${ech(y)}">` +
    lignes
      .map(
        (l, i) =>
          `<tspan x="${ech(cx)}" dy="${i === 0 ? 0 : 14}">${l}</tspan>`,
      )
      .join('') +
    `</text>`
  )
}

/** Les manchons entre deux modules : ce qui fait une station et non une
 *  rangée de boîtes. */
function manchons(): string {
  const boites = [MODULE_HUB, ...MODULES].map((m) => m.boite)
  let out = ''
  for (let i = 1; i < boites.length; i++) {
    const g = boites[i - 1]
    const d = boites[i]
    const x1 = g.x + g.w
    const x2 = d.x
    const y = 300
    out +=
      `<rect class="ps-manchon" x="${ech(x1)}" y="${ech(y - 13)}" width="${ech(x2 - x1)}" height="26" rx="4"/>` +
      `<line class="ps-manchon-trait" x1="${ech(x1)}" y1="${ech(y)}" x2="${ech(x2)}" y2="${ech(y)}"/>`
  }
  return `<g class="ps-manchons" aria-hidden="true">${out}</g>`
}

/** LA ROUTE PARCOURUE : le trait qui va du hub au module courant. C'est lui
 *  qui raconte la progression — les modules disent où l'on est, la route dit
 *  d'où l'on vient. */
function route(o: OptionsPlan): string {
  const c = caseDuRang(o.rang, o.longueur)
  if (c === 0) return ''
  const depart = MODULE_HUB.boite
  const arrivee = MODULES[c - 1].boite
  const x1 = depart.x + depart.w / 2
  const x2 = arrivee.x + arrivee.w / 2
  return (
    `<g class="ps-route" aria-hidden="true">` +
    `<line class="ps-route-trait" x1="${ech(x1)}" y1="300" x2="${ech(x2)}" y2="300"/>` +
    `</g>`
  )
}

/** LE SUJET — « vous êtes ici ». Il se dessine APRÈS les modules, et
 *  AU-DESSUS du fût plutôt qu'en son centre : posé au centre il tombait
 *  pile sur le hublot et les deux points n'en faisaient plus qu'un. */
function sujet(o: OptionsPlan): string {
  const c = caseDuRang(o.rang, o.longueur)
  if (c === 0) return ''
  const b = MODULES[c - 1].boite
  const x = b.x + b.w / 2
  const y = b.y - 4
  return (
    `<g class="ps-marqueur" aria-hidden="true">` +
    `<circle class="ps-sujet" cx="${ech(x)}" cy="${ech(y)}" r="7"/>` +
    `<path class="ps-fleche" d="M ${ech(x - 5)} ${ech(y + 9)} L ${ech(x + 5)} ${ech(y + 9)} L ${ech(x)} ${ech(y + 16)} z"/>` +
    `</g>`
  )
}

/** LA MARQUE DU RECORD : un fanion sur le module le plus loin jamais
 *  atteint sur ce poste. Elle ne s'affiche que devant soi — derrière, elle
 *  ne dirait rien qu'on ne voie déjà. */
function marqueRecord(o: OptionsPlan): string {
  const r = caseDuRang(o.record, o.longueur)
  const c = caseDuRang(o.rang, o.longueur)
  if (r === 0 || r <= c) return ''
  const b = MODULES[r - 1].boite
  const x = b.x + b.w / 2
  return (
    `<g class="ps-record" aria-hidden="true">` +
    `<line x1="${ech(x)}" y1="${ech(b.y - 34)}" x2="${ech(x)}" y2="${ech(b.y - 6)}"/>` +
    `<path d="M ${ech(x)} ${ech(b.y - 34)} l 16 6 l -16 6 z"/>` +
    `</g>`
  )
}

/** LE SCEAU du secteur 4 : des barres en travers, tant que tout n'est pas
 *  raconté. C'est la seule porte du plan qui ne s'ouvre pas en jouant. */
function sceau(o: OptionsPlan): string {
  if (!o.scelle) return ''
  const b = MODULES[CASES - 1].boite
  let barres = ''
  for (let i = 0; i < 5; i++) {
    const x = b.x + 12 + i * ((b.w - 24) / 4)
    barres += `<line x1="${ech(x)}" y1="${ech(b.y + 4)}" x2="${ech(x - 22)}" y2="${ech(b.y + b.h - 4)}"/>`
  }
  return (
    `<g class="ps-sceau" aria-hidden="true">${barres}` +
    `<text x="${ech(b.x + b.w / 2)}" y="${ech(b.y + b.h + 74)}">SCELLÉ</text></g>`
  )
}

/** LE PLAN COMPLET. `selection` met un module en avant sans rien changer à
 *  l'état de la descente : c'est la lecture, pas le jeu. */
export function planStationSVG(o: OptionsPlan): string {
  const decor =
    `<g class="ps-poutre" aria-hidden="true">` +
    RADIATEURS.map(
      (b) =>
        `<rect class="ps-radiateur" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="3"/>`,
    ).join('') +
    `<rect x="${POUTRE.x}" y="${POUTRE.y}" width="${POUTRE.w}" height="${POUTRE.h}" rx="5"/>` +
    `</g>` +
    PANNEAUX.map(panneau).join('')

  const hub = fut(MODULE_HUB, 'ps-mod ps-hub', -1, '⌂')
  const corps = MODULES.map((m, i) => {
    const etat = etatModule(i, o.rang, o.longueur)
    const vise = o.selection === i ? ' ps-vise' : ''
    return fut(m, `ps-mod ps-${etat}${vise}`, i, String(i + 1))
  }).join('')

  return (
    `<svg class="ps-svg" viewBox="0 0 ${PLAN_LARGEUR} ${PLAN_HAUTEUR}" ` +
    `preserveAspectRatio="xMidYMid meet" role="group" ` +
    `aria-label="Plan de la station : ${CASES} modules">` +
    etoiles() +
    decor +
    manchons() +
    route(o) +
    hub +
    corps +
    sujet(o) +
    marqueRecord(o) +
    sceau(o) +
    `</svg>`
  )
}
