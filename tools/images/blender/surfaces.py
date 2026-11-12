"""LES SURFACES RÉPÉTÉES, refaites dans Blender (13/11) — wall.webp et
tank-bg.webp, deux carreaux qui se raccordent sur leurs quatre bords.

Les anciens sortaient d'un générateur d'images et leur couture se voyait
(prepare.py --audit : wall raccord vertical 4,7, tank-bg horizontal 3,2 ; le
seuil est 3,0). Ici, le même dessin — des plaques d'acier brossé à coins
coupés pour le mur, des panneaux sombres barrés de rails à voyants pour le
fond de cuve — refait dans l'atelier de la chaufferie, où le raccord vient
PAR CONSTRUCTION (chaud_tole.py, en-tête) : le bruit des matières pris sur un
tore, le carreau entouré de ses huit copies, une marge rendue puis rognée.

Une mise en page PÉRIODIQUE : chaque rangée donne ses coutures dans [0, 1) ;
la dernière plaque déborde à droite, et la copie de gauche la ramène au début.

Dans Blender :
    DOSSIER = r'...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\surfaces.py', encoding='utf-8').read())
    surfaces() ; lance(['wall', 'tank-bg'], SORTIE, 384)
"""
import bpy, bmesh, math, os, random
from mathutils import Matrix, Vector

_src = os.path.join(DOSSIER, 'chaud_biome.py')
exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

PREFIXE = ''


# ------------------------------------------------------------- les matières
def mat_brosse(nom, base, clair, graine, brosse=0.10, rouille=None):
    """l'acier peint et brossé : un trait horizontal fin (le bruit très serré
    en z, lâche en x), une marbrure large, chaque plaque un rien différente
    (l'attribut 'var' de l'atelier)"""
    mat = bpy.data.materials.new(nom)
    nt, N, L = noeuds(mat)
    out = N.new('ShaderNodeOutputMaterial')
    b = N.new('ShaderNodeBsdfPrincipled')
    L.new(b.outputs[0], out.inputs[0])
    var = N.new('ShaderNodeAttribute')
    var.attribute_type = 'GEOMETRY'
    var.attribute_name = 'var'
    v01 = op(nt, 'MULTIPLY_ADD', var.outputs['Fac'], 0.5, 0.5)
    marbre = bruit_tore(nt, 2.0, 2.0, graine, detail=4, rugo=0.5)
    trait = bruit_tore(nt, 4.0, 420.0, graine + 1, detail=3, rugo=0.6)
    grain = bruit_tore(nt, 90.0, 90.0, graine + 2, detail=6, rugo=0.7)
    t = op(nt, 'ADD', op(nt, 'MULTIPLY', marbre, 0.6), op(nt, 'MULTIPLY', v01, 0.5))
    t = op(nt, 'ADD', t, op(nt, 'MULTIPLY', op(nt, 'SUBTRACT', trait, 0.5), brosse * 4))
    coul = melange(nt, rampe(nt, t, 0.35, 1.15), lin(base), lin(clair))
    if rouille:
        r = rampe(nt, op(nt, 'MULTIPLY', marbre, grain), 0.36, 0.44)
        coul = melange(nt, op(nt, 'MULTIPLY', r, 0.6), coul, lin(rouille))
    L.new(coul, b.inputs['Base Color'])
    b.inputs['Metallic'].default_value = 0.45
    L.new(op(nt, 'ADD', 0.42, op(nt, 'MULTIPLY', trait, 0.18)), b.inputs['Roughness'])
    bump = N.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.25
    bump.inputs['Distance'].default_value = 0.0006
    L.new(op(nt, 'ADD', trait, op(nt, 'MULTIPLY', grain, 0.5)), bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat


# ------------------------------------------------------- l'atelier, en plus
def _plaque_coupee(self, mat, x0, x1, z0, z1, yf, yb, var=0.0, coins=(0, 0, 0, 0)):
    """une plaque à coins coupés en biseau : coins = (bas-gauche, bas-droite,
    haut-droite, haut-gauche), la taille de la coupe (0 : coin droit)"""
    bg, bd, hd, hg = coins
    pts = []
    for (x, z, c, dx, dz) in ((x0, z0, bg, 1, 1), (x1, z0, bd, -1, 1), (x1, z1, hd, -1, -1), (x0, z1, hg, 1, -1)):
        if c:
            # dans l'ordre du contour : on arrive par le côté vertical ou horizontal
            if (dx, dz) in ((1, 1), (-1, -1)):
                pts += [(x, z + dz * c), (x + dx * c, z)]
            else:
                pts += [(x + dx * c, z), (x, z + dz * c)]
        else:
            pts.append((x, z))
    bm = self._bm(mat)
    av = [bm.verts.new((x, yf, z)) for x, z in pts]
    ar = [bm.verts.new((x, yb, z)) for x, z in pts]
    n = len(pts)
    faces = [bm.faces.new(av), bm.faces.new(list(reversed(ar)))]
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((av[i], av[j], ar[j], ar[i])))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    self._marque(mat, av + ar, var)


Atelier.plaque_coupee = _plaque_coupee


def fond(P, mats, nom='fond'):
    me = bpy.data.meshes.new(P.name + '-fond')
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((0.5, FOND_Y + 0.005, 0.5)) @ Matrix.Diagonal((3, 0.01, 3, 1)))
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats[nom])
    P.objects.link(bpy.data.objects.new(P.name + '-fond', me))


def carreau(sc, mats, nom, bati):
    """un carreau : `bati(at, rng)` pose la géométrie dans [0,1]², les huit
    copies l'entourent, la caméra cadre le carreau et sa marge"""
    P = parent(sc, nom)
    C = sous(P, nom + '-carreau')
    at = Atelier()
    bati(at, random.Random(len(nom) * 97))
    at.objets(C, mats, {'panneau': 0.0022, 'rail': 0.0016, 'lame': 0.0006}, prefixe=nom)
    fond(P, mats)
    copies(P, C, [(dx, dz) for dx in (-1, 0, 1) for dz in (-1, 0, 1) if dx or dz])
    declare(nom, P, 0, 1, 0, 1, mx=MARGE, mz=MARGE, alpha=False)


def rangee(coutures):
    """les plaques d'une rangée, de couture en couture ; la dernière va
    jusqu'à la première + 1 (elle déborde, sa copie revient à gauche)"""
    c = sorted(coutures)
    return [(c[i], c[i + 1] if i + 1 < len(c) else c[0] + 1) for i in range(len(c))]


# ------------------------------------------------------------------- le mur
# relevé sur l'ancien wall.webp (1024 px) : quatre rangées de plaques
# décalées, des coins coupés aux marches, un rivet à chaque coin, parfois deux
MUR = [
    # (bas, haut, coutures, coins coupés {indice de plaque: coins})
    (0.000, 0.262, (0.15, 0.54, 0.895), {0: (0, 0, 0.02, 0), 1: (0, 0.02, 0, 0)}),
    (0.262, 0.500, (0.12, 0.26, 0.72), {1: (0.025, 0, 0, 0.025), 2: (0, 0.025, 0, 0)}),
    (0.500, 0.765, (0.0, 0.16, 0.555, 0.895), {1: (0, 0, 0, 0.02), 2: (0.02, 0, 0, 0)}),
    (0.765, 1.000, (0.125, 0.545, 0.90), {2: (0, 0, 0.02, 0)}),
]


def mur(at, rng):
    for (z0, z1, coutures, coupes) in MUR:
        for i, (x0, x1) in enumerate(rangee(coutures)):
            g = JEU / 2
            var = rng.uniform(-1, 1)
            at.plaque_coupee('panneau', x0 + g, x1 - g, z0 + g, z1 - g, 0.0, FOND_Y, var, coupes.get(i, (0, 0, 0, 0)))
            # un rivet à chaque coin, en retrait ; un sur cinq, doublé
            for (x, z, sx, sz) in ((x0, z0, 1, 1), (x1, z0, -1, 1), (x1, z1, -1, -1), (x0, z1, 1, -1)):
                rx, rz = x + sx * 0.016, z + sz * 0.016
                at.dome('rivet', rx, rz, 0.0045, 0.0, var)
                if rng.random() < 0.2:
                    at.dome('rivet', rx + sx * 0.011, rz, 0.0038, 0.0, var)


# ------------------------------------------------------------ le fond de cuve
RAILS = (0.24, 0.745)       # le milieu des deux rails à voyants, relevés sur l'ancien


def rail(at, zc):
    """un rail horizontal : deux plats rivetés, une gorge, trois voyants"""
    h = 0.032
    # les deux plats courent d'un bord à l'autre SANS biseau ('plat') : biseauté,
    # leur bout marquait une encoche au bord du carreau, là où la copie reprend
    at.boite('plat', -0.01, 1.01, zc + h * 0.55, zc + h * 1.6, -0.006, FOND_Y, 0.3)
    at.boite('plat', -0.01, 1.01, zc - h * 1.6, zc - h * 0.55, -0.006, FOND_Y, 0.3)
    at.boite('fond', -0.01, 1.01, zc - h * 0.55, zc + h * 0.55, 0.004, FOND_Y, 0)
    for k in range(32):
        x = (k + 0.5) / 32
        at.dome('rivet', x, zc + h * 1.08, 0.0032, -0.006, 0)
        at.dome('rivet', x, zc - h * 1.08, 0.0032, -0.006, 0)
    # les fentes de la gorge, et les voyants dans trois d'entre elles
    for k in range(6):
        x0 = k / 6 + 0.012
        at.boite('rail', x0, x0 + 1 / 6 - 0.024, zc - h * 0.32, zc + h * 0.32, -0.002, 0.004, -0.4)
        if k % 2 == 0:
            at.boite('voyant', x0 + 0.04, x0 + 0.1, zc - h * 0.1, zc + h * 0.1, -0.0035, -0.002, 0)


def grille(at, x0, x1, z0, z1, var):
    at.boite('panneau', x0, x1, z0, z1, -0.002, FOND_Y, var)
    n = max(3, round((z1 - z0 - 0.02) / 0.016))
    for i in range(n):
        z = z0 + 0.012 + (z1 - z0 - 0.024) * (i + 0.5) / n
        at.boite('fond', x0 + 0.012, x1 - 0.012, z - 0.004, z + 0.004, -0.0025, -0.001, 0)


def panneau_cadre(at, x0, x1, z0, z1, var, rng):
    """un panneau : sa plaque, un cadre en relief, ses rivets ; parfois une
    grille d'aération dans un coin"""
    g = JEU / 2
    x0, x1, z0, z1 = x0 + g, x1 - g, z0 + g, z1 - g
    at.boite('panneau', x0, x1, z0, z1, 0.0, FOND_Y, var)
    m = 0.012
    at.boite('panneau', x0, x1, z1 - m, z1, -0.004, 0.0, var)
    at.boite('panneau', x0, x1, z0, z0 + m, -0.004, 0.0, var)
    at.boite('panneau', x0, x0 + m, z0 + m, z1 - m, -0.004, 0.0, var)
    at.boite('panneau', x1 - m, x1, z0 + m, z1 - m, -0.004, 0.0, var)
    for (x, z) in ((x0 + 0.02, z0 + 0.02), (x1 - 0.02, z0 + 0.02), (x1 - 0.02, z1 - 0.02), (x0 + 0.02, z1 - 0.02)):
        at.dome('rivet', x, z, 0.004, -0.004, var)
    w, h = x1 - x0, z1 - z0
    if w > 0.14 and h > 0.12 and rng.random() < 0.35:
        gx = x0 + 0.03 if rng.random() < 0.5 else x1 - 0.03 - 0.11
        gz = z1 - 0.03 - 0.06
        grille(at, gx, gx + 0.11, gz, gz + 0.06, var)


def faisceau(at, z, x0, xc, zb, r=0.0075):
    """trois conduites côte à côte, à l'horizontale de x0 à xc, puis un coude
    qui descend jusqu'à zb — et des colliers"""
    for k in range(3):
        dz = (k - 1) * 0.018
        R = 0.035 + dz
        at.fut('tuyau', x0, xc - R, r, 0, -0.012, z + dz)
        prev = Vector((xc - R, -0.012, z + dz))
        for i in range(1, 9):
            t = (math.pi / 2) * i / 8
            p = Vector((xc - R + R * math.sin(t), -0.012, z + dz - R + R * math.cos(t)))
            at.tube('tuyau', prev, p, r, seg=12)
            prev = p
        at.tube('tuyau', prev, (prev.x, -0.012, zb), r, seg=12)
    for x in (x0 + 0.06, x0 + 0.26, x0 + 0.42):
        if x < xc - 0.06:
            at.boite('rail', x - 0.008, x + 0.008, z - 0.034, z + 0.034, -0.024, -0.004, 0)


def cuve(at, rng):
    for zc in RAILS:
        rail(at, zc)
    # les bandes entre les rails : panneaux encadrés, une gorge verticale
    # rainurée (un rythme qui ne suit pas les panneaux)
    bandes = [(RAILS[0] + 0.052, RAILS[1] - 0.052), (RAILS[1] + 0.052, RAILS[0] + 1 - 0.052)]
    coutures = [((0.27, 0.36, 0.39, 0.60, 0.80, 0.86), (0.0, 0.42, 1.0)),
                ((0.0, 0.25, 0.31, 0.47, 0.70), (0.0, 0.55, 1.0))]
    for (b0, b1), (cx, fz) in zip(bandes, coutures):
        H = b1 - b0
        for (x0, x1) in rangee(cx):
            if x1 - x0 < 0.08:
                # une gorge rainurée verticale
                at.boite('fond', x0 + 0.004, x1 - 0.004, b0, b1, 0.006, FOND_Y, 0)
                n = int(H / 0.008)
                for k in range(n):
                    z = b0 + (k + 0.5) * H / n
                    at.boite('lame', x0 + 0.012, x1 - 0.012, z - 0.0018, z + 0.0018, 0.002, 0.006, 0)
                continue
            # chaque plaque coupée en hauteur aux fractions fz
            for j in range(len(fz) - 1):
                z0, z1 = b0 + H * fz[j], b0 + H * fz[j + 1]
                panneau_cadre(at, x0, x1, z0, z1, rng.uniform(-1, 1), rng)
    # les faisceaux de conduites, l'un en haut à droite, l'autre en bas à gauche
    faisceau(at, RAILS[1] + 0.16, 0.47, 0.97, RAILS[1] + 0.06)
    faisceau(at, RAILS[0] - 0.17, -0.03, 0.30, 0.04)


def surfaces():
    vide_scene()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_biome()
    # le mur : un acier bleu nuit brossé (l'ancien mesurait 0,17 de luminance)
    # (premier essai à 1c242e / 3a4654 : 0,126 de luminance, trop sombre)
    mats['panneau'] = mat_brosse('mur', (0x26, 0x30, 0x3c), (0x4c, 0x5a, 0x6a), 31, brosse=0.12)
    mats['rivet'] = mats['panneau']
    mats['fond'] = mat_simple('fond', (0x05, 0x07, 0x09), rug=0.9)
    mats['rail'] = mat_brosse('rail', (0x18, 0x24, 0x2a), (0x30, 0x40, 0x48), 33, brosse=0.05)
    mats['plat'] = mats['rail']
    mats['voyant'] = mat_simple('voyant', (0x10, 0x40, 0x40), rug=0.3, emission=(0x5a, 0xf0, 0xe0), force=3.0)
    carreau(sc, mats, 'wall', mur)
    # le fond de cuve : plus sombre, plus sarcelle (l'ancien : 0,11)
    mats_cuve = dict(mats)
    mats_cuve['panneau'] = mat_brosse('cuve', (0x10, 0x1a, 0x20), (0x24, 0x32, 0x3a), 37, brosse=0.04, rouille=(0x22, 0x2a, 0x2a))
    mats_cuve['rivet'] = mats_cuve['panneau']
    carreau(sc, mats_cuve, 'tank-bg', cuve)
    lumiere_camera(sc)
    sc.cycles.device = 'GPU'
