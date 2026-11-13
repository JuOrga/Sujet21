// FABRIQUE DU BANC DE LA CÉRÉMONIE — les vrais modules du jeu, rien de recopié
// sauf ce qui vit DANS main.ts (carteHTML : copié à la lettre, voir la
// référence). Empaqueté en IIFE par esbuild, injecté dans la page
// construite (scripts du jeu bloqués) : window.FAB.
const W = '../../src/game/'
// (esbuild résout les chemins absolus tels quels)
import { CARTE_LIVREE, moduleParId, ORBES } from '../../src/game/carteStation'
import { dessinCarteSVG, legendeCarteHTML, cadreCarte } from '../../src/game/dessinCarte'
import { choixModules } from '../../src/game/descenteCarte'
import { tisseMiniCarte, dessinMiniCarteSVG, ICONES_MINI_CARTE } from '../../src/game/voiesModule'
import { dessineMiniCarte } from '../../src/game/carte'
import { genereNiveauAtelier } from '../../src/game/generateur'
import {
  INSTRUMENTS, tirageInstruments, descriptionInstrument, calibreInstrument, aContrepartie, famillesInstrument,
} from '../../src/game/instruments'
import { levierDef, sensEffet, forceEffet } from '../../src/game/leviers'
import { gainsDeSalle, gainsDeModule, pastillesDeSalles, condensatDuSas, memoireDuSas } from '../../src/game/recolte'
import { rangDeSalle, motDeNote, titreDuTirage } from '../../src/game/ceremonie'
import { iconeMetaHTML } from '../../src/game/metaAssets'
import { iconeCeremonieHTML, iconeInstrumentHTML } from '../../src/game/iconesStation'
import { cuveHTML, sceauHTML, SCENES_FIN } from '../../src/game/ceremonieObjets'
import { finDescenteHTML, levierFin, releveDescente, titresFin } from '../../src/game/finDescente'
import { fmtL } from '../../src/game/formats'
import { anneauxHTML, colonneMaitrise, couleeColonne, niveauColonne } from '../../src/game/colonneMaitrise'
import { cartoucheHTML } from '../../src/game/cartouches'
import { offresRepos, offreDon } from '../../src/game/descenteCarte'
import { tireEvenement, offresDe, detailOffre, resoutChoix, ditEffet } from '../../src/game/evenements'
void W
import { Feu } from '../../src/game/ceremonieFx'

const htmlSafe = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---- main.ts:12820-12930 (FAMILLE_TEINTE, CALIBRE_MOT, FAMILLE_COURT, valeurEffetLisible, carteHTML) ----
const FAMILLE_TEINTE: Record<string, string> = { corps: '#63b7e6', etats: '#f2c98e', collecte: '#6dffb8', protocole: '#c99aff' }
const CALIBRE_MOT: Record<string, string> = { commun: 'Commun', notable: 'Notable', majeur: 'Majeur' }
const FAMILLE_COURT: Record<string, string> = { corps: 'Corps', etats: 'États', collecte: 'Collecte', protocole: 'Protocole' }
function valeurEffetLisible(e: { levier: string; valeur: number }): string {
  const l = levierDef(e.levier)
  if (!l) return ''
  if (l.mode === 'add') {
    const v = l.pas < 1 ? Math.round(e.valeur * 100) : e.valeur
    const unite = l.pas < 1 ? ' pts' : ''
    return `${v > 0 ? '+' : '−'}${Math.abs(v)}${unite}`
  }
  const pct = Math.round((e.valeur - 1) * 100)
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function carteHTML(d: any, o: { variante: string; tenue?: boolean; prix?: number; actions?: string; bouton?: boolean; attrs?: string }): string {
  const fams = famillesInstrument(d)
  const t1 = FAMILLE_TEINTE[fams[0] ?? 'corps'] ?? '#63b7e6'
  const t2 = FAMILLE_TEINTE[fams[1] ?? fams[0] ?? 'corps'] ?? t1
  const cal = calibreInstrument(d)
  const ctr = aContrepartie(d)
  const rang = `${CALIBRE_MOT[cal]} · ` + fams.map((f) => FAMILLE_COURT[f] ?? f).join(' + ')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const effets = d.effets.map((e: any) => {
    const l = levierDef(e.levier)
    if (!l) return ''
    const prix = sensEffet(e) < 0
    return `<span class="eff${prix ? ' eff-prix' : ''}"><i>${htmlSafe(l.nom)}</i><em>${valeurEffetLisible(e)}</em><span class="eff-jauge" style="--f:${forceEffet(e).toFixed(2)}"></span></span>`
  }).join('')
  const pied: string[] = []
  if (o.tenue) pied.push('<i class="crt-tenue">EN POCHE</i>')
  if (d.perso) pied.push('<i class="crt-perso">ATELIER</i>')
  if (o.prix !== undefined) pied.push(o.prix > 0 ? `<em class="crt-prix">${o.prix} cL</em>` : `<em class="crt-prix crt-offert">offert</em>`)
  if (o.actions) pied.push(`<span class="crt-actions">${o.actions}</span>`)
  const cls = `crt crt-${o.variante} cal-${cal}` + (ctr ? ' a-contrepartie' : '') + (d.perso ? ' crt-perso-c' : '')
  const balise = o.bouton ? 'button' : 'div'
  const phrase = descriptionInstrument(d)
  const condensee = o.variante === 'draft'
  return `<${balise} class="${cls}" style="--fam:${t1};--fam2:${t2}" title="${htmlSafe(`${d.nom} — ${phrase} (${rang})`)}"${o.bouton ? ' type="button"' : ''}${o.attrs ?? ''}>` +
    `<span class="crt-halo"></span>` +
    `<span class="crt-tete"><i class="crt-ico">${iconeInstrumentHTML(d)}</i>` +
    `<span class="crt-titres"><b class="crt-nom">${htmlSafe(d.nom)}</b>` +
    (condensee ? '' : `<i class="crt-rang">${htmlSafe(rang)}</i>`) +
    `</span></span>` +
    (condensee ? '' : `<span class="crt-txt">${htmlSafe(phrase)}</span>`) +
    (ctr ? `<span class="crt-ctr">CONTREPARTIE</span>` : '') +
    `<span class="crt-effets">${effets}</span>` +
    (pied.length ? `<span class="crt-pied">${pied.join('')}</span>` : '') +
    `</${balise}>`
}

// un aléa figé : les mêmes images à chaque passage
function graine(s: number): () => number {
  let g = s
  return () => ((g = (g * 16807) % 2147483647) / 2147483647)
}

function miniCarte(): string {
  const mc = tisseMiniCarte(6, graine(7), [0, 1, 2], (r) => (r < 2 ? 0 : r < 4 ? 1 : 2) as never, { debut: 1, suite: 2 }, true)
  return dessinMiniCarteSVG(mc, { rang: 2, trace: [0, 1], portes: [0, 1, 2] })
}

function station(): { svg: string; legende: string; cadre: string; choix: string[]; courant: string; nomCourant: string } {
  const c = CARTE_LIVREE
  const sas = c.modules.find((m) => m.type === 'sas') ?? c.modules[0]
  // un module voisin du sas, déjà traversé : on se tient là, au début de la descente
  const voisin = c.liens.find((l) => l.de === sas.id)?.vers ?? sas.id
  const visites = [sas.id, voisin]
  const run = { module: voisin, visites, niveau: 0, trace: [], revelations: {} }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choix = choixModules(c, run as any, [])
  const cadre = cadreCarte(c, 'jeu')
  return {
    svg: dessinCarteSVG(c, { mode: 'jeu', courant: voisin, visites, selection: null, lienSelection: null, orbes: [], afficherTemp: true, retour: null, revelations: {} }),
    legende: legendeCarteHTML(c),
    cadre: `${cadre.w} / ${cadre.h}`,
    choix: choix.map((x) => x.module.id),
    courant: voisin,
    nomCourant: moduleParId(c, voisin)?.nom ?? voisin,
  }
}

const FAB = {
  carteHTML, cartoucheHTML, miniCarte, station, rangDeSalle, motDeNote, iconeMetaHTML,
  INSTRUMENTS, gainsDeSalle, gainsDeModule, pastillesDeSalles, condensatDuSas,
  offresRepos, offreDon, tireEvenement, offresDe, detailOffre, ICONES_MINI_CARTE,
  graine, Feu, memoireDuSas, resoutChoix, ditEffet, titreDuTirage, tirageInstruments,
  iconeCeremonieHTML, sceauHTML, cuveHTML, colonneMaitrise, couleeColonne, niveauColonne, anneauxHTML,
  SCENES_FIN, finDescenteHTML, levierFin, releveDescente, titresFin, fmtL,
  /** dessine le plan d'une salle générée dans un canvas de porte */
  plan(canvas: HTMLCanvasElement, mecanique: 0 | 1 | 2 | 3, diff: number, variante: string): string {
    const lv = genereNiveauAtelier({ moment: 2, mecanique, difficulte: diff } as never, variante)
    dessineMiniCarte(canvas, lv)
    return `${lv.code}|${lv.name}`
  },
  CARTE_LIVREE, ORBES,
}
;(window as unknown as { FAB: typeof FAB }).FAB = FAB
