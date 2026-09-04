// LE CATALOGUE DES TEXTES : tout ce que le joueur peut lire, en un endroit.
//
// Deux besoins qui n'en font qu'un. Le concepteur veut RÉÉCRIRE le lore et
// a besoin de le voir en entier ; une internationalisation a besoin que
// chaque texte porte une CLÉ STABLE. C'est la même opération : sortir les
// textes de leur cachette et les nommer. Le catalogue français devient le
// plan de travail de la réécriture ; une seconde langue ne sera plus qu'une
// colonne de plus, sans retoucher une ligne de code.
//
// CE FICHIER NE DÉTIENT AUCUN TEXTE. Il PARCOURT les modules de jeu et rend
// une liste plate. C'est délibéré : la couverture est totale dès le premier
// jour, y compris pour les domaines qui n'ont pas encore migré, et aucun
// texte ne peut exister sans paraître ici — un texte oublié serait un texte
// qu'on ne saurait ni relire ni traduire.
//
// HORS PÉRIMÈTRE, et c'est assumé : le journal des livraisons (430 000
// caractères de documentation de chantier), l'éditeur de tableaux et le
// banc de réglage — des outils de conception, pas du jeu. Et tout ce que
// le joueur écrit lui-même (tableaux de la bibliothèque, cinématiques du
// montage, cartes de l'atelier) : ces textes vivent hors du dépôt, ils
// resteront dans la langue de leur auteur.

import { CODEX_EXPERIENCES } from '../game/codex'
import { TABLEAUX, type LevelDef } from '../game/level'
import { ARTICLES_COMPTOIR, TABLEAU_HUB, TABLEAU_HUB_COMPACT } from '../game/hub'
import { ETAL_ECONOMAT, TABLEAU_ECONOMAT } from '../game/economat'
import { REPARATIONS } from '../game/reparations'
import { CINEMATIQUES_LIVREES } from '../game/cinematique'
import { INSTRUMENTS } from '../game/instruments'
import { FIOLES } from '../game/fioles'
import { TROPHEES } from '../game/trophees'
import { LEVIERS, valeurProposee } from '../game/leviers'
import { ETATS_CYCLE, TRANSFOS_CYCLE } from '../game/cycle'

export type DomaineTexte =
  | 'codex'
  | 'tableau'
  | 'hub'
  | 'economat'
  | 'reparation'
  | 'cinematique'
  | 'carte'
  | 'fiole'
  | 'trophee'
  | 'levier'
  | 'cycle'

export const DOMAINE_NOMS: Record<DomaineTexte, string> = {
  codex: 'Le codex',
  tableau: 'Les tableaux',
  hub: 'Le module Méduse',
  economat: 'L’Économat',
  reparation: 'Les réparations',
  cinematique: 'Les cinématiques',
  carte: 'Les cartes',
  fiole: 'Les fioles',
  trophee: 'Les trophées',
  levier: 'Les leviers',
  cycle: 'Le cycle des états',
}

export interface EntreeTexte {
  /** L'identité du texte, stable : c'est elle qui survivra à la réécriture. */
  cle: string
  domaine: DomaineTexte
  /** L'entité qui porte le texte — la fiche, le tableau, la carte. */
  sujet: string
  /** Quel texte de cette entité : titre, corps, panneau, réplique… */
  champ: string
  texte: string
  /** Où le joueur le lit, en clair — pour relire en connaissance de cause. */
  ou: string
  /**
   * Un texte ENGENDRÉ par une fonction, pas une chaîne : il varie avec un
   * nombre, il accorde ses pluriels. Le catalogue en montre un exemple, mais
   * on ne le réécrit pas ici — et c'est lui qui coûtera le plus à traduire.
   */
  engendre?: boolean
}

/** Les deux moitiés d'un panneau du monde : « TITRE|sous-titre ». */
const PANNEAU_SEP = '|'

/**
 * UNE CLÉ N'A QU'UNE FORME. Les identifiants du jeu, eux, en ont trois :
 * capitales pour les cinématiques (ESSAI), codes mêlés pour les tableaux
 * (21-A), camelCase pour les leviers (seuilDispersion). On ne renomme rien
 * — ce sont des identifiants de code — mais la clé les met tous au même
 * régime : minuscules, mots séparés par un tiret. Une clé se tape, se cite
 * dans un tableur, se retrouve dans un diff ; elle ne doit pas dépendre de
 * la casse de celui qui l'écrit.
 */
export function enCle(id: string): string {
  return id
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * LA CLÉ, construite ici et NULLE PART AILLEURS. Le jeu lit désormais le
 * catalogue (src/textes/lecture.ts) : il doit fabriquer exactement la même
 * clé que celle inscrite ici, sinon une retouche se rangerait sous un nom
 * que personne n'irait chercher — et l'on ne s'en apercevrait qu'en jeu, en
 * voyant le texte d'origine s'obstiner. Une seule fonction, donc, appelée
 * des deux côtés.
 */
export function cleTexte(
  domaine: DomaineTexte,
  sujet: string,
  ...champs: string[]
): string {
  return [domaine, enCle(sujet), ...champs.map(enCle)].join('.')
}

function pousse(
  out: EntreeTexte[],
  e: Omit<EntreeTexte, 'texte'> & { texte: string | undefined },
): void {
  const t = (e.texte ?? '').trim()
  if (!t) return
  out.push({ ...e, texte: t })
}

/** Les textes d'un tableau : son nom, son journal, ses panneaux. */
function textesDuTableau(
  out: EntreeTexte[],
  lv: LevelDef,
  domaine: DomaineTexte,
  sujet: string,
  ou: string,
): void {
  // le sujet garde le code tel qu'il se lit ; la clé le normalise
  const k = enCle(sujet)
  pousse(out, {
    cle: `${domaine}.${k}.nom`,
    domaine,
    sujet,
    champ: 'nom',
    texte: lv.name,
    ou: `${ou} — le nom affiché`,
  })
  pousse(out, {
    cle: `${domaine}.${k}.journal`,
    domaine,
    sujet,
    champ: 'journal',
    texte: lv.journal,
    ou: `${ou} — le journal, au dossier de descente`,
  })
  lv.labels.forEach((l, i) => {
    // un panneau que le CODE manipule porte une clé ; les autres se
    // repèrent par leur rang. Le jour où tous en auront une, cette
    // branche disparaîtra — et ce sera le signe que la migration est faite.
    const id = l.cle ?? `${i}`
    pousse(out, {
      cle: `${domaine}.${k}.panneau.${enCle(id)}`,
      domaine,
      sujet,
      champ: l.text.includes(PANNEAU_SEP) ? 'panneau (2 lignes)' : 'panneau',
      texte: l.text,
      ou: `${ou} — pancarte posée dans le décor`,
    })
  })
}

/**
 * TOUT le texte de lore du jeu, à plat. L'ordre est celui de la lecture :
 * le récit d'abord (codex, cinématiques), puis les lieux, puis les objets.
 */
export function catalogueTextes(): EntreeTexte[] {
  const out: EntreeTexte[] = []

  // ——— LE CODEX : le plus gros gisement. Les fiches d'EXPÉRIENCE seulement :
  // le récit et les fins vivent en données (journal.ts) et s'écrivent dans
  // l'atelier du journal — comme les tableaux de la bibliothèque, ils
  // restent dans la langue de leur auteur ———
  for (const f of CODEX_EXPERIENCES) {
    const ou = `Écran CODEX — groupe ${f.groupe}`
    pousse(out, {
      cle: cleTexte('codex', f.id, 'titre'),
      domaine: 'codex',
      sujet: f.id,
      champ: 'titre',
      texte: f.titre,
      ou,
    })
    pousse(out, {
      cle: cleTexte('codex', f.id, 'texte'),
      domaine: 'codex',
      sujet: f.id,
      champ: 'texte',
      texte: f.texte,
      ou,
    })
  }

  // ——— LES CINÉMATIQUES : les répliques du récit ———
  for (const c of CINEMATIQUES_LIVREES) {
    const code = enCle(c.code)
    pousse(out, {
      cle: `cinematique.${code}.titre`,
      domaine: 'cinematique',
      sujet: c.code,
      champ: 'titre',
      texte: c.titre,
      ou: `Cinématique ${c.code} — le titre`,
    })
    c.planches.forEach((p, i) => {
      pousse(out, {
        cle: `cinematique.${code}.planche.${i + 1}`,
        domaine: 'cinematique',
        sujet: c.code,
        champ: `planche ${i + 1}`,
        texte: p.texte,
        ou: `Cinématique ${c.code} — planche ${i + 1} sur ${c.planches.length}`,
      })
    })
  }

  // ——— LES LIEUX ———
  for (const lv of TABLEAUX)
    textesDuTableau(out, lv, 'tableau', lv.code, `Tableau ${lv.code}`)
  textesDuTableau(out, TABLEAU_HUB, 'hub', 'grand', 'Module Méduse (grand)')
  textesDuTableau(
    out,
    TABLEAU_HUB_COMPACT,
    'hub',
    'compact',
    'Module Méduse (compact — celui qu’on joue)',
  )
  textesDuTableau(out, TABLEAU_ECONOMAT, 'economat', 'salle', 'Salle de l’Économat')

  // ——— CE QUI S'ACHÈTE ———
  for (const a of ARTICLES_COMPTOIR) {
    pousse(out, {
      cle: `hub.comptoir.${enCle(a.id)}.nom`,
      domaine: 'hub',
      sujet: `comptoir.${a.id}`,
      champ: 'nom',
      texte: a.nom,
      ou: 'Comptoir du hub — la plaque de l’alcôve',
    })
    pousse(out, {
      cle: `hub.comptoir.${enCle(a.id)}.detail`,
      domaine: 'hub',
      sujet: `comptoir.${a.id}`,
      champ: 'détail',
      texte: a.detail,
      ou: 'Comptoir du hub — la ligne du popup à l’achat',
    })
  }
  for (const a of ETAL_ECONOMAT) {
    pousse(out, {
      cle: `economat.etal.${enCle(a.id)}.nom`,
      domaine: 'economat',
      sujet: `etal.${a.id}`,
      champ: 'nom',
      texte: a.nom,
      ou: 'Étal de l’Économat — la plaque de l’alcôve',
    })
    pousse(out, {
      cle: `economat.etal.${enCle(a.id)}.detail`,
      domaine: 'economat',
      sujet: `etal.${a.id}`,
      champ: 'détail',
      texte: a.detail,
      ou: 'Étal de l’Économat — la ligne du popup à l’achat',
    })
  }

  // ——— LES RÉPARATIONS DU MODULE ———
  for (const r of REPARATIONS) {
    pousse(out, {
      cle: `reparation.${enCle(r.id)}.nom`,
      domaine: 'reparation',
      sujet: r.id,
      champ: 'nom',
      texte: r.nom,
      ou: 'Hub — la plaque de la station, et sa pancarte de panne',
    })
    pousse(out, {
      cle: `reparation.${enCle(r.id)}.detail`,
      domaine: 'reparation',
      sujet: r.id,
      champ: 'détail',
      texte: r.detail,
      ou: 'Hub — la ligne du popup à la remise en état',
    })
  }

  // ——— LES OBJETS ———
  for (const d of INSTRUMENTS) {
    pousse(out, {
      cle: `carte.${enCle(d.id)}.nom`,
      domaine: 'carte',
      sujet: d.id,
      champ: 'nom',
      texte: d.nom,
      ou: 'Tirage de fin de salle, et écran RÉCOMPENSES',
    })
    pousse(out, {
      cle: `carte.${enCle(d.id)}.desc`,
      domaine: 'carte',
      sujet: d.id,
      champ: 'texte',
      texte: d.desc,
      ou: 'Tirage de fin de salle, et écran RÉCOMPENSES',
    })
  }
  for (const f of FIOLES) {
    pousse(out, {
      cle: `fiole.${enCle(f.id)}.nom`,
      domaine: 'fiole',
      sujet: f.id,
      champ: 'nom',
      texte: f.nom,
      ou: 'Placard des fioles, et popup à la trouvaille',
    })
    pousse(out, {
      cle: `fiole.${enCle(f.id)}.desc`,
      domaine: 'fiole',
      sujet: f.id,
      champ: 'texte',
      texte: f.desc,
      ou: 'Placard des fioles, et popup à la trouvaille',
    })
  }
  for (const t of TROPHEES) {
    pousse(out, {
      cle: `trophee.${enCle(t.id)}.nom`,
      domaine: 'trophee',
      sujet: t.id,
      champ: 'nom',
      texte: t.nom,
      ou: 'Voile RECORDS — la vitrine des trophées, et le popup au déblocage',
    })
    pousse(out, {
      cle: `trophee.${enCle(t.id)}.desc`,
      domaine: 'trophee',
      sujet: t.id,
      champ: 'texte',
      texte: t.desc,
      ou: 'Voile RECORDS — la condition, dite au joueur',
    })
  }

  // ——— LE CYCLE DES ÉTATS ———
  for (const [id, e] of Object.entries(ETATS_CYCLE)) {
    pousse(out, {
      cle: `cycle.etat.${enCle(id)}.nom`,
      domaine: 'cycle',
      sujet: `etat.${id}`,
      champ: 'nom',
      texte: e.nom,
      ou: 'Écran LES MÉMOIRES — le nom de l’état',
    })
  }
  for (const t of TRANSFOS_CYCLE) {
    pousse(out, {
      cle: `cycle.transfo.${enCle(t.id)}.nom`,
      domaine: 'cycle',
      sujet: `transfo.${t.id}`,
      champ: 'nom',
      texte: t.nom,
      ou: 'Écran LES MÉMOIRES — le nom du lien',
    })
    pousse(out, {
      cle: `cycle.transfo.${enCle(t.id)}.desc`,
      domaine: 'cycle',
      sujet: `transfo.${t.id}`,
      champ: 'texte',
      texte: t.desc,
      ou: 'Écran LES MÉMOIRES — ce que le lien ouvre',
    })
  }

  // ——— LES LEVIERS : un nom, et une phrase ENGENDRÉE ———
  for (const l of LEVIERS) {
    pousse(out, {
      cle: `levier.${enCle(l.id)}.nom`,
      domaine: 'levier',
      sujet: l.id,
      champ: 'nom',
      texte: l.nom,
      ou: 'Cartes de récompense — le libellé de l’effet',
    })
    // La phrase varie avec la valeur ET accorde ses pluriels : ce n'est pas
    // une chaîne, c'est une fonction. On en montre le milieu de plage, pour
    // que le concepteur voie de quoi il s'agit — mais la réécrire demande de
    // toucher au code, et la traduire demandera un format à pluriels.
    // on montre la valeur que l'atelier PROPOSE : elle tombe sur le pas du
    // levier. Prendre le milieu de plage brut donnait « 1.5 cartes de
    // plus » — un exemple qui n'existe pas en jeu, et qui plus est avec un
    // point décimal là où le jeu écrit une virgule.
    const v = valeurProposee(l)
    pousse(out, {
      cle: `levier.${enCle(l.id)}.phrase`,
      domaine: 'levier',
      sujet: l.id,
      champ: 'phrase engendrée',
      texte: l.phrase(v),
      ou: `Cartes de récompense — engendrée, ici pour la valeur ${v}`,
      engendre: true,
    })
  }

  return out
}

// ---- Les vues du catalogue, pour l'écran de relecture -------------------

export interface CompteDomaine {
  domaine: DomaineTexte
  nom: string
  entrees: number
  caracteres: number
}

export function comptesParDomaine(cat: EntreeTexte[]): CompteDomaine[] {
  const par = new Map<DomaineTexte, CompteDomaine>()
  for (const e of cat) {
    const c = par.get(e.domaine) ?? {
      domaine: e.domaine,
      nom: DOMAINE_NOMS[e.domaine],
      entrees: 0,
      caracteres: 0,
    }
    c.entrees += 1
    c.caracteres += e.texte.length
    par.set(e.domaine, c)
  }
  return [...par.values()].sort((a, b) => b.caracteres - a.caracteres)
}

/** Le catalogue en Markdown : de quoi réécrire hors ligne, puis recoller. */
export function catalogueMarkdown(cat: EntreeTexte[]): string {
  const lignes: string[] = [
    '# Sujet 21 — catalogue des textes',
    '',
    `${cat.length} entrées · ${cat.reduce((s, e) => s + e.texte.length, 0)} caractères`,
    '',
    'Chaque texte porte une CLÉ : elle survit à la réécriture. Ne la changez pas.',
    '',
  ]
  for (const c of comptesParDomaine(cat)) {
    lignes.push(`## ${c.nom} — ${c.entrees} entrées, ${c.caracteres} caractères`, '')
    for (const e of cat.filter((x) => x.domaine === c.domaine)) {
      lignes.push(`### \`${e.cle}\``)
      lignes.push(`*${e.ou}*${e.engendre ? ' — **engendrée par le code**' : ''}`)
      lignes.push('')
      lignes.push(e.texte.split('\n').map((l) => `> ${l}`).join('\n'))
      lignes.push('')
    }
  }
  return lignes.join('\n')
}
