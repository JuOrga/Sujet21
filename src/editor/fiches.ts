// LES FICHES DE L'ÉDITEUR : ce que fait chaque élément, raconté au survol.
// Une bulle patiente (elle attend que la souris se pose) résume l'effet de
// la pièce sous le curseur — par état quand c'est une surface (EAU, GLACE,
// VAPEUR, et le sort du LASER), en paramètres vifs quand c'est un
// mécanisme (canal d'une porte, mode d'une cible, angle d'un émetteur…).
// La même matière nourrit la palette d'outils, à gauche.
//
// Chaque fiche se scinde en deux : le TEXTE STATIQUE (titre, résumé,
// lignes d'effet — modifiable depuis la bulle, partagé via /api/fiches)
// et les VALEURS VIVES (dimensions, canal, angle…), recalculées à chaque
// survol et ajoutées après — une modification ne les perd jamais.

import type { LevelDef, ObstacleBox } from '../game/level'
import {
  MAT_WALL,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_FROID,
  MAT_GRILLE,
  MAT_CHAUD,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
} from '../game/level'

export interface FicheLigne {
  cle: string // la puce (EAU, GLACE, VAPEUR, LASER, ·)
  txt: string
}

export interface Fiche {
  titre: string
  resume: string
  lignes: FicheLigne[]
}

// Une fiche RÉÉCRITE par un concepteur (magasin partagé /api/fiches) :
// le texte remplace le statique, l'auteur et la date signent la relecture.
export interface FicheSurcharge extends Fiche {
  cle: string
  auteur: string
  date: string
  // Remontée libre du concepteur : une valeur vive fausse, un manque,
  // une idée — lisible dans la relecture, jamais dans la bulle du joueur.
  notes?: string
}

export type Surcharges = Record<string, FicheSurcharge>

// ——— Les SURFACES : une fiche par matériau, par état ————————————————
export const FICHES_MATERIAUX: Record<number, Fiche> = {
  [MAT_WALL]: {
    titre: 'Paroi',
    resume: 'Le mur de base : rien ne le traverse.',
    lignes: [
      {
        cle: 'EAU',
        txt: 'bute et s’écoule le long — la paroi ne retient pas.',
      },
      { cle: 'GLACE', txt: 'rebondit entière, sans s’abîmer.' },
      { cle: 'VAPEUR', txt: 'le nuage longe la surface.' },
      { cle: 'LASER', txt: 'absorbé net.' },
      { cle: '·', txt: 'Habillage décoratif au choix par bloc (panneau).' },
    ],
  },
  [MAT_HYDROPHILE]: {
    titre: 'Hydrophile',
    resume: 'Surface mouillée : elle retient ce qui la touche.',
    lignes: [
      { cle: 'EAU', txt: 'adhère et reste collée — un point d’ancrage.' },
      { cle: 'GLACE', txt: 'freinée au contact : un frein à main naturel.' },
      { cle: 'VAPEUR', txt: 'le nuage est attiré et vient s’y plaquer.' },
      { cle: 'LASER', txt: 'absorbé.' },
    ],
  },
  [MAT_HYDROPHOBE]: {
    titre: 'Hydrophobe',
    resume: 'La cire repousse tout ce qui est humide.',
    lignes: [
      { cle: 'EAU', txt: 'repoussée — impossible de s’y poser.' },
      { cle: 'GLACE', txt: 'le rebond est RELANCÉ, façon bumper.' },
      { cle: 'VAPEUR', txt: 'le nuage est tenu à distance.' },
      { cle: 'LASER', txt: 'absorbé.' },
    ],
  },
  [MAT_FROID]: {
    titre: 'Hublot froid',
    resume: 'Une aura de froid émane du hublot (pointillé = sa portée).',
    lignes: [
      { cle: 'EAU', txt: 'gèle si elle s’attarde dans l’aura.' },
      { cle: 'GLACE', txt: 'se SOUDE au hublot : un vrai point d’ancrage.' },
      { cle: 'VAPEUR', txt: 'recondensée en eau au passage.' },
      { cle: 'LASER', txt: 'absorbé par le bâti.' },
    ],
  },
  [MAT_GRILLE]: {
    titre: 'Évent',
    resume: 'Des lamelles : seule la VAPEUR passe.',
    lignes: [
      { cle: 'EAU', txt: 'bute sur les barreaux.' },
      { cle: 'GLACE', txt: 'bute aussi — le palet ne passe pas.' },
      { cle: 'VAPEUR', txt: 'traverse librement : c’est SA porte.' },
      { cle: 'LASER', txt: 'passe entre les barreaux (lumière tamisée).' },
    ],
  },
  [MAT_CHAUD]: {
    titre: 'Chaudière',
    resume: 'La chaleur transforme — jamais désactivée.',
    lignes: [
      { cle: 'EAU', txt: 'VAPORISÉE à ~95 % de présence dans l’aura.' },
      { cle: 'GLACE', txt: 'dégelée : le palet redevient liquide.' },
      { cle: 'VAPEUR', txt: 'entretenue — le nuage n’y condense jamais.' },
      { cle: '·', txt: 'Aura réglable par bloc (champ Aura du panneau).' },
    ],
  },
  [MAT_MEMBRANE]: {
    titre: 'Membrane',
    resume: 'Un tissu gorgé d’eau : seule l’EAU le traverse.',
    lignes: [
      { cle: 'EAU', txt: 'suinte à travers, goutte à goutte.' },
      { cle: 'GLACE', txt: 'refusée — le solide bute.' },
      { cle: 'VAPEUR', txt: 'arrêtée net.' },
      { cle: 'LASER', txt: 'absorbé.' },
    ],
  },
  [MAT_RIDEAU]: {
    titre: 'Rideau lamellaire',
    resume: 'Des lamelles souples : seule la GLACE les écarte.',
    lignes: [
      { cle: 'EAU', txt: 'refusée par les lamelles.' },
      { cle: 'GLACE', txt: 'ÉCARTE le rideau et passe en force.' },
      { cle: 'VAPEUR', txt: 'retenue — le nuage reste derrière.' },
      { cle: 'LASER', txt: 'absorbé.' },
    ],
  },
  [MAT_SURCHAUFFEUR]: {
    titre: 'Surchauffeur',
    resume: 'Une borne de relance pour le nuage.',
    lignes: [
      { cle: 'EAU', txt: 'un mur — la borne l’ignore.' },
      { cle: 'GLACE', txt: 'un mur aussi.' },
      { cle: 'VAPEUR', txt: 'frôlée : rend UN dash, puis s’éteint.' },
      { cle: '·', txt: 'Une seule charge par essai — le serpentin le montre.' },
    ],
  },
}

// ——— Les MÉCANISMES et repères : le texte statique par genre ————————
export const FICHES_GENRES: Record<string, Fiche> = {
  'genre:sas': {
    titre: 'Sas',
    resume: 'La sortie : il aspire et met en bonbonne.',
    lignes: [
      {
        cle: '·',
        txt: 'Tout état qui entre dans son aspiration est collecté.',
      },
      { cle: '·', txt: 'Les litres embarqués font le score du tableau.' },
      { cle: '·', txt: 'Le cercle pointillé montre sa portée d’aspiration.' },
    ],
  },
  'genre:depart': {
    titre: 'Départ',
    resume: 'Le point d’éveil du Sujet.',
    lignes: [
      { cle: '·', txt: 'Le corps naît ici à chaque essai (R le ramène).' },
    ],
  },
  'genre:eponge': {
    titre: 'Éponge',
    resume: 'Elle boit le liquide qui s’attarde.',
    lignes: [
      {
        cle: 'EAU',
        txt: 'absorbée cellule par cellule — chaque litre bu est PERDU.',
      },
      { cle: '·', txt: 'Une cellule saturée se solidifie et ne boit plus.' },
      { cle: '·', txt: 'Gelé ou en vapeur, on la traverse sans risque.' },
    ],
  },
  'genre:laser': {
    titre: 'Émetteur laser',
    resume: 'Un faisceau continu, tendu jusqu’à ce qui l’arrête.',
    lignes: [
      {
        cle: '·',
        txt: 'Les parois l’absorbent, les évents le laissent passer.',
      },
      { cle: 'GLACE', txt: 'le corps gelé le RÉFLÉCHIT — un miroir vivant.' },
      { cle: 'EAU', txt: 'le corps liquide le RÉFRACTE — un prisme.' },
      {
        cle: 'VAPEUR',
        txt: 'l’IONISE : l’arc plasma suit les rails magnétiques.',
      },
      { cle: '·', txt: 'Son métier : allumer les pastilles réceptrices.' },
    ],
  },
  'genre:cible-tor': {
    titre: 'Pastille réceptrice TOR',
    resume: 'Un verrou OUVRANT : un seul passage du faisceau suffit.',
    lignes: [
      {
        cle: '·',
        txt: 'Allumée une fois, elle le reste — la porte asservie s’ouvre pour de bon.',
      },
      {
        cle: '·',
        txt: 'Plusieurs pastilles du même canal : la porte choisit sa règle (une seule suffit, ou toutes).',
      },
    ],
  },
  'genre:cible-nor': {
    titre: 'Pastille réceptrice NOR',
    resume: 'Un maintien SCELLANT : le faisceau doit tenir.',
    lignes: [
      {
        cle: '·',
        txt: 'Ouverte TANT QUE le rayon tient ; première coupure : elle grille et la porte se scelle définitivement.',
      },
      {
        cle: '·',
        txt: 'Plusieurs pastilles du même canal : la porte choisit sa règle (une seule suffit, ou toutes).',
      },
    ],
  },
  'genre:porte': {
    titre: 'Porte asservie',
    resume: 'Une paroi commandée par ses pastilles.',
    lignes: [
      { cle: '·', txt: 'Fermée tant que sa pastille est éteinte.' },
      { cle: '·', txt: 'Ouverte, elle devient traversante — en pointillé.' },
    ],
  },
  'genre:porte-scenarisee': {
    titre: 'Porte scénarisée',
    resume: 'Aucun faisceau ne l’ouvre : une séquence du tableau s’en charge.',
    lignes: [
      {
        cle: '·',
        txt: 'Paroi pleine jusqu’à ce que la séquence in-map la crève (la brèche).',
      },
    ],
  },
  'genre:zone': {
    titre: 'Zone d’état',
    resume: 'Une région qui impose un état — ou déclenche une scène.',
    lignes: [
      {
        cle: '·',
        txt: 'Le corps qui entre est converti ; le sélecteur d’état est verrouillé tant qu’il y reste.',
      },
    ],
  },
  'genre:cache': {
    titre: 'Cachette voilée',
    resume: 'Un pan de carte sous brouillard « non cartographié ».',
    lignes: [
      {
        cle: '·',
        txt: 'Le voile se dissipe à l’entrée du corps et reste levé pour l’essai.',
      },
      {
        cle: '·',
        txt: 'Purement visuel : ce qui est caché existe et fonctionne — on ne le VOIT pas.',
      },
    ],
  },
  'genre:cache-paroi': {
    titre: 'Cachette voilée (paroi factice)',
    resume: 'Rendue comme un vrai mur, ombres portées comprises.',
    lignes: [
      {
        cle: '·',
        txt: 'Elle se dissout à l’entrée du corps et reste levée pour l’essai.',
      },
      {
        cle: '·',
        txt: 'Purement visuel : ce qui est caché existe et fonctionne — on ne le VOIT pas.',
      },
    ],
  },
  'genre:rail': {
    titre: 'Rail magnétique',
    resume: 'Une ligne de champ posée dans le décor.',
    lignes: [
      { cle: '·', txt: 'Le faisceau ordinaire l’ignore.' },
      {
        cle: 'VAPEUR',
        txt: 'un faisceau IONISÉ (passé par le nuage) est capturé à une extrémité, suit le tracé, repart tout droit.',
      },
      {
        cle: '·',
        txt: 'Le plasma se PROVOQUE : être vapeur dans la lumière, au bon endroit.',
      },
    ],
  },
  'genre:lampe': {
    titre: 'Lampe',
    resume: 'Elle éclaire la cuve et couche les ombres du décor.',
    lignes: [
      {
        cle: '·',
        txt: 'Haute : ombres courtes et douces ; basse : longues et dramatiques.',
      },
      {
        cle: '·',
        txt: 'Poser une lampe remplace la lampe par défaut du tableau.',
      },
    ],
  },
  'genre:decor': {
    titre: 'Machinerie de décor',
    resume: 'Tuyaux, vannes, écrans : la vie d’avant.',
    lignes: [
      {
        cle: '·',
        txt: 'Aucune physique, aucune règle — un décor plaqué sur la paroi.',
      },
    ],
  },
  'genre:pancarte': {
    titre: 'Pancarte',
    resume: 'Une étiquette peinte dans le décor.',
    lignes: [
      {
        cle: '·',
        txt: 'Portée SECTEUR : elle nomme un lieu et survit au dézoom ; portée DÉTAIL : elle commente un objet et s’efface si elle gêne.',
      },
    ],
  },
}

const FORMES_NOMS: Record<number, string> = {
  1: 'disque',
  2: 'capsule',
  3: 'coin (triangle rectangle)',
  4: 'arc',
}

type SelFiche = { kind: string; index?: number } | null

/** La CLÉ de la fiche sous le curseur — celle du magasin de surcharges. */
export function cleFiche(sel: SelFiche, level: LevelDef): string | null {
  if (!sel) return null
  switch (sel.kind) {
    case 'box': {
      const b = level.boxes[sel.index ?? -1]
      return b && FICHES_MATERIAUX[b.material] ? `mat:${b.material}` : null
    }
    case 'exit':
      return 'genre:sas'
    case 'spawn':
      return 'genre:depart'
    case 'sponge':
      return 'genre:eponge'
    case 'laser':
      return 'genre:laser'
    case 'cible': {
      const t = (level.cibles ?? [])[sel.index ?? -1]
      return t?.mode === 'nor' ? 'genre:cible-nor' : 'genre:cible-tor'
    }
    case 'porte': {
      const p = (level.portes ?? [])[sel.index ?? -1]
      return p && p.canal < 0 ? 'genre:porte-scenarisee' : 'genre:porte'
    }
    case 'zone':
      return 'genre:zone'
    case 'cache': {
      const ca = (level.caches ?? [])[sel.index ?? -1]
      return ca?.style === 'paroi' ? 'genre:cache-paroi' : 'genre:cache'
    }
    case 'rail':
      return 'genre:rail'
    case 'lumiere':
      return 'genre:lampe'
    case 'decal':
      return 'genre:decor'
    case 'label':
      return 'genre:pancarte'
    default:
      return null
  }
}

/** Le texte statique d'une clé — celui que la surcharge peut remplacer. */
export function ficheStatique(cle: string): Fiche | null {
  if (cle.startsWith('mat:'))
    return FICHES_MATERIAUX[Number(cle.slice(4))] ?? null
  return FICHES_GENRES[cle] ?? null
}

/** Les VALEURS VIVES de l'élément : recalculées à chaque survol, jamais
 * touchées par une surcharge — elles s'ajoutent après le texte. */
export function lignesVives(sel: SelFiche, level: LevelDef): FicheLigne[] {
  if (!sel) return []
  switch (sel.kind) {
    case 'box': {
      const b = level.boxes[sel.index ?? -1]
      if (!b) return []
      const geo: string[] = []
      if (b.forme && FORMES_NOMS[b.forme])
        geo.push(`forme ${FORMES_NOMS[b.forme]}`)
      if (b.angle) geo.push(`inclinée à ${b.angle}°`)
      geo.push(
        `${Math.round(b.maxX - b.minX)} × ${Math.round(b.maxY - b.minY)} u`,
      )
      return [{ cle: '·', txt: geo.join(' · ') }]
    }
    case 'spawn':
      return [{ cle: '·', txt: `${level.spawn.n} particules à l’apparition.` }]
    case 'sponge': {
      const sp = level.sponges[sel.index ?? -1]
      return sp
        ? [
            {
              cle: '·',
              txt: `${sp.cols} × ${sp.rows} cellules · ${sp.capacityPerCell} particules avant qu’une cellule ne se solidifie.`,
            },
          ]
        : []
    }
    case 'laser': {
      const l = (level.lasers ?? [])[sel.index ?? -1]
      return l ? [{ cle: '·', txt: `Orienté à ${l.angle}°.` }] : []
    }
    case 'cible': {
      const t = (level.cibles ?? [])[sel.index ?? -1]
      if (!t) return []
      const canal = t.canal ?? (sel.index ?? 0) + 1
      return [
        {
          cle: '·',
          txt: `Canal n° ${canal} — les portes qui portent ce numéro lui obéissent.`,
        },
      ]
    }
    case 'porte': {
      const p = (level.portes ?? [])[sel.index ?? -1]
      if (!p || p.canal < 0) return []
      return [
        {
          cle: '·',
          txt: `Canal n° ${p.canal} · ${
            p.regle === 'et'
              ? 'Règle ET : toutes les pastilles du canal doivent être actives ensemble.'
              : 'Règle OU : une seule pastille active suffit.'
          }`,
        },
      ]
    }
    case 'zone': {
      const z = (level.zones ?? [])[sel.index ?? -1]
      if (!z) return []
      const noms: Record<string, string> = {
        glace: 'impose la GLACE',
        vapeur: 'impose la VAPEUR',
        eau: 'impose l’EAU',
        libre: 'n’impose rien (déclencheur pur)',
      }
      const l: FicheLigne[] = [
        { cle: '·', txt: `Ici : ${noms[z.force] ?? '?'}.` },
      ]
      if (z.cine)
        l.push({
          cle: '·',
          txt: `Déclenche la cinématique « ${z.cine} » à l’entrée (une fois par essai).`,
        })
      if (z.sequence)
        l.push({
          cle: '·',
          txt: `Déclenche la séquence « ${z.sequence} » à l’entrée (une fois par essai).`,
        })
      return l
    }
    case 'lumiere': {
      const l = (level.lumieres ?? [])[sel.index ?? -1]
      return l ? [{ cle: '·', txt: `Hauteur ${l.h ?? 420} u.` }] : []
    }
    case 'label': {
      const l = level.labels[sel.index ?? -1]
      if (!l) return []
      return [
        {
          cle: '·',
          txt: `« ${l.text} » — portée ${l.rang === 'secteur' ? 'SECTEUR' : 'DÉTAIL'}${
            l.picto
              ? ' · porte un pictogramme d’état (indice humain, aucun effet joueur)'
              : ''
          }.`,
        },
      ]
    }
    default:
      return []
  }
}

/** La fiche complète d'un élément : le texte statique (ou sa SURCHARGE
 * partagée) suivi des valeurs vives. */
export function ficheElement(
  sel: SelFiche,
  level: LevelDef,
  surcharges?: Surcharges,
): Fiche | null {
  const cle = cleFiche(sel, level)
  if (!cle) return null
  const base = surcharges?.[cle] ?? ficheStatique(cle)
  if (!base) return null
  return {
    titre: base.titre,
    resume: base.resume,
    lignes: [...base.lignes, ...lignesVives(sel, level)],
  }
}

/** La fiche d'une paroi posée (matériau + géométrie vive). */
export function ficheBox(b: ObstacleBox): Fiche | null {
  const base = FICHES_MATERIAUX[b.material]
  if (!base) return null
  const geo: string[] = []
  if (b.forme && FORMES_NOMS[b.forme]) geo.push(`forme ${FORMES_NOMS[b.forme]}`)
  if (b.angle) geo.push(`inclinée à ${b.angle}°`)
  geo.push(`${Math.round(b.maxX - b.minX)} × ${Math.round(b.maxY - b.minY)} u`)
  return {
    ...base,
    lignes: [...base.lignes, { cle: '·', txt: geo.join(' · ') }],
  }
}
