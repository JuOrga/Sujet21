// LES FICHES DE L'ÉDITEUR : ce que fait chaque élément, raconté au survol.
// Une bulle patiente (elle attend que la souris se pose) résume l'effet de
// la pièce sous le curseur — par état quand c'est une surface (EAU, GLACE,
// VAPEUR, et le sort du LASER), en paramètres vifs quand c'est un
// mécanisme (canal d'une porte, mode d'une cible, angle d'un émetteur…).
// La même matière nourrit la palette d'outils, à gauche.

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

const FORMES_NOMS: Record<number, string> = {
  1: 'disque',
  2: 'capsule',
  3: 'coin (triangle rectangle)',
  4: 'arc',
}

// ——— La fiche d'une PAROI posée : matériau + géométrie vive ————————
export function ficheBox(b: ObstacleBox): Fiche | null {
  const base = FICHES_MATERIAUX[b.material]
  if (!base) return null
  const lignes = [...base.lignes]
  const geo: string[] = []
  if (b.forme && FORMES_NOMS[b.forme]) geo.push(`forme ${FORMES_NOMS[b.forme]}`)
  if (b.angle) geo.push(`inclinée à ${b.angle}°`)
  geo.push(`${Math.round(b.maxX - b.minX)} × ${Math.round(b.maxY - b.minY)} u`)
  lignes.push({ cle: '·', txt: geo.join(' · ') })
  return { ...base, lignes }
}

// ——— Les MÉCANISMES et repères : une fiche par genre ————————————————
export function ficheElement(
  sel: { kind: string; index?: number } | null,
  level: LevelDef,
): Fiche | null {
  if (!sel) return null
  switch (sel.kind) {
    case 'box': {
      const b = level.boxes[sel.index ?? -1]
      return b ? ficheBox(b) : null
    }
    case 'exit':
      return {
        titre: 'Sas',
        resume: 'La sortie : il aspire et met en bonbonne.',
        lignes: [
          {
            cle: '·',
            txt: 'Tout état qui entre dans son aspiration est collecté.',
          },
          { cle: '·', txt: 'Les litres embarqués font le score du tableau.' },
          {
            cle: '·',
            txt: 'Le cercle pointillé montre sa portée d’aspiration.',
          },
        ],
      }
    case 'spawn':
      return {
        titre: 'Départ',
        resume: 'Le point d’éveil du Sujet.',
        lignes: [
          { cle: '·', txt: `${level.spawn.n} particules à l’apparition.` },
          { cle: '·', txt: 'Le corps naît ici à chaque essai (R le ramène).' },
        ],
      }
    case 'sponge': {
      const sp = level.sponges[sel.index ?? -1]
      return {
        titre: 'Éponge',
        resume: 'Elle boit le liquide qui s’attarde.',
        lignes: [
          {
            cle: 'EAU',
            txt: 'absorbée cellule par cellule — chaque litre bu est PERDU.',
          },
          {
            cle: '·',
            txt: sp
              ? `${sp.cols} × ${sp.rows} cellules · ${sp.capacityPerCell} particules avant qu’une cellule ne se solidifie.`
              : 'Une cellule saturée se solidifie et ne boit plus.',
          },
          { cle: '·', txt: 'Gelé ou en vapeur, on la traverse sans risque.' },
        ],
      }
    }
    case 'laser': {
      const l = (level.lasers ?? [])[sel.index ?? -1]
      return {
        titre: 'Émetteur laser',
        resume: l
          ? `Faisceau continu, orienté à ${l.angle}°.`
          : 'Faisceau continu.',
        lignes: [
          {
            cle: '·',
            txt: 'Les parois l’absorbent, les évents le laissent passer.',
          },
          {
            cle: 'GLACE',
            txt: 'le corps gelé le RÉFLÉCHIT — un miroir vivant.',
          },
          { cle: 'EAU', txt: 'le corps liquide le RÉFRACTE — un prisme.' },
          {
            cle: 'VAPEUR',
            txt: 'l’IONISE : l’arc plasma suit les rails magnétiques.',
          },
          { cle: '·', txt: 'Son métier : allumer les pastilles réceptrices.' },
        ],
      }
    }
    case 'cible': {
      const t = (level.cibles ?? [])[sel.index ?? -1]
      const mode = t?.mode === 'nor' ? 'NOR' : 'TOR'
      const canal = t ? (t.canal ?? (sel.index ?? 0) + 1) : undefined
      return {
        titre: `Pastille réceptrice ${mode}`,
        resume:
          mode === 'TOR'
            ? 'Un verrou OUVRANT : un seul passage du faisceau suffit.'
            : 'Un maintien SCELLANT : le faisceau doit tenir.',
        lignes: [
          mode === 'TOR'
            ? {
                cle: '·',
                txt: 'Allumée une fois, elle le reste — la porte asservie s’ouvre pour de bon.',
              }
            : {
                cle: '·',
                txt: 'Ouverte TANT QUE le rayon tient ; première coupure : elle grille et la porte se scelle définitivement.',
              },
          {
            cle: '·',
            txt:
              canal !== undefined
                ? `Canal n° ${canal} — les portes qui portent ce numéro lui obéissent.`
                : 'Les portes de son canal lui obéissent.',
          },
          {
            cle: '·',
            txt: 'Plusieurs pastilles du même canal : la porte choisit sa règle (une seule suffit, ou toutes).',
          },
        ],
      }
    }
    case 'porte': {
      const p = (level.portes ?? [])[sel.index ?? -1]
      const scen = p ? p.canal < 0 : false
      return {
        titre: scen ? 'Porte scénarisée' : 'Porte asservie',
        resume: scen
          ? 'Aucun faisceau ne l’ouvre : une séquence du tableau s’en charge.'
          : 'Une paroi commandée par ses pastilles.',
        lignes: scen
          ? [
              {
                cle: '·',
                txt: 'Paroi pleine jusqu’à ce que la séquence in-map la crève (la brèche).',
              },
            ]
          : [
              {
                cle: '·',
                txt: p
                  ? `Canal n° ${p.canal} — fermée tant que la pastille est éteinte.`
                  : 'Fermée tant que sa pastille est éteinte.',
              },
              {
                cle: '·',
                txt:
                  p?.regle === 'et'
                    ? 'Règle ET : toutes les pastilles du canal doivent être actives ensemble.'
                    : 'Règle OU : une seule pastille active suffit.',
              },
              {
                cle: '·',
                txt: 'Ouverte, elle devient traversante — en pointillé.',
              },
            ],
      }
    }
    case 'zone': {
      const z = (level.zones ?? [])[sel.index ?? -1]
      const noms: Record<string, string> = {
        glace: 'impose la GLACE',
        vapeur: 'impose la VAPEUR',
        eau: 'impose l’EAU',
        libre: 'n’impose rien (déclencheur pur)',
      }
      return {
        titre: 'Zone d’état',
        resume: z
          ? `Cette région ${noms[z.force] ?? '?'}.`
          : 'Une région qui impose un état.',
        lignes: [
          {
            cle: '·',
            txt: 'Le corps qui entre est converti ; le sélecteur d’état est verrouillé tant qu’il y reste.',
          },
          ...(z?.cine
            ? [
                {
                  cle: '·',
                  txt: `Déclenche la cinématique « ${z.cine} » à l’entrée (une fois par essai).`,
                },
              ]
            : []),
          ...(z?.sequence
            ? [
                {
                  cle: '·',
                  txt: `Déclenche la séquence « ${z.sequence} » à l’entrée (une fois par essai).`,
                },
              ]
            : []),
        ],
      }
    }
    case 'cache': {
      const ca = (level.caches ?? [])[sel.index ?? -1]
      return {
        titre: 'Cachette voilée',
        resume:
          ca?.style === 'paroi'
            ? 'Une PAROI FACTICE : rendue comme un vrai mur, ombres comprises.'
            : 'Un pan de carte sous brouillard « non cartographié ».',
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
      }
    }
    case 'rail':
      return {
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
      }
    case 'lumiere': {
      const l = (level.lumieres ?? [])[sel.index ?? -1]
      return {
        titre: 'Lampe',
        resume: 'Elle éclaire la cuve et couche les ombres du décor.',
        lignes: [
          {
            cle: '·',
            txt: l
              ? `Hauteur ${l.h ?? 420} u — haute : ombres courtes et douces ; basse : longues et dramatiques.`
              : 'Sa hauteur règle la longueur des ombres.',
          },
          {
            cle: '·',
            txt: 'Poser une lampe remplace la lampe par défaut du tableau.',
          },
        ],
      }
    }
    case 'decal':
      return {
        titre: 'Machinerie de décor',
        resume: 'Tuyaux, vannes, écrans : la vie d’avant.',
        lignes: [
          {
            cle: '·',
            txt: 'Aucune physique, aucune règle — un décor plaqué sur la paroi.',
          },
        ],
      }
    case 'label': {
      const l = level.labels[sel.index ?? -1]
      return {
        titre: 'Pancarte',
        resume: l
          ? `« ${l.text} » — peinte dans le décor.`
          : 'Une étiquette peinte dans le décor.',
        lignes: [
          {
            cle: '·',
            txt:
              l?.rang === 'secteur'
                ? 'Portée SECTEUR : elle nomme un lieu et survit au dézoom.'
                : 'Portée DÉTAIL : elle commente un objet et s’efface si elle gêne.',
          },
          ...(l?.picto
            ? [
                {
                  cle: '·',
                  txt: 'Porte un pictogramme d’état (points EAU/GLACE/VAPEUR 0..3) — indice pour les humains, aucun effet joueur.',
                },
              ]
            : []),
        ],
      }
    }
    default:
      return null
  }
}
