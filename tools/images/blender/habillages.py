"""LES HUIT HABILLAGES DE PAROI, refaits dans Blender (13/11) — les cases de
paroi-atlas.webp (grille 4×2 de 1024², l'ordre du champ `skin` de level.ts) :
caissons, conduites, poutrelle, blindage / aération, hublots condamnés,
écrans morts, câbles.

Les anciens sortaient du générateur, chacun dans son grain et sa lumière ;
depuis que le mur, la seconde paroi, le fond de cuve et les deux matières
sont dessinés dans l'atelier (surfaces.py), ils juraient avec eux. Ici, les
mêmes sujets — le concepteur les a choisis à l'éditeur, salle par salle —
dans le même acier, la même lumière, le même raccord PAR CONSTRUCTION (bruit
sur le tore, carreau entouré de ses huit copies) : le shader répète chaque
case toutes les 420 unités, calée sur la boîte qu'elle habille.

Dans Blender :
    DOSSIER = r'...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\habillages.py', encoding='utf-8').read())
    habillages() ; lance(NOMS, SORTIE, 384)
puis, hors de Blender, l'assemblage de l'atlas :
    python -I tools/images/blender/habillages.py <dossier des rendus> [sortie]
"""
import math, os, random, sys

DANS_BLENDER = 'bpy' in sys.modules
if DANS_BLENDER:
    import bpy
    from mathutils import Matrix, Vector
    _src = os.path.join(DOSSIER, 'surfaces.py')
    exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

# l'ordre des cases : skin 1 à 8, de gauche à droite puis de haut en bas
NOMS = ['hab-caissons', 'hab-conduites', 'hab-poutrelle', 'hab-blindage',
        'hab-aeration', 'hab-hublots', 'hab-ecrans', 'hab-cables']


def diagonale(at, mat, a, b, large, yf, yb, var=0.0):
    """une barre droite de a à b (dans le plan du mur), de largeur `large`"""
    (xa, za), (xb, zb) = a, b
    dx, dz = xb - xa, zb - za
    L = math.hypot(dx, dz)
    cx, cz = (xa + xb) / 2, (za + zb) / 2
    rot = Matrix.Rotation(-math.atan2(dz, dx), 4, 'Y')
    at.boite(mat, cx - L / 2, cx + L / 2, cz - large / 2, cz + large / 2, yf, yb, var, rot=rot)


# ---------------------------------------------------------------- 1 caissons
def caissons(at, rng):
    """des caisses de stockage empilées en quinconce, chacune sa teinte d'usure,
    un cadre, deux poignées, une étiquette pâle — parfois un voyant"""
    rangees = [(0.0, 0.26), (0.26, 0.5), (0.5, 0.77), (0.77, 1.0)]
    for i, (z0, z1) in enumerate(rangees):
        coutures = [(0.07 + 0.31 * i) % 1, (0.39 + 0.31 * i) % 1, (0.70 + 0.31 * i) % 1]
        for (x0, x1) in rangee(coutures):
            var = rng.uniform(-1, 1)
            g = 0.008
            a, b, c, d = x0 + g, x1 - g, z0 + g, z1 - g
            yf = rng.choice((0.0, -0.004, -0.008))
            at.boite('panneau', a, b, c, d, yf, FOND_Y, var)
            m = 0.016
            for (p, q, r, s) in ((a, b, d - m, d), (a, b, c, c + m), (a, a + m, c, d), (b - m, b, c, d)):
                at.boite('panneau', p, q, r, s, yf - 0.005, yf, var)
            mx = (a + b) / 2
            for sx in (-1, 1):
                hx = mx + sx * (b - a) * 0.3
                at.boite('lame', hx - 0.025, hx + 0.025, d - 0.05, d - 0.04, yf - 0.012, yf - 0.002, 0)
            at.boite('etiquette', mx - 0.045, mx + 0.045, c + 0.04, c + 0.075, yf - 0.0012, yf, 0)
            if rng.random() < 0.25:
                at.cylindre('voyant', b - 0.035, c + 0.035, 0.006, yf - 0.008, yf, 0, seg=20)


# --------------------------------------------------------------- 2 conduites
TUYAUX = [(0.07, 0.034), (0.2, 0.05), (0.34, 0.026), (0.45, 0.04), (0.6, 0.055), (0.74, 0.03), (0.86, 0.045)]


def conduites_h(at, rng):
    """un faisceau de conduites couchées, de diamètres différents, qui font
    le tour du carreau ; des brides, une vanne, des colliers sur deux rails"""
    # une tôle derrière : sur le noir du fond, le faisceau flottait (essai 1)
    at.boite('tole', 0.0, 1.0, 0.0, 1.0, 0.0, FOND_Y, 0)
    for k, (z, r) in enumerate(TUYAUX):
        y = -r - 0.004
        at.fut('tuyau', -0.02, 1.02, r, 0, y, z)
        for xb in (rng.uniform(0.05, 0.45), rng.uniform(0.55, 0.95)):
            at.tube('bride', (xb - 0.008, y, z), (xb + 0.008, y, z), r * 1.28, seg=40)
        if k % 3 == 1:
            xv = rng.uniform(0.2, 0.8)
            at.tube('bride', (xv, y - r, z), (xv, y - r - 0.03, z), r * 0.35, seg=24)
            at.anneau('volant', xv, z, r * 0.75, r * 0.6, y - r - 0.036, y - r - 0.03, 0, seg=40)
    for xr in (0.25, 0.75):
        at.boite('rail', xr - 0.02, xr + 0.02, -0.01, 1.01, 0.0, FOND_Y, 0)
        for (z, r) in TUYAUX:
            at.boite('lame', xr - 0.012, xr + 0.012, z - r - 0.006, z + r + 0.006, -2 * r - 0.01, -0.002, 0)


# -------------------------------------------------------------- 3 poutrelle
def poutrelle(at, rng):
    """un treillis riveté : un cadre de profilés sur les bords (partagés avec
    les copies voisines), une croix de Saint-André, un gousset aux nœuds"""
    l = 0.05
    at.boite('plat', -l / 2, l / 2, -0.01, 1.01, -0.02, -0.006, 0.3)
    at.boite('plat', -0.01, 1.01, -l / 2, l / 2, -0.02, -0.006, 0.3)
    at.boite('rail', -l / 2 + 0.008, l / 2 - 0.008, -0.01, 1.01, -0.024, -0.02, 0.3)
    at.boite('rail', -0.01, 1.01, -l / 2 + 0.008, l / 2 - 0.008, -0.024, -0.02, 0.3)
    # la traverse et le montant du milieu, plus légers
    at.boite('plat', 0.48, 0.52, -0.01, 1.01, -0.014, -0.004, 0)
    at.boite('plat', -0.01, 1.01, 0.48, 0.52, -0.014, -0.004, 0)
    for (a, b) in (((0.0, 0.0), (0.5, 0.5)), ((0.5, 0.5), (1.0, 1.0)), ((0.0, 1.0), (0.5, 0.5)), ((0.5, 0.5), (1.0, 0.0))):
        diagonale(at, 'rail', a, b, 0.038, -0.03, -0.012, -0.2)
    # les goussets : au centre et au coin (le coin est partagé : quatre quarts)
    for (x, z) in ((0.5, 0.5), (0.0, 0.0)):
        at.boite('plat', x - 0.07, x + 0.07, z - 0.07, z + 0.07, -0.036, -0.03, 0.5)
        for (dx, dz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            at.dome('rivet', x + dx * 0.045, z + dz * 0.045, 0.006, -0.036, 0.5)
    for k in range(20):
        t = (k + 0.5) / 20
        for (x, z) in ((-0.016, t), (0.016, t), (t, -0.016), (t, 0.016)):
            at.dome('rivet', x, z, 0.0035, -0.024, 0.3)
    # derrière, une tôle de fond à grandes plaques
    for (x0, x1) in ((0.0, 0.5), (0.5, 1.0)):
        for (z0, z1) in ((0.0, 0.5), (0.5, 1.0)):
            at.boite('panneau', x0 + 0.004, x1 - 0.004, z0 + 0.004, z1 - 0.004, 0.0, FOND_Y, rng.uniform(-1, 1))


# --------------------------------------------------------------- 4 blindage
def blindage(at, rng):
    """de lourdes plaques boulonnées et une bande de chevrons de danger qui
    traverse le carreau entre deux cornières"""
    for (z0, z1) in ((0.0, 0.42), (0.58, 1.0)):
        dec = 0.0 if z0 == 0 else 0.33
        for (x0, x1) in rangee([dec, (dec + 0.5) % 1]):
            g = 0.006
            var = rng.uniform(-1, 1)
            at.boite('blinde', x0 + g, x1 - g, z0 + g, z1 - g, -0.012, FOND_Y, var)
            n = 6
            for i in range(n):
                x = x0 + 0.03 + (x1 - x0 - 0.06) * i / (n - 1)
                for z in (z0 + 0.03, z1 - 0.03):
                    at.cylindre('ecrou', x, z, 0.008, -0.02, -0.012, var, seg=6)
    at.boite('rayures', -0.01, 1.01, 0.44, 0.56, -0.006, FOND_Y, 0)
    for z in (0.425, 0.575):
        at.boite('plat', -0.01, 1.01, z - 0.012, z + 0.012, -0.016, FOND_Y, 0.2)


# --------------------------------------------------------------- 5 aération
def aeration(at, rng):
    """quatre bandes de tôle perforée en trous hexagonaux, serties entre des
    plats rivetés — l'air passe, on voit le noir derrière"""
    bandes = [(0.035, 0.215), (0.285, 0.465), (0.535, 0.715), (0.785, 0.965)]
    for (z0, z1) in bandes:
        at.boite('panneau', -0.01, 1.01, z0 - 0.03, z1 + 0.03, 0.0, FOND_Y, rng.uniform(-1, 1))
        at.boite('plat', -0.01, 1.01, z1, z1 + 0.025, -0.008, 0.0, 0.2)
        at.boite('plat', -0.01, 1.01, z0 - 0.025, z0, -0.008, 0.0, 0.2)
        for k in range(16):
            at.dome('rivet', (k + 0.5) / 16, z1 + 0.0125, 0.0035, -0.008, 0.2)
            at.dome('rivet', (k + 0.5) / 16, z0 - 0.0125, 0.0035, -0.008, 0.2)
        # les trous : un pas qui divise 1 (le raccord), rangées décalées
        pas = 1 / 40
        h = pas * math.sqrt(3) / 2
        nz = int((z1 - z0 - 0.01) / h)
        for j in range(nz):
            z = z0 + 0.008 + (j + 0.5) * (z1 - z0 - 0.016) / nz
            for i in range(40):
                x = (i + (0.5 if j % 2 else 0.0)) * pas
                at.cylindre('trou', x, z, pas * 0.4, -0.001, 0.002, 0, seg=6)


# --------------------------------------------------------- 6 hublots condamnés
def hublot_condamne(at, x, z, r, rng):
    at.anneau('plat', x, z, r * 1.25, r * 0.95, -0.02, 0.004, 0.3, seg=72)
    at.boulons(x, z, r * 1.1, 16, -0.02, rr=0.005, var=0.3, phase=0.5)
    # la tape boulonnée qui le condamne, et deux fers en croix
    at.disque('panneau', x, z, r * 0.97, -0.012, 0.0, rng.uniform(-1, 1), seg=72)
    for a in (math.pi / 4, -math.pi / 4):
        diagonale(at, 'lame', (x - r * 0.9 * math.cos(a), z - r * 0.9 * math.sin(a)),
                  (x + r * 0.9 * math.cos(a), z + r * 0.9 * math.sin(a)), r * 0.16, -0.022, -0.012)
    at.dome('rivet', x, z, r * 0.12, -0.024, 0)
    # un liseré de lumière froide filtre encore sous la tape
    at.anneau('fuite', x, z, r * 0.98, r * 0.955, -0.0125, -0.011, 0, seg=72)


def hublots(at, rng):
    """un hublot au centre, un au coin (partagé en quatre quarts par les
    copies) : condamnés, tape boulonnée et fers en croix"""
    for (x0, x1) in ((0.0, 0.5), (0.5, 1.0)):
        for (z0, z1) in ((0.0, 0.5), (0.5, 1.0)):
            at.boite('panneau', x0 + 0.004, x1 - 0.004, z0 + 0.004, z1 - 0.004, 0.0, FOND_Y, rng.uniform(-1, 1))
    hublot_condamne(at, 0.5, 0.5, 0.17, rng)
    hublot_condamne(at, 0.0, 0.0, 0.17, rng)


# ---------------------------------------------------------- 7 écrans morts
def ecrans(at, rng):
    """deux rangées d'écrans de contrôle éteints dans leurs boîtiers, une
    goulotte entre elles ; un voyant de veille çà et là"""
    at.boite('tole', 0.0, 1.0, 0.0, 1.0, 0.0, FOND_Y, 0)
    for (zc, dec) in ((0.27, 0.0), (0.73, 0.25)):
        for k in range(2):
            xc = (dec + 0.25 + k * 0.5) % 1
            w, h = 0.36, 0.3
            var = rng.uniform(-1, 1)
            at.boite('boitier', xc - w / 2, xc + w / 2, zc - h / 2, zc + h / 2, -0.03, 0.0, var)
            at.boite('fond', xc - w / 2 + 0.025, xc + w / 2 - 0.025, zc - h / 2 + 0.04, zc + h / 2 - 0.025, -0.031, -0.028, 0)
            at.boite('ecran', xc - w / 2 + 0.03, xc + w / 2 - 0.03, zc - h / 2 + 0.045, zc + h / 2 - 0.03, -0.032, -0.031, 0)
            for i in range(3):
                at.cylindre('eteint' if i or rng.random() < 0.5 else 'voyant', xc - w / 2 + 0.04 + i * 0.022, zc - h / 2 + 0.02,
                            0.0055, -0.034, -0.03, 0, seg=20)
    at.boite('rail', -0.01, 1.01, 0.48, 0.52, -0.016, 0.0, 0)
    for k in range(8):
        x = (k + 0.5) / 8
        at.boite('lame', x - 0.008, x + 0.008, 0.47, 0.53, -0.02, -0.014, 0)


# ------------------------------------------------------------------ 8 câbles
COULEURS_CABLES = ['cable-ocre', 'cable-bleu', 'cable-gris', 'cable-sang', 'cable-gris', 'cable-bleu']


def cables(at, rng):
    """trois chemins de câbles : un faisceau de câbles de couleur couchés dans
    une gouttière, des colliers, une boîte de jonction"""
    at.boite('tole', 0.0, 1.0, 0.0, 1.0, 0.0, FOND_Y, 0)
    for zc in (1 / 6, 0.5, 5 / 6):
        at.boite('rail', -0.01, 1.01, zc - 0.075, zc + 0.075, -0.004, 0.0, 0)
        at.boite('plat', -0.01, 1.01, zc + 0.075, zc + 0.085, -0.03, 0.0, 0.2)
        at.boite('plat', -0.01, 1.01, zc - 0.085, zc - 0.075, -0.03, 0.0, 0.2)
        n = 9
        for i in range(n):
            z = zc - 0.06 + 0.12 * (i + 0.5) / n + rng.uniform(-0.002, 0.002)
            r = rng.uniform(0.0045, 0.0068)
            at.fut(COULEURS_CABLES[(i + int(zc * 7)) % len(COULEURS_CABLES)], -0.02, 1.02, r, 0, -0.006 - r, z, seg=16)
        for k in range(4):
            x = (k + 0.5) / 4 + rng.uniform(-0.04, 0.04)
            at.boite('lame', x - 0.007, x + 0.007, zc - 0.08, zc + 0.08, -0.024, -0.002, 0)
        xj = rng.uniform(0.1, 0.9)
        at.boite('boitier', xj - 0.05, xj + 0.05, zc - 0.07, zc + 0.07, -0.034, -0.004, rng.uniform(-1, 1))
        for (dx, dz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            at.dome('rivet', xj + dx * 0.038, zc + dz * 0.058, 0.004, -0.034, 0)


def matieres_habillages():
    mats = matieres_biome()
    mats['panneau'] = mat_brosse('hab-acier', (0x1e, 0x2a, 0x32), (0x3e, 0x4e, 0x58), 71, brosse=0.08, rouille=(0x2a, 0x30, 0x2e))
    mats['rivet'] = mats['panneau']
    # la même tôle SANS biseau, pour ce qui couvre tout le carreau : biseautée
    # au bord, elle traçait un liseré à chaque répétition (essai 1)
    mats['tole'] = mats['panneau']
    mats['fond'] = mat_simple('fond', (0x04, 0x06, 0x08), rug=0.9)
    mats['trou'] = mats['fond']
    mats['rail'] = mat_brosse('hab-rail', (0x16, 0x20, 0x26), (0x2e, 0x3c, 0x44), 73, brosse=0.05)
    mats['plat'] = mat_brosse('hab-plat', (0x22, 0x2e, 0x36), (0x44, 0x54, 0x5e), 75, brosse=0.08)
    mats['blinde'] = mat_brosse('hab-blinde', (0x1a, 0x22, 0x2a), (0x38, 0x44, 0x4e), 77, brosse=0.03, rouille=(0x30, 0x2c, 0x26))
    mats['ecrou'] = mat_simple('ecrou', (0x50, 0x58, 0x60), rug=0.45, metal=0.6)
    mats['bride'] = mat_simple('bride', (0x34, 0x3e, 0x48), rug=0.45, metal=0.35)
    mats['volant'] = mat_simple('volant', (0x2a, 0x3c, 0x44), rug=0.5)
    mats['boitier'] = mat_brosse('hab-boitier', (0x24, 0x2e, 0x34), (0x40, 0x4c, 0x54), 79, brosse=0.04)
    mats['etiquette'] = mat_simple('etiquette', (0x5a, 0x62, 0x5e), rug=0.8)
    mats['voyant'] = mat_simple('voyant', (0x10, 0x40, 0x40), rug=0.3, emission=(0x5a, 0xf0, 0xe0), force=2.0)
    mats['eteint'] = mat_simple('eteint', (0x0c, 0x18, 0x1a), rug=0.3)
    # l'écran éteint : mat, sinon il renvoie le soleil de face (le fond de
    # cuve, essai 1) ; un rien bleuté, la dalle d'un écran mort
    mats['ecran'] = mat_simple('ecran', (0x06, 0x0c, 0x12), rug=0.4)
    mats['fuite'] = mat_simple('fuite', (0x0a, 0x30, 0x38), rug=0.6, emission=(0x40, 0xb0, 0xc8), force=0.6)
    # les câbles : des couleurs de câblage, TERNIES (charte : la palette est
    # froide, l'ambre réservé à ce qui luit)
    mats['cable-ocre'] = mat_simple('cable-ocre', (0x6a, 0x58, 0x26), rug=0.6)
    mats['cable-bleu'] = mat_simple('cable-bleu', (0x24, 0x48, 0x6a), rug=0.6)
    mats['cable-gris'] = mat_simple('cable-gris', (0x48, 0x4e, 0x54), rug=0.6)
    mats['cable-sang'] = mat_simple('cable-sang', (0x5a, 0x22, 0x20), rug=0.6)
    return mats


BATIS = [caissons, conduites_h, poutrelle, blindage, aeration, hublots, ecrans, cables]


def lisses(C, mats):
    """ce qui est rond (conduites, câbles, brides) se lisse : en facettes, un
    tuyau montrait ses arêtes au reflet"""
    for ob in C.objects:
        if any(ob.name.endswith(s) for s in ('tuyau', 'bride', 'volant')) or '-cable-' in ob.name:
            ob.data.polygons.foreach_set('use_smooth', [True] * len(ob.data.polygons))
            try:
                ob.data.set_sharp_from_angle(angle=math.radians(40))
            except Exception:
                pass


def habillages():
    vide_scene()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_habillages()
    for nom, bati in zip(NOMS, BATIS):
        carreau(sc, mats, nom, bati, extra=lisses, relief=True)
    # (14/11) la lumière neutre : ce sont les lampes du jeu qui sculptent
    # les habillages, par le relief rangé dans l'alpha (relief.py)
    lumiere_neutre(sc)
    sc.cycles.device = 'GPU'


def assemble(dossier, sortie):
    """les huit rendus en un atlas 4×2 (hors de Blender, avec pillow). Rendus
    avec leur relief (14/11, relief/<nom>.npy), il va dans l'alpha CASE PAR
    CASE : chacune a sa fenêtre (les conduites dépassent de 15 cm, l'aération
    de 1) — la profondeur de chaque case est imprimée, et le raccord de sa
    couleur et de son relief, que prepare.py ne mesure pas dans un atlas"""
    import numpy as np
    from PIL import Image
    ici = os.path.dirname(os.path.abspath(__file__))
    sys.path[:0] = [ici, os.path.dirname(ici)]
    import relief
    from prepare import raccord
    avec = all(os.path.exists(os.path.join(dossier, 'relief', n + '.npy')) for n in NOMS)
    atlas = Image.new('RGBA' if avec else 'RGB', (4096, 2048))
    for i, nom in enumerate(NOMS):
        if avec:
            im, prof = relief.monte(dossier, nom)
        else:
            im, prof = Image.open(os.path.join(dossier, nom + '.png')).convert('RGB'), None
        if im.size != (1024, 1024):
            im = im.resize((1024, 1024), Image.LANCZOS)
        a = np.asarray(im, dtype=np.float32) / 255
        mes = [raccord(a[..., :3], 'x'), raccord(a[..., :3], 'y')]
        if prof is not None:
            mes += [raccord(a[..., 3:], 'x'), raccord(a[..., 3:], 'y')]
            print(f'{nom:<16} profondeur {prof:.4f} salle   raccord {mes[0]:.1f} / {mes[1]:.1f}   relief {mes[2]:.1f} / {mes[3]:.1f}')
        atlas.paste(im, ((i % 4) * 1024, (i // 4) * 1024))
    atlas.save(sortie)


if __name__ == '__main__' and not DANS_BLENDER:
    d = sys.argv[1]
    assemble(d, sys.argv[2] if len(sys.argv) > 2 else os.path.join(d, 'paroi-atlas.png'))
