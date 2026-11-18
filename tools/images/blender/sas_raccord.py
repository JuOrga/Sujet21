"""LE SAS DE RACCORD (18/11) — `sas-raccord.webp`, la pièce qui joint deux
modules de la station (docs/assets-ia.md §16).

Le moteur la pose déjà à chaque jonction de couloir (metaAssets.ts,
decalsDuMeta : quatorze sur le module Méduse) et n'attendait que le fichier.
Elle se plante SUR la couture entre deux coques : un col d'amarrage vu de
profil, deux brides boulonnées face à face, l'ouverture vide entre elles, un
vérin et ses biellettes de chaque côté, quatre veilleuses AMBRE — d'après la
référence du concepteur (docs/reference/sas-raccord-reference.png), cadrée sur
les brides : les longs fûts de modules, le moteur les peint déjà.

LA GÉOMÉTRIE EST IMPOSÉE (§16) : la planche est posée entière à son rapport,
et l'ouverture DESSINÉE doit tomber sur la porte PERCÉE. Sur 1024 × 1280 :
  · l'ouverture, centrée, 800 px de haut (PART_PASSAGE_SAS = 0,625), ~200 de
    large, franchement transparente — le fluide et le corps passent devant ;
  · les brides de x 300 à 410 et de 615 à 725 ;
  · le col, 240 px au-dessus et au-dessous de l'ouverture ;
  · un moignon de coque sur les ~250 px de chaque bord, fondu au transparent
    sur le bord extrême (fondu posé APRÈS le rendu, sas_atlas.py : un fondu
    de matière, sous la lumière, ne s'éteindrait pas proprement).
Le quart de tour (`sas-raccord-v`, 1280 × 1024) est la même image tournée.

Unités : 1 = 1024 px ; x de −0,5 à 0,5, z de 0 à 1,25, l'avant en y négatif.

Dans Blender :
    DOSSIER = r'...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\sas_raccord.py', encoding='utf-8').read())
    sas() ; lance(['sas-raccord'], SORTIE, 384)
puis copier SORTIE/alpha/sas-raccord.png dans masters/images/sources/ et lancer
tools/images/sas_atlas.py (le fondu, le quart de tour) puis prepare.py.
"""
import bpy, bmesh, math, os, random
from mathutils import Matrix, Vector

# (surfaces.py charge chaud_biome.py, et ajoute mat_brosse, l'acier brossé)
_src = os.path.join(DOSSIER, 'surfaces.py')
exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

PREFIXE = ''

L, H = 1.0, 1.25
ZC = H / 2
# l'ouverture : 800 px de haut, entre les deux brides
OUV_H = 800 / 1024
OUV_Z0, OUV_Z1 = ZC - OUV_H / 2, ZC + OUV_H / 2


def px(x):
    """une abscisse de la planche (px, depuis la gauche) en unités"""
    return x / 1024 - 0.5


BRIDE_G = (px(300), px(410))
BRIDE_D = (px(615), px(725))
OUV_X0, OUV_X1 = BRIDE_G[1], BRIDE_D[0]


def matieres_sas():
    mats = matieres_biome()
    # la palette relevée sur la référence (§16) : métal #3f454c → #5a6068,
    # arêtes #7d838a, chrome des vérins #9aa3ab ; un cran plus clair que le
    # rendu voulu, le moteur refroidit et atténue les décalques
    # (essai 1, à 3a40 48 → 6269 72 : la pièce sortait sourde et plate à côté
    # de la référence — un cran plus clair, l'écart base / clair élargi)
    mats['acier'] = mat_brosse('sas-acier', (0x44, 0x4a, 0x52), (0x80, 0x88, 0x92), 61, brosse=0.08, rouille=(0x50, 0x3e, 0x32))
    mats['bride'] = mat_brosse('sas-bride', (0x52, 0x58, 0x60), (0x9a, 0xa1, 0xa9), 63, brosse=0.1, rouille=(0x56, 0x42, 0x34))
    mats['cadre'] = mat_brosse('sas-cadre', (0x30, 0x35, 0x3c), (0x5a, 0x60, 0x68), 65, brosse=0.05)
    mats['creux'] = mat_simple('sas-creux', (0x14, 0x18, 0x1c), rug=0.8)
    mats['chrome'] = mat_simple('sas-chrome', (0x9a, 0xa3, 0xab), rug=0.22, metal=0.9)
    mats['veilleuse'] = mat_simple('sas-veilleuse', (0x6a, 0x3c, 0x0e), rug=0.2, emission=(0xe8, 0x95, 0x1f), force=2.2)
    mats['cerne'] = mat_simple('sas-cerne', (0x2a, 0x1a, 0x0a), rug=0.4, emission=(0xc9, 0x6f, 0x14), force=0.35)
    return mats


BISEAU_SAS = dict(BISEAU, acier=0.003, bride=0.004, chrome=0.0015, cadre=0.002)


def veilleuse(at, x, z, y):
    """une petite veilleuse carrée ambre dans son boîtier vissé"""
    at.boite('acier', x - 0.032, x + 0.032, z - 0.026, z + 0.026, y - 0.012, y, -0.3)
    at.boite('cerne', x - 0.022, x + 0.022, z - 0.017, z + 0.017, y - 0.016, y - 0.012, 0)
    at.boite('veilleuse', x - 0.015, x + 0.015, z - 0.011, z + 0.011, y - 0.019, y - 0.016, 0)
    for dx in (-0.026, 0.026):
        for dz in (-0.02, 0.02):
            at.dome('rivet', x + dx, z + dz, 0.0032, y - 0.013, 0)


def verin(at, x, y):
    """le vérin hydraulique debout, ses deux biellettes et leurs pivots"""
    za, zb = ZC - 0.26, ZC + 0.26
    at.tube('chrome', (x, y, za + 0.05), (x, y, zb - 0.05), 0.026, seg=24)
    at.tube('acier', (x, y, za - 0.005), (x, y, za + 0.07), 0.031, seg=24)
    at.tube('acier', (x, y, zb - 0.07), (x, y, zb + 0.005), 0.031, seg=24)
    for z, s in ((za, -1), (zb, 1)):
        # la biellette : du pivot du vérin vers le pivot côté bride
        p0 = (x, y - 0.02, z + s * 0.02)
        dx = 0.09 if x < 0 else -0.09
        p1 = (x + dx, y - 0.02, z + s * 0.06)
        at.tube('acier', p0, p1, 0.016, seg=12)
        for p in (p0, p1):
            at.cylindre('acier', p[0], p[2], 0.026, y - 0.035, y - 0.005, -0.2, seg=24)
            at.cylindre('chrome', p[0], p[2], 0.011, y - 0.04, y - 0.035, 0, seg=16)


def moignon(at, x0, x1):
    """le bout de coque qui recouvre la couture : plaques rivetées, joints,
    un caisson enfoncé où loge le vérin"""
    at.boite('acier', x0, x1, ZC - 0.47, ZC + 0.47, -0.02, 0.06, -0.2)
    for z in (ZC - 0.31, ZC + 0.31):
        at.boite('creux', x0, x1, z - 0.004, z + 0.004, -0.021, -0.018, 0)
    for z in (ZC - 0.455, ZC + 0.455):
        n = max(2, int(abs(x1 - x0) / 0.035))
        for k in range(n + 1):
            at.dome('rivet', x0 + (x1 - x0) * k / n, z, 0.0042, -0.022, 0)
    xa, xb = sorted((x0 + (x1 - x0) * 0.35, x0 + (x1 - x0) * 0.8))
    at.boite('creux', xa, xb, ZC - 0.29, ZC + 0.29, -0.023, -0.019, 0)
    # le cadre en saillie autour du caisson, et ses vis (la référence en a un :
    # sans lui, le vérin flottait sur une tôle nue)
    e = 0.018
    for (a, b, c, d) in ((xa - e, xb + e, ZC + 0.29, ZC + 0.29 + e), (xa - e, xb + e, ZC - 0.29 - e, ZC - 0.29),
                         (xa - e, xa, ZC - 0.29, ZC + 0.29), (xb, xb + e, ZC - 0.29, ZC + 0.29)):
        at.boite('cadre', a, b, c, d, -0.034, -0.02, -0.2)
    for z in (ZC - 0.2, ZC, ZC + 0.2):
        for x in (xa - e / 2, xb + e / 2):
            at.dome('rivet', x, z, 0.004, -0.035, 0)
    # deux nervures verticales de tôle, la couture des plaques du fût
    for xn in (x0 + (x1 - x0) * 0.15, x0 + (x1 - x0) * 0.92):
        at.boite('cadre', xn - 0.006, xn + 0.006, ZC - 0.47, ZC + 0.47, -0.028, -0.02, -0.3)


def bride(at, x0, x1):
    """une bride épaisse vue de chant : la couronne debout, arrondie haut et
    bas, une gorge, deux colonnes de boulons"""
    xm = (x0 + x1) / 2
    w = x1 - x0
    z0, z1 = 0.035, H - 0.035
    r = w / 2
    at.boite('bride', x0, x1, z0 + r, z1 - r, -0.085, 0.07, -0.1)
    for zc in (z0 + r, z1 - r):
        at.tube('bride', (xm, -0.085, zc), (xm, 0.07, zc), r, -0.1, seg=40)
    at.boite('creux', xm - 0.004, xm + 0.004, z0 + r, z1 - r, -0.087, -0.084, 0)
    for xb in (x0 + w * 0.22, x1 - w * 0.22):
        n = 14
        for k in range(n):
            z = z0 + r * 0.7 + (z1 - z0 - 1.4 * r) * k / (n - 1)
            at.cylindre('acier', xb, z, 0.0085, -0.098, -0.085, 0, seg=6)


def col(at):
    """le col, au-dessus et au-dessous de l'ouverture : la tôle qui relie les
    deux brides, et les coins arrondis qui font de l'ouverture une pastille"""
    for za, zb in ((0.06, OUV_Z0), (OUV_Z1, H - 0.06)):
        at.boite('acier', OUV_X0 - 0.002, OUV_X1 + 0.002, za, zb, -0.05, 0.05, -0.3)
        zm = (za + zb) / 2
        at.boite('creux', OUV_X0 + 0.02, OUV_X1 - 0.02, zm - 0.003, zm + 0.003, -0.052, -0.049, 0)
    # un quart de disque plein dans chaque angle du trou : le coin rempli
    # entre l'angle droit et l'arc
    rr = 0.045
    bm = at._bm('acier')
    faces = []
    for (cx, cz, a0, coin) in ((OUV_X0 + rr, OUV_Z0 + rr, math.pi, (OUV_X0, OUV_Z0)),
                               (OUV_X1 - rr, OUV_Z0 + rr, 1.5 * math.pi, (OUV_X1, OUV_Z0)),
                               (OUV_X1 - rr, OUV_Z1 - rr, 0.0, (OUV_X1, OUV_Z1)),
                               (OUV_X0 + rr, OUV_Z1 - rr, 0.5 * math.pi, (OUV_X0, OUV_Z1))):
        pts = [Vector((coin[0], -0.05, coin[1]))]
        for k in range(9):
            a = a0 + (math.pi / 2) * k / 8
            pts.append(Vector((cx + rr * math.cos(a), -0.05, cz + rr * math.sin(a))))
        vs = [bm.verts.new(p) for p in pts]
        vb = [bm.verts.new(p + Vector((0, 0.1, 0))) for p in pts]
        faces.append(bm.faces.new(vs))
        faces.append(bm.faces.new(list(reversed(vb))))
        for i in range(len(vs)):
            j = (i + 1) % len(vs)
            faces.append(bm.faces.new((vs[i], vs[j], vb[j], vb[i])))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    # la tranche sombre du dormant, le long des deux bords verticaux du trou
    for (a, b) in ((OUV_X0, OUV_X0 + 0.006), (OUV_X1 - 0.006, OUV_X1)):
        at.boite('creux', a, b, OUV_Z0 + rr, OUV_Z1 - rr, -0.052, -0.049, 0)


def sas():
    vide_scene()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_sas()
    nom = 'sas-raccord'
    P = parent(sc, nom)
    at = Atelier()
    moignon(at, -0.5, BRIDE_G[0])
    moignon(at, BRIDE_D[1], 0.5)
    for x in (-0.36, 0.36):
        verin(at, x, -0.03)
        for z in (ZC - 0.37, ZC + 0.37):
            veilleuse(at, x + (0.07 if x < 0 else -0.07), z, -0.025)
    bride(at, *BRIDE_G)
    bride(at, *BRIDE_D)
    col(at)
    at.objets(P, mats, BISEAU_SAS, True, nom)
    declare(nom, P, -L / 2, L / 2, 0, H)
    lumiere_camera(sc)
    sc.cycles.device = 'GPU'
