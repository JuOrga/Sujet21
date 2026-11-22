"""LA PORTE BLINDÉE (22/11) — `porte-blindee.webp`, l'atlas des portes que
l'éditeur pose (level.portes).

Jusqu'ici une porte se dessinait au trait, en ROUGE : une « barrière
d'énergie », un aplat translucide barré de lignes. Le rouge est réservé à
l'alerte des cinématiques (charte §3) et rien d'autre dans la station n'est
un hologramme (charte §1) : la porte était le seul objet du tableau qui ne
venait pas de l'atelier. Le concepteur la voulait « comme le protocole porte
de grange » — le verrouillage d'Avengers: Endgame, où de lourds volets
blindés scellent la salle d'un coup. Ici : une DALLE D'ACIER ESCAMOTABLE,
qui SORT DU SOL pour fermer le passage et s'y ENFONCE pour l'ouvrir (« on
voit vraiment la porte s'enfoncer dans le sol et ça libère le passage », le
concepteur, 22/11) — ni montant ni cadre de part et d'autre : ouverte, il ne
reste que la fente au ras du sol.

LA VUE EST CELLE DU JEU : de DESSUS, et relief allumé (la 2,5D, le réglage
par défaut), une des deux grandes faces descend du sommet au pied. Le
premier essai peignait les chevrons du volet sur le dessus — une porte vue de
face, couchée au sol (« on la voit de haut »). Le dessus n'est donc que la
TRANCHE HAUTE d'une dalle épaisse ; ce qui fait la porte blindée (les
chevrons, les panneaux) est sur sa FACE, que le relief dévoile, et qui
grandit depuis le sol pendant que la porte monte.

QUATRE PIÈCES, la longueur à l'horizontale :
  · `dessus` (320 × 160, vu d'en haut) — la tranche haute de la dalle : les
    deux tôles de blindage vues de chant le long des bords, un joint sarcelle
    entre chacune et l'âme, l'âme nervurée en travers, l'échine boulonnée au
    milieu. 160 px = l'épaisseur ; le carreau se RÉPÈTE le long de la porte,
    le joint de plaque à cheval sur ses deux bords (la copie de chaque côté
    le referme) ;
  · `bout` (96 × 160, vu d'en haut) — le sabot d'extrémité, posé aux deux
    bouts (le second en miroir) : le joint de caoutchouc à x = 0, qui frotte
    contre le mur quand la dalle monte, le bloc boulonné, la veilleuse ;
  · `flanc` (320 × 280, en ÉLÉVATION, le haut en haut) — la grande face, la
    tranche du relief : la lèvre de tête, LA BANDE DE CHEVRONS juste
    dessous (c'est elle qui sort du sol la première), deux panneaux de
    blindage et leur nervure boulonnée, le joint du pied. Dessinée en unités
    de jeu, comme les flancs des pièces (flancs_pieces.py) : 2 px par unité,
    un mur haut fait 140 unités (280 px) ; le carreau couvre DEUX carreaux
    du dessus (son joint du milieu tombe sous le leur). Le moteur l'accroche
    par le HAUT : une porte à moitié sortie montre la moitié haute de sa face ;
  · `fente` (320 × 160, vue d'en haut) — les deux lèvres de la fente au sol,
    DÉTOURÉES, peintes de chevrons au pochoir : ce qu'on voit d'une porte
    ouverte (avant : un cadre pointillé vert, couleur de la serre). Le
    milieu est vide : le fluide qui franchit la porte ouverte s'y voit.

Le moteur (src/render/porteBlindee.ts) découpe l'atlas aux rectangles de
`atlas_rects()` — un contrat : les mêmes nombres y sont recopiés, et
porteBlindee.spec.ts relit ce fichier pour le vérifier.

Unités : 1 = 1024 px, comme tout l'atelier ; x le long de la porte, z en
travers (ou la hauteur, pour le flanc), l'avant en y négatif.

Dans Blender :
    DOSSIER = r'...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\porte_blindee.py', encoding='utf-8').read())
    porte() ; lance(NOMS, SORTIE, 384)
ou sans fenêtre, avec le module bpy (pip install bpy) — ~3 min sur 4 cœurs :
    python tools/images/blender/porte_blindee.py --rend SORTIE [échantillons]
puis, hors de Blender, l'assemblage de l'atlas :
    python -I tools/images/blender/porte_blindee.py SORTIE masters/images/porte-blindee.png
    python3 tools/images/prepare.py porte-blindee
"""
import math, os, sys

DANS_BLENDER = 'bpy' in sys.modules
if DANS_BLENDER:
    import bpy, bmesh
    from mathutils import Matrix, Vector
    # (sas_raccord.py charge surfaces.py, qui charge chaud_biome.py : l'acier
    # brossé, les veilleuses ambre, la lumière de la charte)
    _src = os.path.join(DOSSIER, 'sas_raccord.py')
    exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

PREFIXE = 'porte-'
NOMS = ['dessus', 'bout', 'flanc', 'fente']
W = 160    # px : l'épaisseur de la porte, dans les pièces vues d'en haut
HF = 280   # px : la hauteur du flanc — un mur haut (140 unités), à 2 px l'unité
LT = 320   # px : le carreau répété du dessus, du flanc et de la fente
LB = 96    # px : le sabot d'extrémité
VEILLEUSE_X = 30   # px : la veilleuse dans le sabot (porteBlindee.ts la fait battre)
J = 3      # px : le demi-joint de plaque, à chaque bout du carreau
# L'ATLAS : les pièces côte à côte, dans l'ordre de NOMS, séparées et
# entourées d'une gouttière transparente (le moteur découpe chaque pièce à
# l'échelle 1 dans sa propre toile : rien ne bave d'une pièce à l'autre, et
# le bord de l'atlas reste vide, comme prepare.py l'exige d'un détourage).
GOUTTIERE = 4
LARGEURS = {'dessus': LT, 'bout': LB, 'flanc': LT, 'fente': LT}
HAUTEURS = {'dessus': W, 'bout': W, 'flanc': HF, 'fente': W}

# LA COUPE DE LA DALLE, en travers (px ; z = 0 et 160 : les deux faces) — la
# même pour le dessus et le sabot
PEAU = 12          # la tôle de blindage, vue de chant, le long de chaque face
JOINT = 5          # le joint sarcelle entre la tôle et l'âme
ECHINE = (62, 98)  # l'échine boulonnée, au milieu


def atlas_rects():
    """{nom: (x, y, largeur, hauteur)} — recopié dans porteBlindee.ts"""
    out, x = {}, GOUTTIERE
    for n in NOMS:
        out[n] = (x, GOUTTIERE, LARGEURS[n], HAUTEURS[n])
        x += LARGEURS[n] + GOUTTIERE
    return out, (x, max(HAUTEURS.values()) + 2 * GOUTTIERE)


def u(v):
    """des px de la pièce en unités de l'atelier"""
    return v / 1024


def coupe_x(pts, xa, xb):
    """un polygone (x, z) rogné entre deux verticales (Sutherland–Hodgman) :
    les chevrons s'arrêtent au joint de plaque"""
    def un(pts, garde, coupe):
        out = []
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            if garde(a):
                out.append(a)
            if garde(a) != garde(b):
                t = coupe(a, b)
                out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
        return out
    pts = un(pts, lambda p: p[0] >= xa, lambda a, b: (xa - a[0]) / (b[0] - a[0]))
    if len(pts) < 3:
        return []
    pts = un(pts, lambda p: p[0] <= xb, lambda a, b: (xb - a[0]) / (b[0] - a[0]))
    return pts if len(pts) >= 3 else []


def chevrons(at, mat, x0, x1, za, zb, sens, pas, larg, yf, yb, var=0.0):
    """des bandes parallèles à 45°, rognées à x0..x1 : `sens` +1 monte vers
    +x, −1 descend — en gris pâle sur l'acier, la seule « peinture de
    danger » que la palette froide admet"""
    h = zb - za
    k0 = math.floor((x0 - h - larg) / pas) - 1
    k1 = math.ceil(x1 / pas) + 1
    for k in range(k0, k1 + 1):
        a = k * pas
        if sens > 0:
            pts = [(a, za), (a + larg, za), (a + larg + h, zb), (a + h, zb)]
        else:
            pts = [(a + h, za), (a + h + larg, za), (a + larg, zb), (a, zb)]
        pts = coupe_x(pts, x0, x1)
        if pts:
            at.prisme(mat, pts, yf, yb, var)


def matieres_porte():
    mats = matieres_sas()
    # l'acier de la dalle : un cran plus froid que celui du sas (elle sort du
    # sol de la cuve, pas de la coque), même brossé
    mats['blindage'] = mat_brosse('porte-blindage', (0x2c, 0x35, 0x40), (0x5a, 0x65, 0x72), 91, brosse=0.08)
    # le gris pâle des pièces (#9aa3ab, charte §3), usé : les chevrons
    mats['peint'] = mat_brosse('porte-peint', (0x6a, 0x72, 0x7b), (0x9e, 0xa7, 0xb0), 93, brosse=0.12)
    mats['joint'] = mat_simple('porte-joint', (0x12, 0x14, 0x17), rug=0.85)
    mats['ecrou'] = mat_simple('porte-ecrou', (0x5a, 0x63, 0x6c), rug=0.38, metal=0.6)
    # le joint de tête : le sarcelle de la charte, terni — un filet, pas un
    # néon (l'iris le porte à 1,6 ; posé sur un objet plus petit, 1,1)
    mats['sarcelle'] = mat_simple('porte-sarcelle', (0x14, 0x3a, 0x4c), rug=0.3, emission=(0x63, 0xb7, 0xe6), force=1.1)
    return mats


BISEAU_PORTE = dict(BISEAU_SAS, blindage=0.0025, peint=0.0012, joint=0.0015, ecrou=0.0008) if DANS_BLENDER else {}


def lampe(at, x, z, y):
    """la veilleuse du sabot : un boîtier vissé, la lentille ambre couchée en
    travers de la porte — petite : la porte fait 40 unités d'épaisseur en
    jeu, la veilleuse doit y tenir à 6"""
    at.boite('acier', x - u(9), x + u(9), z - u(22), z + u(22), y - 0.006, y, -0.3)
    at.boite('cerne', x - u(6), x + u(6), z - u(16), z + u(16), y - 0.008, y - 0.006, 0)
    at.boite('veilleuse', x - u(4), x + u(4), z - u(12), z + u(12), y - 0.010, y - 0.008, 0)
    for dz in (-u(19), u(19)):
        at.dome('rivet', x, z + dz, 0.0022, y - 0.0065, 0)


# ------------------------------------------------------------------ les pièces
def dessus(sc, mats):
    nom = 'dessus'
    P = parent(sc, nom)
    M = sous(P, nom + '-motif')
    at = Atelier()
    L, j = u(LT), u(J)
    # la tôle de fond, au fond des joints de plaque
    at.boite('creux', 0, L, 0, u(W), -0.012, 0.02, 0)
    # les deux tôles de blindage, vues de chant : le plus haut de la dalle,
    # une arête claire au biseau — la lèvre de tête du flanc, vue d'en haut
    for a, b in ((0, PEAU), (W - PEAU, W)):
        at.boite('bride', j, L - j, u(a), u(b), -0.052, -0.012, 0.2)
    # le joint entre chaque tôle et l'âme : un filet sarcelle au fond d'une
    # fente
    for a in (PEAU, W - PEAU - JOINT):
        at.boite('sarcelle', j, L - j, u(a + 1), u(a + JOINT - 1), -0.031, -0.012, 0)
    # l'âme, plus bas que les tôles, nervurée EN TRAVERS : ce qui dit, vu d'en
    # haut, l'épaisseur d'une dalle (des raidisseurs, pas une plaque peinte)
    za, zb = PEAU + JOINT, W - PEAU - JOINT
    at.boite('blindage', j, L - j, u(za), u(zb), -0.040, -0.012, 0.1)
    n = 16
    for k in range(n):
        x = j + (L - 2 * j) * (k + 0.5) / n
        for a, b in ((za, ECHINE[0] - 4), (ECHINE[1] + 4, zb)):
            at.boite('blindage', x - u(2.6), x + u(2.6), u(a), u(b), -0.046, -0.040, 0.1)
    # l'échine : une poutre boulonnée de part et d'autre d'une gorge
    at.boite('acier', j, L - j, u(ECHINE[0]), u(ECHINE[1]), -0.054, -0.040, -0.2)
    at.boite('creux', j, L - j, u(78), u(82), -0.0548, -0.053, 0)
    for k in range(8):
        x = j + (L - 2 * j) * (k + 0.5) / 8
        for z in (70, 90):
            at.cylindre('ecrou', x, u(z), u(3.4), -0.0575, -0.054, 0, seg=6)
    at.objets(M, mats, BISEAU_PORTE, False, 'porte-dessus')
    copies(P, M, [(-L, 0), (L, 0)])
    declare(nom, P, 0, L, 0, u(W), mx=MARGE, alpha=True)


def bout(sc, mats):
    nom = 'bout'
    P = parent(sc, nom)
    at = Atelier()
    B, j = u(LB), u(J)
    at.boite('creux', 0, B, 0, u(W), -0.012, 0.02, 0)
    # le joint de caoutchouc, côté mur (x = 0) : il frotte contre le mur quand
    # la dalle monte — strié en travers
    at.boite('joint', 0, u(12), u(5), u(W - 5), -0.046, -0.012, 0)
    for k in range(1, 9):
        zc = u(5 + k * (W - 10) / 9)
        at.boite('creux', u(2), u(10), zc - u(1.2), zc + u(1.2), -0.0468, -0.0455, 0)
    # le bloc du sabot, au niveau des tôles, sa plaque et ses boulons
    at.boite('cadre', u(12), B - j, 0, u(W), -0.052, -0.012, -0.3)
    at.boite('bride', u(46), B - u(10), u(ECHINE[0] - 14), u(ECHINE[1] + 14), -0.057, -0.052, 0.1)
    for x in (u(52), B - u(16)):
        for z in (ECHINE[0] - 7, ECHINE[1] + 7):
            at.cylindre('ecrou', x, u(z), u(4), -0.060, -0.057, 0, seg=6)
    for x in (u(22), B - u(12)):
        for z in (22, W - 22):
            at.cylindre('ecrou', x, u(z), u(4.5), -0.0555, -0.052, 0, seg=6)
    lampe(at, u(VEILLEUSE_X), u(W / 2), -0.052)
    at.objets(P, mats, BISEAU_PORTE, False, 'porte-bout')
    declare(nom, P, 0, B, 0, u(W), alpha=True)


def flanc(sc, mats):
    """la grande face, en élévation : z = 0 au pied, HF au sommet"""
    nom = 'flanc'
    P = parent(sc, nom)
    M = sous(P, nom + '-motif')
    at = Atelier()
    L, j = u(LT), u(J)
    at.boite('creux', 0, L, 0, u(HF), -0.012, 0.02, 0)
    # la lèvre de tête : la tôle de blindage que le dessus montre de chant
    at.boite('bride', j, L - j, u(262), u(HF), -0.040, -0.012, 0.2)
    # LA BANDE DE CHEVRONS, sous la tête : c'est elle qui sort du sol la
    # première — le volet blindé qu'on doit voir venir
    at.boite('bride', j, L - j, u(254), u(262), -0.032, -0.012, 0.2)
    at.boite('blindage', j, L - j, u(208), u(254), -0.026, -0.012, 0.05)
    chevrons(at, 'peint', j, L - j, u(210), u(252), 1, u(40), u(18), -0.0268, -0.0258)
    at.boite('bride', j, L - j, u(200), u(208), -0.032, -0.012, 0.2)
    # deux panneaux de blindage, la nervure boulonnée entre eux ; un joint
    # vertical au milieu, sous celui du dessus — et rien d'autre : la dalle
    # n'a ni montant ni cadre, elle glisse dans sa fente
    for a, b, v in ((20, 104, -0.2), (114, 200, 0.25)):
        for x0, x1 in ((j, u(LT / 2) - u(1.5)), (u(LT / 2) + u(1.5), L - j)):
            at.boite('blindage', x0, x1, u(a), u(b), -0.026, -0.012, v)
            e = u(5)
            for (c0, c1, d0, d1) in ((x0, x1, u(a), u(a) + e), (x0, x1, u(b) - e, u(b)),
                                      (x0, x0 + e, u(a), u(b)), (x1 - e, x1, u(a), u(b))):
                at.boite('blindage', c0, c1, d0, d1, -0.030, -0.026, v)
    at.boite('bride', j, L - j, u(104), u(114), -0.034, -0.012, 0.2)
    for k in range(8):
        at.cylindre('ecrou', j + (L - 2 * j) * (k + 0.5) / 8, u(109), u(3.2), -0.037, -0.034, 0, seg=6)
    # le joint du pied, continu d'une plaque à l'autre, et sa lèvre
    at.boite('bride', j, L - j, u(14), u(20), -0.032, -0.012, 0.2)
    at.boite('joint', 0, L, 0, u(14), -0.022, -0.012, 0)
    at.objets(M, mats, BISEAU_PORTE, False, 'porte-flanc')
    copies(P, M, [(-L, 0), (L, 0)])
    declare(nom, P, 0, L, 0, u(HF), mx=MARGE, alpha=True)


def fente(sc, mats):
    """les deux lèvres de la fente au sol, d'où sort la dalle : à plat, peintes
    de chevrons au pochoir en sens contraires ; leur pas (32 px) divise le
    carreau, le motif se suit. Le milieu reste VIDE (détouré) : porte
    ouverte, le fluide qui passe dessus doit se voir"""
    nom = 'fente'
    P = parent(sc, nom)
    M = sous(P, nom + '-motif')
    at = Atelier()
    L = u(LT)
    for a, b, sens in ((0, 22, 1), (138, 160, -1)):
        at.boite('blindage', 0, L, u(a), u(b), -0.010, 0.0, 0)
        chevrons(at, 'peint', 0, L, u(a + 3), u(b - 3), sens, u(32), u(13), -0.0106, -0.0099)
    # le bord intérieur des lèvres : une cornière, l'ombre de la fente
    for a, b in ((22, 27), (133, 138)):
        at.boite('acier', 0, L, u(a), u(b), -0.006, 0.0, 0)
    at.objets(M, mats, BISEAU_PORTE, False, 'porte-fente')
    copies(P, M, [(-L, 0), (L, 0)])
    declare(nom, P, 0, L, 0, u(W), mx=MARGE, alpha=True)


def porte():
    vide_scene()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_porte()
    dessus(sc, mats)
    bout(sc, mats)
    flanc(sc, mats)
    fente(sc, mats)
    lumiere_camera(sc)
    sc.cycles.device = 'GPU'


# -------------------------------------------------------- hors de Blender
def assemble(dossier, sortie):
    """les quatre rendus détourés (dossier/alpha/porte-<nom>.png) en un atlas,
    avec pillow ; imprime ce que prepare.py mesurera"""
    import numpy as np
    from PIL import Image
    rects, (lw, lh) = atlas_rects()
    atlas = Image.new('RGBA', (lw, lh), (0, 0, 0, 0))
    for n in NOMS:
        im = Image.open(os.path.join(dossier, 'alpha', f'{PREFIXE}{n}.png')).convert('RGBA')
        x, y, w, h = rects[n]
        if im.size != (w, h):
            raise SystemExit(f'{n} : {im.size[0]}×{im.size[1]} rendu, {w}×{h} attendu')
        atlas.paste(im, (x, y))
        a = np.asarray(im, dtype=np.float32) / 255
        al = a[..., 3]
        lum = (a[..., :3] @ np.array([0.2126, 0.7152, 0.0722]) * al).sum() / max(al.sum(), 1)
        print(f'{n:<8} {w}×{h}  luminance {lum:.3f}  couvert {al.mean():.0%}')
    atlas.save(sortie)
    print('atlas', f'{lw}×{lh}', '→', sortie)


def rend_sans_fenetre(sortie, echantillons):
    """le rendu sans l'interface de Blender (module bpy) : `lance` passe par un
    minuteur de la fenêtre, qui n'existe pas ici — on rend à la suite"""
    import json
    for d in ('brut', 'alpha'):
        os.makedirs(os.path.join(sortie, d), exist_ok=True)
    porte()
    bpy.context.scene.cycles.device = 'CPU'
    for n in NOMS:
        print(json.dumps(rend(n, sortie, echantillons), ensure_ascii=False), flush=True)


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--rend':
        import bpy
        DOSSIER = os.path.dirname(os.path.abspath(__file__))
        DANS_BLENDER = True
        exec(compile(open(os.path.join(DOSSIER, 'sas_raccord.py'), encoding='utf-8').read(), 'sas_raccord.py', 'exec'), globals())
        from mathutils import Matrix, Vector
        # (les ateliers chargés ont remis leurs propres valeurs)
        PREFIXE = 'porte-'
        BISEAU_PORTE = dict(BISEAU_SAS, blindage=0.0025, peint=0.0012, joint=0.0015, ecrou=0.0008)
        rend_sans_fenetre(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 384)
    elif not DANS_BLENDER and len(sys.argv) > 2:
        assemble(sys.argv[1], sys.argv[2])
