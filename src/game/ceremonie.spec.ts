import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  compteur,
  douce,
  GARDE_GESTE_MS,
  gesteAuVersement,
  gesteTropTot,
  motDeNote,
  PAS_LIGNE_MS,
  rangDeSalle,
  SEUILS_RANG,
  sortieDouce,
  TEMPS_BILAN,
  titreDuTirage,
} from './ceremonie'

// LES AIDES DES GARDES DE LA CÉRÉMONIE. Vitest tourne sans navigateur : les
// gardes lisent main.ts et index.html en TEXTE. `corps` rend le corps d'une
// fonction de main.ts, `regle` le bloc d'une règle de la feuille (la
// première à ce sélecteur, indentée comme la feuille l'écrit). Partagées
// par tous les blocs qui gardent un écran.
const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
const corps = (nom: string): string => {
  const debut = MAIN.indexOf(`\nfunction ${nom}(`)
  expect(debut, `la fonction ${nom} manque`).toBeGreaterThan(-1)
  return MAIN.slice(debut, MAIN.indexOf('\n}\n', debut))
}
const regle = (selecteur: string): string => {
  const debut = HTML.indexOf(`\n      ${selecteur} {`)
  expect(debut, `la règle « ${selecteur} » manque`).toBeGreaterThan(-1)
  return HTML.slice(debut, HTML.indexOf('}', debut))
}

describe('le rang d’une salle', () => {
  it('donne S à qui livre 90 % et plus — la prime peut porter au-delà du départ', () => {
    expect(rangDeSalle(0.9).rang).toBe('S')
    expect(rangDeSalle(1.0).rang).toBe('S')
    expect(rangDeSalle(1.4).rang).toBe('S')
  })

  it('descend palier par palier, aux seuils exacts', () => {
    expect(rangDeSalle(0.899).rang).toBe('A')
    expect(rangDeSalle(0.72).rang).toBe('A')
    expect(rangDeSalle(0.719).rang).toBe('B')
    expect(rangDeSalle(0.52).rang).toBe('B')
    expect(rangDeSalle(0.3).rang).toBe('C')
    expect(rangDeSalle(0.299).rang).toBe('D')
    expect(rangDeSalle(0).rang).toBe('D')
  })

  it('tombe au plus bas sur une part cassée, sans jamais lever', () => {
    expect(rangDeSalle(NaN).rang).toBe('D')
    expect(rangDeSalle(-1).rang).toBe('D')
    expect(rangDeSalle(Infinity).rang).toBe('D')
  })

  it('accompagne chaque lettre d’un mot, d’une teinte et d’étoiles décroissantes', () => {
    const rangs = SEUILS_RANG.map(([, seuil]) => rangDeSalle(seuil))
    for (const v of rangs) {
      expect(v.mot.length).toBeGreaterThan(0)
      expect(v.teinte).toMatch(/^#[0-9a-f]{6}$/i)
    }
    const etoiles = rangs.map((v) => v.etoiles)
    expect(etoiles).toEqual([5, 4, 3, 2, 1])
  })

  it('se lit en régimes d’écoulement, pas en lettres : du superfluide au figé', () => {
    const noms = SEUILS_RANG.map(([, seuil]) => rangDeSalle(seuil).nom)
    expect(noms).toEqual(['SUPERFLUIDE', 'LAMINAIRE', 'TURBULENT', 'VISQUEUX', 'FIGÉ'])
    // plus une seule lettre d'arcade sous les yeux du joueur
    for (const n of noms) expect(n.length).toBeGreaterThan(1)
  })

  it('garde ses seuils rangés du plus haut au plus bas — c’est l’ordre de lecture', () => {
    for (let i = 1; i < SEUILS_RANG.length; i++)
      expect(SEUILS_RANG[i][1]).toBeLessThan(SEUILS_RANG[i - 1][1])
    expect(SEUILS_RANG[SEUILS_RANG.length - 1][1]).toBe(0)
  })
})

describe('les temps de la lecture', () => {
  it('arrivent dans l’ordre du récit : titre, rang, litres, prime, lignes, condensat, versement', () => {
    const t = TEMPS_BILAN
    expect(t.titre).toBe(0)
    expect(t.rang).toBeGreaterThan(t.titre)
    expect(t.litres).toBeGreaterThan(t.rang)
    expect(t.prime).toBeGreaterThan(t.litres)
    expect(t.lignes).toBeGreaterThan(t.prime)
    expect(t.condensat).toBeGreaterThan(t.lignes + PAS_LIGNE_MS * 2)
    expect(t.versement).toBeGreaterThan(t.condensat + 1000)
  })

  it('tiennent en moins de six secondes — au-delà, on saute', () => {
    expect(TEMPS_BILAN.versement).toBeLessThan(6000)
  })
})

// LE GESTE QUI OUVRE N'EST PAS CELUI QUI CHOISIT : le versement s'ouvre sous
// le geste qui a passé le bilan, et le second clic d'un double clic (ou le A
// suivant d'une rafale) choisissait la première cuve. La règle n'était
// gardée qu'en texte ; l'horloge fournie, elle se teste à ses bornes.
describe('la garde du geste qui ouvre le versement', () => {
  it('ignore tout geste pendant 400 ms, et rien après', () => {
    expect(GARDE_GESTE_MS).toBe(400)
    const ouvert = 10_000
    expect(gesteTropTot(ouvert, ouvert)).toBe(true) // le geste même qui ouvre
    expect(gesteTropTot(ouvert + 399.9, ouvert)).toBe(true)
    expect(gesteTropTot(ouvert + 400, ouvert)).toBe(false) // la borne : on obéit
    expect(gesteTropTot(ouvert + 5000, ouvert)).toBe(false)
  })
  it('obéit quand le versement ne s’est jamais ouvert', () => {
    expect(gesteTropTot(0, -Infinity)).toBe(false)
    expect(gesteTropTot(123, -Infinity)).toBe(false)
  })
  it('ne bloque pas pour toujours sur une horloge qui recule', () => {
    // performance.now() ne recule pas, mais une horloge fournie peut : un
    // écart négatif n'est pas « trop tôt », il est faux — on obéit
    expect(gesteTropTot(900, 1000)).toBe(false)
  })
})

// CHAQUE ÉTAPE SE PASSE D'UN GESTE, le déversement compris : le liquide
// monte 800 ms avant que la maîtrise ne prenne la scène, et un geste
// pendant ce temps (clic, Entrée, Espace, A) ne faisait rien — le choix
// absorbait tout. Il enchaîne désormais, mais une seule étape : le second
// clic d'un double clic qui vient de choisir ne saute pas le déversement.
describe('un geste pendant le versement', () => {
  const ouvert = 1000
  it('ne choisit rien sous le geste qui a ouvert, puis choisit', () => {
    expect(gesteAuVersement(ouvert + 100, ouvert, null)).toBe('ignore')
    expect(gesteAuVersement(ouvert + GARDE_GESTE_MS, ouvert, null)).toBe('choisit')
  })
  it('n’enchaîne pas sous le geste qui vient de choisir (une rafale saute une étape, pas deux)', () => {
    const choix = ouvert + 600
    expect(gesteAuVersement(choix, ouvert, choix)).toBe('ignore')
    expect(gesteAuVersement(choix + GARDE_GESTE_MS - 1, ouvert, choix)).toBe('ignore')
  })
  it('enchaîne tout de suite sur un geste pendant le déversement', () => {
    const choix = ouvert + 600
    expect(gesteAuVersement(choix + GARDE_GESTE_MS, ouvert, choix)).toBe('enchaine')
    expect(gesteAuVersement(choix + 700, ouvert, choix)).toBe('enchaine')
  })
})

describe('les courbes des compteurs', () => {
  it('partent de 0 et arrivent à 1, bornées hors du segment', () => {
    for (const f of [sortieDouce, douce]) {
      expect(f(0)).toBe(0)
      expect(f(1)).toBe(1)
      expect(f(-3)).toBe(0)
      expect(f(7)).toBe(1)
    }
  })

  it('montent sans jamais redescendre', () => {
    for (const f of [sortieDouce, douce]) {
      let prev = 0
      for (let i = 1; i <= 100; i++) {
        const v = f(i / 100)
        expect(v).toBeGreaterThanOrEqual(prev)
        prev = v
      }
    }
  })

  it('le compteur arrive EXACTEMENT à sa cible, et file vite au départ', () => {
    expect(compteur(0, 2.5, 1)).toBe(2.5)
    expect(compteur(0, 2.5, 1.4)).toBe(2.5)
    expect(compteur(0, 2.5, 0)).toBe(0)
    // à mi-course, plus des trois quarts du chemin : ça file, puis ça se pose
    expect(compteur(0, 100, 0.5)).toBeGreaterThan(75)
    expect(compteur(10, 10, 0.3)).toBe(10)
  })
})

describe('le mot de la note', () => {
  it('monte avec la note', () => {
    const mots = [0, 80, 180, 300].map(motDeNote)
    expect(new Set(mots).size).toBe(4)
  })
})

describe('le titre d’un tirage', () => {
  it('numérote le palier qu’on vient de franchir', () => {
    expect(titreDuTirage(1, 1, false)).toBe('PALIER DE MAÎTRISE 1 — EMPORTEZ UN INSTRUMENT')
    // deux paliers d'un coup : le premier tirage est celui du palier 2, puis le 3
    expect(titreDuTirage(3, 2, false)).toContain('PALIER DE MAÎTRISE 2')
    expect(titreDuTirage(3, 1, false)).toContain('PALIER DE MAÎTRISE 3')
  })

  it('n’appelle pas « palier 0 » le tirage garanti d’une salle scellée', () => {
    // la panne : aucun palier franchi, un tirage garanti → « PALIER DE MAÎTRISE 0 »
    const t = titreDuTirage(0, 1, true)
    expect(t).not.toContain('PALIER')
    expect(t).toContain('TIRAGE GARANTI')
  })

  it('sert les paliers d’abord, le tirage garanti en dernier, sans décaler les numéros', () => {
    // un palier franchi (le 2) ET une salle scellée : deux tirages
    expect(titreDuTirage(2, 2, true)).toContain('PALIER DE MAÎTRISE 2')
    expect(titreDuTirage(2, 1, true)).toContain('TIRAGE GARANTI')
  })
})

// L'ÉCRAN NE SE MONTE PAS TOUT SEUL : sa coque est dans index.html, son
// code dans main.ts, et rien ne relie les deux qu'une poignée
// d'identifiants en toutes lettres. La cérémonie a été refaite de fond en
// comble : ce test garde que chaque poignée que main.ts va chercher existe
// bien dans la coque — un id renommé d'un côté donne, sans ce filet, un
// écran qui s'ouvre sur du vide, sans erreur.
describe('la cérémonie — la coque et ses poignées', () => {
  it('porte tous les identifiants « mb-… » que main.ts va chercher', () => {
    const ids = new Set<string>()
    for (const m of MAIN.matchAll(/mbEl\('([a-z0-9-]+)'\)/g)) ids.add(m[1])
    for (const m of MAIN.matchAll(/getElementById\('(mb-[a-z0-9-]+)'\)/g)) ids.add(m[1])
    expect(ids.size).toBeGreaterThan(12) // le test regarde bien quelque chose
    for (const id of ids)
      expect(HTML, `id="${id}" manque à index.html`).toContain(`id="${id}"`)
  })

  it('reste une couche de menu sans porte de sortie : on choisit, on ne ferme pas', () => {
    expect(MAIN).toMatch(/\{ id: 'mb-veil' \}/)
  })

  it('respecte le réglage « moins d’animations » : chaque mise en scène a son repli', () => {
    // la feuille de style de la cérémonie porte ses propres règles de
    // repli — sans elles, un joueur qui a demandé moins d'animations
    // verrait quand même la bannière claquer et les cartes se retourner
    const css = HTML.slice(HTML.indexOf('/* ==== LA CÉRÉMONIE DE FIN DE SALLE'), HTML.indexOf('/* ---- Le panneau du GÉNÉRATEUR'))
    expect(css.length).toBeGreaterThan(1000)
    expect(css).toContain('prefers-reduced-motion: reduce')
  })
})

// LE VERSEMENT « OÙ VERSER LE SURPLUS ? » (étape 2). Il se posait SOUS le
// bilan resté en grand : deux plaques à bocal et anneau SVG, des chiffres
// « avant → après », une jauge de 8 px — 789 px de scène pour 717 visibles
// à 1280 × 720, le bas des plaques coupé (inventaire). Le bilan s'en va ;
// restent deux cuves rendues et l'orbe du surplus qu'on y verse.
describe('la cérémonie — le versement', () => {
  it('le versement ne garde pas le bilan au-dessus de lui', () => {
    expect(corps('mbMontreVersement')).toMatch(/mbEl\('mb-releve'\)\.hidden = true|mbScene\.classList\.add\('mb-compact'\)/)
  })
  it('pose deux cuves rendues, la colonne cerclée de ses anneaux', () => {
    const v = corps('mbMontreVersement')
    expect(v).toContain("cuveHTML('reserve', 'mb-v-res')")
    expect(v).toContain("cuveHTML('maitrise', 'mb-v-mai')")
    expect(v).toContain('mbPoseCuve(') // jamais une image cassée
    expect(v).toContain('anneauxHTML(')
    expect(v).toContain('colonneMaitrise(')
  })
  it('dit un chiffre par cuve : plus de jauge de 8 px, plus de bocal ni d’anneau dessinés', () => {
    const v = corps('mbMontreVersement')
    expect(v).not.toContain('mb-dest-jauge')
    expect(v).not.toContain('<em>→</em>')
    expect(v).not.toContain('mb-bocal')
    expect(HTML).not.toContain('.mb-dest-jauge')
    expect(HTML).not.toContain('.mb-bocal')
  })
  it('déverse l’orbe dans la cuve choisie, à sa voix', () => {
    const v = corps('mbMontreVersement')
    expect(v).toContain("sonCeremonie('deversement'")
    expect(v).not.toContain('sting-collecte') // les stings restent au rang, au record, au palier
    expect(v).toMatch(/--mb-niveau/) // le liquide de la cible monte
    // un geste pendant le déversement enchaîne (gesteAuVersement), une
    // seule fois ; la suite n'arrive que si la cérémonie en est encore là
    expect(v).toMatch(/=== 'enchaine'\) \{?\s*enchaine\(\)/)
    expect(v).toMatch(/if \(suivi \|\| !miseEnBonbonne \|\| mbEtape !== 'versement'\) return/)
  })
  it('garde la visée, la manette, le bocal plein grisé et le tampon du palier', () => {
    const v = corps('mbMontreVersement')
    for (const ev of ['pointerenter', 'pad-vise', 'focusin', 'pad-quitte']) expect(v, ev).toContain(`'${ev}'`)
    expect(v).toContain('mb-pauvre')
    expect(v).toContain('UN PALIER SE FRANCHIT')
  })
  // le focus posé d'office sur la réserve (pour qu'Entrée, Espace et A
  // trouvent une cible) déclenchait son focusin : l'orbe penchait vers la
  // réserve à l'ouverture, même pour un joueur à la souris qui n'avait rien
  // visé. Une vraie visée : le survol, la manette, la flèche, la tabulation.
  it('ne penche pas vers la cuve que le focus d’ouverture désigne', () => {
    const v = corps('mbMontreVersement')
    expect(v).toMatch(/mbFocusOuverture = true;?\s*\n\s*[^\n]*\.focus\(\{ preventScroll: true \}\);?\s*\n\s*mbFocusOuverture = false/)
    expect(v).toMatch(/'focusin'[^\n]*\n?[^\n]*mbFocusOuverture/)
  })
  it('se vise aux flèches du clavier, comme à la croix de la manette', () => {
    const v = corps('mbMontreVersement')
    expect(v).toContain("'ArrowLeft'")
    expect(v).toContain("'ArrowRight'")
  })
  it('rend la bannière et le bandeau au palier qui suit', () => {
    const x = corps('mbVerseXp')
    expect(x).toContain("mbEl('mb-releve').hidden = false")
    expect(x).toContain("mbEl('mb-titre').textContent = 'SALLE FRANCHIE'")
  })
  it('n’écrit plus d’étiquette sous 10 px', () => {
    for (const s of ['.mb-goutte-corps i', '.mb-dest-plus.mb-dest-ouvre']) {
      const t = /font-size:\s*calc\((\d+(?:\.\d+)?)px/.exec(regle(s))
      expect(t, s).not.toBeNull()
      expect(Number(t![1]), s).toBeGreaterThanOrEqual(10)
    }
  })
})

// « MOINS D'ANIMATIONS », RÈGLE PAR RÈGLE. Les gardes d'avant cherchaient
// un nom de classe dans le dernier bloc de repli : elles passaient alors
// que l'orbe déversée filait encore (sa règle, plus spécifique, redéfinissait
// sa transition après le « transition: none » d'une classe seule) et que la
// colonne visée rejouait son entrée à chaque survol. Un @media n'ajoute
// aucune spécificité : un repli ne gagne que s'il vise le MÊME sélecteur,
// plus loin dans la feuille. Cette garde relève chaque règle de la
// cérémonie qui anime ou fait transiter quelque chose, et exige pour chacun
// de ses sélecteurs ce repli-là — ou que la règle vive sous
// « prefers-reduced-motion: no-preference ».
interface RegleCSS { selecteurs: string[]; corps: string; medias: string[]; pos: number }
function reglesCSS(source: string): RegleCSS[] {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
  const regles: RegleCSS[] = []
  const pile: Array<{ prelude: string; pos: number }> = []
  let debut = 0
  for (let i = 0; i < css.length; i++) {
    const c = css[i]
    if (c === '{') {
      pile.push({ prelude: css.slice(debut, i).trim(), pos: i })
      debut = i + 1
    } else if (c === '}') {
      const b = pile.pop()
      const medias = pile.map((p) => p.prelude)
      // les images d'une @keyframes ne sont pas des règles
      if (b && !b.prelude.startsWith('@') && !medias.some((m) => m.startsWith('@keyframes')))
        regles.push({ selecteurs: b.prelude.split(',').map((x) => x.trim().replace(/\s+/g, ' ')), corps: css.slice(b.pos + 1, i), medias, pos: b.pos })
      debut = i + 1
    } else if (c === ';' && pile.length === 0) debut = i + 1
  }
  return regles
}
function trousDuRepli(source: string): string[] {
  const regles = reglesCSS(source)
  const reduit = (r: RegleCSS): boolean => r.medias.some((m) => m.includes('prefers-reduced-motion: reduce'))
  const tolere = (r: RegleCSS): boolean => r.medias.some((m) => m.includes('prefers-reduced-motion: no-preference'))
  const declare = (corps: string, prop: string): string | null => new RegExp(`(?:^|;|\\s)${prop}:\\s*([^;]+)`).exec(corps)?.[1].trim() ?? null
  const trous: string[] = []
  for (const r of regles) {
    if (reduit(r) || tolere(r)) continue
    for (const prop of ['animation', 'transition']) {
      const v = declare(r.corps, prop)
      if (v === null || /^none\b/.test(v)) continue
      for (const s of r.selecteurs) {
        const neutralise = regles.some((q) => reduit(q) && q.pos > r.pos && q.selecteurs.includes(s) && /^none\b/.test(declare(q.corps, prop) ?? ''))
        if (!neutralise) trous.push(`${prop} — ${s}`)
      }
    }
  }
  return trous
}
describe('la cérémonie — « moins d’animations », règle par règle', () => {
  it('voit le trou qu’un sélecteur plus spécifique creuse dans le repli', () => {
    // le cas de l'orbe déversée : la classe seule est neutralisée, la règle
    // plus spécifique ne l'est pas
    const piege =
      '.a { transition: opacity 1s; }\n.b .a { transition: transform 1s; }\n' +
      '@media (prefers-reduced-motion: no-preference) { .c { animation: x 1s; } }\n' +
      '@media (prefers-reduced-motion: reduce) { .a { transition: none; } }\n'
    expect(trousDuRepli(piege)).toEqual(['transition — .b .a'])
    // un repli écrit AVANT la règle perd à spécificité égale
    expect(trousDuRepli('@media (prefers-reduced-motion: reduce) { .a { animation: none; } }\n.a { animation: x 1s; }')).toEqual(['animation — .a'])
  })
  it('neutralise chaque animation et chaque transition de la cérémonie', () => {
    const css = HTML.slice(HTML.indexOf('/* ==== LA CÉRÉMONIE DE FIN DE SALLE'), HTML.indexOf('/* ---- Le panneau du GÉNÉRATEUR'))
    const animees = reglesCSS(css).filter((r) => /(?:^|;|\s)(?:animation|transition):\s*(?!none)/.test(r.corps))
    expect(animees.length).toBeGreaterThan(40) // la garde regarde bien quelque chose
    expect(trousDuRepli(css)).toEqual([])
  })
})

// LES CONSTATS DE LA RELECTURE DU BILAN (F2) : trois règles que la cascade
// rendait muettes — une taille du Steam Deck qui écrasait celle des
// téléphones couchés, une bande de poutre trop large sur écran étroit, deux
// monnaies sans leur teinte. Le navigateur ne dit rien d'une règle perdue :
// on garde ce qui la fait gagner.
describe('la cérémonie — les règles que la cascade perdait', () => {
  const css = HTML.slice(HTML.indexOf('/* ==== LA CÉRÉMONIE DE FIN DE SALLE'), HTML.indexOf('/* ---- Le panneau du GÉNÉRATEUR'))
  /** la condition du @media qui enveloppe la première occurrence de `bout` */
  const media = (bout: string): string => {
    const i = css.indexOf(bout)
    expect(i, bout).toBeGreaterThan(-1)
    const m = css.lastIndexOf('@media (', i)
    return css.slice(m, css.indexOf('{', m))
  }
  /** le bloc d'un @media de la section, jusqu'à sa fermeture */
  const blocMedia = (condition: string): string => {
    const d = css.indexOf(`@media ${condition} {`)
    expect(d, condition).toBeGreaterThan(-1)
    return css.slice(d, css.indexOf('\n      }\n', d))
  }
  it('ne laisse pas la taille du Steam Deck écraser celle d’un téléphone couché', () => {
    // 844 × 390 : la règle des 761–1000 px ET celle des 820 px de haut
    // s'appliquent ; la seconde, écrite après, regrossissait le cœur
    // (260 au lieu de 230) et le sceau (136 au lieu de 124)
    expect(media('--mb-coeur-l: 260px')).toContain('min-width: 1001px')
    expect(media('--mb-sceau-l: 136px')).toContain('min-width: 1001px')
  })
  it('resserre la poutre repliée sur écran étroit aussi', () => {
    // la bannière repliée (56 px de bande, 4 classes) l'emportait sur la
    // réduction à 36 px (1 classe) : la poutre débordait sur un téléphone
    expect(blocMedia('(max-width: 760px)')).toMatch(/\.mb-scene\.mb-compact \.mb-banniere\.mb-poutre[^{]*\{[^}]*--mb-bande: 36px/)
  })
  it('donne sa teinte de liseré à chaque gain de la récolte', () => {
    const RECOLTE = readFileSync(new URL('./recolte.ts', import.meta.url), 'utf-8')
    const union = /cle: ((?:'[a-z]+'(?: \| )?)+)/.exec(RECOLTE)
    expect(union, 'le type des clés de Gain').not.toBeNull()
    const cles = [...union![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1])
    expect(cles).toContain('instruments')
    for (const cle of cles) expect(regle(`.mb-cartouche-${cle}`), cle).toContain('--mb-liseret:')
  })
})

// LA CARTE DANS LA CÉRÉMONIE : le plan ne bouge pas sous le survol. Deux
// pannes vécues, deux garde-fous — la fiche qui passait d'une à trois
// lignes poussait la carte vers le bas (16/09) ; une ligne en nowrap plus
// longue que la scène élargissait la colonne « 1fr » de la grille, et la
// carte avec elle (mesuré à 1024 × 768 : 995 → 1067 px au survol d'AUCUNE
// TRANSFO, retour au survol suivant — le « léger décalage » à chaque
// changement de porte, 17/09). Vitest tourne sans navigateur : on garde
// les lignes qui tiennent la mise en page, pas les pixels.
describe('la cérémonie — la carte ne bouge pas sous le survol', () => {
  it('la fiche réserve ses trois lignes : elle ne pousse pas la carte', () => {
    expect(regle('.mb-station-fiche')).toMatch(/min-height:\s*calc\(3 \* 1\.55em\)/)
    expect(regle('.mb-station-fiche span')).toMatch(/white-space:\s*nowrap/)
    expect(regle('.mb-station-fiche span')).toMatch(/text-overflow:\s*ellipsis/)
  })

  it('la fiche ne mesure pas la colonne : une ligne trop longue se coupe, la carte garde sa largeur', () => {
    // « 1fr » vaut minmax(auto, 1fr) : le minimum « auto » lit la largeur
    // min-content de la fiche, donc sa ligne la plus longue en nowrap.
    // Sans « min-width: 0 », la colonne s'élargit à cette mesure à chaque
    // survol, et la carte (100 % de la colonne) suit.
    expect(regle('.mb-station-fiche')).toMatch(/min-width:\s*0/)
    expect(regle('.mb-station-fiche')).toMatch(/overflow:\s*hidden/)
  })
})

// LE CHOIX DE LA SALLE TIENT DANS L'ÉCRAN. « La page de choix des niveaux
// déborde souvent dans le bas de l'écran, il y a trop d'informations » (le
// joueur, 13/11) : au-dessus des portes s'empilaient le relevé de la salle
// déjà lue, la jauge de maîtrise, le rang des jauges, la consigne et une
// fiche réservée sous la mini-carte — à 1280 × 720, les portes passaient
// sous le bas de l'écran. L'étape a été épurée ; ces gardes tiennent
// l'épure, faute de navigateur pour mesurer les pixels sous Vitest.
describe('la cérémonie — le choix de la salle tient dans l’écran', () => {
  it('ni relevé, ni jauge de maîtrise, ni jauges, ni consigne au-dessus des portes', () => {
    for (const nom of ['mbMontreSallesVoie', 'mbMontreSalles']) {
      const f = corps(nom)
      expect(f, `${nom} retire le relevé`).toContain('mbReleveHors()')
      expect(f, `${nom} retire la jauge de maîtrise`).toContain(`mbEl('mb-etal').hidden = true`)
      expect(f, `${nom} remet la jauge mince`).not.toContain('mbJaugeMince()')
      expect(f, `${nom} remet le rang des jauges`).not.toContain('mbJauges()')
      expect(f, `${nom} remet une consigne`).not.toMatch(/Consigne/)
    }
  })

  it('la porte tient en une ligne courte : plus d’étiquette en pastille', () => {
    expect(corps('mbPorte')).not.toContain('mb-porte-tag')
    expect(corps('mbPorteNoeud')).not.toContain('mb-porte-tag')
    expect(regle('.mb-porte-ligne')).toMatch(/white-space:\s*nowrap/)
  })

  it('la mini-carte plafonne sa hauteur, sa fiche ne prend aucune place', () => {
    expect(regle('.mv-svg')).toMatch(/max-height:\s*22vh/)
    expect(regle('.mv-fiche')).toMatch(/position:\s*absolute/)
    // au repos, la fiche se tait : plus de consigne par défaut
    expect(corps('mbMontreSallesVoie')).not.toContain('visez une porte')
  })
})

// LE VOCABULAIRE DE LA STATION. « Tout est rectangulaire, carré… ça ne fait
// pas encore assez jeu vidéo » (le concepteur, 13/11) : la cérémonie était
// faite de rectangles arrondis et de pilules. Ses primitives (chanfreins,
// poutre, cartouche, sceau, manomètre, levier) posent les coins coupés une
// fois pour toutes ; ces gardes tiennent qu'aucune ne retombe dans
// l'arrondi, et que chaque mise en scène qu'elles apportent a son repli
// « moins d'animations ».
describe('la cérémonie — le vocabulaire de la station', () => {
  const css = HTML.slice(HTML.indexOf('/* ==== LA CÉRÉMONIE DE FIN DE SALLE'), HTML.indexOf('/* ---- Le panneau du GÉNÉRATEUR'))
  const regle = (s: string): string => { const d = css.indexOf(`\n      ${s} {`); expect(d, s).toBeGreaterThan(-1); return css.slice(d, css.indexOf('}', d)) }
  it('taille ses cadres au chanfrein, pas à l’arrondi', () => {
    for (const s of ['.mb-coupe', '.mb-coupe-diag', '.mb-cartouche', '.mb-levier', '.mb-sceau', '.mb-poutre'])
      expect(regle(s), s).toMatch(/clip-path:\s*polygon\(/)
    expect(regle('.mb-levier')).not.toMatch(/border-radius:\s*999/)
  })
  it('donne un repli « moins d’animations » à chaque primitive animée', () => {
    const moins = css.slice(css.lastIndexOf('prefers-reduced-motion: reduce'))
    for (const s of ['.mb-sceau', '.mb-cartouche', '.mb-poutre', '.mb-levier', '.mb-mano']) expect(moins, s).toContain(s)
  })
  // posée à une largeur (min(100 %, 940 px) en bannière), la poutre ajoutait
  // ses 2 × 143 px de rembourrage PAR-DESSUS : elle débordait la scène de
  // 46 px à 1280 × 720 (mesuré au banc : 1270 px de contenu pour 1224)
  it('compte le rembourrage de la poutre dans sa largeur : elle ne déborde pas', () => {
    expect(regle('.mb-poutre')).toMatch(/box-sizing:\s*border-box/)
  })
})

// LE BILAN « SALLE FRANCHIE ». Il se lisait comme un tableau de bord : une
// médaille ronde, un flacon en rectangle, trois lignes à barre de 6 px, des
// tuiles qui répétaient à chaque salle un paragraphe sur l'usage de la
// monnaie, des émojis (💧 ⏱ ❖ 🧊) ; et il ne se passait qu'au pointeur —
// ni Entrée, ni Espace, ni A n'y faisaient rien (inventaire, étape 1). Il
// devient une scène à UN héros, la bonbonne, et un levier qu'on presse.
describe('la cérémonie — le bilan « SALLE FRANCHIE »', () => {
  it('ne s’allonge pas : le versement arrive au plus tard à 4,9 s', () => {
    expect(TEMPS_BILAN.versement).toBeLessThanOrEqual(4900)
  })
  it('se passe d’un geste : le levier est un bouton focalisé à l’ouverture', () => {
    expect(HTML).toMatch(/<button[^>]*id="mb-passer"/)
    expect(corps('montreMiseEnBonbonne')).toMatch(/mbEl\('mb-passer'\)\.focus\(/)
  })
  it('saute une étape et une seule, même sous les gestes en rafale', () => {
    expect(corps('mbSauteBilan')).toMatch(/if \(mbEtape !== 'bilan'\) return/)
  })
  it('n’a plus aucun émoji dans le bilan', () => {
    const coque = HTML.slice(HTML.indexOf('id="mb-releve"'), HTML.indexOf('id="mb-etal"'))
    expect(coque).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  // le levier, la touche et le clic qui le pressent mènent tous au même saut
  it('le clic du levier et le toucher de la scène appellent le même saut', () => {
    expect(MAIN).toMatch(/mbEl\('mb-passer'\)\.addEventListener\('click', mbSauteBilan\)/)
    const toucher = MAIN.slice(MAIN.indexOf("mbVeil?.addEventListener('pointerdown'"))
    expect(toucher.slice(0, 400)).toContain('mbSauteBilan()')
  })
  // ESPACE ÉTAIT AU JEU : la table des commandes en fait la PAUSE, et
  // input.ts l'annule (preventDefault) sur window — un bouton ne s'actionne
  // pas sur une touche annulée. C'est input.ts qui laisse les touches du
  // voile à la cérémonie (cibleHorsJeu, input.spec.ts) ; le voile ne coupe
  // plus leur remontée, qui les cachait au réveil du son (eveilAudio) et à
  // l'aide clavier du dossier. Une touche TENUE (répétition) n'actionne
  // toujours pas la cible suivante.
  it('laisse Entrée et Espace à ses boutons sans les cacher au reste, et ignore une touche tenue', () => {
    const touches = MAIN.slice(MAIN.indexOf("mbVeil?.addEventListener('keydown'"))
    expect(touches.length).toBeLessThan(MAIN.length)
    const h = touches.slice(0, touches.indexOf('\n})\n'))
    expect(h).not.toContain('stopPropagation()')
    expect(h).toMatch(/e\.repeat\)? e\.preventDefault\(\)/)
    const INPUT = readFileSync(new URL('./input.ts', import.meta.url), 'utf-8')
    const clavier = INPUT.slice(INPUT.indexOf("window.addEventListener('keydown'"))
    expect(clavier.slice(0, 400)).toContain('if (cibleHorsJeu(e.target')
  })
  // le second geste d'une rafale (double clic, A martelé) tombait sur la
  // première cuve, que le versement venait de poser sous le doigt
  it('le versement n’obéit pas au geste qui vient de l’ouvrir', () => {
    const v = corps('mbMontreVersement')
    expect(v).toMatch(/gesteAuVersement\(performance\.now\(\), mbVersementOuvertA, /)
    expect(v).toMatch(/\.focus\(\{ preventScroll: true \}\)/)
  })

  it('met en scène la bonbonne, son manomètre, le sceau du rang et les cartouches', () => {
    const f = corps('montreMiseEnBonbonne')
    expect(f).toContain("cuveHTML('bonbonne', 'mb-eau')")
    expect(f).toContain('sceauHTML(verdict.rang)')
    expect(f).toContain('cartoucheHTML')
    expect(HTML).toMatch(/<header class="mb-banniere mb-poutre"/)
    expect(HTML).toMatch(/<svg class="mb-mano" id="mb-mano"/)
    expect(HTML).toMatch(/class="mb-rang mb-sceau" id="mb-rang"/)
    expect(MAIN).not.toContain('function mbGainHTML')
  })
  // LA BONBONNE AVANT SES IMAGES (point de vigilance n° 1) : les rendus de
  // l'atelier n'étaient pas livrés, et Chrome dessinait à leur place l'icône
  // d'image cassée, cadre compris, au cœur du héros (vu au banc, 13/11). Une
  // image en échec se cache, la silhouette CSS tient la place jusqu'au dos.
  it('pose ses cuves sans jamais montrer une image cassée', () => {
    expect(corps('montreMiseEnBonbonne')).toContain("mbPoseCuve(mbEl('mb-bonbonne'), cuveHTML('bonbonne', 'mb-eau'))")
    const pose = corps('mbPoseCuve')
    expect(pose).toMatch(/'error'/)
    expect(pose).toMatch(/\.hidden = true/)
    expect(pose).toContain('mb-cuve-rendue')
    expect(HTML).toMatch(/\.mb-cuve::before,\s*\.mb-cuve::after \{[^}]*clip-path:\s*polygon\(/)
    expect(HTML).toMatch(/\.mb-cuve\.mb-cuve-rendue::before[^{]*\{[^}]*display: none/)
  })
  it('n’a plus ni lignes à barre ni titre de récolte', () => {
    expect(HTML).not.toContain('id="mb-lignes"')
    expect(HTML).not.toContain('id="mb-recolte-titre"')
    expect(MAIN).not.toContain("mbEl('mb-lignes')")
  })
  it('fait sonner chaque geste de sa voix', () => {
    const f = corps('montreMiseEnBonbonne')
    for (const v of ['sceau', 'compteur', 'cartouche']) expect(f, v).toContain(`sonCeremonie('${v}'`)
    expect(corps('mbSauteBilan')).toContain("sonCeremonie('levier'")
    // la sonde de la console n'a plus de raison d'être : la voix sert
    expect(MAIN).not.toContain('__sonCeremonie')
  })
  // les constats de la relecture du vocabulaire : un nom de rang trop long
  // descendait sous 10 px, et la poutre gardait 143 px de bande par côté
  // sur un écran de téléphone
  it('borne le mot du sceau à 10 px et resserre les bandes de la poutre sur petit écran', () => {
    expect(regle('.mb-sceau-mot')).toMatch(/font-size:\s*max\(calc\(10px \* var\(--ui\)\)/)
    const petit = HTML.slice(HTML.indexOf('@media (max-width: 760px) {', HTML.indexOf('/* ==== LA CÉRÉMONIE DE FIN DE SALLE')))
    expect(petit.slice(0, petit.indexOf('\n      }\n'))).toMatch(/\.mb-poutre \{ --mb-bande:/)
  })
})

// « MODULE TRAVERSÉ » (étape 5). La fin de module était une plaque arrondie
// de tableau de bord : une coche dans un octogone menthe, des pastilles de
// salle en rectangles à étoiles, des tuiles en deux colonnes et une pilule
// qui respirait (inventaire, étape 7). Elle devient une scène de station :
// le sceau du module en héros, une rangée de petits sceaux de rang (un par
// salle, teinté de son régime), les gains en cartouches, un levier.
describe('la cérémonie — « MODULE TRAVERSÉ »', () => {
  it('pose le sceau du module en héros, et les gains en cartouches', () => {
    expect(corps('mbMontreBilanModule')).toContain('cartoucheHTML(')
    expect(corps('mbMontreBilanModule')).toContain("sceauHTML('module')")
    expect(corps('mbMontreBilanModule')).not.toContain('mbGainHTML(')
  })
  it('range les salles en petits sceaux de rang teintés, avec le code et les litres', () => {
    const f = corps('mbMontreBilanModule')
    expect(f).toContain('sceauHTML(p.rang)')
    expect(f).toMatch(/--mb-rang:\$\{p\.teinte\}/)
    expect(f).toContain('p.code')
    expect(f).toContain('p.litres')
    // le régime se lit au sceau (et dans l'infobulle) : plus d'étoiles en texte
    expect(f).not.toContain("'★'.repeat")
  })
  it('n’a plus ni émoji ni coche dans son gabarit', () => {
    expect(corps('mbMontreBilanModule')).not.toMatch(/\p{Extended_Pictographic}|✓/u)
  })
  // le sceau rendu de cinq rangs est un acier neutre que --mb-rang teinte :
  // sans teinte à lui, le sceau du module prendrait celle de la dernière
  // salle, restée sur le voile
  it('donne au sceau du module sa propre teinte', () => {
    expect(regle('.mb-module-sceau')).toMatch(/--mb-rang:/)
  })
  it('se passe d’un geste : un levier focalisé, à sa voix', () => {
    const f = corps('mbMontreBilanModule')
    expect(f).toContain('mb-levier')
    expect(f).not.toContain("'mb-continuer'")
    expect(f).toMatch(/\.focus\(\{ preventScroll: true \}\)/)
    expect(f).toContain("sonCeremonie('levier'")
  })
  // le geste qui ferme l'étape d'avant (A martelé, double clic, Entrée)
  // trouverait le levier sous lui, focalisé : il sauterait le bilan du
  // module sans qu'on l'ait vu. Une rafale saute une étape, pas deux.
  it('ignore le geste qui vient de l’ouvrir', () => {
    const f = corps('mbMontreBilanModule')
    expect(f).toMatch(/const ouvertA = performance\.now\(\)/)
    expect(f).toMatch(/gesteTropTot\(performance\.now\(\), ouvertA\)\) return/)
  })
  // le choc part à l'impact du sceau ; si le joueur a déjà passé, le
  // minuteur ne fait plus rien (pas de flash ni de choc sur le plan)
  it('fait sonner le sceau qui tombe, tant que l’étape est là', () => {
    const f = corps('mbMontreBilanModule')
    expect(f).toContain("sonCeremonie('sceau'")
    expect(f).toMatch(/if \(mbEtape !== 'module'\) return/)
  })
  it('n’écrit plus d’étiquette sous 10 px', () => {
    for (const s of ['.mb-module-total small', '.mb-module-nom small', '.mb-salle-code']) {
      const t = /font-size:\s*calc\((\d+(?:\.\d+)?)px/.exec(regle(s))
      expect(t, s).not.toBeNull()
      expect(Number(t![1]), s).toBeGreaterThanOrEqual(10)
    }
  })
  // six salles (le plus grand module de la station) tiennent sur une rangée
  // à 1280 px — mesuré au banc ; un module plus long (l'éditeur n'a pas de
  // plafond) passe à la ligne au lieu de pousser la scène de côté
  it('garde ses petits sceaux à taille fixe, et passe à la ligne au-delà', () => {
    expect(regle('.mb-salle-sceau')).toMatch(/--mb-sceau-l:\s*\d+px/)
    expect(regle('.mb-module-salles')).toMatch(/flex-wrap:\s*wrap/)
  })
})

// LES HALTES, RENCONTRES, CACHE ET MINI-JEU (étape 6). Des cartes arrondies
// à émoji (💠 🫙 💧, 🥌 🌬️ 🪐 🎯 🔪), des puces de texte (🫙 💧 🧠 💠 🜄 🗺️
// ⚠️ 🔮), une pilule ; un choix ne faisait qu'un sting, ni feu ni flash ; et
// l'alcôve s'appelait du type de son module, « ÉNIGME » (inventaire,
// étapes 9–12). Chaque halte prend son objet rendu en héros, ses offres et
// ses issues en cartouches, un levier ; un choix claque comme les autres.
describe('la cérémonie — les haltes', () => {
  it('l’alcôve s’appelle REPOS, quel que soit le module', () => {
    expect(corps('mbMontreRepos')).toMatch(/'REPOS/)
  })
  it('un choix de halte claque comme les autres choix', () => {
    for (const f of ['mbMontreRepos', 'mbMontreDon', 'mbTranche', 'mbMontreCache'])
      expect(corps(f), f).toMatch(/mbFlash\(\)/)
  })
  it('aucun émoji ne reste dans les haltes', () => {
    for (const f of ['mbMontreRepos', 'mbMontreDon', 'mbPeintEvenement', 'mbTranche', 'mbMontreCache', 'mbMontreResultatMiniJeu', 'mbMontreChoixPalet'])
      expect(corps(f), f).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  // « ÉNIGME » venait du type du module où l'alcôve se tient (une halte
  // tirée en voie vit dans un module d'énigmes) : ce n'est pas son nom
  it('ne nomme plus l’alcôve ni le don du type de leur module', () => {
    for (const f of ['mbMontreRepos', 'mbMontreDon']) expect(corps(f), f).not.toContain('carte.types[m.type]')
  })
  it('pose l’objet de chaque halte en héros', () => {
    expect(corps('mbMontreRepos')).toContain("iconeCeremonieHTML('repos')")
    expect(corps('mbMontreDon')).toContain("iconeCeremonieHTML('don')")
    expect(corps('mbPeintEvenement')).toContain("iconeCeremonieHTML('rencontre')")
    expect(corps('mbTranche')).toContain("iconeCeremonieHTML('rencontre')")
    expect(corps('mbMontreCache')).toContain("iconeCeremonieHTML('cache')")
    expect(corps('mbMontreChoixPalet')).toContain("iconeCeremonieHTML('palet')")
    // le mini-jeu par son identifiant : couperet, palet, rafales, orbites, cibles
    expect(corps('mbMontreResultatMiniJeu')).toMatch(/iconeCeremonieHTML\(level\.minijeu\?\.type \?\? 'couperet'\)/)
    for (const f of ['mbMontreRepos', 'mbMontreDon', 'mbPeintEvenement', 'mbTranche', 'mbMontreCache', 'mbMontreChoixPalet', 'mbMontreResultatMiniJeu'])
      expect(corps(f), f).toContain('mb-halte-heros')
  })
  it('met les offres et les issues en cartouches', () => {
    for (const f of ['mbMontreRepos', 'mbMontreDon', 'mbPeintEvenement', 'mbMontreChoixPalet'])
      expect(corps(f), f).toContain('offreHTML(')
    // le glyphe des données passe par la table, jamais tel quel dans le gabarit
    for (const f of ['mbMontreRepos', 'mbMontreDon']) expect(corps(f), f).toContain('glyphe: o.icone')
    expect(corps('mbTranche')).toContain('puceHTML(')
    expect(corps('mbMontreCache')).toMatch(/plaqueHTML\(|puceHTML\(/)
    for (const f of ['mbMontreRepos', 'mbMontreDon', 'mbPeintEvenement', 'mbMontreChoixPalet', 'mbTranche', 'mbMontreCache', 'mbMontreResultatMiniJeu'])
      expect(corps(f), f).not.toContain("'mb-carte ")
  })
  it('garde le récit d’une rencontre, dans un cadre de la station', () => {
    expect(corps('mbPeintEvenement')).toContain('htmlSafe(ev.texte)')
    expect(corps('mbPeintEvenement')).toMatch(/className = 'mb-ev-recit mb-coupe/)
    expect(corps('mbTranche')).toContain('htmlSafe(issue.texte)')
  })
  it('fait sonner chaque choix et chaque levier de sa voix', () => {
    for (const f of ['mbMontreRepos', 'mbMontreDon', 'mbPeintEvenement', 'mbTranche', 'mbMontreCache', 'mbMontreResultatMiniJeu', 'mbMontreChoixPalet', 'mbMontreFin'])
      expect(corps(f), f).toContain("sonCeremonie('levier'")
  })
  it('se passe d’un geste : un levier ou une offre focalisés, sous une garde de rafale', () => {
    for (const f of ['mbMontreRepos', 'mbMontreDon', 'mbPeintEvenement', 'mbTranche', 'mbMontreCache', 'mbMontreResultatMiniJeu', 'mbMontreChoixPalet', 'mbMontreFin']) {
      expect(corps(f), f).toMatch(/\.focus\(\{ preventScroll: true \}\)/)
      expect(corps(f), f).toMatch(/gesteTropTot\(performance\.now\(\), ouvertA\)/)
    }
    for (const f of ['mbTranche', 'mbMontreCache', 'mbMontreResultatMiniJeu', 'mbMontreFin']) {
      expect(corps(f), f).toContain('mb-levier')
      expect(corps(f), f).not.toContain("'mb-continuer'")
    }
  })
  it('n’écrit plus d’étiquette sous 10 px', () => {
    for (const s of ['.mb-ev-recit em', '.mb-ev-pari, .mb-ev-sur', '.mb-offre-detail', '.mb-puce-texte']) {
      const t = /font-size:\s*calc\((\d+(?:\.\d+)?)px/.exec(regle(s))
      expect(t, s).not.toBeNull()
      expect(Number(t![1]), s).toBeGreaterThanOrEqual(10)
    }
  })
  // le bouton d'une offre est taillé : le clip-path rogne l'outline, le
  // focus (clavier et manette) se dessine DANS la forme
  it('dessine la visée d’une offre dans sa forme', () => {
    expect(corps('mbMontreRepos')).toContain('mb-cartouche mb-offre')
    expect(HTML).toMatch(/\.mb-offre:focus-visible, \.mb-offre\.pad-focus \{[^}]*outline: none;[^}]*box-shadow: inset/)
  })
})

// LA RELECTURE DES HALTES (tour 1)
describe('la cérémonie — les haltes, relues', () => {
  // le flash et le feu vivent dans #mb-veil : fermer la cérémonie dans le
  // même tour les cachait avant leur première image — le palet ne claquait
  // pas. Le motif de la fin ordinaire : on ferme 260 ms plus tard, si la
  // cérémonie est encore ouverte.
  it('laisse claquer le choix du palet avant de fermer la cérémonie', () => {
    const f = corps('mbMontreChoixPalet')
    expect(f).toMatch(/mbEclate\(btn[\s\S]*?window\.setTimeout\(\(\) => \{\s*if \(!miseEnBonbonne\) return\s*fermeMiseEnBonbonne\(\)\s*action\(\)/)
    expect(f).toMatch(/sansAnimation\(\) \? 0 : 260/)
  })
  it('pose le héros en grand, et la colonne du récit suit sa taille', () => {
    const l = (s: string): number => Number(/--mb-heros-l:\s*(\d+)px/.exec(regle(s))?.[1] ?? 0)
    expect(l('.mb-halte')).toBeGreaterThanOrEqual(200)
    expect(l('.mb-halte-a-recit')).toBeGreaterThanOrEqual(160)
    expect(regle('.mb-halte-a-recit')).toMatch(/grid-template-columns:[^;]*var\(--mb-heros-l\)/)
  })
  it('ne laisse pas d’explication à l’écran du repos', () => {
    expect(corps('mbMontreRepos')).not.toContain('PUIS LA CARTE SE ROUVRE')
  })
  // un risque ne luit pas : l'or est réservé à ce qui luit
  it('ne met pas en or la mention d’un pari', () => {
    expect(regle('.mb-ev-pari')).not.toMatch(/--mb-or|#ffd977/i)
  })
})

// LA FIN ORDINAIRE (étape 13, hors voie) : une rangée de jauges en texte à
// émojis (🫙 ◈ 💠 ⇣) et une pilule. Le même traitement que les haltes.
describe('la cérémonie — la fin ordinaire', () => {
  it('dit ses jauges en cartouches, sans émoji', () => {
    expect(corps('mbJauges')).toContain('plaqueHTML(')
    for (const f of ['mbJauges', 'mbMontreFin']) expect(corps(f), f).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

// LE CHOIX DE LA SALLE ET LA CARTE DE LA STATION, HABILLÉS (M3) : la
// disposition, l'épure du 13/11 et le plan ne bougent pas — les portes
// prennent le chanfrein, ENTRER devient un levier, l'icône d'un nœud vient
// de la planche rendue, le plan se taille comme un module.
describe('la cérémonie — les portes et le plan, habillés', () => {
  it('les portes sont taillées au chanfrein, ENTRER est un levier', () => {
    expect(regle('.mb-porte')).toMatch(/clip-path:\s*polygon\(/)
    expect(corps('mbPorte')).toContain('mb-levier')
  })
  it('la porte d’un nœud aussi, et son icône vient de la planche de cérémonie', () => {
    const f = corps('mbPorteNoeud')
    expect(f).toContain('mb-coupe')
    expect(f).toContain('mb-levier')
    expect(f).toContain('iconeCeremonieHTML(d.ceremonie)')
    expect(f).not.toContain('mb-ev-icone')
    expect(corps('mbPorte')).toContain('mb-coupe')
  })
  // le clip-path rogne l'outline : la porte armée au doigt et la visée de
  // la manette se dessinaient DEHORS, et auraient disparu
  it('dessine la porte armée et la visée de la manette dans sa forme', () => {
    expect(regle('.mb-porte.mb-armee')).not.toMatch(/outline:\s*2px/)
    expect(regle('.mb-porte.mb-armee')).toMatch(/box-shadow:\s*inset/)
    expect(HTML).toMatch(/\.mb-porte\.pad-focus[^{]*\{[^}]*box-shadow:\s*inset/)
  })
  it('taille le plan de la station comme un module', () => {
    expect(corps('mbMontreCarte')).toContain("'mb-station-carte mb-coupe'")
  })
  // la manette vise les portes et le plan par « pad-vise » : l'habillage ne
  // doit pas l'avoir débranché
  it('garde la visée de la manette sur les portes et sur le plan', () => {
    expect(corps('mbMontreSallesVoie')).toContain("'pad-vise'")
    expect(corps('mbMontreCarte')).toContain("'pad-vise'")
  })
  it('échappe les portes comme le reste : guillemets compris', () => {
    for (const f of ['mbPorte', 'mbPorteNoeud']) {
      expect(corps(f), f).not.toContain('const esc')
      expect(corps(f), f).toContain('htmlSafe(')
    }
  })
  it('n’écrit plus d’étiquette sous 10 px sur une porte', () => {
    for (const s of ['.mb-porte-no', '.mb-porte-ligne', '.mb-porte-entrer']) {
      const t = /font-size:\s*calc\((\d+(?:\.\d+)?)px/.exec(regle(s))
      expect(t, s).not.toBeNull()
      expect(Number(t![1]), s).toBeGreaterThanOrEqual(10)
    }
  })
})

// LA QUESTION RESTAIT REPLIÉE. mbQuestion() pose « mb-question » (le titre
// en grand), mbCartes() la retire (le porte-cartes repart à neuf pour une
// étape sans question) : appelées dans cet ordre, la question s'effaçait
// aussitôt — les salles, la carte, le module et les haltes s'affichaient
// dans le style replié. Le commentaire de mbCartes le dit : « l'étape qui
// pose une QUESTION le regrossit elle-même », donc APRÈS.
describe('la cérémonie — la question se pose après le porte-cartes', () => {
  it('chaque étape qui pose une question la pose après mbCartes()', () => {
    const fonctions = [...MAIN.matchAll(/\nfunction (\w+)\(/g)].map((m) => m[1])
    const fautives: string[] = []
    let vues = 0
    for (const nom of fonctions) {
      const f = corps(nom)
      const q = f.lastIndexOf('mbQuestion(')
      const c = f.indexOf('mbCartes()')
      if (q < 0 || c < 0 || nom === 'mbQuestion' || nom === 'mbCartes') continue
      vues++
      if (q < c) fautives.push(nom)
    }
    expect(vues).toBeGreaterThan(8) // la garde regarde bien quelque chose
    expect(fautives).toEqual([])
  })
  // en grand, la question cassait sur deux lignes dans la poutre repliée
  // (F3, « CHOISISSEZ LA SALLE SUIVANTE ») : la poutre s'élargit, le titre
  // tient sur une ligne ; sur téléphone il retourne à la ligne et la
  // bande reste resserrée
  it('tient la question sur une ligne dans la poutre repliée', () => {
    expect(regle('.mb-scene.mb-compact.mb-question .mb-banniere.mb-poutre')).toMatch(/width:\s*min\(100%,/)
    expect(HTML).toMatch(/\.mb-scene\.mb-compact\.mb-question \.mb-titre \{[^}]*white-space:\s*nowrap/)
    const petit = HTML.slice(HTML.indexOf('@media (max-width: 760px) {', HTML.indexOf('/* ==== LA CÉRÉMONIE DE FIN DE SALLE')))
    expect(petit.slice(0, petit.indexOf('\n      }\n'))).toMatch(/\.mb-scene\.mb-compact\.mb-question \.mb-banniere\.mb-poutre \{[^}]*--mb-bande: 36px/)
  })
})
