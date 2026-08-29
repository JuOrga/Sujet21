// Le CODEX du protocole : chaque interaction état × élément découverte EN
// JOUANT débloque sa fiche — toucher une surface hydrophile en liquide,
// écarter un rideau en glace, traverser un évent en vapeur… Le codex
// consigne ce que le sujet apprend de lui-même : là où les trophées
// récompensent l'exploit, le codex récompense la CURIOSITÉ, et sa page
// devient le manuel du jeu, écrit par la partie elle-même.

import {
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  MAT_WALL,
} from './level'

export type CodexGroupe = 'eau' | 'glace' | 'vapeur' | 'phenomenes' | 'recit'

export interface CodexDef {
  id: string
  groupe: CodexGroupe
  icone: string
  titre: string
  texte: string
  // combinaison matériau × état (détection par contact du solveur) —
  // absente pour les fiches « phénomènes », détectées par événement
  mat?: number
  etat?: 0 | 1 | 2 // 0 liquide, 1 glace, 2 vapeur
}

// Indice dans le tableau des contacts du solveur : matériau × 3 + état
export const codexCle = (mat: number, etat: number): number => mat * 3 + etat

export const CODEX: CodexDef[] = [
  // ---- LIQUIDE 💧 -------------------------------------------------------
  {
    id: 'eau-mur',
    groupe: 'eau',
    icone: '🧱',
    titre: 'Le liquide épouse la paroi',
    texte:
      'L’eau s’écrase et s’étale contre le métal : rien ne se perd, mais l’élan si. Pour rebondir, il faudra un autre état.',
    mat: MAT_WALL,
    etat: 0,
  },
  {
    id: 'eau-hydrophile',
    groupe: 'eau',
    icone: '🫧',
    titre: 'La surface mouillée retient',
    texte:
      'La paroi hydrophile (liseré turquoise) aspire l’eau qui passe à portée et la freine au contact. Utile pour se poser — dangereux pour filer.',
    mat: MAT_HYDROPHILE,
    etat: 0,
  },
  {
    id: 'eau-hydrophobe',
    groupe: 'eau',
    icone: '💥',
    titre: 'La cire repousse',
    texte:
      'La surface hydrophobe (liseré violet) refuse l’eau : elle la repousse de loin et la fait rebondir au contact, presque sans perte d’élan.',
    mat: MAT_HYDROPHOBE,
    etat: 0,
  },
  {
    id: 'eau-froid',
    groupe: 'eau',
    icone: '❄',
    titre: 'L’aura froide gèle',
    texte:
      'L’eau qui s’attarde dans l’aura d’une plaque froide gèle sur place. Une transformation gratuite — mais la glace née là reste soudée à la plaque.',
    mat: MAT_FROID,
    etat: 0,
  },
  {
    id: 'eau-grille',
    groupe: 'eau',
    icone: '🚧',
    titre: 'L’évent arrête le liquide',
    texte:
      'La grille d’évent bloque l’eau comme un mur. Un seul état la traverse : la vapeur.',
    mat: MAT_GRILLE,
    etat: 0,
  },
  {
    id: 'eau-chaud',
    groupe: 'eau',
    icone: '🔥',
    titre: 'La chaudière vaporise',
    texte:
      'Baigner presque entier dans l’aura d’une chaudière transforme le corps en vapeur. Cette transformation est SUBIE : elle ne rend pas les dashs — seule une vaporisation décidée (G) refait le plein de la réserve. La transformation offerte par la salle ne coûte rien.',
    mat: MAT_CHAUD,
    etat: 0,
  },
  {
    id: 'eau-membrane',
    groupe: 'eau',
    icone: '🧽',
    titre: 'L’eau suinte à travers la membrane',
    texte:
      'La membrane gorgée d’eau laisse passer le liquide — et seulement lui. Glace et vapeur butent : pour franchir, redevenez eau.',
    mat: MAT_MEMBRANE,
    etat: 0,
  },
  {
    id: 'eau-rideau',
    groupe: 'eau',
    icone: '🪟',
    titre: 'Le rideau refuse le liquide',
    texte:
      'Les lamelles souples ne s’écartent pas devant l’eau : elle bute. Seule la glace, d’un bloc, force le passage.',
    mat: MAT_RIDEAU,
    etat: 0,
  },
  {
    id: 'eau-surchauffeur',
    groupe: 'eau',
    icone: '🔋',
    titre: 'La borne ignore le liquide',
    texte:
      'Pour l’eau, le surchauffeur n’est qu’un mur. Sa lueur ambre s’adresse à un autre état : approchez-le en vapeur.',
    mat: MAT_SURCHAUFFEUR,
    etat: 0,
  },
  // ---- GLACE ❄ ----------------------------------------------------------
  {
    id: 'glace-mur',
    groupe: 'glace',
    icone: '🏒',
    titre: 'Le palet rebondit entier',
    texte:
      'Gelé, le corps devient un palet : les parois le renvoient sans une goutte perdue, l’élan se conserve. La glace est l’état du voyage gratuit.',
    mat: MAT_WALL,
    etat: 1,
  },
  {
    id: 'glace-hydrophile',
    groupe: 'glace',
    icone: '🛑',
    titre: 'La chimie mord le palet',
    texte:
      'Au contact d’une surface hydrophile, le palet est freiné : la paroi mouillée retient même le solide. Un frein à main naturel.',
    mat: MAT_HYDROPHILE,
    etat: 1,
  },
  {
    id: 'glace-hydrophobe',
    groupe: 'glace',
    icone: '🎯',
    titre: 'Le bumper relance le palet',
    texte:
      'La surface hydrophobe rend au palet plus qu’un rebond : elle le relance, comme un flipper. De quoi traverser une salle sans dépenser une goutte.',
    mat: MAT_HYDROPHOBE,
    etat: 1,
  },
  {
    id: 'glace-froid',
    groupe: 'glace',
    icone: '⚓',
    titre: 'La glace se soude au froid',
    texte:
      'Un palet qui touche une plaque froide s’y ancre : soudé, immobile, imprenable. Pour repartir, il faut dégeler — et viser juste.',
    mat: MAT_FROID,
    etat: 1,
  },
  {
    id: 'glace-grille',
    groupe: 'glace',
    icone: '🚧',
    titre: 'L’évent arrête le palet',
    texte:
      'La grille bloque la glace comme elle bloque l’eau. Le nuage seul se faufile entre ses barreaux.',
    mat: MAT_GRILLE,
    etat: 1,
  },
  {
    id: 'glace-chaud',
    groupe: 'glace',
    icone: '🫠',
    titre: 'La chaudière dégèle',
    texte:
      'L’aura chaude défait la glace : le palet fond et redevient liquide. Aucune plaque froide ne résiste indéfiniment à une chaudière voisine.',
    mat: MAT_CHAUD,
    etat: 1,
  },
  {
    id: 'glace-membrane',
    groupe: 'glace',
    icone: '🧊',
    titre: 'La membrane refuse le solide',
    texte:
      'Le palet bute sur la membrane gorgée d’eau : elle ne laisse suinter que le liquide. Dégeler devant elle, c’est la clé.',
    mat: MAT_MEMBRANE,
    etat: 1,
  },
  {
    id: 'glace-rideau',
    groupe: 'glace',
    icone: '💨',
    titre: 'La glace écarte le rideau',
    texte:
      'D’un bloc, le palet écarte les lamelles et passe. L’eau et la vapeur butent : le rideau est une porte réservée au solide.',
    mat: MAT_RIDEAU,
    etat: 1,
  },
  {
    id: 'glace-surchauffeur',
    groupe: 'glace',
    icone: '🔋',
    titre: 'La borne ignore le solide',
    texte:
      'Pour le palet, le surchauffeur est un mur de plus — un rebond, rien d’autre. Sa recharge est réservée au nuage.',
    mat: MAT_SURCHAUFFEUR,
    etat: 1,
  },
  // ---- VAPEUR 💨 --------------------------------------------------------
  {
    id: 'vapeur-mur',
    groupe: 'vapeur',
    icone: '🌫',
    titre: 'Le nuage longe les parois',
    texte:
      'La vapeur du corps glisse le long du métal sans coller ni rebondir. Attention au souffle du dash : lui se condense à la première paroi.',
    mat: MAT_WALL,
    etat: 2,
  },
  {
    id: 'vapeur-hydrophile',
    groupe: 'vapeur',
    icone: '🧲',
    titre: 'La paroi mouillée attire le nuage',
    texte:
      'La surface hydrophile travaille la vapeur en sourdine : une attirance légère, de loin. Assez pour infléchir une dérive — pas pour la capturer.',
    mat: MAT_HYDROPHILE,
    etat: 2,
  },
  {
    id: 'vapeur-hydrophobe',
    groupe: 'vapeur',
    icone: '🌀',
    titre: 'La cire éloigne le nuage',
    texte:
      'La surface hydrophobe repousse même la vapeur — doucement, de loin. Le nuage dévie sans jamais toucher.',
    mat: MAT_HYDROPHOBE,
    etat: 2,
  },
  {
    id: 'vapeur-froid',
    groupe: 'vapeur',
    icone: '💧',
    titre: 'Le froid recondense',
    texte:
      'Le nuage qui s’attarde près d’une plaque froide se refroidit et retombe en eau. Une sortie de vapeur gratuite — au bon endroit.',
    mat: MAT_FROID,
    etat: 2,
  },
  {
    id: 'vapeur-grille',
    groupe: 'vapeur',
    icone: '🕳',
    titre: 'La vapeur traverse l’évent',
    texte:
      'Le nuage se faufile entre les barreaux de la grille comme si elle n’existait pas. C’est LE passe-partout de la vapeur — l’eau et la glace restent dehors.',
    mat: MAT_GRILLE,
    etat: 2,
  },
  {
    id: 'vapeur-chaud',
    groupe: 'vapeur',
    icone: '♨',
    titre: 'La chaleur entretient le nuage',
    texte:
      'Près d’une chaudière, la vapeur reste vapeur : rien à craindre de la chaleur quand on est déjà un nuage.',
    mat: MAT_CHAUD,
    etat: 2,
  },
  {
    id: 'vapeur-membrane',
    groupe: 'vapeur',
    icone: '⛔',
    titre: 'La membrane arrête le nuage',
    texte:
      'La membrane gorgée d’eau bloque la vapeur — et le souffle n’y perle pas : il rebondit et ira se condenser ailleurs. Elle est faite pour ça.',
    mat: MAT_MEMBRANE,
    etat: 2,
  },
  {
    id: 'vapeur-rideau',
    groupe: 'vapeur',
    icone: '🪟',
    titre: 'Le rideau retient le nuage',
    texte:
      'Les lamelles ne s’écartent que devant la glace : la vapeur bute. Un nuage ne force rien — il contourne.',
    mat: MAT_RIDEAU,
    etat: 2,
  },
  {
    id: 'vapeur-surchauffeur',
    groupe: 'vapeur',
    icone: '⚡',
    titre: 'La borne rend un dash',
    texte:
      'Frôlé en vapeur, le surchauffeur recharge UNE impulsion de dash — jamais au-delà de la réserve du tableau — puis son serpentin ambre s’éteint. Réserve pleine, il reste chargé et attend. Une station-service, une seule fois.',
    mat: MAT_SURCHAUFFEUR,
    etat: 2,
  },
  // ---- PHÉNOMÈNES ✦ -----------------------------------------------------
  {
    id: 'rosee',
    groupe: 'phenomenes',
    icone: '🫗',
    titre: 'Le souffle perle en rosée',
    texte:
      'Chaque dash éjecte un souffle de vapeur : il se condense à la première paroi et s’y pose en gouttes. Cette rosée vous attend — repassez la boire.',
  },
  {
    id: 'laser-glace',
    groupe: 'phenomenes',
    icone: '🔦',
    titre: 'Le corps gelé réfléchit le laser',
    texte:
      'Un faisceau qui frappe le palet repart comme sur un miroir. Le corps devient un outil optique : orientez-le, et le laser ira où les miroirs ne vont pas.',
  },
  {
    id: 'eponge',
    groupe: 'phenomenes',
    icone: '🧽',
    titre: 'L’éponge boit ce qui s’attarde',
    texte:
      'Le feutre englue le liquide et l’absorbe cellule par cellule. Une cellule gorgée devient solide : la brèche se paie en volume, définitivement.',
  },
  {
    id: 'zone-glace',
    groupe: 'phenomenes',
    icone: '❄',
    titre: 'La zone impose la glace',
    texte:
      'Certaines zones du vaisseau forcent l’état : ici, le corps gèle qu’on le veuille ou non. L’état n’est plus un choix — le trajet, si.',
  },
  {
    id: 'zone-vapeur',
    groupe: 'phenomenes',
    icone: '💨',
    titre: 'La zone impose la vapeur',
    texte:
      'Dans une zone vapeur, le corps monte en nuage d’office — et la sortie de zone le rend. Profitez du passage : les évents s’ouvrent.',
  },
  {
    id: 'sas',
    groupe: 'phenomenes',
    icone: '🌀',
    titre: 'Le sas met en bonbonne',
    texte:
      'Le collecteur aspire ce qui l’approche et le met en bonbonne : chaque centilitre livré fait la note — et la glace avalée solide vaut prime. La réserve ainsi mise de côté se REVERSE en route : la fiole du bandeau, la touche V, ou la croix ↑ à la manette — en liquide seulement.',
  },
  // ---- LE RÉCIT 🛰️ — les jalons de l'arc (decouvertes.ts), servis un
  // par retour de run : ce que le laboratoire n'aurait jamais dit --------
  {
    id: 'recit-livraison',
    groupe: 'recit',
    icone: '🛰️',
    titre: 'La livraison',
    texte:
      'Fragment de registre de quai : « Réception du miroir de rechange, 14 h 02. Rupture du portique, 14 h 03. » Le module Méduse a pris le choc — les pannes du hub datent de cette minute-là. Le télescope orbital attendait sa pièce ; la station attendait autre chose.',
  },
  {
    id: 'recit-cahier-charges',
    groupe: 'recit',
    icone: '🪞',
    titre: 'Le cahier des charges',
    texte:
      'Note technique, en-tête arrachée : « Le produit n’est pas un sujet d’étude. Le produit est un MIROIR : un fluide capable de tenir une surface parfaite, à toute température, sous toute contrainte. » Vous n’avez pas été conçu pour apprendre. Vous avez appris quand même.',
  },
  {
    id: 'recit-note-vega',
    groupe: 'recit',
    icone: '📄',
    titre: 'Note de service — Dr N. Véga',
    texte:
      '« On me demande de cesser de consigner le comportement du produit. Je consigne donc ceci : le produit prend les chicanes du conduit sans jamais se tromper. Il s’attarde devant le placard. Il LIT, je crois. Je ne cesserai pas de consigner. — N.V. »',
  },
  {
    id: 'recit-calibrations',
    groupe: 'recit',
    icone: '📐',
    titre: 'Les calibrations',
    texte:
      'Vos « records » portent un autre nom dans les registres du labo : mesures de planéité. Chaque descente chronométrée était un banc d’essai optique — le mur des records est un banc de calibration. On ne mesurait pas vos exploits. On mesurait si vous feriez un bon miroir.',
  },
  {
    id: 'recit-endormis',
    groupe: 'recit',
    icone: '🫙',
    titre: 'Les endormis',
    texte:
      'Les capsules de la cuve ne sont pas des réserves. Ce sont les essais d’avant vous — sujets 12 à 20 — mis en sommeil quand leur surface a été jugée « insuffisante ». Vivants. La consigne « NE PAS RÉVEILLER » n’est pas une précaution d’hygiène.',
  },
  {
    id: 'recit-semblable',
    groupe: 'recit',
    icone: '🧿',
    titre: 'Le Semblable',
    texte:
      'Le marchand du comptoir en était un. Le sujet 12 — le premier à tenir une surface plus de dix secondes. Un matin, il a cessé de dormir, et personne n’a osé le rendormir. Alors on lui a donné une grille, un étal, et un registre. Il prend la mémoire en paiement : il sait ce qu’elle vaut.',
  },
  {
    id: 'recit-alerte',
    groupe: 'recit',
    icone: '🚨',
    titre: 'Pourquoi l’alerte',
    texte:
      'L’alerte n’a pas été déclenchée par la rupture du portique — elle l’a PRÉCÉDÉE de neuf secondes. Le secteur 4 n’est pas scellé contre l’accident. Il est scellé contre ce qui doit partir. Quelqu’un a fermé cette porte en sachant ce qu’il faisait.',
  },
  {
    id: 'recit-la-haut',
    groupe: 'recit',
    icone: '🔭',
    titre: 'Là-haut',
    texte:
      'Le télescope orbite depuis quatre ans, achevé à un miroir près. Sans son œil, il ne voit rien — et la station n’existe QUE pour le lui fournir. Chaque jour de retard se compte en carrières brisées, là-haut comme ici. N’importe quel miroir fera l’affaire. N’importe lequel.',
  },
  {
    id: 'recit-precurseurs',
    groupe: 'recit',
    icone: '🕳️',
    titre: 'Ceux d’avant',
    texte:
      'Deux « produits conformes » ont déjà pris la route du secteur 4. Les registres notent le départ, le vide des capsules, la mise sous tension du convoyeur. Puis plus rien. Aucun message n’est jamais redescendu — mais le télescope, lui, ne voit toujours pas.',
  },
  {
    id: 'recit-le-choix',
    groupe: 'recit',
    icone: '🚪',
    titre: 'Le choix',
    texte:
      'Tout est raconté. Le sceau du secteur 4 n’a plus de raison de tenir : la route du plasma mène au convoyeur, le convoyeur mène là-haut. Devenir l’œil du télescope — ou rester ce que vous êtes devenu. Personne n’a jamais eu ce choix avant vous. Le sas s’ouvre.',
  },
]

const CLE = 'sujet21-codex'

/** Découvertes (id → date ISO), persistées en local. `onDecouverte` reçoit
 * chaque fiche NOUVELLEMENT consignée — le toast s'y accroche. */
export class Codex {
  private etat: Record<string, string> = {}
  onDecouverte: (d: CodexDef) => void = () => {}

  constructor(private readonly storage: Storage | null = null) {
    try {
      const s = this.storage ?? localStorage
      this.etat = JSON.parse(s.getItem(CLE) ?? '{}') as Record<string, string>
    } catch {
      this.etat = {}
    }
  }

  connu(id: string): boolean {
    return id in this.etat
  }

  quand(id: string): string {
    return this.etat[id] ?? ''
  }

  compte(): number {
    return CODEX.reduce((n, d) => n + (this.connu(d.id) ? 1 : 0), 0)
  }

  marque(id: string): void {
    if (id in this.etat) return
    const def = CODEX.find((d) => d.id === id)
    if (!def) return
    this.etat[id] = new Date().toISOString()
    try {
      const s = this.storage ?? localStorage
      s.setItem(CLE, JSON.stringify(this.etat))
    } catch {
      // stockage refusé : la découverte restera en mémoire de session
    }
    this.onDecouverte(def)
  }

  /** Consigne toutes les combinaisons vues dans le tableau de contacts du
   * solveur (indice = matériau × 3 + état). */
  litContacts(contacts: Uint8Array): void {
    for (const d of CODEX) {
      if (d.mat === undefined || d.etat === undefined) continue
      if (this.connu(d.id)) continue
      if (contacts[codexCle(d.mat, d.etat)] === 1) this.marque(d.id)
    }
  }
}
