"""LES ICÔNES PEINTES (18/11) — les cases de `cycle-icones.webp` et de
`trophees-icones.webp` (docs/assets-ia.md §23a, §23b).

Les états, les transformations et les trophées s'affichaient en EMOJI, dont
le dessin change d'une machine à l'autre (sans police emoji : un carré vide).
Ici, chaque icône est une petite pièce de l'atelier, rendue seule dans une
case de 256 px ; tools/images/icones_planches.py les cerne et les range.

ELLES DOIVENT SE LIRE À 24 PX (le logement de l'ATH au repos ; 32 px pour
l'état courant, dont le fond est de la même teinte) : des silhouettes
FRANCHES, peu de détails, une matière qui luit un peu par elle-même (une face
à l'ombre ne doit pas tomber au noir), et le contour sombre posé à
l'assemblage. Les couleurs de la charte : glace #a7ddf5, eau #63b7e6, vapeur
#f2c98e, plasma #c99aff ; ni texte, ni cadre.

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
    """une matière qui luit un peu d'elle-même : à 24 px, la face à l'ombre
    d'une goutte qui tombe au noir coupe la silhouette en deux"""
    m = mat_simple(nom, couleur, rug=0.3, emission=couleur, force=force)
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    for k in ('Specular IOR Level', 'Specular'):
        if k in b.inputs:
            b.inputs[k].default_value = 0.3
            break
    return m


def matieres_icones():
    mats = matieres_biome()
    mats['glace'] = mat_lumineux('ic-glace', (0xa7, 0xdd, 0xf5), 0.35)
    mats['eau'] = mat_lumineux('ic-eau', (0x63, 0xb7, 0xe6), 0.35)
    mats['vapeur'] = mat_lumineux('ic-vapeur', (0xf2, 0xc9, 0x8e), 0.3)
    mats['plasma'] = mat_lumineux('ic-plasma', (0xc9, 0x9a, 0xff), 1.0)
    mats['fleche'] = mat_lumineux('ic-fleche', (0xcf, 0xe2, 0xee), 0.45)
    mats['acier'] = mat_brosse('ic-acier', (0x4a, 0x52, 0x5c), (0x8a, 0x94, 0xa0), 41, brosse=0.08)
    mats['sombre'] = mat_simple('ic-sombre', (0x1a, 0x20, 0x28), rug=0.6)
    return mats


# ------------------------------------------------------------ les quatre états
def cristal(at, x, z, s):
    """un prisme de glace à six pans, pointu aux deux bouts"""
    at.tube('glace', (x, 0, z - 0.42 * s), (x, 0, z + 0.42 * s), 0.36 * s, seg=6)
    at.tube('glace', (x, 0, z + 0.42 * s), (x, 0, z + 0.85 * s), 0.36 * s, seg=6, r2=0.0)
    at.tube('glace', (x, 0, z - 0.42 * s), (x, 0, z - 0.85 * s), 0.36 * s, seg=6, r2=0.0)


def goutte(at, x, z, s):
    at.coussin('eau', x, z - 0.2 * s, 0.5 * s, 0.5 * s, 0.5 * s, 0, 0)
    at.tube('eau', (x, 0, z - 0.05 * s), (x, 0, z + 0.8 * s), 0.47 * s, seg=32, r2=0.0)


def nuee(at, x, z, s):
    for (dx, dz, r) in ((-0.42, -0.12, 0.36), (0.0, 0.12, 0.48), (0.42, -0.1, 0.34), (0.15, -0.22, 0.3), (-0.18, -0.24, 0.3)):
        at.coussin('vapeur', x + dx * s, z + dz * s, r * s, r * s, r * s, 0, 0)


def arc(at, x, z, s):
    """l'arc électrique : un éclair épais en trois segments"""
    pts = [(-0.3, 0.8), (0.12, 0.12), (-0.12, 0.02), (0.3, -0.8)]
    pts = [(x + a * s, 0, z + b * s) for a, b in pts]
    for p0, p1 in zip(pts, pts[1:]):
        at.tube('plasma', p0, p1, 0.15 * s, seg=12)
        at.coussin('plasma', p1[0], p1[2], 0.15 * s, 0.15 * s, 0.15 * s, 0, 0)


ETATS = {'solide': cristal, 'liquide': goutte, 'gaz': nuee, 'plasma': arc}


def fleche(at, x0, x1, z, h):
    """une flèche fine, en arc, de x0 à x1, sa pointe à droite"""
    n = 10
    pts = [(x0 + (x1 - x0) * k / n, 0, z + h * math.sin(math.pi * k / n)) for k in range(n + 1)]
    for p0, p1 in zip(pts, pts[1:]):
        at.tube('fleche', p0, p1, 0.006, seg=8)
    a, b = Vector(pts[-2]), Vector(pts[-1])
    d = (b - a).normalized()
    at.tube('fleche', tuple(b - d * 0.004), tuple(b + d * 0.026), 0.016, seg=12, r2=0.0)


def transformation(at, src, dst):
    # (essai 1, à 0,075 et ±0,07 : la nuée débordait de sa case, rognée par
    # le bord, son cerne avec elle)
    ETATS[src](at, -0.066, Z0 - 0.02, 0.064)
    ETATS[dst](at, 0.066, Z0 - 0.02, 0.064)
    fleche(at, -0.042, 0.032, Z0 + 0.045, 0.028)


# ------------------------------------------------------------ les trophées
def poly(at, mat, pts, yf=-0.01, yb=0.01):
    at.prisme(mat, pts, yf, yb)


def trophee(at, nom):
    if nom == 'sans-une-goutte':
        at.anneau('acier', 0, Z0, 0.1, 0.082, -0.012, 0.012, 0, seg=64)
        goutte(at, 0, Z0 - 0.005, 0.085)
    elif nom == 'palet-parfait':
        at.cylindre('glace', 0, Z0, 0.09, -0.012, 0.012, 0, seg=64)
        at.anneau('fleche', 0, Z0, 0.09, 0.078, -0.016, -0.012, 0, seg=64)
        # deux reflets droits : un palet POLI, pas une boule de neige
        for (a, b) in (((-0.04, 0.03), (0.02, 0.05)), ((-0.05, -0.01), (0.04, 0.025))):
            at.tube('fleche', (a[0], -0.018, Z0 + a[1]), (b[0], -0.018, Z0 + b[1]), 0.004, seg=6)
    elif nom == 'trois-etats':
        cristal(at, 0, Z0 + 0.045, 0.065)
        goutte(at, -0.055, Z0 - 0.05, 0.06)
        nuee(at, 0.055, Z0 - 0.05, 0.065)
    elif nom == 'ligne-de-crete':
        poly(at, 'acier', [(-0.105, Z0 - 0.07), (-0.05, Z0 + 0.0), (-0.02, Z0 - 0.025), (0.035, Z0 + 0.06),
                           (0.105, Z0 - 0.07)])
        poly(at, 'glace', [(0.012, Z0 + 0.03), (0.035, Z0 + 0.06), (0.058, Z0 + 0.03), (0.046, Z0 + 0.038),
                           (0.035, Z0 + 0.026), (0.024, Z0 + 0.038)], -0.012, -0.01)
        at.tube('acier', (0.035, -0.012, Z0 + 0.06), (0.035, -0.012, Z0 + 0.11), 0.004, seg=8)
        poly(at, 'eau', [(0.037, Z0 + 0.108), (0.08, Z0 + 0.095), (0.037, Z0 + 0.082)], -0.014, -0.012)
    elif nom == 'miroir-vivant':
        cristal(at, 0.02, Z0 - 0.01, 0.07)
        at.tube('eau', (-0.105, -0.02, Z0 + 0.07), (0.0, -0.02, Z0 - 0.0), 0.009, seg=10)
        at.tube('eau', (0.0, -0.02, Z0 - 0.0), (0.1, -0.02, Z0 + 0.08), 0.009, seg=10)
        at.coussin('fleche', 0.0, Z0, 0.016, 0.016, 0.016, -0.025, 0)
    elif nom == 'recondense':
        at.boite('acier', -0.1, 0.1, Z0 - 0.07, Z0 - 0.045, -0.02, 0.02, 0)
        for k in range(5):
            x = -0.08 + k * 0.04
            at.coussin('eau', x, Z0 - 0.025, 0.017, 0.017, 0.017, -0.005, 0)
    elif nom == 'integrale':
        # la station : un fût, deux ailes de panneaux
        at.tube('acier', (-0.03, 0, Z0), (0.03, 0, Z0), 0.018, seg=24)
        at.boite('glace', -0.08, -0.035, Z0 - 0.022, Z0 + 0.022, -0.003, 0.003, 0)
        at.boite('glace', 0.035, 0.08, Z0 - 0.022, Z0 + 0.022, -0.003, 0.003, 0)

        # l'orbite : une ellipse inclinée, sa moitié arrière DERRIÈRE la station
        def p(t):
            xx, zz = 0.105 * math.cos(t), 0.04 * math.sin(t)
            c, s_ = math.cos(-0.35), math.sin(-0.35)
            return (xx * c - zz * s_, (0.03 if math.sin(t) > 0 else -0.03), Z0 + xx * s_ + zz * c)
        n = 48
        for k in range(n):
            at.tube('fleche', p(2 * math.pi * k / n), p(2 * math.pi * (k + 1) / n), 0.004, seg=6)
        at.coussin('eau', p(1.2)[0], p(1.2)[2], 0.012, 0.012, 0.012, -0.035, 0)
    elif nom == 'operateur-de-nuit':
        # le pupitre, et au-dessus le croissant de lune
        poly(at, 'acier', [(-0.09, Z0 - 0.09), (0.09, Z0 - 0.09), (0.09, Z0 - 0.05), (0.06, Z0 - 0.02),
                           (-0.06, Z0 - 0.02), (-0.09, Z0 - 0.05)])
        for k in range(3):
            at.cylindre('eau', -0.04 + k * 0.04, Z0 - 0.05, 0.008, -0.013, -0.01, 0, seg=16)
        # le croissant : le bord gauche d'un disque, moins un disque égal
        # décalé à droite
        R, dx, zc = 0.06, 0.03, Z0 + 0.04
        pts = []
        for k in range(25):
            a = math.pi / 2 + math.pi * k / 24
            pts.append((R * math.cos(a), zc + R * math.sin(a)))
        for k in range(1, 24):
            yy = -R + 2 * R * k / 24
            pts.append((dx - math.sqrt(max(R * R - yy * yy, 0.0)), zc + yy))
        poly(at, 'glace', pts)


def icones():
    vide_scene()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_icones()
    for nom in CYCLE + TROPHEES:
        P = parent(sc, nom)
        at = Atelier()
        if nom in ETATS:
            ETATS[nom](at, 0, Z0, 0.11)
        elif nom in TRANSFOS:
            transformation(at, *TRANSFOS[nom])
        else:
            trophee(at, nom)
        at.objets(P, mats, {}, True, nom)
        declare(nom, P, -0.125, 0.125, 0, 0.25)
    lumiere_camera(sc)
    sc.cycles.device = 'GPU'
