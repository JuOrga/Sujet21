"""LE FOND DE CUVE EN GRANDE DALLE (16/11) — tank-bg.webp, trois carreaux sur
deux : 2700 × 1800 unités de jeu, un tableau standard (2400 × 1500) n'en voit
qu'une.

Le carreau du 13/11 (surfaces.py : cuve) couvrait 900 unités et portait DEUX
baies — un hublot, un évent. Un tableau le voyait presque trois fois en
largeur : « très basique, les mêmes hublots répliqués, très peu de détails »
(le concepteur, 16/11, le fond enfin vu en jeu). La même ossature ici —
montants en I tous les demi-carreaux, une traverse par rangée — mais DOUZE
baies, et dans chacune un équipement de banc d'essai différent : aucun n'est
en double dans la dalle. Deux longues courses la traversent d'un bord à
l'autre : les deux conduites de la rangée basse, un chemin de câbles dans la
rangée haute.

Ce que le fond doit rester (assets-ia §18b) : PLUS SOMBRE QUE LES PAROIS
(luminance visée 0,10 à 0,15), froid, sans contraste fort — le fluide passe
devant et doit se lire dessus. Plus de détails, pas plus de clarté.

Le raccord vient par construction, comme pour le carreau : le bruit des
matières est pris sur un tore de période 1 (donc de période 3 et 2), la
dalle est entourée de ses huit copies, une marge est rendue puis rognée.

LA SCÈNE EST À PART. fond_cuve() ne vide PAS le fichier ouvert (vide_scene
efface tous les objets de toutes les scènes) : elle bâtit dans une scène
« fond-cuve », qu'elle refait à chaque appel.

Dans Blender :
    DOSSIER = r'...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\fond_cuve.py', encoding='utf-8').read())
    fond_cuve() ; lance(['tank-bg'], SORTIE, 256)
    (SORTIE : masters\\images\\fond-cuve, avec brut\\ ; 3072 × 2048)
"""
import bpy, bmesh, math, os, random
from mathutils import Matrix, Vector

_src = os.path.join(DOSSIER, 'surfaces.py')
exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

LARGE, HAUT = 3, 2        # la dalle, en carreaux de 900 unités
PAS_MONTANT = 0.5         # un montant en I tous les demi-carreaux
BAS_BAIE = DEMI_TRAVERSE + 0.008
HAUT_BAIE = 1 - DEMI_TRAVERSE - 0.008
# la plaque d'une baie se coupe en trois : la plaque basse, le bandeau où
# passent les longues courses, la grande plaque de l'équipement
COUTURES = (0.0, 0.36, 0.40, 1.0)
Z_CONDUITES = (0.405, 0.442)   # rangée basse : les deux conduites
Z_CABLES = 1.42                # rangée haute : le chemin de câbles
CABLES = ['cable-ocre', 'cable-bleu', 'cable-gris', 'cable-sang', 'cable-gris', 'cable-bleu']


# ------------------------------------------------------------- l'ossature
def montant_dalle(at, xc):
    """le montant en I de surfaces.py, sur toute la hauteur de la dalle"""
    h = DEMI_MONTANT
    at.boite('rail', xc - h * 0.55, xc + h * 0.55, -0.01, HAUT + 0.01, -0.006, FOND_Y, 0.2)
    for s in (-1, 1):
        x0, x1 = sorted((xc + s * h * 0.55, xc + s * h))
        at.boite('plat', x0, x1, -0.01, HAUT + 0.01, -0.02, FOND_Y, 0.4)
    for k in range(16 * HAUT):
        z = (k + 0.5) / 16
        for s in (-1, 1):
            at.dome('rivet', xc + s * h * 0.78, z, 0.0042, -0.02, 0.4)


def traverse_dalle(at, zc):
    h = DEMI_TRAVERSE
    at.boite('rail', -0.01, LARGE + 0.01, zc - h, zc + h, -0.012, FOND_Y, -0.2)
    at.boite('plat', -0.01, LARGE + 0.01, zc + h, zc + h + 0.008, -0.016, FOND_Y, 0.3)
    at.boite('plat', -0.01, LARGE + 0.01, zc - h - 0.008, zc - h, -0.016, FOND_Y, 0.3)
    for k in range(24 * LARGE):
        at.dome('rivet', (k + 0.5) / 24, zc, 0.0036, -0.012, -0.2)


def conduites_dalle(at):
    """les deux conduites de la rangée basse, d'un bord de la dalle à l'autre
    (elles se raccordent à elles-mêmes), une bride à mi-baie, un collier sur
    chaque montant"""
    for i, z in enumerate(Z_CONDUITES):
        r = 0.011 if i == 0 else 0.0085
        at.fut('tuyau', -0.02, LARGE + 0.02, r, 0, -0.034, z)
        for k in range(int(LARGE / PAS_MONTANT)):
            xb = (k + 0.5) * PAS_MONTANT
            at.anneau('tuyau', xb, z, r * 1.55, r * 0.6, -0.034 - r * 1.1, -0.034 + r * 1.1, 0, seg=32)
    for k in range(int(LARGE / PAS_MONTANT)):
        xc = k * PAS_MONTANT
        at.boite('plat', xc - 0.012, xc + 0.012, Z_CONDUITES[0] - 0.024, Z_CONDUITES[1] + 0.02, -0.05, -0.02, 0.3)


def chemin_cables(at, rng):
    """le chemin de câbles de la rangée haute : une gouttière, six câbles de
    couleur ternie couchés dedans, une bride tous les quarts de carreau"""
    zc = Z_CABLES
    at.boite('rail', -0.01, LARGE + 0.01, zc - 0.034, zc + 0.034, -0.004, 0.0, 0)
    at.boite('plat', -0.01, LARGE + 0.01, zc + 0.034, zc + 0.041, -0.022, 0.0, 0.2)
    at.boite('plat', -0.01, LARGE + 0.01, zc - 0.041, zc - 0.034, -0.022, 0.0, 0.2)
    n = len(CABLES)
    for i, mat in enumerate(CABLES):
        r = 0.0036 + 0.0012 * ((i * 7) % 3) / 2
        at.fut(mat, -0.02, LARGE + 0.02, r, 0, -0.005 - r, zc - 0.026 + 0.052 * (i + 0.5) / n, seg=16)
    for k in range(LARGE * 4):
        x = (k + 0.5) / 4 + rng.uniform(-0.03, 0.03)
        at.boite('lame', x - 0.006, x + 0.006, zc - 0.038, zc + 0.038, -0.018, -0.002, 0)


# ------------------------------------------------- les douze équipements
# Chacun reçoit sa baie (x0, x1) et le bas z de sa rangée ; la plaque est
# déjà posée. Deux zones libres : la grande plaque (z + 0,50 à z + 0,94) et
# la plaque basse (z + 0,07 à z + 0,33) — le bandeau entre les deux est aux
# longues courses.
def plaquette(at, x, z):
    """une plaquette signalétique : une tôle rivée, trois lignes gravées —
    l'aplat de cyan terni tout seul faisait pastille (essai 1)"""
    at.boite('lame', x, x + 0.1, z, z + 0.06, -0.003, 0.0, 0)
    for i, l in enumerate((0.07, 0.05, 0.062)):
        at.boite('trait', x + 0.012, x + 0.012 + l, z + 0.014 + i * 0.013, z + 0.019 + i * 0.013, -0.0038, -0.003, 0)
    for dx in (0.006, 0.094):
        at.dome('rivet', x + dx, z + 0.052, 0.0028, -0.003, 0)


def eq_hublot(at, x0, x1, z, rng):
    """le hublot d'inspection et sa réglette (le « CUVE 21 » se peint dessous)"""
    hublot(at, (x0 + x1) / 2 - 0.02, z + 0.70, 0.105)
    reglette(at, x1 - 0.042, z + 0.50, z + 0.94)


def eq_event(at, x0, x1, z, rng):
    grille(at, x0 + 0.05, x1 - 0.05, z + 0.56, z + 0.90, 0.2)
    boitier(at, x0 + 0.04, x0 + 0.17, z + 0.10, z + 0.28, rng)


def eq_ecrans(at, x0, x1, z, rng):
    """deux écrans de contrôle éteints, l'un sur l'autre ; un rang
    d'interrupteurs sur la plaque basse, un seul voyant de veille"""
    xm = (x0 + x1) / 2
    for k, zc in enumerate((z + 0.615, z + 0.83)):
        w, h = 0.30, 0.17
        at.boite('panneau', xm - w / 2, xm + w / 2, zc - h / 2, zc + h / 2, -0.024, 0.0, rng.uniform(-1, 1))
        at.boite('fond', xm - w / 2 + 0.018, xm + w / 2 - 0.018, zc - h / 2 + 0.03, zc + h / 2 - 0.016, -0.0255, -0.023, 0)
        at.boite('ecran', xm - w / 2 + 0.022, xm + w / 2 - 0.022, zc - h / 2 + 0.034, zc + h / 2 - 0.02, -0.0265, -0.0245, 0)
        for i in range(3):
            at.cylindre('voyant' if (k == 1 and i == 0) else 'eteint', xm - w / 2 + 0.03 + i * 0.02, zc - h / 2 + 0.015,
                        0.005, -0.028, -0.024, 0, seg=20)
    at.boite('panneau', x0 + 0.06, x1 - 0.06, z + 0.14, z + 0.26, -0.012, 0.0, rng.uniform(-1, 1))
    for i in range(7):
        x = x0 + 0.095 + i * (x1 - x0 - 0.19) / 6
        at.boite('rail', x - 0.008, x + 0.008, z + 0.175, z + 0.225, -0.019, -0.012, 0)
        at.dome('rivet', x, z + 0.215 if i % 3 else z + 0.185, 0.0048, -0.019, 0)


def eq_caissons(at, x0, x1, z, rng):
    """quatre tiroirs à cadre et à poignée, une étiquette sur chacun ; une
    trappe à charnières sur la plaque basse"""
    g = 0.012
    for a in range(2):
        for b in range(2):
            xa = x0 + 0.04 + a * ((x1 - x0 - 0.08 + g) / 2)
            xb = xa + (x1 - x0 - 0.08 - g) / 2
            za = z + 0.52 + b * 0.21
            zb = za + 0.198
            var = rng.uniform(-1, 1)
            at.boite('panneau', xa, xb, za, zb, -0.012, 0.0, var)
            at.boite('fond', xa + 0.014, xb - 0.014, za + 0.014, zb - 0.014, -0.0125, -0.011, 0)
            at.boite('panneau', xa + 0.018, xb - 0.018, za + 0.018, zb - 0.018, -0.016, 0.0, var)
            at.boite('lame', xa + 0.03, xa + 0.09, zb - 0.054, zb - 0.032, -0.0172, -0.0155, 0)
            at.boite('trait', xa + 0.036, xa + 0.076, zb - 0.045, zb - 0.041, -0.0178, -0.017, 0)
            xm = (xa + xb) / 2
            at.fut('tuyau', xm - 0.035, xm + 0.035, 0.0045, 0, -0.026, za + 0.052, seg=16)
            for s in (-1, 1):
                at.cylindre('plat', xm + s * 0.035, za + 0.052, 0.006, -0.026, -0.016, 0, seg=12)
    at.boite('panneau', x0 + 0.09, x1 - 0.09, z + 0.10, z + 0.30, -0.008, 0.0, rng.uniform(-1, 1))
    for zc in (z + 0.14, z + 0.26):
        at.boite('plat', x0 + 0.075, x0 + 0.105, zc - 0.014, zc + 0.014, -0.014, -0.004, 0.3)
    at.cylindre('rail', x1 - 0.115, z + 0.20, 0.011, -0.016, -0.008, 0, seg=24)


def eq_vanne(at, x0, x1, z, rng):
    """une colonne montante, deux brides, et sa vanne à volant vue de face"""
    xm = (x0 + x1) / 2 + 0.03
    at.tube('tuyau', (xm, -0.04, z + 0.47), (xm, -0.04, z + 0.975), 0.024, 0, seg=40)
    for zb in (z + 0.56, z + 0.90):
        at.cylindre('plat', xm, zb, 0.036, -0.04, -0.04, 0.3, seg=32, axe='Z', long=0.016)
    zv = z + 0.73
    # le corps de vanne, une caisse devant la colonne : le volant se plaque
    # dessus. Monté en l'air sur sa tige, son ombre tombait dix centièmes
    # plus bas sur la plaque et se lisait comme un SECOND volant (essai 1)
    at.boite('plat', xm - 0.098, xm + 0.098, zv - 0.098, zv + 0.098, -0.07, -0.01, 0.2)
    for (dx, dz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        at.cylindre('ecrou', xm + dx * 0.082, zv + dz * 0.082, 0.0075, -0.076, -0.07, 0, seg=6)
    at.anneau('rail', xm, zv, 0.074, 0.061, -0.082, -0.074, 0.0, seg=48)
    for k in range(3):
        at.boite('rail', xm - 0.064, xm + 0.064, zv - 0.0055, zv + 0.0055, -0.081, -0.075, 0.0,
                 rot=Matrix.Rotation(k * math.pi / 3, 4, 'Y'))
    at.disque('plat', xm, zv, 0.016, -0.087, -0.074, 0.3, seg=24)
    # une plaque signalétique, et le purgeur sur la plaque basse
    plaquette(at, x0 + 0.035, z + 0.80)
    at.cylindre('plat', x0 + 0.10, z + 0.20, 0.03, -0.014, 0.0, 0.3, seg=32)
    at.cylindre('rail', x0 + 0.10, z + 0.20, 0.014, -0.03, -0.014, 0, seg=6)


def eq_cables_montants(at, x0, x1, z, rng):
    """un faisceau qui descend du plafond dans une boîte de jonction, deux
    colliers ; la plaque basse porte un bornier"""
    xm = (x0 + x1) / 2
    n = 8
    for i in range(n):
        x = xm - 0.07 + 0.14 * (i + 0.5) / n + rng.uniform(-0.002, 0.002)
        r = rng.uniform(0.0042, 0.0062)
        at.tube(CABLES[(i * 5 + 1) % len(CABLES)], (x, -0.006 - r, z + 0.60), (x, -0.006 - r, z + 0.975), r, 0, seg=16)
    for zc in (z + 0.74, z + 0.88):
        at.boite('lame', xm - 0.085, xm + 0.085, zc - 0.007, zc + 0.007, -0.022, -0.002, 0)
    at.boite('panneau', xm - 0.115, xm + 0.115, z + 0.50, z + 0.63, -0.034, 0.0, rng.uniform(-1, 1))
    for (dx, dz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        at.dome('rivet', xm + dx * 0.10, z + 0.565 + dz * 0.05, 0.004, -0.034, 0)
    at.boite('rail', x0 + 0.07, x1 - 0.07, z + 0.16, z + 0.24, -0.01, 0.0, 0)
    for i in range(9):
        x = x0 + 0.095 + i * (x1 - x0 - 0.19) / 8
        at.cylindre('ecrou', x, z + 0.20, 0.0075, -0.016, -0.01, 0, seg=6)


def eq_aeration(at, x0, x1, z, rng):
    """un grand évent à lames sur toute la plaque, un petit dessous"""
    grille(at, x0 + 0.04, x1 - 0.04, z + 0.52, z + 0.93, -0.3)
    grille(at, x0 + 0.10, x1 - 0.10, z + 0.11, z + 0.29, 0.1)
    for (x, zc) in ((x0 + 0.05, z + 0.20), (x1 - 0.05, z + 0.20)):
        at.dome('rivet', x, zc, 0.0055, 0.0, 0)


def eq_blindage(at, x0, x1, z, rng):
    """une plaque de renfort boulonnée, deux écharpes en croix"""
    xa, xb, za, zb = x0 + 0.035, x1 - 0.035, z + 0.52, z + 0.93
    at.boite('panneau', xa, xb, za, zb, -0.012, 0.0, rng.uniform(-1, 1))
    xm, zm = (xa + xb) / 2, (za + zb) / 2
    long = math.hypot(xb - xa - 0.06, zb - za - 0.06)
    ang = math.atan2(zb - za - 0.06, xb - xa - 0.06)
    for s in (-1, 1):
        at.boite('plat', xm - long / 2, xm + long / 2, zm - 0.013, zm + 0.013, -0.02, -0.012, 0.2,
                 rot=Matrix.Rotation(s * ang, 4, 'Y'))
    at.disque('plat', xm, zm, 0.034, -0.026, -0.012, 0.2, seg=32)
    at.boulons(xm, zm, 0.022, 6, -0.026, rr=0.0042, var=0.2)
    for k in range(7):
        t = (k + 0.5) / 7
        for zc in (za + 0.018, zb - 0.018):
            at.cylindre('ecrou', xa + (xb - xa) * t, zc, 0.007, -0.018, -0.012, 0, seg=6)
    for k in range(5):
        t = (k + 1) / 6
        for x in (xa + 0.018, xb - 0.018):
            at.cylindre('ecrou', x, za + (zb - za) * t, 0.007, -0.018, -0.012, 0, seg=6)
    plaquette(at, x0 + 0.07, z + 0.17)


def eq_cadrans(at, x0, x1, z, rng):
    """trois manomètres en triangle : une couronne, un verre mat, une
    aiguille arrêtée, quelques graduations ; leur piquage sur la plaque basse"""
    xm = (x0 + x1) / 2
    poses = ((xm - 0.095, z + 0.80, 0.075), (xm + 0.10, z + 0.83, 0.06), (xm + 0.02, z + 0.615, 0.085))
    for (x, zc, r) in poses:
        at.anneau('plat', x, zc, r * 1.22, r, -0.02, 0.002, 0.3, seg=56)
        at.disque('ecran', x, zc, r * 1.0, -0.006, -0.002, 0, seg=56)
        for k in range(9):
            a = math.radians(225 - k * 270 / 8)
            c, s = math.cos(a), math.sin(a)
            at.boite('trait', x + c * r * 0.82 - 0.0016, x + c * r * 0.82 + 0.0016, zc + s * r * 0.82 - 0.006, zc + s * r * 0.82 + 0.006,
                     -0.0075, -0.006, 0, rot=Matrix.Rotation(math.pi / 2 - a, 4, 'Y'))
        a = math.radians(rng.uniform(40, 200))
        c, s = math.cos(a), math.sin(a)
        at.boite('trait', x + c * r * 0.32 - 0.002, x + c * r * 0.32 + 0.002, zc + s * r * 0.32 - r * 0.36, zc + s * r * 0.32 + r * 0.36,
                 -0.0095, -0.008, 0, rot=Matrix.Rotation(math.pi / 2 - a, 4, 'Y'))
        at.cylindre('rail', x, zc, r * 0.11, -0.012, -0.006, 0, seg=20)
    for x in (xm - 0.09, xm, xm + 0.09):
        at.cylindre('plat', x, z + 0.20, 0.022, -0.012, 0.0, 0.3, seg=28)
        at.cylindre('ecrou', x, z + 0.20, 0.011, -0.022, -0.012, 0, seg=6)


def eq_hublot_condamne(at, x0, x1, z, rng):
    """un ancien hublot, condamné : une tape boulonnée, une barre en travers"""
    xm, zc, r = (x0 + x1) / 2, z + 0.72, 0.12
    at.anneau('plat', xm, zc, r * 1.2, r * 0.96, -0.018, 0.004, 0.3, seg=64)
    at.disque('panneau', xm, zc, r * 0.98, -0.012, 0.0, rng.uniform(-1, 1), seg=64)
    at.boulons(xm, zc, r * 1.08, 12, -0.018, rr=0.0046, var=0.3, phase=0.5)
    at.boite('plat', xm - r * 1.25, xm + r * 1.25, zc - 0.016, zc + 0.016, -0.03, -0.012, 0.2,
             rot=Matrix.Rotation(math.radians(-18), 4, 'Y'))
    boitier(at, x1 - 0.18, x1 - 0.05, z + 0.11, z + 0.29, rng)


def eq_reservoirs(at, x0, x1, z, rng):
    """deux bouteilles couchées, sanglées à la plaque ; un détendeur à
    cadran sur la plaque basse"""
    for zc, r in ((z + 0.635, 0.062), (z + 0.845, 0.05)):
        xa, xb = x0 + 0.06 + r, x1 - 0.06 - r
        at.fut('tuyau', xa, xb, r, 0, -0.012 - r, zc, seg=56)
        for x in (xa, xb):
            at.dome('tuyau', x, zc, r, -0.012 - r, 0, aplati=1.0)
        for t in (0.25, 0.75):
            x = xa + (xb - xa) * t
            at.boite('plat', x - 0.009, x + 0.009, zc - r - 0.004, zc + r + 0.004, -0.014 - 2 * r - 0.003, 0.0, 0.3)
    at.boite('panneau', x0 + 0.08, x0 + 0.24, z + 0.13, z + 0.27, -0.016, 0.0, rng.uniform(-1, 1))
    at.anneau('plat', x0 + 0.16, z + 0.20, 0.046, 0.036, -0.022, -0.014, 0.3, seg=40)
    at.disque('ecran', x0 + 0.16, z + 0.20, 0.036, -0.019, -0.016, 0, seg=40)


def eq_echelle(at, x0, x1, z, rng):
    """une échelle de visite, de la traverse à la traverse (elle passe sous
    le chemin de câbles), et une plaque de repère à côté"""
    xm = x0 + 0.13
    for s in (-1, 1):
        at.boite('plat', xm + s * 0.062 - 0.007, xm + s * 0.062 + 0.007, z + 0.05, z + 0.95, -0.03, 0.0, 0.3)
    for k in range(15):
        at.fut('tuyau', xm - 0.062, xm + 0.062, 0.0055, 0, -0.022, z + 0.08 + k * 0.06, seg=16)
    at.boite('panneau', x1 - 0.19, x1 - 0.04, z + 0.64, z + 0.84, -0.008, 0.0, rng.uniform(-1, 1))
    for (dx, dz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        at.dome('rivet', x1 - 0.115 + dx * 0.06, z + 0.74 + dz * 0.085, 0.0038, -0.008, 0)


# la dalle, rangée basse puis rangée haute, de gauche à droite : deux
# équipements ronds ou lumineux ne se touchent jamais, et le seul hublot à
# lueur est seul de son espèce
PLAN = [
    [eq_hublot, eq_event, eq_ecrans, eq_caissons, eq_vanne, eq_cables_montants],
    [eq_aeration, eq_blindage, eq_cadrans, eq_hublot_condamne, eq_reservoirs, eq_echelle],
]


def grande_cuve(at, rng):
    n = int(LARGE / PAS_MONTANT)
    for k in range(n):
        montant_dalle(at, k * PAS_MONTANT)
    for j in range(HAUT):
        traverse_dalle(at, float(j))
    for j in range(HAUT):
        for k in range(n):
            x0 = k * PAS_MONTANT + DEMI_MONTANT
            x1 = (k + 1) * PAS_MONTANT - DEMI_MONTANT
            baie(at, x0, x1, j + BAS_BAIE, j + HAUT_BAIE, COUTURES, rng)
            PLAN[j][k](at, x0, x1, float(j), rng)
    conduites_dalle(at)
    chemin_cables(at, rng)


# ------------------------------------------------------------ les marquages
MARQUAGES = [
    # (texte, corps, x, z, y) — au pochoir ; y : la face qui les porte
    ('CUVE 21', 0.044, 0.235, 0.19, -0.0015),
    ('ESSAI · NE PAS VIDANGER', 0.016, 0.235, 0.145, -0.0015),
    ('B-07', 0.03, 2.853, 1.725, -0.0095),
    ('PURGE', 0.018, 2.31, 0.115, -0.0015),
    ('CIRCUIT 2', 0.02, 1.25, 1.115, -0.0015),
]


def marquages(C, mats):
    for corps, taille, x, z, y in MARQUAGES:
        cu = bpy.data.curves.new('marquage', 'FONT')
        cu.body = corps
        cu.size = taille
        cu.align_x = 'CENTER'
        cu.extrude = 0.0004
        cu.space_character = 1.15
        ob = bpy.data.objects.new('tank-bg-marquage', cu)
        # (le texte se pose dans XY ; tourné d'un quart autour de X, il se
        # dresse dans le plan du mur — surfaces.py : marquage)
        ob.rotation_euler = (math.pi / 2, 0, 0)
        ob.location = (x, y, z)
        ob.data.materials.append(mats['trait'])
        C.objects.link(ob)
    # ce qui est rond se lisse : en facettes, un fût montrait ses arêtes
    for ob in C.objects:
        if ob.type == 'MESH' and (ob.name.endswith('tuyau') or '-cable-' in ob.name):
            ob.data.polygons.foreach_set('use_smooth', [True] * len(ob.data.polygons))
            try:
                ob.data.set_sharp_from_angle(angle=math.radians(40))
            except Exception as e:
                print('lissage :', e)


# ---------------------------------------------------------------- la dalle
def matieres_cuve():
    """les matières du fond de cuve du 13/11 (surfaces.py : surfaces), et ce
    que les nouveaux équipements demandent — tout reste sombre et froid"""
    mats = matieres_biome()
    mats['fond'] = mat_simple('fond', (0x05, 0x07, 0x09), rug=0.9)
    mats['rail'] = mat_brosse('rail', (0x18, 0x24, 0x2a), (0x30, 0x40, 0x48), 33, brosse=0.05)
    mats['voyant'] = mat_simple('voyant', (0x10, 0x40, 0x40), rug=0.3, emission=(0x5a, 0xf0, 0xe0), force=3.0)
    mats['panneau'] = mat_brosse('cuve', (0x10, 0x1a, 0x20), (0x24, 0x32, 0x3a), 37, brosse=0.04, rouille=(0x22, 0x2a, 0x2a))
    mats['rivet'] = mats['panneau']
    mats['plat'] = mat_brosse('semelle', (0x1e, 0x2a, 0x32), (0x3a, 0x4a, 0x54), 39, brosse=0.08)
    mats['lueur'] = mat_lueur()
    mats['ecran'] = mat_simple('ecran', (0x04, 0x0a, 0x0c), rug=0.45)
    mats['trait'] = mat_simple('trait', (0x2c, 0x5a, 0x6a), rug=0.6)
    mats['eteint'] = mat_simple('eteint', (0x0c, 0x18, 0x1a), rug=0.3)
    mats['lame'] = mat_brosse('cuve-lame', (0x1a, 0x24, 0x2c), (0x34, 0x42, 0x4c), 41, brosse=0.06)
    mats['ecrou'] = mat_simple('ecrou', (0x30, 0x38, 0x40), rug=0.5, metal=0.5)
    # les câbles : les couleurs de câblage des habillages, plus ternes encore
    # — derrière l'eau, une teinte vive ferait tache
    mats['cable-ocre'] = mat_simple('cable-ocre', (0x40, 0x36, 0x1a), rug=0.65)
    mats['cable-bleu'] = mat_simple('cable-bleu', (0x18, 0x2e, 0x44), rug=0.65)
    mats['cable-gris'] = mat_simple('cable-gris', (0x2c, 0x32, 0x38), rug=0.65)
    mats['cable-sang'] = mat_simple('cable-sang', (0x3a, 0x18, 0x18), rug=0.65)
    return mats


def dalle(sc, mats, nom, bati, extra=None):
    """le carreau de surfaces.py, à la taille de la dalle : la géométrie dans
    [0, LARGE] × [0, HAUT], ses huit copies autour, la caméra sur la dalle"""
    P = parent(sc, nom)
    C = sous(P, nom + '-carreau')
    at = Atelier()
    bati(at, random.Random(2126))
    at.objets(C, mats, {'panneau': 0.0022, 'peinture': 0.0022, 'rail': 0.0016, 'lame': 0.0006, 'plat': 0.0012}, prefixe=nom)
    if extra:
        extra(C, mats)
    me = bpy.data.meshes.new(P.name + '-fond')
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((LARGE / 2, FOND_Y + 0.005, HAUT / 2))
                          @ Matrix.Diagonal((3 * LARGE, 0.01, 3 * HAUT, 1)))
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats['fond'])
    P.objects.link(bpy.data.objects.new(P.name + '-fond', me))
    copies(P, C, [(dx * LARGE, dz * HAUT) for dx in (-1, 0, 1) for dz in (-1, 0, 1) if dx or dz])
    declare(nom, P, 0, LARGE, 0, HAUT, mx=MARGE, mz=MARGE, alpha=False)


def fond_cuve():
    """bâtit la dalle dans SA scène (« fond-cuve »), sans vider le fichier"""
    ancienne = bpy.data.scenes.get('fond-cuve')
    sc = bpy.data.scenes.new('fond-cuve-neuve')
    bpy.context.window.scene = sc
    if ancienne:
        for o in list(ancienne.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        for c in list(ancienne.collection.children_recursive):
            bpy.data.collections.remove(c)
        bpy.data.scenes.remove(ancienne)
    sc.name = 'fond-cuve'
    PIECES.clear()
    dalle(sc, matieres_cuve(), 'tank-bg', grande_cuve, extra=marquages)
    lumiere_camera(sc)
    sc.cycles.device = 'GPU'
    return sc
