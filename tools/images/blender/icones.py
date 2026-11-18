"""LES ICÔNES PEINTES (18/11) — les cases de `cycle-icones.webp` et de
`trophees-icones.webp` (docs/assets-ia.md §23a, §23b).

Les états, les transformations et les trophées s'affichaient en EMOJI, dont
le dessin change d'une machine à l'autre (sans police emoji : un carré vide).
Ici, chaque icône est une petite pièce de l'atelier, rendue seule dans une
case de 256 px ; tools/images/icones_planches.py les cerne et les range.

LE STYLE : DES PLAQUES D'INSTRUMENT (choix du concepteur, 18/11). Le premier
jet — des objets ronds et saturés, cernés de noir — « faisait enfantin », loin
de l'acier riveté du laboratoire. Chaque icône est maintenant un voyant de
pupitre : un disque d'acier riveté, sa face sombre, et le symbole incrusté en
ÉMAIL qui luit, à la couleur de son état (charte : glace #a7ddf5, eau #63b7e6,
vapeur #f2c98e, plasma #c99aff). Les symboles, retenus par le concepteur : le
FLOCON (le carré du cadran ne se lisait pas), la GOUTTE, le SOUFFLE qui se
disperse en nuée (la vapeur — « l'état vapeur va sûrement pas mal changer » :
son symbole est une fonction à part, `souffle`), l'ÉCLAIR. Ils doivent se lire à
24 px (le logement de l'ATH au repos ; 32 px pour l'état courant) : des traits
francs, rien de fin.

Une case : x de −0,125 à 0,125, z de 0 à 0,25 (1 = 1024 px), centre (0, 0,125).

Dans Blender :
    DOSSIER = r'...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\icones.py', encoding='utf-8').read())
    icones() ; lance(list(PIECES), SORTIE, 256)
puis copier SORTIE/alpha/*.png dans masters/images/sources/icones/ et lancer
tools/images/icones_planches.py.
"""
import bpy, bmesh, math, os
from mathutils import Matrix, Vector

_src = os.path.join(DOSSIER, 'surfaces.py')
exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

PREFIXE = ''
Z0 = 0.125  # le centre d'une case

CYCLE = ['solide', 'liquide', 'gaz', 'plasma',
         'fusion', 'liquefaction', 'solidification', 'vaporisation',
         'sublimation', 'condensation', 'ionisation', 'deionisation']
TRANSFOS = {
    'fusion': ('solide', 'liquide'), 'liquefaction': ('gaz', 'liquide'),
    'solidification': ('liquide', 'solide'), 'vaporisation': ('liquide', 'gaz'),
    'sublimation': ('solide', 'gaz'), 'condensation': ('gaz', 'solide'),
    'ionisation': ('gaz', 'plasma'), 'deionisation': ('plasma', 'gaz'),
}
TROPHEES = ['sans-une-goutte', 'palet-parfait', 'trois-etats', 'ligne-de-crete',
            'miroir-vivant', 'recondense', 'integrale', 'operateur-de-nuit']


def mat_lumineux(nom, couleur, force):
    """l'émail du symbole : il luit par lui-même, à la couleur de son état"""
    m = mat_simple(nom, couleur, rug=0.3, emission=couleur, force=force)
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    for k in ('Specular IOR Level', 'Specular'):
        if k in b.inputs:
            b.inputs[k].default_value = 0.3
            break
    return m


COULEURS = {'solide': (0xa7, 0xdd, 0xf5), 'liquide': (0x63, 0xb7, 0xe6),
            'gaz': (0xf2, 0xc9, 0x8e), 'plasma': (0xc9, 0x9a, 0xff),
            'neutre': (0xcf, 0xe2, 0xee)}


def matieres_icones():
    mats = matieres_biome()
    for k, c in COULEURS.items():
        mats['email-' + k] = mat_lumineux('ic-email-' + k, c, 1.3)
    mats['face'] = mat_simple('ic-face', (0x10, 0x15, 0x1b), rug=0.5)
    mats['bezel'] = mat_brosse('ic-bezel', (0x40, 0x46, 0x4e), (0x86, 0x8e, 0x98), 51, brosse=0.12)
    return mats


# ------------------------------------------------------------ la plaque
def plaque(at, trophee=False):
    """le voyant : la face sombre, la lunette d'acier brossé, ses rivets —
    celle d'un trophée est ouvragée (double lunette, huit rivets)"""
    at.cylindre('face', 0, Z0, 0.092, -0.01, 0.01, 0, seg=64)
    at.anneau('bezel', 0, Z0, 0.105, 0.088, -0.022, 0.012, 0, seg=64)
    n = 8 if trophee else 4
    for k in range(n):
        a = math.pi / 4 + k * 2 * math.pi / n
        at.dome('rivet', 0.097 * math.cos(a), Z0 + 0.097 * math.sin(a), 0.0045, -0.024, 0)
    if trophee:
        at.anneau('bezel', 0, Z0, 0.084, 0.079, -0.014, 0.0, 0, seg=64)


Y_EMAIL = -0.013
TRAIT = 0.0045


def trace(at, etat, pts, r=TRAIT):
    """un trait d'émail le long d'une polyligne, aux joints arrondis"""
    m = 'email-' + etat
    for (a, b) in zip(pts, pts[1:]):
        at.tube(m, (a[0], Y_EMAIL, a[1]), (b[0], Y_EMAIL, b[1]), r, seg=8)
        at.coussin(m, b[0], b[1], r, r, r, Y_EMAIL, 0)
    at.coussin(m, pts[0][0], pts[0][1], r, r, r, Y_EMAIL, 0)


def arc_pts(cx, cz, rr, a0, a1, n=16):
    return [(cx + rr * math.cos(a0 + (a1 - a0) * k / n), cz + rr * math.sin(a0 + (a1 - a0) * k / n)) for k in range(n + 1)]


# ------------------------------------------------------------ les symboles
# Chacun dans un disque de rayon ~1 autour de (cx, cz), à l'échelle s.
def flocon(at, cx, cz, s, etat='solide'):
    for k in range(6):
        a = math.pi / 2 + k * math.pi / 3
        d = (math.cos(a), math.sin(a))
        trace(at, etat, [(cx, cz), (cx + s * d[0], cz + s * d[1])], TRAIT * min(1, s / 0.058))
        b = (cx + 0.58 * s * d[0], cz + 0.58 * s * d[1])
        for sg in (-1, 1):
            a2 = a + sg * math.pi / 4
            trace(at, etat, [b, (b[0] + 0.28 * s * math.cos(a2), b[1] + 0.28 * s * math.sin(a2))], TRAIT * 0.85 * min(1, s / 0.058))


def goutte(at, cx, cz, s, etat='liquide'):
    r = 0.6 * s
    pts = [(cx, cz + s)] + arc_pts(cx, cz - 0.2 * s, r, math.pi * 0.65 + math.pi / 2 - math.pi / 2, math.pi * 2.35, 20) + [(cx, cz + s)]
    trace(at, etat, pts, TRAIT * min(1, s / 0.058))


def souffle(at, cx, cz, s, etat='gaz'):
    """LA VAPEUR : un souffle venu de la gauche qui se disperse en nuée —
    deux traits, puis trois volutes ouvertes côté souffle. (L'état vapeur va
    changer : c'est le seul symbole à redessiner alors.)"""
    k = min(1, s / 0.058)
    trace(at, etat, [(cx - s, cz + 0.22 * s), (cx - 0.1 * s, cz + 0.22 * s)], TRAIT * k)
    trace(at, etat, [(cx - 0.85 * s, cz - 0.22 * s), (cx - 0.05 * s, cz - 0.22 * s)], TRAIT * k)
    for (dx, dz, rr, a0, a1) in ((0.2, 0.42, 0.3, -0.4 * math.pi, 1.05 * math.pi), (0.62, 0.0, 0.34, -0.75 * math.pi, 0.75 * math.pi),
                                 (0.22, -0.44, 0.28, -1.05 * math.pi, 0.4 * math.pi)):
        trace(at, etat, arc_pts(cx + dx * s, cz + dz * s, rr * s, a0, a1, 18), TRAIT * 0.9 * k)


def eclair(at, cx, cz, s, etat='plasma'):
    # (essai 1, à 1,15 trait sur un zigzag étroit : le plus maigre des quatre)
    pts = [(-0.38, 0.9), (0.2, 0.12), (-0.2, 0.0), (0.38, -0.9)]
    trace(at, etat, [(cx + a * s, cz + b * s) for a, b in pts], TRAIT * 1.6 * min(1, s / 0.058))


SYMBOLES = {'solide': flocon, 'liquide': goutte, 'gaz': souffle, 'plasma': eclair}


def fleche(at, x0, x1, z):
    trace(at, 'neutre', [(x0, z), (x1, z)], TRAIT * 0.7)
    trace(at, 'neutre', [(x1 - 0.012, z + 0.011), (x1, z), (x1 - 0.012, z - 0.011)], TRAIT * 0.7)


# L'ÉTENDUE de chaque symbole, à gauche et à droite de son point de pose, en
# fractions de son échelle (trait compris) : le flocon est large, la goutte
# étroite, le souffle déborde d'un côté.
ETENDUE = {'solide': (0.98, 0.98), 'liquide': (0.68, 0.68), 'gaz': (1.08, 1.04), 'plasma': (0.5, 0.5)}


def transformation(at, src, dst):
    """source, flèche, cible : posés selon leur LARGEUR réelle, le même jour
    de part et d'autre de la flèche, et le groupe centré sur la plaque.
    (Essai 1, à l'œil ; essai 2, symboles symétriques et flèche au centre de
    la plaque : la flèche y était, mais une goutte étroite à côté d'un flocon
    large laissait deux jours inégaux — le concepteur : « ça fait pas
    centré ».)"""
    s, jour, lg = 0.032, 0.008, 0.02
    gs, ds = (e * s for e in ETENDUE[src])
    gd, dd = (e * s for e in ETENDUE[dst])
    total = gs + ds + jour + lg + jour + gd + dd
    x = -total / 2
    SYMBOLES[src](at, x + gs, Z0, s)
    x += gs + ds + jour
    fleche(at, x, x + lg, Z0)
    x += lg + jour
    SYMBOLES[dst](at, x + gd, Z0, s)


# ------------------------------------------------------------ les trophées
def trophee(at, nom):
    if nom == 'sans-une-goutte':
        at.anneau('email-liquide', 0, Z0, 0.062, 0.056, Y_EMAIL - 0.002, Y_EMAIL + 0.002, 0, seg=64)
        goutte(at, 0, Z0, 0.04)
    elif nom == 'palet-parfait':
        h = [(0.05 * math.cos(k * math.pi / 3), Z0 + 0.05 * math.sin(k * math.pi / 3)) for k in range(7)]
        trace(at, 'solide', h)
        trace(at, 'solide', [(-0.022, Z0 + 0.012), (0.012, Z0 + 0.026)], TRAIT * 0.7)
    elif nom == 'trois-etats':
        flocon(at, 0, Z0 + 0.036, 0.024)
        goutte(at, -0.036, Z0 - 0.026, 0.024)
        souffle(at, 0.038, Z0 - 0.026, 0.024)
    elif nom == 'ligne-de-crete':
        trace(at, 'solide', [(-0.06, Z0 - 0.035), (-0.025, Z0 + 0.0), (-0.008, Z0 - 0.016), (0.022, Z0 + 0.03), (0.06, Z0 - 0.035)])
        trace(at, 'neutre', [(0.022, Z0 + 0.03), (0.022, Z0 + 0.065)], TRAIT * 0.7)
        trace(at, 'liquide', [(0.022, Z0 + 0.065), (0.048, Z0 + 0.055), (0.022, Z0 + 0.046)], TRAIT * 0.7)
    elif nom == 'miroir-vivant':
        trace(at, 'neutre', [(0.0, Z0 - 0.05), (0.045, Z0 - 0.005)], TRAIT * 1.2)
        trace(at, 'liquide', [(-0.06, Z0 + 0.045), (0.022, Z0 - 0.027), (0.02, Z0 + 0.06)])
    elif nom == 'recondense':
        trace(at, 'neutre', [(-0.06, Z0 - 0.03), (0.06, Z0 - 0.03)], TRAIT * 0.8)
        for k in range(5):
            at.coussin('email-liquide', -0.048 + k * 0.024, Z0 - 0.01, 0.009, 0.009, 0.004, Y_EMAIL, 0)
    elif nom == 'integrale':
        el = [(0.065 * math.cos(2 * math.pi * k / 40), Z0 + 0.026 * math.sin(2 * math.pi * k / 40)) for k in range(41)]
        c, s_ = math.cos(-0.35), math.sin(-0.35)
        trace(at, 'liquide', [(x * c - (z - Z0) * s_, Z0 + x * s_ + (z - Z0) * c) for x, z in el], TRAIT * 0.75)
        trace(at, 'solide', [(-0.014, Z0 - 0.014), (0.014, Z0 - 0.014), (0.014, Z0 + 0.014), (-0.014, Z0 + 0.014), (-0.014, Z0 - 0.014)])
    elif nom == 'operateur-de-nuit':
        trace(at, 'solide', arc_pts(-0.004, Z0 + 0.014, 0.036, 0.35 * math.pi, 1.65 * math.pi, 22) +
              arc_pts(0.012, Z0 + 0.014, 0.028, 1.45 * math.pi, 0.55 * math.pi, 18))
        trace(at, 'neutre', [(-0.05, Z0 - 0.045), (0.05, Z0 - 0.045)], TRAIT * 0.8)


def icones():
    vide_scene()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_icones()
    for nom in CYCLE + TROPHEES:
        P = parent(sc, nom)
        at = Atelier()
        plaque(at, trophee=nom in TROPHEES)
        if nom in SYMBOLES:
            SYMBOLES[nom](at, 0, Z0, 0.058)
        elif nom in TRANSFOS:
            transformation(at, *TRANSFOS[nom])
        else:
            trophee(at, nom)
        at.objets(P, mats, {'bezel': 0.002}, True, nom)
        declare(nom, P, -0.125, 0.125, 0, 0.25)
    lumiere_camera(sc)
    sc.cycles.device = 'GPU'
