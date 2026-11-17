"""LES STATIONS DU HUB (17/11) — cinq pièces de machinerie pour le module
Méduse (docs/assets-ia.md §20).

Le hub est le tableau le plus joué, et ses stations (celles du tableau des
avaries) n'y étaient que des plots nus. Ce sont des DÉCALQUES que l'admin pose
dans l'éditeur (groupe « Décor ») — le hub va changer, la mise en scène lui
revient ; le moteur assombrit une pièce posée près d'une station en panne.
Une seule image par pièce, donc, en état de marche.

Même famille que l'écran de contrôle et la vanne : vue de FACE
orthographique, détourée, sans ombre au sol ; l'acier de l'atelier (celui de
la chaufferie et des équipements de coque, chaud_biome.py), aucun texte ni
chiffre, cadrans vierges ; le sarcelle de la charte en liseré seulement,
l'ambre en veilleuse seulement.

Chaque pièce : z = 0 son pied, x = 0 son axe, l'avant en y négatif, en
largeurs de salle (1 = 1024 px) — les tailles sont celles que §20 demande :
  hub-eclairage     1024 × 1024   l'armoire de distribution, porte ouverte
  hub-table-depart  1536 × 512    la console basse à pupitre incliné
  hub-mur-records   1536 × 439    le panneau des compteurs à volets
  hub-bac-sable     1024 × 1024   le bac d'essai sur son bâti
  hub-distillateur  1024 × 1024   la colonne de distillation

Dans Blender :
    DOSSIER = r'...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\hub_stations.py', encoding='utf-8').read())
    stations() ; lance(list(PIECES), SORTIE, 384)
puis copier SORTIE/<nom>.png dans masters/images/ et lancer
tools/images/prepare.py <nom>.
"""
import bpy, bmesh, math, os, random
from mathutils import Matrix, Vector

_src = os.path.join(DOSSIER, 'chaud_biome.py')
exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

# (les noms portent déjà « hub- » : sans préfixe, sinon hub-hub-…, essai 1)
PREFIXE = ''

TAILLES = {
    'hub-eclairage': (1.0, 1.0),
    'hub-table-depart': (1.5, 0.5),
    'hub-mur-records': (1.5, 439 / 1024),
    'hub-bac-sable': (1.0, 1.0),
    'hub-distillateur': (1.0, 1.0),
}


# ------------------------------------------------------------ les matières
def specul_bride(mat, v=0.15):
    """un poli vu de face renvoie le soleil d'aplomb dans la caméra ortho :
    un voile gris (13/11) — le spéculaire est bridé"""
    b = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    for nom in ('Specular IOR Level', 'Specular'):
        if nom in b.inputs:
            b.inputs[nom].default_value = v
            break
    return mat


def mat_trame():
    """le plateau de la table à cartes : un vert-de-gris sombre, une grille
    fine et pâle (la période se pose en coordonnées du monde)"""
    mat = mat_simple('trame', (0x16, 0x22, 0x26), rug=0.5)
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    b = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
    geo = N.new('ShaderNodeNewGeometry')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(geo.outputs['Position'], sep.inputs[0])

    def ligne(axe, pas, ep):
        f = op(nt, 'FRACT', op(nt, 'MULTIPLY', sep.outputs[axe], 1 / pas))
        return op(nt, 'LESS_THAN', op(nt, 'ABSOLUTE', op(nt, 'SUBTRACT', f, 0.5)), ep)
    trait = op(nt, 'MAXIMUM', op(nt, 'SUBTRACT', 1.0, ligne('X', 0.03, 0.44)), op(nt, 'SUBTRACT', 1.0, ligne('Z', 0.03, 0.44)))
    c = melange(nt, op(nt, 'MULTIPLY', trait, 0.55), lin((0x16, 0x22, 0x26)), lin((0x4e, 0x6a, 0x70)))
    L.new(c, b.inputs['Base Color'])
    return mat


def matieres_hub():
    mats = matieres_biome()
    mats['laiton'] = mat_simple('laiton', (0x8a, 0x6c, 0x34), rug=0.38, metal=0.85)
    mats['cuivre'] = mat_simple('cuivre', (0x7a, 0x48, 0x30), rug=0.42, metal=0.85)
    mats['cadran'] = specul_bride(mat_simple('cadran', (0xb4, 0xb8, 0xb0), rug=0.55))
    mats['aiguille'] = mat_simple('aiguille', (0x14, 0x16, 0x18), rug=0.5)
    mats['ceramique'] = specul_bride(mat_simple('ceramique', (0xc8, 0xc4, 0xb8), rug=0.35))
    mats['plaque'] = mat_simple('plaque', (0x6e, 0x76, 0x7e), rug=0.4, metal=0.6)
    mats['caoutchouc'] = mat_simple('caoutchouc', (0x12, 0x13, 0x15), rug=0.75)
    mats['cable'] = mat_simple('cable', (0x1a, 0x1c, 0x20), rug=0.65)
    mats['fenetre'] = mat_simple('fenetre', (0x07, 0x09, 0x0b), rug=0.3)
    mats['volet'] = mat_simple('volet', (0x22, 0x25, 0x28), rug=0.45)
    mats['verre'] = specul_bride(mat_simple('verre', (0x1e, 0x2e, 0x38), rug=0.08, metal=0.3))
    # le distillat : le bleu pâle de §20e, qui semble luire sans briller —
    # une pointe de lueur propre (un verre transmissif sortait gris uni, 13/11)
    mats['liquide'] = specul_bride(mat_simple('liquide', (0x6c, 0xa8, 0xc4), rug=0.12, emission=(0xa7, 0xdd, 0xf5), force=0.35), 0.12)
    mats['eau'] = specul_bride(mat_simple('eau', (0x1c, 0x5c, 0x78), rug=0.1, emission=(0x63, 0xb7, 0xe6), force=0.18))
    # la veilleuse ÉTEINTE de l'armoire : un verre ambre sombre, sans lueur
    mats['lampe'] = mat_simple('lampe', (0x3a, 0x22, 0x0a), rug=0.15)
    mats['reflet'] = mat_simple('reflet', (0xe6, 0xf2, 0xfa), rug=0.1, emission=(0xe6, 0xf2, 0xfa), force=0.6)
    mats['trame'] = mat_trame()
    return mats


BISEAU_HUB = dict(BISEAU, laiton=0.0015, plaque=0.001, volet=0.0008)


def pose(P, mats, at, prefixe, m):
    """bâtit les objets de `at` et les pose d'un bloc par la matrice `m` —
    la porte tournée sur sa charnière, le pupitre couché sur sa pente"""
    avant = set(P.objects)
    at.objets(P, mats, BISEAU_HUB, True, prefixe)
    for ob in set(P.objects) - avant:
        ob.matrix_world = m


MARGE_CADRE = 0.008   # 8 px de transparent tout autour


def declare_dans(nom, P, w, h):
    """déclare la pièce à sa taille exacte, son contenu RESSERRÉ d'une marge :
    une pièce qui touche le cadre (pieds au sol, câbles qui sortent) se lit
    coupée — prepare.py refuse au-delà de 5 % de bord plein (essai 1 : 7 à
    77 %). Mise à l'échelle uniforme autour du centre du cadre."""
    s = min((w - 2 * MARGE_CADRE) / w, (h - 2 * MARGE_CADRE) / h)
    m = Matrix.Translation((0, 0, h / 2)) @ Matrix.Scale(s, 4) @ Matrix.Translation((0, 0, -h / 2))
    for ob in P.objects:
        ob.matrix_world = m @ ob.matrix_world
    declare(nom, P, -w / 2, w / 2, 0, h)


# ------------------------------------------------------------ les organes
def cadran(at, x, z, r, y, angle=0.6):
    """un manomètre vierge : la couronne, le fond clair, l'aiguille, le pivot"""
    at.anneau('tuyau', x, z, r, r * 0.84, y - 0.006, y + 0.01, 0, seg=40)
    at.cylindre('cadran', x, z, r * 0.86, y - 0.002, y + 0.008, 0, seg=40)
    lg = r * 0.7
    at.tube('aiguille', (x, y - 0.006, z), (x + lg * math.cos(angle + 1.2), y - 0.006, z + lg * math.sin(angle + 1.2)),
            r * 0.035, seg=6, r2=r * 0.01)
    at.dome('rivet', x, z, r * 0.08, y - 0.008, 0)


def levier(at, x, z, y):
    """un interrupteur à levier : le socle, la manette relevée, sa poignée"""
    at.boite('lame', x - 0.045, x + 0.045, z - 0.06, z + 0.06, y - 0.04, y, -0.2)
    at.boite('peinture', x - 0.012, x + 0.012, z - 0.03, z + 0.02, y - 0.05, y - 0.04, 0)
    bout = (x, y - 0.11, z + 0.07)
    at.tube('tuyau', (x, y - 0.045, z - 0.01), bout, 0.008, seg=10)
    at.coussin('caoutchouc', bout[0], bout[2], 0.022, 0.014, 0.014, bout[1], 0)


def fusible(at, x, z, y, h=0.11):
    """une cartouche de céramique entre ses deux pinces"""
    at.tube('ceramique', (x, y, z - h / 2), (x, y, z + h / 2), 0.02, seg=20)
    for s in (-1, 1):
        at.tube('tuyau', (x, y, z + s * h / 2), (x, y, z + s * (h / 2 + 0.014)), 0.022, seg=20)
        zp = z + s * (h / 2 + 0.006)
        at.boite('lame', x - 0.028, x + 0.028, zp - 0.008, zp + 0.008, y - 0.006, y + 0.03, 0)


def volant(at, x, z, r, y):
    """un volant de vanne vu de face : la jante, trois rayons, le moyeu"""
    at.anneau('tuyau', x, z, r, r * 0.8, y - 0.008, y + 0.008, 0, seg=32)
    for k in range(3):
        a = math.pi / 2 + k * 2 * math.pi / 3
        at.tube('tuyau', (x, y, z), (x + r * 0.85 * math.cos(a), y, z + r * 0.85 * math.sin(a)), r * 0.08, seg=8)
    at.cylindre('peinture', x, z, r * 0.2, y - 0.01, y + 0.01, 0, seg=16)


def rivets_ligne(at, x0, x1, z, y, pas=0.03, r=0.0045, var=0.0):
    n = max(1, int((x1 - x0) / pas))
    for k in range(n + 1):
        at.dome('rivet', x0 + k * (x1 - x0) / n, z, r, y, var)


# ------------------------------------------------------------ les pièces
def eclairage(sc, mats):
    """§20a — L'ARMOIRE DE DISTRIBUTION, porte ouverte : leviers, fusibles,
    une veilleuse éteinte par rangée, plaques gravées vierges, le chemin de
    câbles qui part par le haut"""
    nom = 'hub-eclairage'
    P = parent(sc, nom)
    at = Atelier()
    w, h = TAILLES[nom]
    X0, X1, Z0, Z1 = -0.30, 0.40, 0.05, 0.84
    # le fond de l'armoire, sombre, et son cadre peint
    at.boite('lame', X0, X1, Z0, Z1, -0.01, 0.03, -0.3)
    for (a, b, c, d) in ((X0 - 0.035, X0, Z0 - 0.035, Z1 + 0.035), (X1, X1 + 0.035, Z0 - 0.035, Z1 + 0.035),
                         (X0, X1, Z0 - 0.035, Z0), (X0, X1, Z1, Z1 + 0.035)):
        at.boite('peinture', a, b, c, d, -0.12, 0.03, -0.4)
    rivets_ligne(at, X0 - 0.018, X1 + 0.018, Z1 + 0.018, -0.123, pas=0.05)
    rivets_ligne(at, X0 - 0.018, X1 + 0.018, Z0 - 0.018, -0.123, pas=0.05)
    # les trois rangées : leviers, fusibles, leviers ; une veilleuse éteinte
    # et une plaque gravée vierge à chacune
    rangs = (0.67, 0.45, 0.23)
    for i, z in enumerate(rangs):
        at.boite('lame', X0 + 0.03, X1 - 0.03, z - 0.095, z + 0.095, -0.025, -0.01, -0.6)
        if i == 1:
            for x in (-0.20, -0.11, -0.02, 0.07, 0.16, 0.25):
                fusible(at, x, z, -0.05)
        else:
            for x in (-0.17, -0.03, 0.11, 0.25):
                levier(at, x, z, -0.025)
        at.cylindre('tuyau', 0.35, z + 0.05, 0.02, -0.04, -0.02, 0, seg=20)
        at.dome('lampe', 0.35, z + 0.05, 0.014, -0.042, 0, aplati=0.7)
        at.boite('plaque', 0.31, 0.39, z - 0.06, z - 0.03, -0.035, -0.025, 0.1)
        for xr in (0.315, 0.385):
            at.dome('rivet', xr, z - 0.045, 0.003, -0.037, 0)
    # le chemin de câbles : un caniveau au-dessus, les câbles qui montent et
    # redescendent le long du fond vers leur rangée
    at.boite('peinture', X0 + 0.02, X1 - 0.02, Z1 + 0.035, Z1 + 0.07, -0.09, 0.0, -0.2)
    rng = random.Random(7)
    for k in range(9):
        x = -0.18 + k * 0.055
        top = (x * 0.8 + rng.uniform(-0.01, 0.01), -0.05, 1.0)
        at.tube('cable', (x, -0.05, Z1 + 0.07), top, 0.011, seg=10)
        at.tube('cable', (x, -0.015, Z1), (x, -0.015, rangs[k % 3] + 0.1), 0.006, seg=8)
    at.boite('peinture', -0.22, 0.28, Z1 + 0.07, Z1 + 0.09, -0.07, -0.03, 0)
    # le trait sarcelle sous l'armoire (la seule couleur de la pièce)
    at.boite('cyan', X0, X1, Z0 - 0.03, Z0 - 0.024, -0.124, -0.12, 0)
    at.objets(P, mats, BISEAU_HUB, True, nom)
    # LA PORTE, ouverte vers nous sur sa charnière gauche : bâtie fermée
    # (x de 0 à la largeur, la face intérieure en y > 0), tournée de −100°.
    # On en voit le chant et, de biais, la face intérieure et sa pochette.
    pt = Atelier()
    larg = X1 - X0 + 0.07
    pt.boite('peinture', 0.0, larg, Z0 - 0.035, Z1 + 0.035, -0.012, 0.012, 0.3)
    pt.boite('lame', 0.08, larg - 0.08, Z0 + 0.2, Z1 - 0.12, 0.012, 0.02, -0.4)
    pt.boite('plaque', 0.15, larg - 0.15, Z1 - 0.1, Z1 - 0.06, 0.012, 0.018, 0)
    pose(P, mats, pt, 'porte', Matrix.Translation((X0 - 0.035, -0.12, 0)) @ Matrix.Rotation(math.radians(-100), 4, 'Z'))
    declare_dans(nom, P, w, h)


def table_depart(sc, mats):
    """§20b — LA TABLE DE DÉPART : une console basse, son pupitre incliné aux
    manomètres vierges, la table à cartes, la main courante de laiton"""
    nom = 'hub-table-depart'
    P = parent(sc, nom)
    at = Atelier()
    w, h = TAILLES[nom]
    L = 0.70
    for x in (-L + 0.04, -0.2, 0.2, L - 0.04):
        at.boite('peinture', x - 0.035, x + 0.035, 0.0, 0.05, -0.09, 0.09, -0.4)
    at.boite('peinture', -L, L, 0.05, 0.30, -0.10, 0.10, -0.3)
    # la façade : trois panneaux et leurs joints, rivets haut et bas
    for x0, x1 in ((-L + 0.02, -0.25), (-0.23, 0.23), (0.25, L - 0.02)):
        at.boite('lame', x0, x1, 0.085, 0.265, -0.104, -0.1, -0.5)
    rivets_ligne(at, -L + 0.02, L - 0.02, 0.28, -0.103, pas=0.06)
    rivets_ligne(at, -L + 0.02, L - 0.02, 0.07, -0.103, pas=0.06)
    at.boite('cyan', -L + 0.01, L - 0.01, 0.055, 0.062, -0.104, -0.1, 0)
    # boutons rotatifs et interrupteurs sur la façade centrale
    for x in (-0.17, -0.09, -0.01):
        at.cylindre('caoutchouc', x, 0.19, 0.022, -0.13, -0.104, 0, seg=24)
        at.boite('aiguille', x - 0.003, x + 0.003, 0.19, 0.209, -0.132, -0.13, 0)
    for x in (0.07, 0.12, 0.17):
        at.boite('peinture', x - 0.014, x + 0.014, 0.17, 0.21, -0.11, -0.104, 0)
        at.tube('tuyau', (x, -0.11, 0.19), (x, -0.15, 0.215), 0.0055, seg=8)
    # la main courante de laiton, le long du bord avant
    at.tube('laiton', (-L - 0.01, -0.17, 0.315), (L + 0.01, -0.17, 0.315), 0.009, seg=16)
    for x in (-L + 0.05, -0.3, 0.3, L - 0.05):
        at.tube('laiton', (x, -0.17, 0.315), (x, -0.10, 0.28), 0.006, seg=10)
    # LE PUPITRE incliné à 30°, bâti à plat (x le long de la table, y le long
    # de la pente, z sa normale) puis couché sur son bord avant
    a = math.radians(30)
    m = Matrix.Translation((0, -0.10, 0.30)) @ Matrix(((1, 0, 0, 0), (0, math.cos(a), -math.sin(a), 0),
                                                     (0, math.sin(a), math.cos(a), 0), (0, 0, 0, 1)))
    pu = Atelier()
    # (dans l'atelier, boite(x0, x1, z0, z1, yf, yb) : ici le « z » de
    # l'atelier est la NORMALE du pupitre, son « y » la PENTE)
    pu.boite('peinture', -L, L, -0.012, 0.0, 0.0, 0.26, -0.2)
    xs = (-0.6, -0.47, -0.34, -0.21, -0.08)
    for x in xs:
        pu.boite('lame', x - 0.058, x + 0.058, 0.0, 0.028, 0.03, 0.2, -0.3)
    # la table à cartes et son cadre de laiton
    pu.boite('trame', 0.04, L - 0.04, 0.0, 0.004, 0.03, 0.24, 0)
    for (x0, x1, y0, y1) in ((0.03, L - 0.03, 0.02, 0.03), (0.03, L - 0.03, 0.24, 0.25),
                             (0.03, 0.04, 0.02, 0.25), (L - 0.04, L - 0.03, 0.02, 0.25)):
        pu.boite('laiton', x0, x1, 0.0, 0.009, y0, y1, 0)
    pose(P, mats, pu, 'pupitre', m)
    # les cadrans, face à la caméra, devant leurs boîtiers (montés droits :
    # un cadran couché sur la pente se lirait en ellipse écrasée)
    for k, x in enumerate(xs):
        p = m @ Vector((x, 0.115, 0.03))
        cadran(at, x, p.z, 0.05, p.y - 0.012, angle=0.3 + 0.35 * k)
    at.objets(P, mats, BISEAU_HUB, True, nom)
    declare_dans(nom, P, w, h)


def mur_records(sc, mats):
    """§20c — LE MUR DES RECORDS : des rangées de compteurs à volets, tous
    VIERGES, leurs plaques vides, quelques cadrans, le cadre de laiton"""
    nom = 'hub-mur-records'
    P = parent(sc, nom)
    at = Atelier()
    w, h = TAILLES[nom]
    L = 0.74
    at.boite('peinture', -L + 0.02, L - 0.02, 0.025, h - 0.025, -0.01, 0.03, -0.3)
    for (a, b, c, d) in ((-L, L, 0.0, 0.025), (-L, L, h - 0.025, h), (-L, -L + 0.025, 0.0, h), (L - 0.025, L, 0.0, h)):
        at.boite('laiton', a, b, c, d, -0.04, 0.03, 0)
    at.boite('cyan', -L + 0.03, L - 0.03, h - 0.036, h - 0.03, -0.012, -0.01, 0)
    rivets_ligne(at, -L + 0.0125, L - 0.0125, 0.0125, -0.042, pas=0.07, r=0.004)
    rivets_ligne(at, -L + 0.0125, L - 0.0125, h - 0.0125, -0.042, pas=0.07, r=0.004)
    # les rangées de compteurs : une plaque vide, six fenêtres à volets
    for z in (0.075, 0.155, 0.235, 0.315):
        at.boite('plaque', -0.70, -0.57, z - 0.018, z + 0.018, -0.016, -0.01, 0.1)
        for k in range(6):
            x = -0.48 + k * 0.135
            at.boite('peinture', x - 0.06, x + 0.06, z - 0.032, z + 0.032, -0.03, -0.01, -0.4)
            at.boite('fenetre', x - 0.05, x + 0.05, z - 0.025, z + 0.025, -0.031, -0.02, 0)
            # les volets, vierges, et la fente qui les partage
            for j in range(3):
                xv = x - 0.034 + j * 0.034
                at.boite('volet', xv - 0.015, xv + 0.015, z - 0.021, z + 0.021, -0.033, -0.03, 0)
            at.boite('aiguille', x - 0.05, x + 0.05, z - 0.0015, z + 0.0015, -0.034, -0.033, 0)
    # à droite, deux cadrans vierges l'un sur l'autre
    for z in (0.29, 0.12):
        x = 0.62
        at.boite('lame', x - 0.075, x + 0.075, z - 0.075, z + 0.075, -0.02, -0.01, -0.5)
        cadran(at, x, z, 0.062, -0.025, angle=0.4 + z * 4)
    at.objets(P, mats, BISEAU_HUB, True, nom)
    declare_dans(nom, P, w, h)


def bac_sable(sc, mats):
    """§20d — LE BAC D'ESSAI : un bac peu profond sur son bâti riveté, les
    graduations du fond (traits nus), l'eau teintée au fond, quatre buses au
    bord, la vanne de vidange dessous"""
    nom = 'hub-bac-sable'
    P = parent(sc, nom)
    at = Atelier()
    w, h = TAILLES[nom]
    B0, B1 = 0.46, 0.88  # le bac, du fond au bord haut
    # le bâti : deux pieds devant, deux derrière, une croix, des semelles
    for x in (-0.40, 0.40):
        at.boite('peinture', x - 0.03, x + 0.03, 0.02, B0, -0.06, 0.0, -0.3)
        at.boite('peinture', x - 0.06, x + 0.06, 0.0, 0.02, -0.08, 0.02, -0.4)
        for z in (0.1, 0.2, 0.3, 0.4):
            at.dome('rivet', x, z, 0.0055, -0.062, 0)
    for x in (-0.30, 0.30):
        at.boite('peinture', x - 0.025, x + 0.025, 0.02, B0, 0.06, 0.11, -0.5)
    at.tube('peinture', (-0.38, -0.03, 0.08), (0.38, -0.03, 0.38), 0.011, -0.3, seg=10)
    at.tube('peinture', (-0.38, -0.03, 0.38), (0.38, -0.03, 0.08), 0.011, -0.3, seg=10)
    # la vanne de vidange, sous le bac
    at.tube('tuyau', (0.0, -0.02, B0), (0.0, -0.02, 0.30), 0.016, seg=16)
    at.boite('peinture', -0.035, 0.035, 0.31, 0.37, -0.05, 0.01, -0.2)
    volant(at, 0.0, 0.34, 0.045, -0.065)
    # le fond du bac (le mur arrière, plus haut) et ses graduations nues
    at.boite('peinture', -0.46, 0.46, B0, B1, 0.10, 0.14, -0.2)
    for k in range(10):
        z = B0 + 0.12 + k * 0.03
        lg = 0.05 if k % 5 == 0 else 0.025
        for x in (-0.42, 0.42 - lg):
            at.boite('cadran', x, x + lg, z - 0.002, z + 0.002, 0.096, 0.1, 0)
    for k in range(9):
        x = -0.36 + k * 0.09
        at.boite('cadran', x - 0.0015, x + 0.0015, B0 + 0.12, B1 - 0.03, 0.097, 0.1, 0)
    # l'eau au fond, puis le cuvelage : fond, flancs, rebord avant bas
    # (essai 1 : à 0,12, l'eau ne dépassait du rebord que d'un trait)
    at.boite('eau', -0.43, 0.43, B0 + 0.02, B0 + 0.17, -0.10, 0.10, 0)
    at.boite('peinture', -0.46, 0.46, B0, B0 + 0.02, -0.14, 0.14, -0.3)
    for s in (-1, 1):
        a, b = sorted((s * 0.46, s * 0.43))
        at.boite('peinture', a, b, B0, B1, -0.14, 0.14, -0.3)
    at.boite('peinture', -0.46, 0.46, B0, B0 + 0.09, -0.15, -0.10, -0.3)
    rivets_ligne(at, -0.44, 0.44, B0 + 0.045, -0.153, pas=0.055)
    at.boite('cyan', -0.44, 0.44, B0 + 0.084, B0 + 0.09, -0.152, -0.15, 0)
    # le rebord du haut, et les quatre buses réglables
    at.boite('peinture', -0.48, 0.48, B1, B1 + 0.025, -0.02, 0.15, -0.2)
    for x in (-0.33, -0.11, 0.11, 0.33):
        at.tube('tuyau', (x, 0.05, B1 + 0.025), (x, 0.05, B1 + 0.075), 0.012, seg=14)
        at.coussin('peinture', x, B1 + 0.08, 0.018, 0.012, 0.018, 0.05, 0)
        at.tube('tuyau', (x, 0.05, B1 + 0.08), (x + 0.02, 0.01, B1 + 0.06), 0.008, seg=10, r2=0.005)
        at.anneau('tuyau', x, B1 + 0.052, 0.017, 0.012, 0.035, 0.065, 0, seg=20)
    at.objets(P, mats, BISEAU_HUB, True, nom)
    declare_dans(nom, P, w, h)


def distillateur(sc, mats):
    """§20e — LE DISTILLATEUR : la chaudière trapue, la colonne rivetée et
    ses trois bulbes de distillat bleu pâle, le serpentin de cuivre, le
    manomètre vierge, la veilleuse ambre au pied"""
    nom = 'hub-distillateur'
    P = parent(sc, nom)
    at = Atelier()
    w, h = TAILLES[nom]
    cx = -0.1
    at.boite('peinture', -0.42, 0.42, 0.0, 0.03, -0.12, 0.12, -0.4)
    # la chaudière : un fût debout, son dôme, deux ceintures de rivets
    R = 0.2
    at.tube('peinture', (cx, 0.0, 0.03), (cx, 0.0, 0.29), R, -0.2, seg=48)
    at.coussin('peinture', cx, 0.29, R, 0.06, R, 0.0, -0.2)
    for z in (0.07, 0.25):
        for k in range(15):
            a = -1.3 + k * 2.6 / 14
            at.dome('rivet', cx + R * math.sin(a), z, 0.006, -R * math.cos(a), 0)
    # le foyer, sa trappe, la veilleuse ambre
    at.boite('lame', cx - 0.07, cx + 0.07, 0.08, 0.17, -0.21, -0.17, -0.5)
    at.boite('fond', cx - 0.05, cx + 0.05, 0.1, 0.15, -0.212, -0.205, 0)
    at.cylindre('tuyau', cx + 0.12, 0.12, 0.018, -0.205, -0.185, 0, seg=20)
    at.dome('ambre', cx + 0.12, 0.12, 0.012, -0.207, 0, aplati=0.7)
    cadran(at, cx - 0.11, 0.2, 0.045, -0.215, angle=0.9)
    # la colonne : des viroles rivetées entre trois bulbes de verre
    rc = 0.07
    for z0, z1 in ((0.33, 0.395), (0.485, 0.565), (0.655, 0.735), (0.825, 0.92)):
        at.tube('peinture', (cx, 0.0, z0), (cx, 0.0, z1), rc, -0.2, seg=32)
        at.tube('tuyau', (cx, 0.0, z0), (cx, 0.0, z0 + 0.012), rc + 0.012, seg=32)
        at.tube('tuyau', (cx, 0.0, z1 - 0.012), (cx, 0.0, z1), rc + 0.012, seg=32)
        for k in range(7):
            a = -1.2 + k * 2.4 / 6
            at.dome('rivet', cx + rc * math.sin(a), (z0 + z1) / 2, 0.004, -rc * math.cos(a), 0)
    for z in (0.44, 0.61, 0.78):
        at.coussin('verre', cx, z, 0.085, 0.05, 0.06, 0.0, 0)
        # le distillat : le bas du bulbe, son ventre DEVANT celui du verre —
        # caché derrière, le bulbe sortait noir (essai 1) ; sa silhouette tient
        # dans celle du verre, rien ne dépasse de face
        at.coussin('liquide', cx, z - 0.013, 0.076, 0.032, 0.07, -0.012, 0)
        at.coussin('reflet', cx - 0.04, z + 0.022, 0.012, 0.006, 0.004, -0.08, 0)
    at.coussin('peinture', cx, 0.92, rc, 0.03, rc, 0.0, -0.2)
    # le col de cygne vers le serpentin, à droite
    sx, sr = 0.27, 0.075
    at.tube('cuivre', (cx, 0.0, 0.93), (cx + 0.05, 0.0, 0.965), 0.014, seg=12)
    at.tube('cuivre', (cx + 0.05, 0.0, 0.965), (sx, 0.0, 0.965), 0.014, seg=12)
    at.tube('cuivre', (sx, 0.0, 0.965), (sx, -sr, 0.86), 0.014, seg=12)
    # le serpentin : cinq spires
    n, z_haut, z_bas = 5 * 16, 0.86, 0.42
    pts = [(sx + sr * math.sin(i / 16 * 2 * math.pi), -sr * math.cos(i / 16 * 2 * math.pi),
            z_haut - (z_haut - z_bas) * i / n) for i in range(n + 1)]
    for p0, p1 in zip(pts, pts[1:]):
        at.tube('cuivre', p0, p1, 0.013, seg=10)
    # le montant qui le porte, derrière, et ses deux colliers
    at.boite('peinture', sx - 0.015, sx + 0.015, 0.03, 0.9, 0.09, 0.12, -0.4)
    for z in (0.48, 0.8):
        at.tube('peinture', (sx, 0.09, z), (sx, 0.0, z), 0.008, seg=8)
    # la sortie vers la recette, sa vanne
    at.tube('cuivre', pts[-1], (sx, -0.04, 0.24), 0.012, seg=12)
    at.tube('peinture', (sx, 0.0, 0.03), (sx, 0.0, 0.19), 0.065, -0.3, seg=32)
    at.coussin('peinture', sx, 0.19, 0.065, 0.025, 0.065, 0.0, -0.3)
    volant(at, sx, 0.24, 0.035, -0.07)
    at.objets(P, mats, BISEAU_HUB, True, nom)
    declare_dans(nom, P, w, h)


def stations():
    vide_scene()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_hub()
    for f in (eclairage, table_depart, mur_records, bac_sable, distillateur):
        f(sc, mats)
    lumiere_camera(sc)
    sc.cycles.device = 'GPU'
