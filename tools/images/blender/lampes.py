"""LES DEUX LUMINAIRES, refaits dans Blender (16/11) — lampe-plafonnier.webp
(512², rond) et lampe-bande.webp (1024 × 256, le bandeau).

Les anciens sortaient du générateur : le DOS d'une lampe, du métal clair et
rien d'allumé. En jeu, c'étaient des pastilles pâles et, pour le bandeau —
étiré d'un seul tenant à la longueur de la lampe —, une barre laiteuse aux
embouts pointus : « c'est moche » (le concepteur, 16/11).

On regarde toujours le luminaire PAR-DESSUS (il est au plafond, la caméra
au-dessus de lui) : un capot, pas une vitre. Mais un capot qui dit ce qu'il
est — un acier sombre à ailettes de refroidissement, des pattes boulonnées,
et LA LUMIÈRE QUI FUIT tout autour, par le jeu entre le capot et sa
monture : un liseré blanc froid, seul élément clair de la pièce. La flaque
et le halo au sol restent ceux du moteur (la carte de lumière).

Le cadrage est celui que le moteur attend (renderer.ts : drawLampes) : le
quad déborde le corps de 35 % pour les pattes — le corps a donc un rayon de
1 / 1,35 de la demi-image. LE BANDEAU SE DESSINE EN TROIS TRANCHES (lampes.ts
: tranchesBandeau) : deux embouts carrés, jamais étirés, et un milieu qui
s'allonge — tout ce qui est dans le milieu de l'image (de 0,25 à 0,75) est
donc UNIFORME le long de la barre : des ailettes filantes, pas de boulons.

Dans Blender :
    DOSSIER = r'...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\lampes.py', encoding='utf-8').read())
    lampes() ; lance(LAMPES, SORTIE, 256)
    (SORTIE : masters\\images\\lampes, avec brut\\ et alpha\\)
"""
import bpy, bmesh, math, os, random
from mathutils import Matrix, Vector

_src = os.path.join(DOSSIER, 'surfaces.py')
exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

PREFIXE = 'lampe-'
LAMPES = ['plafonnier', 'bande']
DEBORD = 1.35             # le quad du moteur, rapporté au corps


def matieres_lampes():
    mats = matieres_biome()
    mats['capot'] = mat_brosse('lampe-capot', (0x26, 0x32, 0x3e), (0x50, 0x60, 0x6e), 81, brosse=0.10)
    mats['plat'] = mat_brosse('lampe-monture', (0x32, 0x40, 0x4c), (0x5e, 0x6e, 0x7c), 83, brosse=0.08)
    mats['rail'] = mat_brosse('lampe-ailette', (0x1a, 0x24, 0x2e), (0x38, 0x46, 0x52), 85, brosse=0.05)
    mats['rivet'] = mats['plat']
    mats['ecrou'] = mat_simple('lampe-ecrou', (0x58, 0x62, 0x6c), rug=0.4, metal=0.6)
    # la lumière qui fuit : un blanc froid — c'est le seul clair de la
    # pièce, il doit se lire à 40 pixels d'écran. À force 5, il sortait en
    # blanc pur, écrêté, un trait de feutre (essai 1) : à 1, il garde sa
    # teinte, et l'acier éclairci autour le porte au lieu de le découper
    mats['fuite'] = mat_simple('lampe-fuite', (0xc8, 0xe6, 0xff), rug=0.5, emission=(0xc4, 0xe6, 0xff), force=1.0)
    return mats


def piece(sc, mats, nom, bati, x1, z1):
    P = parent(sc, nom)
    at = Atelier()
    bati(at)
    at.objets(P, mats, {'capot': 0.0016, 'plat': 0.0012, 'rail': 0.0008}, prefixe='lampe-' + nom)
    for ob in P.objects:
        if ob.name.endswith(('capot', 'fuite')):
            ob.data.polygons.foreach_set('use_smooth', [True] * len(ob.data.polygons))
            try:
                ob.data.set_sharp_from_angle(angle=math.radians(40))
            except Exception as e:
                print('lissage :', e)
    declare(nom, P, 0, x1, 0, z1, alpha=True)


def plafonnier(at):
    c = 0.25                      # le centre de l'image (0,5 de côté)
    R = c / DEBORD                # le corps
    # la fuite de lumière, sous le capot, qui déborde en liseré
    at.disque('fuite', c, c, R * 1.0, -0.004, 0.0, 0, seg=96)
    # la monture : une couronne fine, détachée du capot par le liseré
    at.anneau('plat', c, c, R * 1.0, R * 0.95, -0.012, 0.0, 0.3, seg=96)
    # le capot, bombé en deux gradins
    # (à 0,88 du rayon, la lumière n'était plus qu'un fil à la taille du
    # jeu — une pastille sombre, essai 3 : le capot rentre, la lumière prend
    # le tiers extérieur)
    at.disque('capot', c, c, R * 0.66, -0.02, 0.0, 0, seg=96)
    at.disque('capot', c, c, R * 0.46, -0.03, -0.02, 0.4, seg=96)
    # les ailettes : des couronnes dressées sur le premier gradin
    for k in range(2):
        r = R * (0.63 - k * 0.075)
        at.anneau('rail', c, c, r, r - R * 0.03, -0.027, -0.02, 0, seg=96)
    # le moyeu et son écrou
    at.disque('plat', c, c, R * 0.22, -0.038, -0.03, 0.3, seg=48)
    at.cylindre('ecrou', c, c, R * 0.11, -0.046, -0.038, 0, seg=6)
    # quatre fentes rayonnantes sur le gradin haut : la chaleur sort par là
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        at.boite('rail', c + math.cos(a) * R * 0.35 - R * 0.07, c + math.cos(a) * R * 0.35 + R * 0.07,
                 c + math.sin(a) * R * 0.35 - R * 0.02, c + math.sin(a) * R * 0.35 + R * 0.02,
                 -0.0305, -0.0285, 0, rot=Matrix.Rotation(-a, 4, 'Y'))
    # quatre bras portent le capot à travers l'anneau de lumière
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        rm = R * 0.8
        at.boite('plat', c + math.cos(a) * rm - R * 0.17, c + math.cos(a) * rm + R * 0.17, c + math.sin(a) * rm - R * 0.03, c + math.sin(a) * rm + R * 0.03,
                 -0.012, 0.0, 0.3, rot=Matrix.Rotation(-a, 4, 'Y'))
    # les quatre pattes, de la monture au bord de l'image, boulonnées
    for k in range(4):
        a = k * math.pi / 2
        ca, sa = math.cos(a), math.sin(a)
        rm = R * 1.13
        at.boite('plat', c + ca * rm - R * 0.2, c + ca * rm + R * 0.2, c + sa * rm - R * 0.105, c + sa * rm + R * 0.105,
                 -0.01, 0.0, 0.3, rot=Matrix.Rotation(-a, 4, 'Y'))
        at.cylindre('ecrou', c + ca * R * 1.2, c + sa * R * 1.2, R * 0.055, -0.016, -0.01, 0, seg=6)


def bande(at):
    zc = 0.125                    # l'axe (l'image fait 1 × 0,25)
    R = zc / DEBORD               # la demi-hauteur du corps
    xa, xb = 0.125, 0.875         # les deux bouts du segment de la lampe
    # la fuite : une gélule claire sous le capot, qui déborde en liseré
    at.boite('fuite', xa, xb, zc - R, zc + R, -0.004, 0.0, 0)
    # (les disques un cheveu plus bas que le pavé : deux faces émissives
    # confondues se sommaient en une tache blanche, essai 2)
    for x in (xa, xb):
        at.disque('fuite', x, zc, R, -0.0036, 0.0, 0, seg=64)
    # la monture : deux lisses le long de la barre, une couronne à chaque
    # bout — le liseré de lumière passe entre elle et le capot
    for s in (-1, 1):
        z0, z1 = sorted((zc + s * R * 0.95, zc + s * R))
        at.boite('plat', xa, xb, z0, z1, -0.012, 0.0, 0.3)
    # (une couronne ENTIÈRE montrait sa moitié intérieure en travers du
    # liseré, essai 2 : la demi-couronne se pose en petits pavés tangents)
    n = 28
    for x, s0 in ((xa, 1), (xb, -1)):
        for i in range(n):
            ang = math.pi / 2 + s0 * math.pi * (i + 0.5) / n
            ca, sa = math.cos(ang), math.sin(ang)
            demi = math.pi * R * 0.975 / n * 0.56
            at.boite('plat', x + ca * R * 0.975 - demi, x + ca * R * 0.975 + demi, zc + sa * R * 0.975 - R * 0.025, zc + sa * R * 0.975 + R * 0.025,
                     -0.012, 0.0, 0.3, rot=Matrix.Rotation(-(ang + math.pi / 2), 4, 'Y'))
    # le capot : une gélule plus étroite, en deux gradins
    # (large de 0,84, il ne laissait qu'un fil de lumière à la taille du
    # jeu, essai 3 : une épine centrale, la lumière de part et d'autre)
    for (k, y0, y1, var) in ((0.46, -0.02, 0.0, 0.0), (0.28, -0.03, -0.02, 0.4)):
        at.boite('capot', xa, xb, zc - R * k, zc + R * k, y0, y1, var)
        for x in (xa, xb):
            at.disque('capot', x, zc, R * k, y0, y1, var, seg=64)
    # deux ailettes filantes sur le premier gradin, de part et d'autre —
    # UNIFORMES le long de la barre : le milieu s'allonge sans les déformer
    for s in (-1, 1):
        at.boite('rail', xa, xb, zc + s * R * 0.37 - R * 0.035, zc + s * R * 0.37 + R * 0.035, -0.027, -0.02, 0)
    # une nervure filante sur le gradin haut
    at.boite('rail', xa, xb, zc - R * 0.05, zc + R * 0.05, -0.034, -0.03, 0)
    # les embouts : une bride, son écrou, et la patte qui sort du cadre
    for x, s in ((xa, -1), (xb, 1)):
        at.disque('plat', x, zc, R * 0.3, -0.038, -0.03, 0.3, seg=40)
        at.cylindre('ecrou', x, zc, R * 0.15, -0.046, -0.038, 0, seg=6)
        at.boite('plat', x + s * R * 0.95 - R * 0.28, x + s * R * 0.95 + R * 0.28, zc - R * 0.2, zc + R * 0.2, -0.01, 0.0, 0.3)
        at.cylindre('ecrou', x + s * R * 1.08, zc, R * 0.085, -0.016, -0.01, 0, seg=6)


def lampes():
    """bâtit les deux luminaires dans LEUR scène (« lampes »), sans vider le
    fichier ouvert (vide_scene efface tous les objets de toutes les scènes)"""
    ancienne = bpy.data.scenes.get('lampes')
    sc = bpy.data.scenes.new('lampes-neuve')
    bpy.context.window.scene = sc
    if ancienne:
        for o in list(ancienne.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        for c in list(ancienne.collection.children_recursive):
            bpy.data.collections.remove(c)
        bpy.data.scenes.remove(ancienne)
    sc.name = 'lampes'
    PIECES.clear()
    mats = matieres_lampes()
    piece(sc, mats, 'plafonnier', plafonnier, 0.5, 0.5)
    piece(sc, mats, 'bande', bande, 1.0, 0.25)
    lumiere_camera(sc)
    sc.cycles.device = 'GPU'
    return sc
