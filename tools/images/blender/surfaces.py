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
    surfaces() ; lance(['wall', 'wall-a', 'phile', 'phobe'], SORTIE, 384)
    (sous lumière neutre, avec la passe de relief : relief.py les monte)
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


def carreau(sc, mats, nom, bati, extra=None, relief=False):
    """un carreau : `bati(at, rng)` pose la géométrie dans [0,1]², les huit
    copies l'entourent, la caméra cadre le carreau et sa marge ; `extra(C,
    mats)` y ajoute ce que l'atelier ne sait pas faire (un texte)"""
    P = parent(sc, nom)
    C = sous(P, nom + '-carreau')
    at = Atelier()
    bati(at, random.Random(len(nom) * 97))
    at.objets(C, mats, {'panneau': 0.0022, 'peinture': 0.0022, 'rail': 0.0016, 'lame': 0.0006, 'plat': 0.0012}, prefixe=nom)
    if extra:
        extra(C, mats)
    fond(P, mats)
    copies(P, C, [(dx, dz) for dx in (-1, 0, 1) for dz in (-1, 0, 1) if dx or dz])
    declare(nom, P, 0, 1, 0, 1, mx=MARGE, mz=MARGE, alpha=False, relief=relief)


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
# LA PAROI DU FOND DE LA CUVE D'ESSAI (13/11, deuxième version). La première
# reprenait l'ancien dessin généré — des panneaux plats barrés de deux rails —
# et rien n'y disait qu'on était dans une cuve : on aurait dit un mur de plus,
# plus sombre. Celle-ci est une OSSATURE : deux montants en I par carreau, une
# traverse, et entre eux des baies en retrait qui portent chacune un
# équipement de banc d'essai — un hublot d'inspection, une réglette graduée,
# un évent, un boîtier de mesure, deux conduites qui courent d'un bord à
# l'autre. Le carreau couvre 900 unités de jeu : un montant toutes les 450,
# assez rare pour ne pas faire grille avec la trame de mesure du shader
# (100 et 500 unités), assez proche pour que toute cuve en montre deux.
#
# Ce que le fond doit rester (assets-ia §18b) : PLUS SOMBRE QUE LES PAROIS
# (luminance visée 0,10 à 0,15 ; le mur mesure 0,15), sans chaud, sans
# contraste fort — l'eau passe devant et doit se lire dessus.

MONTANTS = (0.0, 0.5)     # l'axe des deux montants en I
DEMI_MONTANT = 0.032
TRAVERSE = 0.0            # l'axe de la traverse, au bord bas du carreau
DEMI_TRAVERSE = 0.026
CONDUITES = (0.405, 0.442)  # les deux conduites qui traversent le carreau


def grille(at, x0, x1, z0, z1, var):
    at.boite('panneau', x0, x1, z0, z1, -0.002, FOND_Y, var)
    n = max(3, round((z1 - z0 - 0.02) / 0.016))
    for i in range(n):
        z = z0 + 0.012 + (z1 - z0 - 0.024) * (i + 0.5) / n
        at.boite('fond', x0 + 0.012, x1 - 0.012, z - 0.004, z + 0.004, -0.0025, -0.001, 0)


def panneau_cadre(at, x0, x1, z0, z1, var, rng, evente=True):
    """un panneau : sa plaque, un cadre en relief, ses rivets ; parfois une
    grille d'aération dans un coin (pas dans une baie qui porte déjà son
    équipement : evente=False)"""
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
    if evente and w > 0.14 and h > 0.12 and rng.random() < 0.35:
        gx = x0 + 0.03 if rng.random() < 0.5 else x1 - 0.03 - 0.11
        gz = z1 - 0.03 - 0.06
        grille(at, gx, gx + 0.11, gz, gz + 0.06, var)


def montant(at, xc):
    """un montant en I vu de face : l'âme en retrait, deux semelles devant,
    une file de boulons sur chaque semelle"""
    h = DEMI_MONTANT
    at.boite('rail', xc - h * 0.55, xc + h * 0.55, -0.01, 1.01, -0.006, FOND_Y, 0.2)
    for s in (-1, 1):
        x0, x1 = sorted((xc + s * h * 0.55, xc + s * h))
        at.boite('plat', x0, x1, -0.01, 1.01, -0.02, FOND_Y, 0.4)
    for k in range(16):
        z = (k + 0.5) / 16
        for s in (-1, 1):
            at.dome('rivet', xc + s * h * 0.78, z, 0.0042, -0.02, 0.4)


def traverse(at):
    """la traverse : une poutre couchée entre les montants, un cran en retrait
    d'eux (ils passent devant), un plat d'appui dessus et dessous"""
    h = DEMI_TRAVERSE
    zc = TRAVERSE
    at.boite('rail', -0.01, 1.01, zc - h, zc + h, -0.012, FOND_Y, -0.2)
    at.boite('plat', -0.01, 1.01, zc + h, zc + h + 0.008, -0.016, FOND_Y, 0.3)
    at.boite('plat', -0.01, 1.01, zc - h - 0.008, zc - h, -0.016, FOND_Y, 0.3)
    for k in range(24):
        x = (k + 0.5) / 24
        at.dome('rivet', x, zc, 0.0036, -0.012, -0.2)


def baie(at, x0, x1, z0, z1, coutures, rng):
    """le fond d'une baie : des plaques à cadre, coupées en hauteur aux
    fractions données — le décor de la baie se pose dessus"""
    for j in range(len(coutures) - 1):
        za = z0 + (z1 - z0) * coutures[j]
        zb = z0 + (z1 - z0) * coutures[j + 1]
        panneau_cadre(at, x0, x1, za, zb, rng.uniform(-1, 1), rng, evente=False)


def hublot(at, x, z, r):
    """le hublot d'inspection : une couronne boulonnée, un verre sombre en
    retrait — l'œil par lequel on regarde dans la cuve d'à côté"""
    at.anneau('plat', x, z, r * 1.32, r * 0.98, -0.022, 0.004, 0.3, seg=64)
    at.anneau('rail', x, z, r * 1.0, r * 0.9, -0.012, 0.004, 0.0, seg=64)
    # la lueur de l'eau voisine, sous un verre poli : opaque et noir, le
    # hublot se lisait comme une simple couronne (essai 1) ; un verre qui
    # transmet sortait gris uni (essai 2) — le verre est donc la lueur même
    # (devant la plaque de la baie, dont la face est à 0 : derrière, il
    # disparaissait, essai 4)
    at.disque('lueur', x, z, r * 0.92, -0.007, -0.003, 0.0, seg=64)
    at.boulons(x, z, r * 1.17, 16, -0.022, rr=0.0042, var=0.3, phase=0.5)


def reglette(at, x, z0, z1):
    """une réglette graduée, le long d'un montant : la cuve est un instrument
    de mesure (le shader y trace déjà sa trame). Un trait par quarantième,
    long tous les cinq et tous les dix"""
    at.boite('plat', x, x + 0.03, z0, z1, -0.008, 0.0, -0.5)
    n = 40
    for k in range(n + 1):
        z = z0 + 0.01 + (z1 - z0 - 0.02) * k / n
        long = 0.022 if k % 10 == 0 else (0.015 if k % 5 == 0 else 0.009)
        at.boite('trait', x + 0.004, x + 0.004 + long, z - 0.0011, z + 0.0011, -0.0095, -0.007, 0)


def boitier(at, x0, x1, z0, z1, rng):
    """un boîtier de mesure : une caisse en saillie, une fenêtre d'afficheur
    éteinte, trois voyants dont un seul allumé"""
    at.boite('panneau', x0, x1, z0, z1, -0.02, 0.0, rng.uniform(-1, 1))
    m = 0.01
    at.boite('fond', x0 + m * 2, x1 - m * 2, z1 - 0.06, z1 - 0.022, -0.0215, -0.019, 0)
    at.boite('ecran', x0 + m * 2.4, x1 - m * 2.4, z1 - 0.057, z1 - 0.025, -0.022, -0.0205, 0)
    for i, mat in enumerate(('voyant', 'eteint', 'eteint')):
        at.cylindre(mat, x0 + 0.03 + i * 0.026, z0 + 0.026, 0.0065, -0.026, -0.02, 0, seg=20)
    for (x, z) in ((x0 + 0.012, z0 + 0.012), (x1 - 0.012, z0 + 0.012), (x1 - 0.012, z1 - 0.012), (x0 + 0.012, z1 - 0.012)):
        at.dome('rivet', x, z, 0.0035, -0.02, 0)


def conduites(at):
    """deux conduites qui traversent tout le carreau (elles se raccordent à
    elles-mêmes au bord), des brides à mi-baie, un collier sur chaque montant"""
    for i, z in enumerate(CONDUITES):
        r = 0.011 if i == 0 else 0.0085
        at.fut('tuyau', -0.02, 1.02, r, 0, -0.034, z)
        for xb in (0.25, 0.75):
            at.anneau('tuyau', xb, z, r * 1.55, r * 0.6, -0.034 - r * 1.1, -0.034 + r * 1.1, 0, seg=32)
    for xc in MONTANTS:
        at.boite('plat', xc - 0.012, xc + 0.012, CONDUITES[0] - 0.024, CONDUITES[1] + 0.02, -0.05, -0.02, 0.3)


def mat_lueur():
    """le hublot : un verre poli presque noir (le soleil du haut y pose son
    reflet) qui laisse monter la lueur sarcelle de l'eau voisine, ondoyante"""
    mat = mat_simple('lueur', (0x02, 0x08, 0x0a), rug=0.3, emission=(0x2a, 0x8a, 0x96), force=0.35)
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    b = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
    # le soleil « de face » frappe le disque d'aplomb et revient droit dans
    # la caméra : poli et à plein spéculaire, le hublot sortait gris clair
    # (essais 2 et 6) — un reflet faible et étalé suffit à dire « verre »
    for nom in ('Specular IOR Level', 'Specular'):
        if nom in b.inputs:
            b.inputs[nom].default_value = 0.08
            break
    ondes = bruit_tore(nt, 6, 6, 41, detail=3, rugo=0.5)
    # (à 0,7 – 2,1 le hublot sortait en lampe cyan, essai 5)
    L.new(op(nt, 'MULTIPLY_ADD', ondes, 0.36, 0.08), b.inputs['Emission Strength'])
    return mat


def marquage(C, mats):
    """le numéro de la cuve, peint au pochoir sur la plaque basse de la baie
    du hublot — « 21 » : c'est le sujet qu'on y essaie"""
    for corps, taille, z in (('CUVE 21', 0.044, 0.19), ('ESSAI · NE PAS VIDANGER', 0.016, 0.145)):
        cu = bpy.data.curves.new('marquage', 'FONT')
        cu.body = corps
        cu.size = taille
        cu.align_x = 'CENTER'
        cu.extrude = 0.0004
        cu.space_character = 1.15
        ob = bpy.data.objects.new('tank-bg-marquage', cu)
        # le texte se pose dans XY ; tourné d'un quart autour de X, il se
        # dresse dans le plan du mur et regarde la caméra (-Y)
        ob.rotation_euler = (math.pi / 2, 0, 0)
        ob.location = (0.235, -0.0015, z)
        ob.data.materials.append(mats['trait'])
        C.objects.link(ob)


def cuve(at, rng):
    for xc in MONTANTS:
        montant(at, xc)
    traverse(at)
    bas = TRAVERSE + DEMI_TRAVERSE + 0.008
    haut = TRAVERSE + 1 - DEMI_TRAVERSE - 0.008
    gA = (MONTANTS[0] + DEMI_MONTANT, MONTANTS[1] - DEMI_MONTANT)
    gB = (MONTANTS[1] + DEMI_MONTANT, MONTANTS[0] + 1 - DEMI_MONTANT)
    # la baie du hublot : la réglette contre le montant de droite
    baie(at, gA[0], gA[1], bas, haut, (0.0, 0.36, 0.40, 1.0), rng)
    hublot(at, (gA[0] + gA[1]) / 2 - 0.02, 0.70, 0.105)
    reglette(at, gA[1] - 0.042, 0.50, 0.94)
    # la baie de l'évent : un grand évent à lames en haut, le boîtier en bas
    baie(at, gB[0], gB[1], bas, haut, (0.0, 0.34, 0.40, 1.0), rng)
    grille(at, gB[0] + 0.05, gB[1] - 0.05, 0.56, 0.90, 0.2)
    boitier(at, gB[0] + 0.04, gB[0] + 0.17, 0.10, 0.28, rng)
    conduites(at)


# ------------------------------------------- les parois hydrophile et hydrophobe
# Les deux matières que le joueur apprend à lire : l'une ATTIRE l'eau
# (turquoise, mouillée, brillante — le shader y fait glisser un reflet),
# l'autre la REPOUSSE (violette, cireuse — l'eau y perle). Les anciennes
# sortaient du générateur et montraient leur couture (prepare.py --audit du
# 13/11 : phile 1,8 / 1,6, phobe 2,3 / 2,5) ; ici, tout le grain est pris sur
# le tore, les perles sont semées en distance PÉRIODIQUE et le carreau a ses
# huit copies : le raccord vient par construction. Luminance gardée sur les
# anciennes (0,15 et 0,16) : le shader les assombrit déjà (×0,85 à ×1,1 pour
# l'une, ×0,75 pour l'autre).

def mat_phile():
    """une céramique sarcelle sous un film d'eau : des marbrures larges, des
    pores sombres, une surface polie que le film ride (le relief seul)"""
    mat = bpy.data.materials.new('phile')
    nt, N, L = noeuds(mat)
    out = N.new('ShaderNodeOutputMaterial')
    b = N.new('ShaderNodeBsdfPrincipled')
    L.new(b.outputs[0], out.inputs[0])
    marbre = bruit_tore(nt, 2.5, 2.5, 51, detail=5, rugo=0.55)
    c = melange(nt, rampe(nt, marbre, 0.3, 0.75), lin((0x03, 0x17, 0x1a)), lin((0x09, 0x34, 0x38)))
    pores = bruit_tore(nt, 70, 70, 52, detail=4, rugo=0.6)
    c = melange(nt, op(nt, 'MULTIPLY', rampe(nt, pores, 0.64, 0.72), 0.5), c, lin((0x02, 0x0e, 0x12)))
    L.new(c, b.inputs['Base Color'])
    # LE FILM D'EAU : des vagues franches sous un poli de miroir — seules
    # les crêtes tournées vers la caméra renvoient le soleil de face, en
    # éclats, et le reste plonge dans le sarcelle. Un frisson fin renvoyait
    # ce soleil en grésil gris (essai 1, 0,33 de luminance) ; un film doux à
    # demi poli, en voile gris uniforme (essai 2, 0,31) ; des vagues trop
    # fouillées (six octaves), en granit pailleté (essai 3)
    b.inputs['Roughness'].default_value = 0.1
    # (et des pentes trop raides, en pluie d'éclats, essai 4 ; trop douces,
    # le soleil de face se mirait partout : 0,45, essai 5). Le soleil de
    # face, renvoyé d'aplomb, est le piège de toute matière polie ici : un
    # reflet blanc sur des pentes moyennes faisait un camouflage gris et
    # noir (essai 6). Le reflet est donc TEINTÉ (à demi métallique, comme
    # un émail) : là où le film regarde la caméra, il luit sarcelle
    b.inputs['Metallic'].default_value = 0.7
    b.inputs['Roughness'].default_value = 0.16
    # la part non métallique renvoie du blanc : bridée, sinon la luminance
    # restait à 0,23 quelle que soit la teinte (essai 8)
    for nom in ('Specular IOR Level', 'Specular'):
        if nom in b.inputs:
            b.inputs[nom].default_value = 0.12
            break
    rides = bruit_tore(nt, 2.5, 2.5, 53, detail=1.5, rugo=0.35)
    bump = N.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 1.0
    bump.inputs['Distance'].default_value = 0.008
    L.new(rides, bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat


def mat_phobe():
    """une cire violette : mate, une peau d'orange fine, des voiles plus
    clairs là où la couche est épaisse"""
    mat = bpy.data.materials.new('phobe')
    nt, N, L = noeuds(mat)
    out = N.new('ShaderNodeOutputMaterial')
    b = N.new('ShaderNodeBsdfPrincipled')
    L.new(b.outputs[0], out.inputs[0])
    voile = bruit_tore(nt, 2.0, 2.0, 61, detail=4, rugo=0.5)
    c = melange(nt, rampe(nt, voile, 0.3, 0.75), lin((0x26, 0x17, 0x34)), lin((0x4a, 0x30, 0x5e)))
    L.new(c, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.55
    # un martelé large (la cire coulée en couche inégale) et une peau
    # d'orange fine dessus
    martele = bruit_tore(nt, 14, 14, 63, detail=2, rugo=0.4)
    peau = bruit_tore(nt, 55, 55, 62, detail=3, rugo=0.5)
    bump = N.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.5
    bump.inputs['Distance'].default_value = 0.003
    L.new(op(nt, 'ADD', martele, op(nt, 'MULTIPLY', peau, 0.3)), bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat


def bati_phile(at, rng):
    # la plaque tient JUSTE le carreau : débordant de 0,01, elle se
    # superposait à ses copies et le bord sortait en liseré sombre (essai 1)
    at.boite('phile', 0.0, 1.0, 0.0, 1.0, 0.0, FOND_Y, 0)


def perles(rng, n, rmin, rmax, essais=6000):
    """des perles qui ne se touchent pas, semées en distance PÉRIODIQUE (une
    perle au bord se mesure aussi à celles de l'autre bord) — la plupart
    petites, quelques grosses (une loi en puissance sur le rayon)"""
    pts = []
    for _ in range(essais):
        if len(pts) >= n:
            break
        x, z = rng.random(), rng.random()
        r = rmin + (rmax - rmin) * rng.random() ** 3
        ok = True
        for (a, c, q) in pts:
            dx = min(abs(x - a), 1 - abs(x - a))
            dz = min(abs(z - c), 1 - abs(z - c))
            if dx * dx + dz * dz < (r + q + 0.004) ** 2:
                ok = False
                break
        if ok:
            pts.append((x, z, r))
    return pts


def bati_phobe(at, rng):
    at.boite('phobe', 0.0, 1.0, 0.0, 1.0, 0.0, FOND_Y, 0)
    # l'eau perle : des gouttes presque rondes (l'angle de contact d'une
    # surface qui repousse), posées sur la cire
    for (x, z, r) in perles(rng, 260, 0.0035, 0.022):
        at.dome('goutte', x, z, r, 0.0, 0, aplati=0.75)


# ------------------------------------------------------- la seconde paroi
# wall-a : la paroi qui alterne avec le mur sur les longs murs (le shader
# fond l'une dans l'autre selon un bruit très lent, à l'échelle 520 contre
# 230). Elle doit donc être PLUS FOUILLÉE que le mur, dans le même acier
# froid — c'est le relief qui rompt la répétition, pas la couleur. La mise
# en page et les panneaux sont ceux de la tôle de la chaufferie (dispose,
# plaque, nervures, trappe), sans ce qui y dit la chaleur : ni matelas, ni
# suie, ni veilleuse ambre.

def bati_wall_a(at, rng):
    g = JEU / 2
    for (x0, x1, z0, z1, sorte) in dispose(rng, [0.2, 0.26, 0.18, 0.36], [0.16, 0.22, 0.3, 0.4]):
        w, h = x1 - x0, z1 - z0
        a = (x0 + g, x1 - g, z0 + g, z1 - g)
        yf = rng.choice((0.0, 0.0, -0.003, -0.006))
        var = rng.uniform(-1, 1)
        t = rng.random()
        if sorte is None and t < 0.2 and w >= 0.16:
            nervures(at, *a, yf, var)
        elif sorte is None and t < 0.34 and w >= 0.14 and h >= 0.14:
            trappe(at, *a, yf, var)
        elif sorte is None and t < 0.48 and w >= 0.2 and h >= 0.16:
            plaque(at, *a, yf, var)
            grille(at, a[0] + 0.03, a[1] - 0.03, a[2] + 0.03, a[3] - 0.03, var)
        else:
            plaque(at, *a, yf, var)
            # une plaque nue sur deux porte un petit équipement : sans eux, la
            # paroi sortait plus propre et plus sage que le mur (essai 1)
            if w >= 0.1 and h >= 0.1 and rng.random() < 0.55:
                petit_equipement(at, *a, yf, var, rng)
    # deux faisceaux de conduites verticales, qui font le tour du carreau
    for xc in (rng.uniform(0.05, 0.4), rng.uniform(0.55, 0.9)):
        for k, dx in enumerate((-0.011, 0.011)):
            at.tube('tuyau', (xc + dx, -0.016, -0.02), (xc + dx, -0.016, 1.02), 0.0075, seg=16)
        for i in range(4):
            z = (i + 0.5) / 4 + rng.uniform(-0.04, 0.04)
            at.boite('lame', xc - 0.024, xc + 0.024, z - 0.007, z + 0.007, -0.026, -0.006, 0)


def petit_equipement(at, x0, x1, z0, z1, yf, var, rng):
    """un boîtier de raccordement, ou des fentes d'aération, dans un coin de
    la plaque"""
    if rng.random() < 0.5:
        bw, bh = min(0.08, (x1 - x0) * 0.5), min(0.06, (z1 - z0) * 0.5)
        bx = x0 + 0.02 if rng.random() < 0.5 else x1 - 0.02 - bw
        bz = z0 + 0.02 if rng.random() < 0.5 else z1 - 0.02 - bh
        at.boite('peinture', bx, bx + bw, bz, bz + bh, yf - 0.01, yf, var)
        at.boite('fond', bx + 0.008, bx + bw - 0.008, bz + bh - 0.016, bz + bh - 0.01, yf - 0.0105, yf - 0.009, 0)
    else:
        n = rng.randint(3, 5)
        sx = x0 + 0.025
        sz = z1 - 0.03
        for i in range(n):
            z = sz - i * 0.012
            at.boite('fond', sx, sx + min(0.07, (x1 - x0) * 0.45), z - 0.0025, z + 0.0025, yf - 0.0005, yf + 0.002, 0)


def gouttes_lisses(C, mats):
    """les gouttes en facettes de dix sur six se lisaient comme des clous :
    lissées, elles prennent un reflet rond"""
    for ob in C.objects:
        if ob.name.endswith('goutte'):
            ob.data.polygons.foreach_set('use_smooth', [True] * len(ob.data.polygons))


def surfaces(neutre=True):
    """neutre (14/11) : la lumière neutre et la passe de relief, pour ce que
    les lampes du jeu éclairent ; le fond de cuve, que le shader n'éclaire
    pas (il est sous l'eau, derrière tout), garde son soleil peint et ne se
    re-rend qu'avec surfaces(neutre=False)"""
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
    carreau(sc, mats, 'wall', mur, relief=neutre)
    # le fond de cuve : plus sombre, plus sarcelle (l'ancien : 0,11)
    mats_cuve = dict(mats)
    mats_cuve['panneau'] = mat_brosse('cuve', (0x10, 0x1a, 0x20), (0x24, 0x32, 0x3a), 37, brosse=0.04, rouille=(0x22, 0x2a, 0x2a))
    mats_cuve['rivet'] = mats_cuve['panneau']
    # les semelles des montants, un cran plus claires que l'âme : à la même
    # teinte, l'ossature ne se lisait pas (essai 1)
    mats_cuve['plat'] = mat_brosse('semelle', (0x1e, 0x2a, 0x32), (0x3a, 0x4a, 0x54), 39, brosse=0.08)
    # derrière le hublot, l'eau de la cuve voisine : une lueur sarcelle —
    # assez faible pour rester sous la luminance des parois
    mats_cuve['lueur'] = mat_lueur()
    # l'afficheur éteint : mat (poli, il renvoyait le soleil du haut et
    # sortait gris clair, essai 1)
    mats_cuve['ecran'] = mat_simple('ecran', (0x04, 0x0a, 0x0c), rug=0.45)
    # les traits de la réglette et le marquage : le cyan de la charte, terni
    mats_cuve['trait'] = mat_simple('trait', (0x2c, 0x5a, 0x6a), rug=0.6)
    mats_cuve['eteint'] = mat_simple('eteint', (0x0c, 0x18, 0x1a), rug=0.3)
    carreau(sc, mats_cuve, 'tank-bg', cuve, extra=marquage)
    mats['phile'] = mat_phile()
    carreau(sc, mats, 'phile', bati_phile, relief=neutre)
    mats['phobe'] = mat_phobe()
    # la goutte : une eau claire teintée par la cire dessous, polie — c'est
    # son reflet qui la dessine
    mats['goutte'] = mat_simple('goutte', (0x3c, 0x2c, 0x52), rug=0.04)
    carreau(sc, mats, 'phobe', bati_phobe, extra=gouttes_lisses, relief=neutre)
    # la seconde paroi : l'acier du mur, un rien plus vert et plus usé
    # (l'ancienne mesurait 0,17 de luminance ; à 223032 / 46585a, 0,137 :
    # plus sombre que le mur, elle s'y lisait en tache)
    mats_a = dict(mats)
    mats_a['peinture'] = mat_brosse('paroi-a', (0x27, 0x36, 0x38), (0x50, 0x63, 0x65), 43, brosse=0.08, rouille=(0x2c, 0x32, 0x2c))
    mats_a['rivet'] = mats_a['panneau'] = mats_a['peinture']
    carreau(sc, mats_a, 'wall-a', bati_wall_a, relief=neutre)
    (lumiere_neutre if neutre else lumiere_camera)(sc)
    sc.cycles.device = 'GPU'
