"""LES ÉQUIPEMENTS DE COQUE, refaits dans Blender (13/11) — ce qui se dresse
sur le bord haut de chaque module : le mât, les deux panneaux solaires,
l'antenne parabolique, le radiateur, le réservoir.

Les anciens sortaient d'une planche générée, à 853 px par largeur de salle :
le tableau en plein écran (une salle sur ~1500 px d'écran) les agrandissait
1,9 fois, c'était l'endroit le plus flou du décor. Ceux-ci sont rendus à
1536 px par salle, dans le même atelier que la chaufferie et la serre
(chaud_biome.py), aux MÊMES dimensions que les anciens (en largeurs de
salle) : le moteur les pose au même endroit, pied sur le bord haut.

Chaque pièce : z = 0 son pied, x = 0 son axe ; vue de face, détourée.

Dans Blender :
    DOSSIER = r'...' ; exec(open(DOSSIER + r'\\equipements.py').read())
    equipements() ; lance(list(PIECES), DOSSIER + r'\\equipements', 384, 150)
"""
import bpy, bmesh, math, os
from mathutils import Matrix, Vector

_src = os.path.join(DOSSIER, 'chaud_biome.py')
exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

PREFIXE = 'equipement-'

# les dimensions des anciens, en largeurs de salle (largeur, hauteur) : le
# fichier livré × 1,07 / 853,3 (module2dCanvas.ts, ce que le peintre en fait)
TAILLES = {
    'mat': (0.283, 0.509),
    'grand-solaire': (0.572, 0.459),
    'petit-solaire': (0.337, 0.339),
    'antenne': (0.465, 0.461),
    'radiateur': (0.514, 0.408),
    'reservoir': (0.507, 0.252),
}


def mat_solaire():
    """les cellules d'un panneau : un bleu nuit vitré, une grille d'argent
    (la période, entière par cellule, se pose en coordonnées du monde)"""
    mat = mat_simple('solaire', (0x0a, 0x12, 0x26), rug=0.3, metal=0.2)
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    b = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
    geo = N.new('ShaderNodeNewGeometry')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(geo.outputs['Position'], sep.inputs[0])

    def ligne(axe, pas, ep):
        f = op(nt, 'FRACT', op(nt, 'MULTIPLY', sep.outputs[axe], 1 / pas))
        return op(nt, 'LESS_THAN', op(nt, 'ABSOLUTE', op(nt, 'SUBTRACT', f, 0.5)), ep)
    # (premier rendu : pas de 0,024 et grille claire — une grille de fenêtre,
    # luminance 0,32 contre 0,13 au reste du décor)
    grille = op(nt, 'MAXIMUM', op(nt, 'SUBTRACT', 1.0, ligne('X', 0.0115, 0.4)), op(nt, 'SUBTRACT', 1.0, ligne('Z', 0.0115, 0.4)))
    reflet = rampe(nt, bruit_tore(nt, 3, 3, 51, detail=2, rugo=0.5), 0.45, 0.7)
    c = melange(nt, op(nt, 'MULTIPLY', reflet, 0.6), lin((0x0a, 0x12, 0x26)), lin((0x16, 0x26, 0x46)))
    c = melange(nt, op(nt, 'MULTIPLY', grille, 0.75), c, lin((0x34, 0x3e, 0x4c)))
    L.new(c, b.inputs['Base Color'])
    return mat


def socle(at, w, h=0.022):
    """la semelle boulonnée au bord de coque"""
    at.boite('peinture', -w / 2, w / 2, 0, h, -0.03, 0.03, -0.4)
    for x in (-w / 2 + 0.012, w / 2 - 0.012):
        at.cylindre('peinture', x, h * 0.5, 0.005, -0.036, -0.03, -0.4, seg=6)


def mat_(sc, mats):
    """LE MÂT : un pylône en treillis qui s'affine, ses bras, ses fouets, sa
    balise ambre"""
    P = parent(sc, 'mat')
    at = Atelier()
    w, h = TAILLES['mat']
    socle(at, 0.2)
    z, base, n = 0.022, 0.065, 6
    for k in range(n):
        za, zb = z + k * 0.06, z + (k + 1) * 0.06
        ea, eb = base * (1 - 0.09 * k), base * (1 - 0.09 * (k + 1))
        at.tube('tuyau', (-ea, -0.01, za), (-eb, -0.01, zb), 0.0045, seg=10)
        at.tube('tuyau', (ea, -0.01, za), (eb, -0.01, zb), 0.0045, seg=10)
        at.tube('tuyau', (-ea, -0.01, za), (eb, -0.01, zb), 0.003, seg=8)
        at.tube('tuyau', (ea, -0.01, za), (-eb, -0.01, zb), 0.003, seg=8)
        at.tube('tuyau', (-eb, -0.01, zb), (eb, -0.01, zb), 0.003, seg=8)
    zt = z + n * 0.06
    at.boite('peinture', -0.05, 0.05, zt, zt + 0.012, -0.03, 0.02, -0.3)
    at.tube('tuyau', (-0.12, -0.01, zt + 0.03), (0.12, -0.01, zt + 0.03), 0.004, seg=10)
    for s in (-1, 1):
        at.tube('tuyau', (s * 0.12, -0.01, zt + 0.03), (s * 0.12, -0.01, zt - 0.05), 0.0025, seg=8)
        at.boite('peinture', s * 0.12 - 0.008, s * 0.12 + 0.008, zt - 0.064, zt - 0.05, -0.018, -0.002, 0.2)
    at.tube('tuyau', (0, -0.01, zt + 0.012), (0, -0.01, h - 0.012), 0.0035, seg=10)
    at.tube('tuyau', (-0.03, -0.01, zt + 0.012), (-0.03, -0.01, h - 0.07), 0.0022, seg=8)
    at.tube('tuyau', (0.032, -0.01, zt + 0.012), (0.032, -0.01, h - 0.09), 0.0022, seg=8)
    at.coussin('ambre', 0, h - 0.008, 0.008, 0.008, 0.008, -0.01, 0)
    at.objets(P, mats, BISEAU, True, 'mat')
    declare('mat', P, -w / 2, w / 2, 0, h)


def aile(at, x0, x1, z0, z1, y=-0.012):
    """un panneau de cellules, son cadre, sa traverse"""
    at.boite('peinture', x0, x1, z0, z1, y, y + 0.012, -0.5)
    at.boite('solaire', x0 + 0.008, x1 - 0.008, z0 + 0.008, z1 - 0.008, y - 0.002, y, 0)
    m = (x0 + x1) / 2
    at.boite('peinture', m - 0.003, m + 0.003, z0, z1, y - 0.004, y, -0.4)


def grand_solaire(sc, mats):
    """LE GRAND PANNEAU SOLAIRE : deux ailes sur un mât, le boîtier d'orientation"""
    P = parent(sc, 'grand-solaire')
    at = Atelier()
    w, h = TAILLES['grand-solaire']
    socle(at, 0.12)
    zc = h * 0.55
    at.tube('peinture', (0, 0.0, 0.022), (0, 0.0, zc), 0.011, -0.3, seg=16)
    at.boite('peinture', -0.03, 0.03, zc - 0.03, zc + 0.03, -0.035, 0.02, -0.2)
    at.cylindre('ambre', 0.016, zc + 0.016, 0.004, -0.039, -0.035, 0, seg=10)
    for s in (-1, 1):
        at.tube('tuyau', (s * 0.03, -0.005, zc), (s * 0.045, -0.005, zc), 0.006, seg=12)
        xa, xb = sorted((s * 0.045, s * (w / 2)))
        aile(at, xa, xb, zc - 0.21, h)
    at.objets(P, mats, BISEAU, True, 'grand-solaire')
    declare('grand-solaire', P, -w / 2, w / 2, 0, h)


def petit_solaire(sc, mats):
    """LE PETIT PANNEAU : un seul, sur une potence, et son jambage"""
    P = parent(sc, 'petit-solaire')
    at = Atelier()
    w, h = TAILLES['petit-solaire']
    socle(at, 0.1)
    at.tube('peinture', (0, 0.0, 0.022), (0, 0.0, 0.16), 0.009, -0.3, seg=14)
    at.tube('tuyau', (-0.04, 0.0, 0.022), (0, 0.0, 0.12), 0.0035, seg=8)
    at.boite('peinture', -0.022, 0.022, 0.15, 0.18, -0.03, 0.02, -0.2)
    aile(at, -w / 2, w / 2, 0.18, h)
    at.objets(P, mats, BISEAU, True, 'petit-solaire')
    declare('petit-solaire', P, -w / 2, w / 2, 0, h)


def antenne(sc, mats):
    """L'ANTENNE PARABOLIQUE : le pied, la monture, le réflecteur tourné vers
    le haut et la droite, la source sur ses trois bras"""
    P = parent(sc, 'antenne')
    at = Atelier()
    w, h = TAILLES['antenne']
    socle(at, 0.16)
    at.tube('peinture', (0, 0.0, 0.022), (0, 0.0, 0.17), 0.022, -0.3, seg=20)
    at.boite('peinture', -0.04, 0.04, 0.15, 0.19, -0.03, 0.03, -0.2)
    at.tube('tuyau', (-0.05, -0.035, 0.18), (0.05, -0.035, 0.18), 0.008, seg=14)
    # (tournée vers le haut, on la voyait par en dessous : une ellipse noire)
    axe = Vector((0.45, -1.0, 0.55)).normalized()
    c = Vector((0.0, 0.0, 0.25))
    R, F = 0.2, 0.16
    rot = axe.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bm = at._bm('peinture')
    lay = bm.faces.layers.float['var']
    anneaux = []
    for i in range(9):
        r = R * i / 8
        z = r * r / (4 * F)
        anneaux.append([bm.verts.new(c + (rot @ Vector((r * math.cos(t), r * math.sin(t), z)))) for t in [2 * math.pi * j / 48 for j in range(48)]])
    for i in range(8):
        for j in range(48):
            f = bm.faces.new((anneaux[i][j], anneaux[i][(j + 1) % 48], anneaux[i + 1][(j + 1) % 48], anneaux[i + 1][j]))
            f[lay] = 0.4
    for t in [2 * math.pi * j / 24 for j in range(24)]:
        p = c + rot @ Vector((R * math.cos(t), R * math.sin(t), R * R / (4 * F)))
        at.dome('rivet', p.x, p.z, 0.0035, p.y - 0.004, 0.3)
    s = c + axe * F
    at.coussin('tuyau', s.x, s.z, 0.014, 0.014, 0.014, s.y, 0)
    for t in (0.3, 2.4, 4.5):
        p = c + rot @ Vector((R * 0.85 * math.cos(t), R * 0.85 * math.sin(t), (R * 0.85) ** 2 / (4 * F)))
        at.tube('tuyau', tuple(p), tuple(s), 0.0028, seg=8)
    at.tube('tuyau', (0.0, -0.035, 0.19), tuple(c), 0.01, seg=12)
    at.cylindre('ambre', 0.03, 0.17, 0.004, -0.034, -0.03, 0, seg=10)
    at.objets(P, mats, BISEAU, True, 'antenne')
    declare('antenne', P, -w / 2, w / 2, 0, h)


def radiateur(sc, mats):
    """LE RADIATEUR : des ailettes verticales dans un cadre, les collecteurs
    haut et bas, posé sur quatre pieds"""
    P = parent(sc, 'radiateur')
    at = Atelier()
    w, h = TAILLES['radiateur']
    socle(at, w * 0.9)
    for x in (-w / 2 + 0.03, -0.06, 0.06, w / 2 - 0.03):
        at.boite('peinture', x - 0.008, x + 0.008, 0.022, 0.08, -0.02, 0.02, -0.4)
    at.boite('peinture', -w / 2, w / 2, 0.08, 0.1, -0.03, 0.03, -0.3)
    at.boite('peinture', -w / 2, w / 2, h - 0.03, h, -0.03, 0.03, -0.3)
    for x in (-w / 2, w / 2):
        xa, xb = sorted((x, x - math.copysign(0.02, x)))
        at.boite('peinture', xa, xb, 0.08, h, -0.03, 0.03, -0.3)
    at.boite('peinture', -w / 2 + 0.02, w / 2 - 0.02, 0.1, h - 0.03, 0.02, 0.025, -0.9)
    n = 17
    for k in range(n):
        x = -w / 2 + 0.03 + k * (w - 0.06) / (n - 1)
        at.boite('tuyau', x - 0.0045, x + 0.0045, 0.1, h - 0.03, -0.02, 0.02, 0)
    for z in (0.09, h - 0.015):
        at.tube('tuyau', (-w / 2 - 0.015, -0.035, z), (w / 2 + 0.015, -0.035, z), 0.009, seg=14)
    rivets(at, -w / 2, w / 2, h - 0.03, h, -0.03, -0.3, retrait=0.008, pas=0.04, r=0.003)
    at.boite('cyan', -w / 2 + 0.02, -w / 2 + 0.1, 0.087, 0.091, -0.031, -0.03, 0)
    at.cylindre('ambre', w / 2 - 0.035, h - 0.015, 0.004, -0.034, -0.03, 0, seg=10)
    at.objets(P, mats, BISEAU, True, 'radiateur')
    declare('radiateur', P, -w / 2, w / 2, 0, h)


def reservoir(sc, mats):
    """LE RÉSERVOIR : un fût couché, ses fonds bombés, deux sangles, posé sur
    deux berceaux ; la vanne, l'étiquette, le trait cyan"""
    P = parent(sc, 'reservoir')
    at = Atelier()
    w, h = TAILLES['reservoir']
    socle(at, w * 0.8)
    r = 0.085
    zc = h - r - 0.02
    L = w / 2 - r * 0.55 - 0.005
    at.fut('peinture', -L, L, r, 0.2, 0.0, zc)
    for s in (-1, 1):
        at.coussin('peinture', s * L, zc, r * 0.55, r, r, 0.0, 0.2)
        x = s * L * 0.55
        at.fut('tuyau', x - 0.01, x + 0.01, r + 0.004, 0, 0.0, zc)
        at.boite('peinture', x - 0.05, x + 0.05, zc - r - 0.012, zc - r + 0.012, -0.04, 0.04, -0.3)
        at.tube('tuyau', (x - 0.04, -0.04, 0.022), (x - 0.01, -0.04, zc - r - 0.012), 0.005, seg=10)
        at.tube('tuyau', (x + 0.04, -0.04, 0.022), (x + 0.01, -0.04, zc - r - 0.012), 0.005, seg=10)
    at.fut('cyan', -0.03, 0.03, r + 0.0008, 0, 0.0, zc)
    at.tube('tuyau', (0.12, 0.0, zc + r - 0.01), (0.12, 0.0, zc + r + 0.025), 0.008, seg=12)
    at.tube('tuyau', (0.105, 0.0, zc + r + 0.02), (0.135, 0.0, zc + r + 0.02), 0.0045, seg=10)
    at.boite('etiquette', -0.13, -0.07, zc - 0.02, zc + 0.02, -r - 0.002, -r + 0.004, 0)
    at.cylindre('ambre', -0.16, zc + 0.03, 0.004, -r - 0.004, -r + 0.004, 0, seg=10)
    at.objets(P, mats, BISEAU, True, 'reservoir')
    declare('reservoir', P, -w / 2, w / 2, 0, h)


def equipements():
    vide_scene()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_biome()
    mats['solaire'] = mat_solaire()
    mats['etiquette'] = mat_simple('etiquette', (0x9a, 0xa3, 0xab), rug=0.6)
    for f in (mat_, grand_solaire, petit_solaire, antenne, radiateur, reservoir):
        f(sc, mats)
    lumiere_camera(sc)
    sc.cycles.device = 'GPU'
