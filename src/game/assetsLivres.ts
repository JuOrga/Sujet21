// Le CATALOGUE des images livrées avec le jeu : tout ce qui dort dans
// public/assets — textures de surfaces, planches de cinématiques, décors,
// fonds, objets. La bibliothèque d'images les présente à côté des visuels
// importés, pour qu'un concepteur voie d'un seul écran TOUT ce dont il
// dispose (et puisse réemployer un décor existant dans une planche).
//
// La liste n'est pas tenue à la main : Vite énumère le dossier à la
// compilation (import.meta.glob ne lit que les CLÉS, aucune image n'est
// embarquée deux fois — elles sont déjà servies telles quelles depuis
// public/). Déposer un fichier suffit à le voir apparaître ; rien ne peut
// manquer au catalogue, et rien n'y traîne après une suppression.

export interface AssetLivre {
  url: string
  nom: string
  rubrique: string
}

/** L'ordre des rubriques : celui du regard d'un concepteur — d'abord ce
 *  qu'on met en scène, ensuite ce dont la cuve est faite, puis le lointain. */
export const RUBRIQUES = [
  'Cinématiques — planches',
  'Surfaces & matériaux',
  'Zones d’état',
  'Machinerie & décalques',
  'Méta & commerce',
  'Serre & cultures',
  'Coque & fonds',
  'Objets & emblèmes',
  'Autres',
] as const

// Les noms lisibles des images connues ; le reste est déduit du fichier.
const NOMS: Record<string, string> = {
  'wall.webp': 'Paroi',
  'wall-a.webp': 'Paroi (seconde)',
  'paroi-atlas.webp': 'Atlas des habillages de paroi (4×2)',
  'phile.webp': 'Surface hydrophile',
  'phobe.webp': 'Surface hydrophobe',
  'froid.webp': 'Plaque froide (givre)',
  'chaud.webp': 'Chaudière (ailettes)',
  'grille.webp': 'Évent (panneau perforé)',
  'sponge-dry.webp': 'Éponge sèche',
  'sponge-wet.webp': 'Éponge gorgée',
  'zone-hublot.webp': 'Zone — hublot fendu (glace)',
  'zone-conduite.webp': 'Zone — conduite rompue (vapeur)',
  'zone-buses.webp': 'Zone — rampe de buses (liquide)',
  'decal-tuyaux.webp': 'Décalque — tuyaux',
  'decal-vanne.webp': 'Décalque — vanne',
  'decal-ecran-on.webp': 'Décalque — écran de contrôle (allumé)',
  'decal-ecran-off.webp': 'Décalque — écran de contrôle (éteint)',
  'lampe-plafonnier.webp': 'Luminaire — plafonnier (vu du dessus)',
  'lampe-bande.webp': 'Luminaire — bande lumineuse (vu du dessus)',
  'plafond.webp': 'Plafond du reflet (vu du dessous)',
  'iris.webp': 'Sas — iris mécanique',
  'hull.webp': 'Coque de la cuve',
  'tank-bg.webp': 'Fond de cuve',
  'stars.webp': 'Ciel étoilé (proche)',
  'stars-far.webp': 'Ciel étoilé (lointain, station)',
  'home.webp': 'Fiche — illustration d’accueil',
  'card-galerie.webp': 'Carton de journal — la galerie noyée',
  'fiole-pleine.webp': 'Fiole pleine (semblable)',
  'fiole-vide.webp': 'Fiole vide (semblable)',
  'badge.webp': 'Badge du protocole',
  // LA SERRE (niveau serre) — les prompts vivent dans docs/assets-ia.md ;
  // déposer le fichier sous ce nom suffit à le voir arriver bien nommé
  'serre-roquette.webp': 'Serre — bac de roquette',
  'serre-ble-nain.webp': 'Serre — blé nain',
  'serre-tomates.webp': 'Serre — colonne de tomates',
  'serre-rampe.webp': 'Serre — gouttière et barre horticole',
  'serre-rampe-a.webp': 'Serre — gouttière et barre horticole (seconde)',
  // LE MÉTA (commerce, banc, marchand, éclats) — prompts en § 15 de
  // docs/assets-ia.md ; déposer le fichier sous ce nom suffit
  'meta-alcove.webp': 'Méta — alcôve d’étal',
  'meta-banc.webp': 'Méta — pupitre du banc des mémoires',
  'meta-marchand.webp': 'Méta — le Sujet 12 (marchand)',
  'meta-eclat.webp': 'Méta — éclat de mémoire',
  'meta-icones.webp': 'Méta — planche d’icônes (4×2)',
}

/** La rubrique d'un fichier, d'après son chemin. Tout finit classé : ce qui
 *  n'entre dans aucune règle tombe dans « Autres » plutôt que d'être perdu. */
export function rubriqueDe(url: string): string {
  const f = url.slice(url.lastIndexOf('/') + 1)
  if (url.includes('/cine/')) return 'Cinématiques — planches'
  if (/^(wall|paroi|phile|phobe|froid|chaud|grille|sponge)/.test(f))
    return 'Surfaces & matériaux'
  if (f.startsWith('zone-')) return 'Zones d’état'
  if (f.startsWith('serre-')) return 'Serre & cultures'
  if (f.startsWith('meta-')) return 'Méta & commerce'
  if (
    f.startsWith('decal-') ||
    f.startsWith('iris') ||
    f.startsWith('lampe-') ||
    f.startsWith('plafond')
  )
    return 'Machinerie & décalques'
  if (/^(hull|tank-bg|stars|home|card-)/.test(f)) return 'Coque & fonds'
  if (/^(fiole|badge)/.test(f)) return 'Objets & emblèmes'
  return 'Autres'
}

/** Le nom lisible : celui du dictionnaire, sinon le fichier déguisé en titre
 *  (« ouverture-2.webp » → « Ouverture 2 »). */
export function nomDe(url: string): string {
  const f = url.slice(url.lastIndexOf('/') + 1)
  if (NOMS[f]) return NOMS[f]
  const nu = f.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
  return nu.charAt(0).toUpperCase() + nu.slice(1)
}

// Les clés du glob suffisent : Vite les résout à la compilation, sans
// importer une seule image (elles sont servies depuis public/).
const FICHIERS = import.meta.glob(
  '../../public/assets/**/*.{webp,png,jpg,jpeg,avif,svg,gif}',
)

/** Toutes les images livrées, classées par rubrique puis par nom. */
export function assetsLivres(): AssetLivre[] {
  const out: AssetLivre[] = []
  for (const chemin of Object.keys(FICHIERS)) {
    const i = chemin.indexOf('/public/')
    const url = i >= 0 ? chemin.slice(i + '/public'.length) : chemin
    out.push({ url, nom: nomDe(url), rubrique: rubriqueDe(url) })
  }
  const rang = (r: string): number => {
    const i = (RUBRIQUES as readonly string[]).indexOf(r)
    return i < 0 ? RUBRIQUES.length : i
  }
  return out.sort(
    (a, b) =>
      rang(a.rubrique) - rang(b.rubrique) || a.nom.localeCompare(b.nom, 'fr'),
  )
}
