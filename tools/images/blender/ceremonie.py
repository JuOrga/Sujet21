r"""L'ATELIER DE LA CÉRÉMONIE « STATION » (13/11) — les pictogrammes rendus qui
remplacent les émojis des écrans de récompense, puis du jeu entier.

Pourquoi des objets et pas des pictos plats : la cérémonie se passe DANS la
station (conception du 13/11, docs/superpowers/specs/2026-11-13-ceremonie-
station-design.md). Chaque icône est donc un objet qu'on y trouverait — une
goutte sous cloche, un cristal, une sphère en cage, une bonbonne, un bocal,
une colonne cerclée, un manomètre… — modélisé ici par script, dans l'acier, la
lumière et le grain de l'atelier des surfaces (surfaces.py, qui charge
chaud_biome.py et chaud_tole.py) : mêmes trois soleils froids, mêmes bruits
pris sur le tore, même vue orthographique de face. Ce qui change : l'acier est
un cran plus clair que celui des murs (une icône se lit à 32 px sur le voile
sombre de la cérémonie, un mur doit au contraire rester sous l'eau), et les
objets sont un peu inclinés vers la caméra pour montrer leur dessus.

La planche : 7 colonnes × 4 rangées de cases de 512², dans l'ordre de
ICONES_CEREMONIE (src/game/iconesStation.ts) — la case i est en colonne i % 7,
rangée i // 7 ; les deux dernières restent vides. C'est un CONTRAT : changer
l'ordre ici sans le changer là-bas, c'est montrer un manomètre à la place
d'une bonbonne.

Dans Blender, en UN SEUL appel (le MCP ne garde rien d'un appel à l'autre ;
le rendu ne bloque pas : lance() passe par un minuteur) :
    DOSSIER = r'\\wsl.localhost\Ubuntu\home\julian\projets\sujet21\tools\images\blender'
    exec(compile(open(DOSSIER + r'\ceremonie.py', encoding='utf-8').read(), DOSSIER + r'\ceremonie.py', 'exec'))
    atelier() ; lance(ICONES, SORTIE, 192)       # la planche d'icônes
    sceaux() ; lance(SCEAUX, SORTIE, 192)        # la planche des sceaux
    cuves() ; lance_cuves(SORTIE, 192)           # les cuves (dos, verre, sonde) et l'anneau
    instruments() ; lance(INSTRUMENTS, SORTIE, 160)  # la planche des instruments
atelier(), sceaux(), cuves() et instruments() rendent dans une scène À EUX, `ceremonie`, et y
basculent la fenêtre : la scène d'origine reste intacte, on y revient à la
main. Puis, hors de Blender, l'assemblage (et une planche de contrôle
réduite à 32 et 64 px, pour juger la lisibilité) :
    python -I tools/images/blender/ceremonie.py icones <rendus> masters/images/ceremonie-icones.png [contrôle.png]
    python -I tools/images/blender/ceremonie.py sceaux <rendus> masters/images/ceremonie-sceaux.png [contrôle.png]
    python -I tools/images/blender/ceremonie.py instruments <rendus> masters/images/instruments-icones.png [contrôle.png]
    python -I tools/images/blender/ceremonie.py cuves <rendus> masters/images [contrôle.png]
(la dernière écrit les sept masters des cuves et de l'anneau, et IMPRIME les
fenêtres de liquide et les boîtes des sièges à recopier dans
src/game/ceremonieObjets.ts ; elle échoue si le liquide déborderait)
"""
import json, math, os, random, sys

DANS_BLENDER = 'bpy' in sys.modules

# l'ORDRE des cases : recopié de ICONES_CEREMONIE (iconesStation.ts)
ICONES = [
    'condensat', 'memoire', 'tirage', 'orbe', 'livre', 'reserve', 'maitrise',
    'instruments', 'chrono', 'note', 'secours', 'profondeur', 'repos', 'don', 'rencontre',
    'cache', 'economat', 'carte', 'danger', 'couperet', 'palet', 'rafales',
    'orbites', 'cibles', 'minijeu', 'contrepartie',
]
COLONNES, RANGEES, CASE = 7, 4, 512
# l'ORDRE des sceaux : recopié de ORDRE_SCEAUX (ceremonieObjets.ts), 3 × 2
SCEAUX = ['S', 'A', 'B', 'C', 'D', 'module']
COLONNES_SCEAUX, RANGEES_SCEAUX = 3, 2
# les cuves : un DOS et un VERRE chacune (le liquide CSS passe entre eux),
# et l'anneau de palier, intact puis brisé (ceremonieObjets.ts)
CUVES = ['bonbonne', 'reserve', 'maitrise']
ANNEAUX = ['intact', 'brise']
# l'ORDRE des instruments : recopié de ORDRE_INSTRUMENTS (iconesStation.ts),
# 8 × 4 cases de 256² — 24 instruments, 7 contreparties, la case 32 vide
INSTRUMENTS = [
    'echantillon-secours', 'gaine-isolante', 'buse-calibree', 'aimant-rosee',
    'chambre-froide', 'peau-tendue', 'vanne-de-secours', 'plastron',
    'detendeur', 'patins-de-givre', 'lentille-de-visee', 'gueule-ouverte',
    'filtre-a-condensat', 'ballast', 'bascule-rapide', 'chambre-etanche',
    'tamis-fin', 'semelles-polies', 'eclateur', 'croc-du-sas',
    'sur-regime', 'ration-de-survie', 'oeilleres', 'carnet-du-semblable',
    'fuite-lente', 'residu-collant', 'gaine-fendue', 'buse-encrassee',
    'bonbonne-percee', 'fuite-prioritaire', 'vapeur-eventee',
]
COLONNES_INSTR, RANGEES_INSTR, CASE_INSTR = 8, 4, 256

if DANS_BLENDER:
    import bpy, bmesh
    from mathutils import Matrix, Vector
    _src = os.path.join(DOSSIER, 'surfaces.py')
    exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

    PREFIXE = 'ico-'
    # 2048 px par unité : une case (0,5 unité) sort à 1024 px, réduite à 512
    # à l'assemblage — le sous-échantillonnage lisse les arêtes et le bruit
    # de Cycles sans débruiteur (qui gommait le grain, chaud_tole.py)
    PX = 2048
    DEMI = 0.25                # la demi-case, en unités
    BISEAU_ICO = {'acier': 0.004, 'sombre': 0.003, 'clair': 0.0025, 'rayures': 0.003}

    def T(x, y, z):
        return Matrix.Translation((x, y, z))

    def RX(d):
        return Matrix.Rotation(math.radians(d), 4, 'X')

    def RY(d):
        return Matrix.Rotation(math.radians(d), 4, 'Y')

    def RZ(d):
        return Matrix.Rotation(math.radians(d), 4, 'Z')

    # un tour (axe Z) tourné ainsi regarde la caméra : son axe pointe vers -Y
    FACE = RX(90)

    # --------------------------------------------- l'atelier, outils en plus
    def _tour(self, mat, profil, M=None, seg=48, var=0.0, ferme=False, phase=0.0):
        """un solide de révolution autour de l'axe Z local : profil = [(r, z)]
        (r nul : un pôle) ; ferme : le dernier point rejoint le premier (une
        couronne) ; seg=6 ou 8 et phase=0.5 : un prisme taillé (cristal,
        socle octogonal)"""
        bm = self._bm(mat)
        M = M if M is not None else Matrix.Identity(4)
        R = []
        for (r, h) in profil:
            if r < 1e-7:
                R.append([bm.verts.new(M @ Vector((0, 0, h)))])
            else:
                R.append([bm.verts.new(M @ Vector((r * math.cos(2 * math.pi * (i + phase) / seg),
                                                     r * math.sin(2 * math.pi * (i + phase) / seg), h)))
                          for i in range(seg)])
        paires = list(zip(R, R[1:])) + ([(R[-1], R[0])] if ferme else [])
        faces = []
        for A, B in paires:
            if len(A) == 1 and len(B) == 1:
                continue
            for i in range(seg):
                j = (i + 1) % seg
                if len(A) == 1:
                    f = (A[0], B[j], B[i])
                elif len(B) == 1:
                    f = (A[i], A[j], B[0])
                else:
                    f = (A[i], A[j], B[j], B[i])
                faces.append(bm.faces.new(f))
        if not ferme:
            for anneau in (R[0], R[-1]):
                if len(anneau) > 2:
                    faces.append(bm.faces.new(anneau))
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        self._marque(mat, [v for a in R for v in a], var)

    def _tore(self, mat, R, r, M=None, seg=64, segr=12, a0=0.0, a1=2 * math.pi, var=0.0):
        """un tore dans le plan XY local (un cerclage autour d'un fût) ; a0..a1
        en limite un arc (les ondes d'une balise)"""
        bm = self._bm(mat)
        M = M if M is not None else Matrix.Identity(4)
        plein = abs(a1 - a0 - 2 * math.pi) < 1e-6
        n = seg if plein else seg + 1
        V = []
        for i in range(n):
            u = a0 + (a1 - a0) * i / seg
            V.append([bm.verts.new(M @ Vector(((R + r * math.cos(2 * math.pi * j / segr)) * math.cos(u),
                                               (R + r * math.cos(2 * math.pi * j / segr)) * math.sin(u),
                                               r * math.sin(2 * math.pi * j / segr)))) for j in range(segr)])
        faces = []
        for i in range(n if plein else n - 1):
            A, B = V[i], V[(i + 1) % n]
            for j in range(segr):
                k = (j + 1) % segr
                faces.append(bm.faces.new((A[j], A[k], B[k], B[j])))
        if not plein:
            faces += [bm.faces.new(V[0]), bm.faces.new(list(reversed(V[-1])))]
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        self._marque(mat, [v for a in V for v in a], var)

    def _prisme(self, mat, pts, yf, yb, M=None, var=0.0):
        """un contour du plan de la caméra (x, z), extrudé de yf à yb"""
        bm = self._bm(mat)
        M = M if M is not None else Matrix.Identity(4)
        av = [bm.verts.new(M @ Vector((x, yf, z))) for x, z in pts]
        ar = [bm.verts.new(M @ Vector((x, yb, z))) for x, z in pts]
        n = len(pts)
        faces = [bm.faces.new(av), bm.faces.new(list(reversed(ar)))]
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new((av[i], av[j], ar[j], ar[i])))
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        self._marque(mat, av + ar, var)

    def _sphere(self, mat, c, r, var=0.0, u=40, v=20):
        res = bmesh.ops.create_uvsphere(self._bm(mat), u_segments=u, v_segments=v, radius=r, matrix=T(*c))
        self._marque(mat, res['verts'], var)

    Atelier.tour, Atelier.tore, Atelier.prisme, Atelier.sphere = _tour, _tore, _prisme, _sphere

    def chanfrein(x0, x1, z0, z1, coins):
        """le contour d'un rectangle à coins coupés — coins = (bas-gauche,
        bas-droite, haut-droite, haut-gauche) : la cartouche de la station"""
        pts = []
        for (x, z, c, dx, dz) in ((x0, z0, coins[0], 1, 1), (x1, z0, coins[1], -1, 1),
                                  (x1, z1, coins[2], -1, -1), (x0, z1, coins[3], 1, -1)):
            if not c:
                pts.append((x, z))
            elif (dx, dz) in ((1, 1), (-1, -1)):
                pts += [(x, z + dz * c), (x + dx * c, z)]
            else:
                pts += [(x + dx * c, z), (x, z + dz * c)]
        return pts

    def polygone(cx, cz, r, n, phase=0.5):
        return [(cx + r * math.cos(2 * math.pi * (i + phase) / n), cz + r * math.sin(2 * math.pi * (i + phase) / n))
                for i in range(n)]

    def tourne(pts, deg, cx=0.0, cz=0.0):
        """tourne un contour dans le plan de la caméra, sens trigonométrique"""
        a = math.radians(deg)
        c, s = math.cos(a), math.sin(a)
        return [(cx + (x - cx) * c - (z - cz) * s, cz + (x - cx) * s + (z - cz) * c) for x, z in pts]

    def mise_a_l_echelle(pts, k, cx, cz):
        return [(cx + (x - cx) * k, cz + (z - cz) * k) for x, z in pts]

    # ----------------------------------------------------------- les matières
    def mat_verre():
        """un verre mince : la plupart du temps on voit À TRAVERS (le liquide
        dessous se lit), le bord rasant se teinte et reflète. Un verre
        réfractant (transmission) plein noircissait tout le contenu : la cuve
        de l'atelier est sur fond noir, et c'est ce noir qu'il réfractait"""
        mat = bpy.data.materials.new('ico-verre')
        nt, N, L = noeuds(mat)
        out = N.new('ShaderNodeOutputMaterial')
        tr = N.new('ShaderNodeBsdfTransparent')
        tr.inputs['Color'].default_value = lin((0xd0, 0xe4, 0xea))
        b = N.new('ShaderNodeBsdfPrincipled')
        b.inputs['Base Color'].default_value = lin((0x22, 0x34, 0x3e))
        b.inputs['Roughness'].default_value = 0.08
        lw = N.new('ShaderNodeLayerWeight')
        lw.inputs['Blend'].default_value = 0.35
        fac = op(nt, 'MULTIPLY_ADD', lw.outputs['Facing'], 0.75, 0.18)
        mix = N.new('ShaderNodeMixShader')
        L.new(fac, mix.inputs[0])
        L.new(tr.outputs[0], mix.inputs[1])
        L.new(b.outputs[0], mix.inputs[2])
        L.new(mix.outputs[0], out.inputs[0])
        return mat

    def matieres_ceremonie():
        mats = matieres_biome()
        # l'acier des murs (surfaces.py : 26303c / 4c5a6a, 0,15 de luminance),
        # remonté de deux crans : une icône se lit sur le voile sombre. Au
        # premier essai (404e5c / 8696a6, métal 0,45), la bonbonne, la
        # colonne, la caisse et le couperet se perdaient dans le fond à 32 px :
        # le monde de l'atelier est NOIR, et un acier très métallique n'y
        # renvoie que les soleils — moins de métal, plus de diffus
        mats['acier'] = mat_brosse('ico-acier', (0x5a, 0x68, 0x78), (0xa2, 0xb0, 0xbe), 81, brosse=0.10)
        mats['rivet'] = mats['acier']
        mats['sombre'] = mat_brosse('ico-sombre', (0x28, 0x34, 0x3e), (0x48, 0x56, 0x62), 83, brosse=0.05)
        for m in (mats['acier'], mats['sombre']):
            next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Metallic'].default_value = 0.2
        mats['clair'] = mat_simple('ico-clair', (0xa4, 0xb0, 0xba), rug=0.32, metal=0.25)
        mats['verre'] = mat_verre()
        # le fluide du Sujet 21 : le sarcelle de la maquette (5af0e0), qui luit
        mats['eau'] = mat_simple('ico-eau', (0x0c, 0x40, 0x48), rug=0.15, emission=(0x5a, 0xf0, 0xe0), force=0.85)
        mats['orbe'] = mat_simple('ico-orbe', (0x10, 0x50, 0x58), rug=0.1, emission=(0x5a, 0xf0, 0xe0), force=1.1)
        # la vie : la menthe du rang A (6dffb8)
        mats['vie'] = mat_simple('ico-vie', (0x10, 0x48, 0x30), rug=0.15, emission=(0x6d, 0xff, 0xb8), force=0.8)
        # la mémoire : un cristal froid, bleu de glace
        # (à 0,55 de lueur, les facettes s'aplatissaient en un seul bleu pâle :
        # c'est l'ombre d'une face à l'autre qui dit « taillé »)
        mats['cristal'] = mat_simple('ico-cristal', (0x6c, 0x94, 0xc0), rug=0.12, emission=(0x9c, 0xcc, 0xff), force=0.3)
        mats['voyant'] = mat_simple('ico-voyant', (0x10, 0x40, 0x40), rug=0.3, emission=(0x5a, 0xf0, 0xe0), force=2.0)
        # le cyan de la charte (63b7e6), en trait qui luit à peine
        mats['cyan'] = mat_simple('ico-cyan', (0x1c, 0x48, 0x5c), rug=0.5, emission=(0x63, 0xb7, 0xe6), force=0.7)
        mats['veille'] = mat_simple('ico-veille', (0x0c, 0x18, 0x2c), rug=0.3, emission=(0x4a, 0x8c, 0xd8), force=0.6)
        mats['cadran'] = mat_simple('ico-cadran', (0xb4, 0xc0, 0xc6), rug=0.6, emission=(0x8c, 0x9c, 0xa4), force=0.2)
        mats['trait'] = mat_simple('ico-trait', (0x0a, 0x10, 0x14), rug=0.6)
        mats['aiguille'] = mat_simple('ico-aiguille', (0x14, 0x1a, 0x20), rug=0.4, metal=0.3)
        mats['etiquette'] = mat_simple('ico-etiquette', (0x8a, 0x94, 0x8e), rug=0.8)
        # ce qui luit d'or : la prime du tirage (charte : l'ambre pour ce qui luit)
        mats['ambre'] = mat_simple('ico-ambre', (0x6a, 0x3c, 0x0e), rug=0.2, emission=(0xff, 0xc8, 0x5a), force=1.2)
        return mats

    # ------------------------------------------------------- les pictogrammes
    # Chaque fonction bâtit son objet autour de l'origine, dans |x|, |z| < 0,215
    # (la case fait ±0,25 : le bord doit rester transparent, prepare.py le
    # mesure). x à droite, z en haut, y vers le fond (la caméra est en -y).

    def ico_condensat(at):
        """une goutte sous cloche de verre, sur un socle"""
        at.tour('acier', [(0, -0.205), (0.15, -0.205), (0.156, -0.195), (0.156, -0.17), (0.136, -0.155), (0.125, -0.14), (0, -0.14)], var=0.2)
        at.tore('clair', 0.117, 0.009, T(0, 0, -0.138))
        at.tour('verre', [(0, -0.14), (0.112, -0.14), (0.112, 0.05), (0.104, 0.10), (0.085, 0.135), (0.055, 0.158), (0, 0.168)])
        at.tour('acier', [(0, 0.162), (0.028, 0.162), (0.03, 0.176), (0.016, 0.186), (0.022, 0.198), (0, 0.205)])
        at.tour('eau', [(0, -0.138), (0.032, -0.135), (0.052, -0.115), (0.058, -0.085), (0.05, -0.048), (0.032, -0.012), (0.013, 0.025), (0, 0.055)])

    def ico_memoire(at):
        """un cristal taillé, serré dans un collier, sur un socle octogonal"""
        at.tour('acier', [(0, -0.205), (0.13, -0.205), (0.136, -0.195), (0.136, -0.175), (0.09, -0.15), (0.08, -0.125), (0, -0.125)], seg=8, phase=0.5)
        # une FACE vers la caméra, les deux voisines à 60° : la lumière les
        # sépare (arête vers la caméra, premier essai : deux faces au même
        # gris, le cristal se lisait en aplat)
        at.tour('cristal', [(0, -0.15), (0.064, -0.10), (0.064, 0.09), (0.03, 0.165), (0, 0.205)], seg=6, phase=0.0)
        at.tour('cristal', [(0, -0.10), (0.034, -0.075), (0.034, 0.02), (0, 0.075)], M=T(0.092, -0.01, -0.105) @ RY(28), seg=6, phase=0.0)
        at.tour('cristal', [(0, -0.10), (0.026, -0.08), (0.026, -0.01), (0, 0.035)], M=T(-0.085, -0.01, -0.11) @ RY(-32), seg=6, phase=0.0)
        at.tour('clair', [(0.068, -0.125), (0.082, -0.125), (0.082, -0.088), (0.068, -0.088)], seg=6, phase=0.0, ferme=True)

    def ico_tirage(at):
        """trois cartouches d'instrument en éventail, la prime qui luit sur
        celle de devant"""
        carte = chanfrein(-0.095, 0.095, -0.135, 0.135, (0.04, 0, 0.04, 0))
        pivot = (0.0, -0.17)
        for ang, y, mat in ((24, 0.03, 'sombre'), (-24, 0.015, 'acier')):
            pts = tourne(carte, ang, *pivot)
            at.prisme(mat, [(x, z + 0.03) for x, z in pts], y, y + 0.01, var=0.4)
        pts = [(x, z + 0.03) for x, z in carte]
        at.prisme('acier', pts, -0.004, 0.006, var=-0.3)
        at.prisme('sombre', [(x, z + 0.03) for x, z in chanfrein(-0.07, 0.07, -0.11, 0.11, (0.028, 0, 0.028, 0))], -0.008, -0.004)
        at.prisme('clair', polygone(0, 0.045, 0.05, 6, 0.0), -0.012, -0.006)
        at.prisme('ambre', polygone(0, 0.045, 0.036, 6, 0.0), -0.016, -0.011)

    def ico_orbe(at):
        """une sphère qui luit, dans une cage de méridiens, sur un pied"""
        c = 0.025
        at.sphere('orbe', (0, 0, c), 0.092)
        for a in (0, 60, 120):
            at.tore('acier', 0.118, 0.0075, T(0, 0, c) @ RZ(a + 15) @ RX(90), segr=10, var=0.3)
        at.tore('clair', 0.119, 0.009, T(0, 0, c))
        at.tour('acier', [(0, 0.135), (0.032, 0.135), (0.036, 0.152), (0.02, 0.168), (0, 0.172)])
        at.tour('acier', [(0, -0.205), (0.12, -0.205), (0.126, -0.19), (0.062, -0.15), (0.04, -0.105), (0, -0.1)], seg=8, phase=0.5)

    def bonbonne(at, M, liquide=0.75):
        """la bonbonne de livraison : un fût à col, un robinet, deux cerclages
        et la jauge vitrée où luit le fluide"""
        at.tour('acier', [(0, -0.205), (0.075, -0.205), (0.088, -0.195), (0.093, -0.18), (0.093, 0.07), (0.087, 0.10),
                          (0.07, 0.125), (0.045, 0.14), (0.025, 0.145), (0, 0.145)], M=M, var=0.1)
        at.tour('clair', [(0, 0.14), (0.022, 0.14), (0.022, 0.168), (0.032, 0.168), (0.032, 0.182), (0, 0.182)], M=M)
        at.tore('sombre', 0.04, 0.008, M @ T(0, 0, 0.19), segr=10)
        for a in (0, 90):
            at.tube('sombre', M @ Vector((0.04 * math.cos(math.radians(a)), 0.04 * math.sin(math.radians(a)), 0.19)),
                    M @ Vector((-0.04 * math.cos(math.radians(a)), -0.04 * math.sin(math.radians(a)), 0.19)), 0.005)
        for z in (-0.16, 0.045):
            at.tore('sombre', 0.094, 0.0075, M @ T(0, 0, z), segr=10)
        # la jauge : un cadre sombre, le fluide jusqu'à son niveau
        haut = -0.125 + 0.155 * liquide
        at.prisme('fond', chanfrein(-0.032, 0.032, -0.135, 0.035, (0.01,) * 4), -0.1, -0.08, M=M)
        at.prisme('eau', chanfrein(-0.023, 0.023, -0.125, haut, (0.006, 0.006, 0, 0)), -0.102, -0.098, M=M)

    def ico_livre(at):
        bonbonne(at, Matrix.Identity(4))

    def ico_reserve(at):
        """le bocal de la réserve : large, à couvercle, le fluide aux deux tiers"""
        at.tour('acier', [(0, -0.205), (0.15, -0.205), (0.156, -0.195), (0.156, -0.165), (0.14, -0.155), (0, -0.155)], var=0.2)
        at.tour('verre', [(0, -0.155), (0.13, -0.155), (0.13, 0.105), (0, 0.105)])
        at.tour('eau', [(0, -0.152), (0.122, -0.152), (0.122, 0.0), (0, 0.0)])
        at.tour('acier', [(0, 0.105), (0.145, 0.105), (0.152, 0.115), (0.152, 0.148), (0.13, 0.163), (0.055, 0.168), (0.045, 0.185), (0, 0.188)], var=-0.2)
        for a in (215, 325, 90):
            x, y = 0.143 * math.cos(math.radians(a)), 0.143 * math.sin(math.radians(a))
            at.tube('clair', (x, y, -0.16), (x, y, 0.11), 0.0075)

    def ico_maitrise(at):
        """la colonne de maîtrise : un tube de verre cerclé de trois anneaux de
        palier, sur un socle octogonal"""
        at.tour('acier', [(0, -0.205), (0.11, -0.205), (0.116, -0.19), (0.08, -0.17), (0.07, -0.158), (0, -0.158)], seg=8, phase=0.5)
        at.tour('verre', [(0, -0.16), (0.052, -0.16), (0.052, 0.16), (0, 0.16)])
        at.tour('eau', [(0, -0.158), (0.045, -0.158), (0.045, 0.035), (0, 0.035)])
        at.tour('acier', [(0, 0.152), (0.07, 0.152), (0.076, 0.168), (0.06, 0.188), (0, 0.194)], seg=8, phase=0.5)
        for z in (-0.085, 0.0, 0.085):
            at.tour('clair', [(0.053, z - 0.013), (0.078, z - 0.013), (0.078, z + 0.013), (0.053, z + 0.013)], ferme=True)
        for a in (235, 305):
            x, y = 0.066 * math.cos(math.radians(a)), 0.066 * math.sin(math.radians(a))
            at.tube('sombre', (x, y, -0.16), (x, y, 0.155), 0.0055)

    def ico_instruments(at):
        """la caisse d'instruments : coins coupés, couvercle, poignée, loquets"""
        at.prisme('acier', chanfrein(-0.17, 0.17, -0.165, 0.035, (0.03, 0.03, 0, 0)), -0.07, 0.07, var=0.2)
        at.prisme('sombre', chanfrein(-0.176, 0.176, 0.035, 0.09, (0, 0, 0.035, 0.035)), -0.074, 0.074)
        for x in (-0.07, 0.07):
            at.tube('clair', (x, 0, 0.088), (x, 0, 0.145), 0.011)
        at.tube('clair', (-0.078, 0, 0.145), (0.078, 0, 0.145), 0.013)
        for x in (-0.115, 0.115):
            at.boite('clair', x - 0.018, x + 0.018, 0.0, 0.065, -0.082, -0.068)
        at.boite('cyan', -0.055, 0.055, -0.1, -0.055, -0.074, -0.068)
        at.prisme('sombre', chanfrein(-0.17, 0.17, -0.03, -0.012, (0, 0, 0, 0)), -0.073, 0.073)

    def ico_chrono(at):
        """le manomètre : cadran pâle, graduations, une aiguille, son raccord"""
        cz = 0.03
        M = T(0, 0, cz) @ FACE
        at.tour('sombre', [(0, 0.0), (0.152, 0.0), (0.158, 0.01), (0.158, 0.03), (0, 0.03)], M=M)
        at.tour('clair', [(0.134, 0.03), (0.166, 0.03), (0.17, 0.044), (0.16, 0.055), (0.142, 0.055), (0.132, 0.044)], M=M, ferme=True)
        at.tour('cadran', [(0, 0.03), (0.136, 0.03), (0.136, 0.036), (0, 0.036)], M=M)
        # la plage de service, en cyan, de 7 h à 2 h
        at.tore('cyan', 0.112, 0.0065, T(0, -0.037, cz) @ RX(90), a0=math.radians(-20), a1=math.radians(225), segr=8)
        for k in range(11):
            th = math.radians(225 - 27 * k)
            long = 0.03 if k % 5 == 0 else 0.018
            r = 0.122 - long / 2
            at.boite('trait', r * math.cos(th) - long / 2, r * math.cos(th) + long / 2,
                     cz + r * math.sin(th) - 0.004, cz + r * math.sin(th) + 0.004, -0.039, -0.035, rot=RY(-math.degrees(th)))
        aig = tourne([(-0.03, -0.009), (0.112, -0.003), (0.122, 0.0), (0.112, 0.003), (-0.03, 0.009)], 40)
        at.prisme('aiguille', [(x, z + cz) for x, z in aig], -0.046, -0.04)
        at.tour('clair', [(0, 0.036), (0.017, 0.036), (0.017, 0.047), (0.01, 0.053), (0, 0.055)], M=M)
        at.tube('clair', (0, 0.015, cz - 0.155), (0, 0.015, -0.17), 0.016)
        at.tour('acier', [(0, -0.205), (0.032, -0.205), (0.032, -0.168), (0, -0.168)], M=T(0, 0.015, 0), seg=6, phase=0.5)

    def ico_note(at):
        """la réglette : une règle graduée, son curseur et son fil qui luit"""
        at.prisme('acier', chanfrein(-0.2, 0.2, -0.058, 0.058, (0.022, 0, 0.022, 0)), -0.015, 0.015, var=0.2)
        for k in range(21):
            x = -0.175 + 0.35 * k / 20
            long = 0.05 if k % 10 == 0 else (0.035 if k % 5 == 0 else 0.02)
            at.boite('trait', x - 0.0035, x + 0.0035, 0.048 - long, 0.048, -0.018, -0.014)
        at.boite('sombre', -0.175, 0.175, -0.042, -0.02, -0.018, -0.014)
        x0, x1 = 0.025, 0.105
        at.boite('clair', x0, x0 + 0.016, -0.078, 0.078, -0.032, 0.025)
        at.boite('clair', x1 - 0.016, x1, -0.078, 0.078, -0.032, 0.025)
        at.boite('clair', x0, x1, 0.062, 0.078, -0.032, 0.025)
        at.boite('clair', x0, x1, -0.078, -0.062, -0.032, 0.025)
        at.boite('voyant', 0.062, 0.068, -0.062, 0.062, -0.03, -0.024)

    def ico_secours(at):
        """l'ampoule de vie : une fiole scellée, le fluide menthe, la croix de
        secours sur sa bague"""
        at.tour('verre', [(0, -0.19), (0.035, -0.185), (0.052, -0.165), (0.056, -0.14), (0.056, 0.07), (0.046, 0.095),
                          (0.022, 0.115), (0.016, 0.13), (0.02, 0.15), (0.022, 0.165), (0.012, 0.19), (0, 0.2)])
        at.tour('vie', [(0, -0.182), (0.034, -0.178), (0.047, -0.16), (0.049, -0.14), (0.049, 0.062), (0.03, 0.08), (0, 0.083)])
        for z in (-0.125, 0.035):
            at.tore('acier', 0.059, 0.009, T(0, 0, z), segr=10)
        at.tour('acier', [(0.057, -0.075), (0.064, -0.075), (0.064, -0.01), (0.057, -0.01)], ferme=True)
        at.prisme('clair', [(-0.02, -0.048), (-0.007, -0.048), (-0.007, -0.061), (0.007, -0.061), (0.007, -0.048), (0.02, -0.048),
                            (0.02, -0.036), (0.007, -0.036), (0.007, -0.023), (-0.007, -0.023), (-0.007, -0.036), (-0.02, -0.036)],
                  -0.07, -0.06)

    def ico_profondeur(at):
        """la sonde de profondeur : un plomb profilé au bout de son câble,
        sa bague de mesure qui luit, deux chevrons qui disent « plus bas »"""
        at.tube('sombre', (0, 0, 0.05), (0, 0, 0.212), 0.007)
        at.tore('clair', 0.02, 0.006, T(0, 0, 0.068) @ RX(90), segr=8)
        at.tour('acier', [(0, -0.21), (0.012, -0.205), (0.04, -0.15), (0.075, -0.06), (0.081, -0.03), (0.076, 0.0),
                          (0.052, 0.034), (0.022, 0.048), (0, 0.05)], var=0.2)
        at.tore('voyant', 0.079, 0.006, T(0, 0, -0.048), segr=8)
        for z in (0.16, 0.1):
            for s in (-1, 1):
                xa, za = 0.13 + s * 0.035, z + 0.025
                at.tube('cyan', (xa, 0, za), (0.13, 0, z), 0.008)
                at.tube('cyan', (-xa, 0, za), (-0.13, 0, z), 0.008)

    def ico_repos(at):
        """l'alcôve de repos : une capsule de sommeil couchée sur son bâti, le
        hublot en veilleuse"""
        M = RY(90)
        at.tour('acier', [(0, -0.19), (0.04, -0.186), (0.07, -0.166), (0.086, -0.14), (0.09, -0.11), (0.09, 0.11),
                          (0.086, 0.14), (0.07, 0.166), (0.04, 0.186), (0, 0.19)], M=T(0, 0, 0.01) @ M, var=0.1)
        for x in (-0.145, 0.135):
            at.tore('sombre', 0.091, 0.007, T(x, 0, 0.01) @ M, segr=10)
        at.prisme('clair', chanfrein(-0.12, 0.1, -0.005, 0.07, (0.015,) * 4), -0.094, -0.07)
        at.prisme('veille', chanfrein(-0.11, 0.09, 0.004, 0.061, (0.01,) * 4), -0.098, -0.094)
        for x in (-0.12, 0.12):
            at.boite('sombre', x - 0.012, x + 0.012, -0.17, -0.07, -0.03, 0.03)
        at.prisme('acier', chanfrein(-0.18, 0.18, -0.2, -0.165, (0.012,) * 4), -0.06, 0.06)

    def ico_don(at):
        """la bonbonne oubliée : une petite bonbonne, et l'étiquette pendue à son
        col"""
        k = 0.86
        M = T(-0.02, 0, 0.0) @ Matrix.Diagonal((k, k, k, 1))
        bonbonne(at, M, liquide=0.55)
        at.tube('sombre', (0.0, -0.02, 0.15 * k), (0.11, -0.03, 0.04), 0.004)
        etiq = tourne([(0.09, -0.02), (0.18, -0.02), (0.18, 0.04), (0.105, 0.04), (0.09, 0.01)], -20, 0.11, 0.04)
        at.prisme('etiquette', [(x, z - 0.02) for x, z in etiq], -0.035, -0.027)

    def ico_rencontre(at):
        """la balise : un mât sur son socle, une tête qui luit, deux ondes de
        chaque côté — un signal capté dans la station"""
        at.tour('acier', [(0, -0.205), (0.1, -0.205), (0.106, -0.19), (0.07, -0.16), (0.03, -0.15), (0, -0.15)], seg=8, phase=0.5)
        at.tube('clair', (0, 0, -0.155), (0, 0, 0.07), 0.012)
        at.tour('sombre', [(0, 0.055), (0.03, 0.055), (0.03, 0.07), (0, 0.07)])
        at.sphere('voyant', (0, 0, 0.1), 0.03)
        for R in (0.075, 0.125):
            for a0, a1 in ((-40, 40), (140, 220)):
                at.tore('cyan', R, 0.009, T(0, 0, 0.1) @ RX(90), seg=24, segr=8, a0=math.radians(a0), a1=math.radians(a1))

    def ico_cache(at):
        """le coffre de la cache : porte blindée, cadran rond, levier, gonds"""
        at.prisme('acier', chanfrein(-0.17, 0.17, -0.175, 0.13, (0.028,) * 4), -0.08, 0.08, var=0.2)
        at.prisme('sombre', chanfrein(-0.145, 0.145, -0.15, 0.105, (0.02,) * 4), -0.086, -0.08)
        at.prisme('acier', chanfrein(-0.135, 0.135, -0.14, 0.095, (0.016,) * 4), -0.094, -0.086, var=-0.4)
        M = T(-0.03, -0.094, -0.022) @ FACE
        at.tour('clair', [(0, 0.0), (0.058, 0.0), (0.062, 0.01), (0.05, 0.02), (0, 0.022)], M=M)
        at.tour('sombre', [(0, 0.02), (0.024, 0.02), (0.024, 0.03), (0, 0.032)], M=M)
        for k in range(12):
            th = 2 * math.pi * k / 12
            x, z = -0.03 + 0.074 * math.cos(th), -0.022 + 0.074 * math.sin(th)
            at.boite('clair', x - 0.005, x + 0.005, z - 0.005, z + 0.005, -0.099, -0.094)
        at.tube('clair', (0.085, -0.11, -0.07), (0.085, -0.11, 0.04), 0.011)
        for z in (-0.07, 0.04):
            at.tube('clair', (0.085, -0.094, z), (0.085, -0.112, z), 0.008)
        for z in (-0.11, 0.06):
            at.tube('sombre', (-0.176, -0.06, z - 0.03), (-0.176, -0.06, z + 0.03), 0.012)
        for (x, z) in ((-0.12, -0.125), (0.12, -0.125), (0.12, 0.08), (-0.12, 0.08)):
            at.dome('clair', x, z, 0.006, -0.094)

    def ico_economat(at):
        """l'économat : une balance — le fluide d'un côté, l'instrument de
        l'autre"""
        at.tour('acier', [(0, -0.205), (0.09, -0.205), (0.096, -0.19), (0.05, -0.168), (0, -0.168)], seg=8, phase=0.5)
        at.tube('acier', (0, 0, -0.17), (0, 0, 0.125), 0.013)
        at.sphere('clair', (0, 0, 0.14), 0.022)
        at.boite('clair', -0.155, 0.155, 0.104, 0.12, -0.012, 0.012)
        for s in (-1, 1):
            xc = s * 0.145
            for dx in (-0.05, 0.05):
                at.tube('sombre', (xc, 0, 0.105), (xc + dx, 0, -0.03), 0.004)
            at.tour('acier', [(0, -0.062), (0.035, -0.062), (0.062, -0.034), (0.062, -0.028), (0, -0.028)], M=T(xc, 0, 0))
        at.tour('eau', [(0, -0.03), (0.022, -0.026), (0.03, -0.01), (0.022, 0.01), (0.008, 0.03), (0, 0.04)], M=T(-0.145, 0, 0))
        at.prisme('cyan', polygone(0.145, -0.002, 0.03, 6, 0.0), -0.02, 0.02)

    def ico_carte(at):
        """la carte de la station : une plaque à coins coupés où les modules
        octogonaux sont reliés par leurs coursives ; celui où l'on est luit"""
        at.prisme('acier', chanfrein(-0.195, 0.195, -0.195, 0.195, (0.055,) * 4), 0.0, 0.022, var=0.2)
        at.prisme('sombre', chanfrein(-0.168, 0.168, -0.168, 0.168, (0.045,) * 4), -0.004, 0.0)
        mods = [(-0.105, 0.085), (0.0, 0.0), (0.105, 0.09), (-0.09, -0.1), (0.1, -0.095)]
        for (a, b) in ((0, 1), (1, 2), (1, 3), (1, 4)):
            (xa, za), (xb, zb) = mods[a], mods[b]
            L = math.hypot(xb - xa, zb - za)
            ang = math.degrees(math.atan2(zb - za, xb - xa))
            at.boite('cyan', (xa + xb) / 2 - L / 2, (xa + xb) / 2 + L / 2, (za + zb) / 2 - 0.007, (za + zb) / 2 + 0.007,
                     -0.008, -0.004, rot=RY(-ang))
        for i, (x, z) in enumerate(mods):
            at.prisme('voyant' if i == 1 else 'clair', polygone(x, z, 0.042, 8), -0.014, -0.004)

    def ico_danger(at):
        """le triangle de danger à bandes ocre (l'ocre terni des habillages)"""
        tri = [(0, 0.19), (-0.205, -0.165), (0.205, -0.165)]
        g = (0.0, (0.19 - 0.33) / 3)
        at.prisme('acier', tri, 0.0, 0.02, var=0.2)
        at.prisme('rayures', mise_a_l_echelle(tri, 0.9, *g), -0.006, 0.0)
        at.prisme('sombre', mise_a_l_echelle(tri, 0.6, *g), -0.01, -0.006)
        at.prisme('clair', chanfrein(-0.016, 0.016, -0.04, 0.075, (0.006,) * 4), -0.016, -0.01)
        at.prisme('clair', polygone(0, -0.08, 0.018, 8), -0.016, -0.01)

    def ico_couperet(at):
        """le couperet : une lame lourde, son tranchant vif, son manche"""
        lame = [(-0.17, 0.075), (0.07, 0.075), (0.07, -0.08), (-0.17, -0.055)]
        at.prisme('acier', lame, -0.008, 0.008, var=0.3)
        at.prisme('clair', [(-0.17, -0.055), (0.07, -0.08), (0.07, -0.065), (-0.17, -0.04)], -0.0095, 0.0095)
        at.tour('fond', [(0, -0.01), (0.017, -0.01), (0.017, 0.01), (0, 0.01)], M=T(-0.13, 0, 0.042) @ FACE)
        at.tube('sombre', (0.07, 0, 0.03), (0.215, 0, 0.03), 0.022)
        at.tore('clair', 0.023, 0.007, T(0.085, 0, 0.03) @ RY(90), segr=8)
        for x in (0.12, 0.17):
            at.dome('clair', x, 0.03, 0.007, -0.022)

    def ico_palet(at):
        """le palet : la pierre, sa bande, sa poignée"""
        at.tour('acier', [(0, -0.135), (0.12, -0.135), (0.155, -0.115), (0.17, -0.085), (0.17, -0.055), (0.155, -0.035),
                          (0.12, -0.02), (0, -0.02)], var=0.2)
        at.tore('cyan', 0.171, 0.009, T(0, 0, -0.07), segr=10)
        at.tube('clair', (-0.05, 0, -0.025), (-0.05, 0, 0.04), 0.017)
        at.tube('clair', (-0.068, 0, 0.04), (0.12, 0, 0.04), 0.019)
        at.sphere('clair', (-0.05, 0, 0.04), 0.019)

    def ico_rafales(at):
        """le ventilateur : une hélice dans son carter rond, sur sa platine"""
        at.prisme('sombre', chanfrein(-0.2, 0.2, -0.2, 0.2, (0.05,) * 4), 0.01, 0.026)
        for (x, z) in ((-0.165, -0.165), (0.165, -0.165), (0.165, 0.165), (-0.165, 0.165)):
            at.dome('clair', x, z, 0.012, 0.01)
        at.tour('acier', [(0.152, 0.0), (0.19, 0.0), (0.195, 0.015), (0.19, 0.04), (0.152, 0.04), (0.15, 0.02)], M=FACE, ferme=True)
        at.tour('fond', [(0, -0.01), (0.152, -0.01), (0.152, 0.005), (0, 0.005)], M=FACE)
        for k in range(6):
            th = 360 * k / 6 + 15
            r = 0.085
            x, z = r * math.cos(math.radians(th)), r * math.sin(math.radians(th))
            at.boite('clair', x - 0.062, x + 0.062, z - 0.026, z + 0.026, -0.003, 0.003, rot=RY(-th) @ RX(28))
        at.tour('sombre', [(0, 0.0), (0.042, 0.0), (0.042, 0.03), (0.022, 0.045), (0, 0.05)], M=FACE)
        # (une grille de deux cercles et quatre rayons brouillait les pales à
        # 32 px : un seul cercle de garde)
        at.tore('sombre', 0.12, 0.005, T(0, -0.045, 0) @ RX(90), segr=6)

    def ico_orbites(at):
        """les orbites : un astre et ses deux anneaux, deux satellites dessus"""
        # (au premier essai, astre de 0,065 et anneaux fins d'acier : une
        # poussière à 32 px)
        at.sphere('acier', (0, 0, 0), 0.08)
        M1 = RY(-18) @ RX(20)
        M2 = RY(32) @ RX(-30)
        at.tore('clair', 0.195, 0.01, M1, segr=10)
        at.tore('clair', 0.13, 0.009, M2, segr=10)
        p1 = M1 @ Vector((0.195 * math.cos(math.radians(-60)), 0.195 * math.sin(math.radians(-60)), 0))
        p2 = M2 @ Vector((0.13 * math.cos(math.radians(140)), 0.13 * math.sin(math.radians(140)), 0))
        at.sphere('orbe', tuple(p1), 0.032)
        at.sphere('cristal', tuple(p2), 0.024)

    def ico_cibles(at):
        """la cible : des anneaux alternés, le centre qui luit, une fléchette
        plantée, son trépied"""
        cz = 0.035
        M = T(0, 0, cz) @ FACE
        for i, (ri, re, h) in enumerate(((0.115, 0.152, 0.02), (0.078, 0.115, 0.024), (0.041, 0.078, 0.028), (0.0, 0.041, 0.03))):
            mat = ('acier', 'sombre', 'acier', 'voyant')[i]
            prof = [(re, 0.0), (re, h), (ri, h), (ri, 0.0)] if ri else [(0, 0.0), (re, 0.0), (re, h), (0, h)]
            at.tour(mat, prof, M=M, ferme=bool(ri))
        at.tore('clair', 0.152, 0.008, T(0, -0.01, cz) @ RX(90), segr=10)
        for s in (-1, 1):
            at.tube('sombre', (0, 0.01, cz - 0.1), (s * 0.115, 0.02, -0.205), 0.009)
        at.tube('sombre', (0, 0.01, cz - 0.1), (0, 0.09, -0.205), 0.009)
        at.tube('clair', (0.012, -0.03, cz + 0.012), (0.16, -0.2, cz + 0.15), 0.008)
        for a in (0, 90):
            at.boite('cyan', 0.135, 0.185, cz + 0.142 - 0.004, cz + 0.142 + 0.004, -0.19, -0.17, rot=RY(-45 + a))

    def ico_minijeu(at):
        """le mini-jeu : un pupitre à manche, sa boule qui luit, deux boutons"""
        at.prisme('acier', chanfrein(-0.17, 0.17, -0.2, -0.085, (0, 0, 0.03, 0.03)), -0.09, 0.09, var=0.2)
        at.boite('sombre', -0.15, 0.15, -0.2, -0.17, -0.094, -0.09)
        at.tour('sombre', [(0, -0.088), (0.048, -0.088), (0.034, -0.065), (0.018, -0.05), (0, -0.048)], M=T(-0.04, 0, 0))
        at.tube('clair', (-0.04, 0, -0.06), (-0.015, 0, 0.1), 0.014)
        at.sphere('voyant', (-0.013, 0, 0.115), 0.038)
        for x in (0.075, 0.13):
            at.tour('cyan', [(0, -0.088), (0.021, -0.088), (0.021, -0.074), (0, -0.072)], M=T(x, -0.02, 0))

    def ico_contrepartie(at):
        """la contrepartie : une conduite fendue qui fuit — le prix d'un
        instrument"""
        z = 0.06
        at.tube('acier', (-0.2, 0, z), (0.2, 0, z), 0.045, seg=40)
        for x in (-0.155, 0.155):
            at.tube('clair', (x - 0.012, 0, z), (x + 0.012, 0, z), 0.058, seg=40)
        fente = [(-0.03, z + 0.03), (-0.008, z + 0.006), (-0.022, z - 0.004), (0.012, z - 0.034), (0.0, z - 0.004), (0.016, z + 0.008)]
        at.prisme('fond', fente, -0.05, -0.03)
        for (x, zz, r) in ((0.01, z - 0.06, 0.016), (0.03, z - 0.105, 0.019), (0.055, z - 0.152, 0.016), (0.08, z - 0.19, 0.012),
                           (-0.02, z - 0.085, 0.01), (0.0, z - 0.135, 0.009)):
            at.sphere('eau', (x, -0.05, zz), r)

    # (fonction, inclinaison vers la caméra en degrés, roulis dans le plan)
    # L'inclinaison montre le dessus d'un fût (12 à 25°) ; un cadran, une
    # cible, un ventilateur regardent la caméra en face.
    FABRIQUES = {
        'condensat': (ico_condensat, 12, 0), 'memoire': (ico_memoire, 10, 0), 'tirage': (ico_tirage, 0, 0),
        'orbe': (ico_orbe, 10, 0), 'livre': (ico_livre, 12, 0), 'reserve': (ico_reserve, 15, 0),
        'maitrise': (ico_maitrise, 10, 0), 'instruments': (ico_instruments, 18, 0), 'chrono': (ico_chrono, 0, 0),
        'note': (ico_note, 0, -16), 'secours': (ico_secours, 8, 32), 'profondeur': (ico_profondeur, 0, 0),
        'repos': (ico_repos, 15, 0), 'don': (ico_don, 10, 18), 'rencontre': (ico_rencontre, 8, 0),
        'cache': (ico_cache, 12, 0), 'economat': (ico_economat, 6, 0), 'carte': (ico_carte, 10, 0),
        'danger': (ico_danger, 0, 0), 'couperet': (ico_couperet, 0, -28), 'palet': (ico_palet, 24, 0),
        'rafales': (ico_rafales, 0, 0), 'orbites': (ico_orbites, 0, 0), 'cibles': (ico_cibles, 0, 0),
        'minijeu': (ico_minijeu, 22, 0), 'contrepartie': (ico_contrepartie, 8, 0),
    }

    # un agrandissement pour les objets plats ou fins, borné par DEMI_MAX : la
    # demi-taille d'un objet dans sa case (0,25) — mesuré à la livraison du
    # 13/11, au moins 35 px transparents au bord d'une case de 512 (le bord
    # est ce que prepare.py contrôle)
    ECHELLE = {'palet': 1.2, 'secours': 1.1, 'couperet': 1.12, 'orbites': 1.1, 'repos': 1.08, 'note': 1.05}
    DEMI_MAX = 0.215

    def efface():
        """retire la scène d'un essai précédent, et elle SEULE : la scène que
        le concepteur a ouverte (un atlas, une chaufferie) reste intacte —
        vide_scene() de l'atelier, lui, efface tout le fichier"""
        sc = bpy.data.scenes.get('ceremonie')
        if sc:
            for o in list(sc.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            for c in list(sc.collection.children_recursive):
                bpy.data.collections.remove(c)
            bpy.data.scenes.remove(sc)
        for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
            for d in list(coll):
                if d.users == 0:
                    coll.remove(d)

    def scene_neuve():
        """la scène `ceremonie`, neuve, et la fenêtre de Blender basculée
        dessus (rend() rend la scène de la fenêtre) : revenir à la scène
        d'origine se fait à la main, dans le sélecteur de scènes"""
        efface()
        PIECES.clear()
        sc = bpy.data.scenes.new('ceremonie')
        fen = bpy.context.window or bpy.context.window_manager.windows[0]
        fen.scene = sc
        return sc

    def monte_cases(sc, mats, noms, fabriques, colonnes, prefixe, echelle):
        """une case par objet : bâti autour de l'origine, posé (inclinaison
        vers la caméra, roulis dans le plan), RECENTRÉ sur sa boîte et mis à
        l'échelle `echelle(nom, demi)` — incliné, un fût descend dans sa case
        (le bocal finissait à 14 px du bord bas, premier essai des icônes) ;
        et un objet plat (le palet) y flottait petit"""
        for i, nom in enumerate(noms):
            fab, incl, roulis = fabriques[nom]
            P = parent(sc, nom)
            at = Atelier()
            fab(at)
            cx = (i % colonnes) * 0.6
            cz = -(i // colonnes) * 0.6
            pose = RX(incl) @ RY(roulis)
            for bm in at.bm.values():
                bmesh.ops.transform(bm, matrix=pose, verts=bm.verts[:])
            xs = [v.co.x for bm in at.bm.values() for v in bm.verts]
            zs = [v.co.z for bm in at.bm.values() for v in bm.verts]
            demi = max(max(xs) - min(xs), max(zs) - min(zs)) / 2
            k = echelle(nom, demi)
            cadre = T(cx, 0, cz) @ Matrix.Diagonal((k, k, k, 1)) @ T(-(max(xs) + min(xs)) / 2, 0, -(max(zs) + min(zs)) / 2)
            for bm in at.bm.values():
                bmesh.ops.transform(bm, matrix=cadre, verts=bm.verts[:])
            at.objets(P, mats, BISEAU_ICO, lisse=True, prefixe=prefixe + nom)
            declare(nom, P, cx - DEMI, cx + DEMI, cz - DEMI, cz + DEMI, alpha=True)

    def atelier():
        global PREFIXE
        PREFIXE = 'ico-'
        sc = scene_neuve()
        monte_cases(sc, matieres_ceremonie(), ICONES, FABRIQUES, COLONNES, 'ico-',
                    lambda nom, demi: min(ECHELLE.get(nom, 1.0), DEMI_MAX / demi))
        lumiere_camera(sc)
        sc.cycles.device = 'GPU'
        return sc

    # ------------------------------------------------------------ les sceaux
    # Un MÉDAILLON OCTOGONAL par rang, et celui du module. Le CSS (.mb-sceau,
    # lot F) le découpe par un clip-path octogonal RÉGULIER qui touche les
    # quatre bords de son cadre (sommets à 29,3 %, côtés plats en haut, en
    # bas et sur les flancs) puis le teinte par --mb-rang en mélange
    # « color » : la teinte remplace celle de l'image, seule sa LUMINANCE
    # reste. D'où un acier NEUTRE (aucune teinte à laisser traîner, rien de
    # chaud pour prepare.py) et une gravure en relief, dont l'arête claire
    # et l'ombre portée portent tout le dessin une fois teinté. Le mot du
    # rang s'écrit au centre, par-dessus : le champ reste dans les gris moyens.
    #
    # La gravure dit le RÉGIME D'ÉCOULEMENT (ceremonie.ts) : du lisse au strié
    # figé — S superfluide, un champ poli sans une ride ; A laminaire, des
    # filets droits et parallèles ; B turbulent, des filets qui ondulent et
    # deux tourbillons ; C visqueux, des bourrelets épais et lents ; D figé,
    # des stries anguleuses, cassées et décalées, et une fêlure.

    APOTHEME = 0.246     # demi-largeur de plat à plat (la case : 0,25) — 4 px de marge à 512
    CHAMP = 0.2          # le plat du champ, sous la couronne
    DISQUE = 0.172       # le rayon de la gravure
    Y_CHAMP = -0.024     # la face du champ (la caméra est en -y)

    def octo(a):
        """l'octogone régulier d'apothème a, côtés plats sur les axes (comme
        le clip-path de .mb-sceau)"""
        return polygone(0, 0, a / math.cos(math.pi / 8), 8, 0.5)

    def couronne_octo(at, mat, ae, ai, yf, yb, var=0.0):
        """une couronne octogonale, en huit trapèzes"""
        E, I = octo(ae), octo(ai)
        for k in range(8):
            j = (k + 1) % 8
            at.prisme(mat, [E[k], E[j], I[j], I[k]], yf, yb, var=var)

    def _trace(self, mat, pts, r, segr=10, var=0.0, y=None):
        """un filet en relief le long d'une ligne du plan de la caméra :
        un tube à demi noyé dans le champ. r est un rayon, ou un rayon par
        point (un bourrelet qui enfle) ; segr=4 : une arête vive"""
        bm = self._bm(mat)
        y = Y_CHAMP if y is None else y
        rs = r if isinstance(r, (list, tuple)) else [r] * len(pts)
        anneaux = []
        for i, (x, z) in enumerate(pts):
            a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
            tx, tz = b[0] - a[0], b[1] - a[1]
            n = math.hypot(tx, tz) or 1.0
            nx, nz = -tz / n, tx / n
            anneaux.append([bm.verts.new((x + rs[i] * math.cos(2 * math.pi * j / segr + math.pi / segr) * nx,
                                          y + rs[i] * math.sin(2 * math.pi * j / segr + math.pi / segr),
                                          z + rs[i] * math.cos(2 * math.pi * j / segr + math.pi / segr) * nz))
                            for j in range(segr)])
        faces = []
        for A, B in zip(anneaux, anneaux[1:]):
            for j in range(segr):
                k = (j + 1) % segr
                faces.append(bm.faces.new((A[j], A[k], B[k], B[j])))
        faces += [bm.faces.new(anneaux[0]), bm.faces.new(list(reversed(anneaux[-1])))]
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        self._marque(mat, [v for a in anneaux for v in a], var)

    Atelier.trace = _trace

    def dans_disque(pts, R=DISQUE):
        """coupe une ligne en tronçons qui restent dans le disque gravé"""
        tron, cour = [], []
        for p in pts:
            if math.hypot(*p) < R:
                cour.append(p)
            elif cour:
                tron.append(cour)
                cour = []
        if cour:
            tron.append(cour)
        return [t for t in tron if len(t) > 2]

    def filets(at, mat, lignes, r, segr=10):
        for ligne in lignes:
            for t in dans_disque(ligne):
                at.trace(mat, t, r if not callable(r) else [r(x, z) for x, z in t], segr=segr)

    def medaillon(at, champ='champ'):
        """le médaillon commun : la plaque, la couronne rivetée, la marche
        intérieure, le champ et le cercle de la gravure"""
        at.prisme('acier', octo(APOTHEME), -0.02, 0.0, var=0.2)
        couronne_octo(at, 'acier', APOTHEME, CHAMP, -0.04, -0.02, var=-0.1)
        couronne_octo(at, 'sombre', CHAMP, CHAMP - 0.01, -0.032, -0.02)
        at.prisme(champ, octo(CHAMP), Y_CHAMP, -0.02)
        for k in range(8):
            a = 2 * math.pi * (k + 0.5) / 8
            r = (APOTHEME + CHAMP) / 2 / math.cos(math.pi / 8)
            at.dome('clair', r * math.cos(a), r * math.sin(a), 0.0085, -0.04)
        at.tore('clair', DISQUE + 0.006, 0.0045, T(0, Y_CHAMP, 0) @ RX(90), seg=96, segr=8)

    def xs(pas=0.004):
        n = int(0.4 / pas)
        return [-0.2 + pas * i for i in range(n + 1)]

    def sceau_S(at):
        # SUPERFLUIDE : un champ poli, une lentille sans une ride
        medaillon(at, champ='poli')
        at.tour('poli', [(0, 0.0), (0.15, 0.0), (0.13, 0.006), (0.08, 0.011), (0, 0.013)], M=T(0, Y_CHAMP, 0) @ FACE, seg=96)

    def sceau_A(at):
        # LAMINAIRE : des filets droits, parallèles, réguliers
        medaillon(at)
        filets(at, 'clair', [[(x, z0) for x in xs()] for z0 in [-0.156 + 0.026 * i for i in range(13)]], 0.004)

    def sceau_B(at):
        # TURBULENT : les filets ondulent, deux tourbillons les déchirent
        medaillon(at)
        tourb = [(-0.06, 0.045, 0.06), (0.07, -0.055, 0.055)]
        lignes = []
        for i in range(10):
            z0 = -0.15 + 0.033 * i
            ligne = []
            for x in xs():
                z = z0 + 0.011 * math.sin(x * 26 + i * 1.7)
                if all(math.hypot(x - cx, z - cz) > r + 0.012 for cx, cz, r in tourb):
                    ligne.append((x, z))
                elif ligne:
                    lignes.append(ligne)
                    ligne = []
            lignes.append(ligne)
        for cx, cz, r in tourb:
            lignes.append([(cx + (0.008 + r * t / 12.6) * math.cos(t), cz + (0.008 + r * t / 12.6) * math.sin(t))
                           for t in [0.1 * k for k in range(127)]])
        filets(at, 'clair', [l for l in lignes if len(l) > 2], 0.004)

    def sceau_C(at):
        # VISQUEUX : peu de bourrelets, épais, lents, qui enflent et maigrissent
        medaillon(at)
        lignes = [[(x, z0 + 0.016 * math.sin(x * 11 + i)) for x in xs(0.005)] for i, z0 in enumerate([-0.135 + 0.054 * k for k in range(6)])]
        filets(at, 'clair', lignes, lambda x, z: 0.0075 + 0.0035 * math.sin(x * 23 + z * 40))

    def sceau_D(at):
        # FIGÉ : des stries anguleuses, cassées par des failles et décalées,
        # en arête vive ; une fêlure les traverse
        medaillon(at)
        # (premier essai : des stries en zigzag — elles se lisaient en
        # vaguelettes, de l'eau qui coule encore. Ici, les filets droits du
        # laminaire, PRIS dans la masse : trois failles en biais, et chaque
        # bloc entre deux failles a glissé d'un cran, toutes stries ensemble)
        failles = [-0.085, 0.0, 0.08]       # x de chaque faille à z = 0
        biais = 0.45                         # la faille penche : x = f + biais·z
        rejets = [0.0, 0.011, -0.007, 0.014]  # le glissement de chaque bloc
        lignes = []
        for i in range(12):
            z0 = -0.152 + 0.0285 * i
            for k in range(4):
                a = -0.2 if k == 0 else failles[k - 1] + biais * z0
                b = 0.2 if k == 3 else failles[k] + biais * z0
                lignes.append([(x, z0 + rejets[k]) for x in xs(0.004) if a + 0.007 < x < b - 0.007])
        filets(at, 'clair', lignes, 0.005, segr=4)
        felure = [(-0.14, 0.11), (-0.07, 0.04), (-0.085, 0.01), (-0.01, -0.03), (0.02, -0.075), (0.005, -0.1), (0.07, -0.15)]
        for (a, b) in zip(felure, felure[1:]):
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
            at.boite('fond', (a[0] + b[0]) / 2 - L / 2 - 0.003, (a[0] + b[0]) / 2 + L / 2 + 0.003,
                     (a[1] + b[1]) / 2 - 0.004, (a[1] + b[1]) / 2 + 0.004, Y_CHAMP - 0.0065, Y_CHAMP + 0.002, rot=RY(-ang))

    def sceau_module(at):
        # LE MODULE : son plan octogonal — la coque, les coursives en croix,
        # quatre salles, le nœud central et ses quatre sas
        medaillon(at)
        couronne_octo(at, 'clair', 0.135, 0.12, Y_CHAMP - 0.008, Y_CHAMP + 0.002)
        for rot in (RY(0), RY(90)):
            at.boite('clair', -0.12, 0.12, -0.009, 0.009, Y_CHAMP - 0.005, Y_CHAMP + 0.002, rot=rot)
        for sx in (-1, 1):
            for sz in (-1, 1):
                at.prisme('clair', chanfrein(sx * 0.062 - 0.03, sx * 0.062 + 0.03, sz * 0.062 - 0.03, sz * 0.062 + 0.03, (0.008,) * 4),
                          Y_CHAMP - 0.006, Y_CHAMP + 0.002)
        at.prisme('clair', octo(0.026), Y_CHAMP - 0.009, Y_CHAMP + 0.002)
        # (boite() tourne autour de son PROPRE centre : chaque sas se place
        # donc à la main, sur son côté)
        for (dx, dz) in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            x0, x1 = sorted((0.135 * dx, 0.162 * dx)) if dx else (-0.016, 0.016)
            z0, z1 = sorted((0.135 * dz, 0.162 * dz)) if dz else (-0.016, 0.016)
            at.boite('clair', x0, x1, z0, z1, Y_CHAMP - 0.007, Y_CHAMP + 0.002)

    GRAVURES = {'S': sceau_S, 'A': sceau_A, 'B': sceau_B, 'C': sceau_C, 'D': sceau_D, 'module': sceau_module}

    def matieres_sceaux():
        mats = matieres_ceremonie()
        # NEUTRE : la teinte viendra du CSS ; brossé comme l'acier de
        # l'atelier, mais gris pur
        mats['acier'] = mat_brosse('sceau-acier', (0x5e, 0x5e, 0x5e), (0xa4, 0xa4, 0xa4), 91, brosse=0.10)
        mats['champ'] = mat_brosse('sceau-champ', (0x36, 0x36, 0x36), (0x5c, 0x5c, 0x5c), 93, brosse=0.05)
        mats['sombre'] = mat_simple('sceau-sombre', (0x22, 0x22, 0x22), rug=0.6)
        mats['clair'] = mat_simple('sceau-clair', (0xb8, 0xb8, 0xb8), rug=0.34, metal=0.2)
        mats['poli'] = mat_simple('sceau-poli', (0x6c, 0x6c, 0x6c), rug=0.2, metal=0.3)
        mats['fond'] = mat_simple('sceau-fond', (0x08, 0x08, 0x08), rug=0.9)
        mats['rivet'] = mats['clair']
        for m in (mats['acier'], mats['champ']):
            next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Metallic'].default_value = 0.2
        return mats

    def sceaux():
        global PREFIXE
        PREFIXE = 'sceau-'
        sc = scene_neuve()
        mats = matieres_sceaux()
        for i, nom in enumerate(SCEAUX):
            P = parent(sc, nom)
            at = Atelier()
            GRAVURES[nom](at)
            cx, cz = (i % COLONNES_SCEAUX) * 0.6, -(i // COLONNES_SCEAUX) * 0.6
            for bm in at.bm.values():
                bmesh.ops.transform(bm, matrix=T(cx, 0, cz), verts=bm.verts[:])
            at.objets(P, mats, {'acier': 0.004, 'sombre': 0.002, 'clair': 0.0015}, lisse=True, prefixe='sceau-' + nom)
            declare(nom, P, cx - DEMI, cx + DEMI, cz - DEMI, cz + DEMI, alpha=True)
        lumiere_camera(sc)
        sc.cycles.device = 'GPU'
        return sc

    # -------------------------------------------------------------- les cuves
    # LA BONBONNE, LA RÉSERVE ET LA COLONNE DE MAÎTRISE, en deux calques. Le
    # jeu pose entre eux un liquide CSS qui est un RECTANGLE (cuveHTML,
    # ceremonieObjets.ts) ; il monte et descend.
    #   · le DOS : la cuve entière, vide, sans son verre — l'intérieur sombre
    #     est ce qu'on voit au-dessus du liquide ;
    #   · le VERRE : tout ce qui n'est PAS derrière le liquide plein — la
    #     vitre, et tous les opaques qui passent devant lui (cadre de la
    #     jauge, socle, couvercle, chapeau, moitié avant des sièges). Le
    #     liquide plein y est rendu en CACHE (holdout) : c'est la profondeur
    #     qui trie, pas une liste. (Premier essai, objet par objet : un socle
    #     ou un siège entoure le liquide, et sa moitié ARRIÈRE, classée au
    #     verre, passait devant lui — un croissant sombre au fond du bocal,
    #     des sièges en double anneau sur la colonne.)
    #   · la SONDE : le liquide plein seul, en blanc, tous les opaques en
    #     cache, la vitre ôtée. Ce qui en reste visible est la fenêtre du
    #     liquide : elle ne se devine pas, elle se MESURE (assemble_cuves,
    #     hors de Blender), qui vérifie aussi que chaque pixel de la fenêtre
    #     où le liquide ne se voit pas est couvert par le calque verre (à plus
    #     de moitié opaque, vitre comprise : voir VOILE_MAX).
    #
    # Vue de face, inclinée de INCL_CUVE vers la caméra comme les icônes (on
    # voit le dessus des fûts) : une cuve fait une unité de haut, rendue à
    # 2048 px, livrée à 1024. Les bâtisseurs ci-dessous reçoivent encore trois
    # ateliers (D, V, S) : seule la SONDE (S) a un rôle à part ; D et V ne
    # font que ranger, le rôle d'un objet tient à sa matière (vitre,
    # intérieur, opaque).
    INCL_CUVE = 8
    PX_CUVE = 2048
    SIEGES = (-0.2, 0.0, 0.2)       # la hauteur des trois sièges d'anneau de la colonne
    COTE_ANNEAU = 0.44              # le côté de la case de l'anneau, en unités
    COUCHES = ('dos', 'verre', 'sonde')

    def _secteur(self, mat, profil, a0, a1, M=None, seg=48, var=0.0):
        """un morceau de couronne : le profil FERMÉ (r, z) balayé de a0 à a1
        autour de l'axe Z local, fermé à ses deux bouts (l'anneau brisé)"""
        bm = self._bm(mat)
        M = M if M is not None else Matrix.Identity(4)
        V = []
        for i in range(seg + 1):
            a = a0 + (a1 - a0) * i / seg
            V.append([bm.verts.new(M @ Vector((r * math.cos(a), r * math.sin(a), h))) for r, h in profil])
        n = len(profil)
        faces = []
        for A, B in zip(V, V[1:]):
            for j in range(n):
                k = (j + 1) % n
                faces.append(bm.faces.new((A[j], A[k], B[k], B[j])))
        faces += [bm.faces.new(V[0]), bm.faces.new(list(reversed(V[-1])))]
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        self._marque(mat, [v for a in V for v in a], var)

    Atelier.secteur = _secteur

    def couronne(at, mat, E, I, yf, yb, var=0.0):
        """une couronne entre deux contours au même nombre de sommets (un
        cadre à coins coupés)"""
        for k in range(len(E)):
            j = (k + 1) % len(E)
            at.prisme(mat, [E[k], E[j], I[j], I[k]], yf, yb, var=var)

    def mat_sonde():
        mat = bpy.data.materials.new('cuve-sonde')
        nt, N, L = noeuds(mat)
        out = N.new('ShaderNodeOutputMaterial')
        em = N.new('ShaderNodeEmission')
        em.inputs['Strength'].default_value = 1.0
        L.new(em.outputs[0], out.inputs[0])
        return mat

    def mat_vitre():
        """la vitre des cuves : CLAIRE de face (le liquide CSS se voit au
        travers), teintée et reflétante au rasant seulement. Le verre des
        icônes, posé ici en tube fermé, voilait le liquide à 63 % (deux parois
        et une transmission teintée, premier essai) : il éteignait le fluide"""
        mat = bpy.data.materials.new('cuve-vitre')
        nt, N, L = noeuds(mat)
        out = N.new('ShaderNodeOutputMaterial')
        tr = N.new('ShaderNodeBsdfTransparent')
        b = N.new('ShaderNodeBsdfPrincipled')
        b.inputs['Base Color'].default_value = lin((0x22, 0x34, 0x3e))
        b.inputs['Roughness'].default_value = 0.06
        lw = N.new('ShaderNodeLayerWeight')
        lw.inputs['Blend'].default_value = 0.4
        fac = op(nt, 'MULTIPLY_ADD', op(nt, 'POWER', lw.outputs['Facing'], 2.0), 0.8, 0.05)
        mix = N.new('ShaderNodeMixShader')
        L.new(fac, mix.inputs[0])
        L.new(tr.outputs[0], mix.inputs[1])
        L.new(b.outputs[0], mix.inputs[2])
        L.new(mix.outputs[0], out.inputs[0])
        return mat

    VITRES = ('ico-verre', 'cuve-vitre')

    def matieres_cuves():
        mats = matieres_ceremonie()
        mats['vitre'] = mat_vitre()
        mats['corps'] = mats['acier']
        # l'intérieur vide : un noir d'eau profonde, à peine sarcelle — ce
        # qu'on voit au-dessus du liquide quand la cuve n'est pas pleine
        mats['interieur'] = mat_simple('cuve-interieur', (0x08, 0x12, 0x16), rug=0.35, emission=(0x0c, 0x2a, 0x30), force=0.25)
        mats['creux'] = mat_simple('cuve-creux', (0x0a, 0x0c, 0x0e), rug=0.7)
        mats['sonde'] = mat_sonde()
        # l'anneau franchi s'ALLUME (l'or des paliers, charte : ce qui luit),
        # puis se brise : ses morceaux ne gardent qu'une braise
        mats['ambre'] = mat_simple('anneau-ambre', (0x6a, 0x3c, 0x0e), rug=0.2, emission=(0xff, 0xc0, 0x50), force=1.6)
        mats['braise'] = mat_simple('anneau-braise', (0x3a, 0x22, 0x0a), rug=0.3, emission=(0xff, 0xa0, 0x38), force=0.35)
        mats['trou'] = mat_simple('anneau-trou', (0, 0, 0))
        return mats

    def vitre(V, R, z0, z1, seg):
        """un tube de verre mince et OUVERT : fermé, son fond vu presque à
        plat se teintait au rasant et voilait le bas du liquide"""
        V.secteur('vitre', [(R - 0.002, z0), (R, z0), (R, z1), (R - 0.002, z1)], 0, 2 * math.pi, seg=seg)

    def cuve_bonbonne(D, V, S):
        """LA BONBONNE, le héros du bilan : un fût d'acier à col et robinet
        (avec son petit manomètre), deux cerclages, un pied à bandes de
        danger, l'étiquette du sujet, et la JAUGE — une fente vitrée, dans un
        cadre boulonné et gradué, où le fluide monte"""
        R = 0.2
        D.tour('corps', [(0, -0.43), (0.17, -0.43), (0.19, -0.424), (R, -0.41), (R, 0.17), (0.192, 0.225), (0.168, 0.27),
                         (0.125, 0.302), (0.07, 0.32), (0, 0.325)], seg=96, var=0.1)
        D.tour('sombre', [(0.15, -0.47), (0.193, -0.47), (0.197, -0.458), (0.197, -0.418), (0.15, -0.418)], seg=96, ferme=True)
        D.tour('rayures', [(0.1972, -0.462), (0.1985, -0.462), (0.1985, -0.426), (0.1972, -0.426)], seg=96, ferme=True)
        for z in (-0.375, 0.125):
            D.tore('sombre', R + 0.004, 0.011, T(0, 0, z), seg=96, segr=12)
        D.tour('clair', [(0, 0.318), (0.05, 0.318), (0.05, 0.345), (0.064, 0.345), (0.064, 0.365), (0.045, 0.372), (0.045, 0.395), (0, 0.395)])
        D.boite('acier', -0.042, 0.042, 0.39, 0.445, -0.036, 0.036, var=-0.3)
        D.tube('clair', (0.04, 0, 0.418), (0.09, 0, 0.418), 0.015)
        D.tube('sombre', (0.09, 0, 0.418), (0.1, 0, 0.418), 0.019)
        D.tour('acier', [(0, 0.444), (0.012, 0.444), (0.012, 0.458), (0, 0.458)])
        D.tore('sombre', 0.058, 0.0085, T(0, 0, 0.462), segr=10)
        for a in (0, 120, 240):
            c, s_ = math.cos(math.radians(a)), math.sin(math.radians(a))
            D.tube('sombre', (0.0, 0.0, 0.462), (0.058 * c, 0.058 * s_, 0.462), 0.005)
        # le petit manomètre du robinet
        D.tube('clair', (-0.04, 0, 0.418), (-0.07, 0, 0.418), 0.008)
        M = T(-0.085, -0.02, 0.418) @ FACE
        D.tour('clair', [(0, 0.0), (0.03, 0.0), (0.03, 0.012), (0, 0.012)], M=M)
        D.tour('cadran', [(0, 0.012), (0.024, 0.012), (0.024, 0.014), (0, 0.014)], M=M)
        D.boite('aiguille', -0.085 - 0.002, -0.085 + 0.002, 0.418, 0.438, -0.0365, -0.0345, rot=RY(-35))
        # l'étiquette du sujet
        D.boite('etiquette', -0.09, 0.09, 0.165, 0.21, -0.206, -0.178, var=0)
        for x in (-0.078, 0.078):
            D.dome('clair', x, 0.1875, 0.005, -0.206)
        # la jauge : l'intérieur au dos, le cadre et sa vitre au verre
        fen = chanfrein(-0.07, 0.07, -0.335, 0.105, (0.014,) * 4)
        D.prisme('interieur', fen, -0.203, -0.17)
        S.prisme('sonde', fen, -0.204, -0.171)
        ext = chanfrein(-0.102, 0.102, -0.367, 0.137, (0.03,) * 4)
        couronne(V, 'acier', ext, fen, -0.218, -0.165, var=0.3)
        for z in (-0.33, -0.22, -0.11, 0.0, 0.1):
            for x in (-0.087, 0.087):
                V.dome('clair', x, z, 0.0062, -0.218)
        for k in range(13):
            z = -0.31 + 0.4 * k / 12
            long = 0.016 if k % 3 == 0 else 0.009
            V.boite('cyan', -0.07 + 0.002, -0.07 + 0.002 + long, z - 0.0018, z + 0.0018, -0.2085, -0.2075)
        V.prisme('vitre', fen, -0.209, -0.207)

    def cuve_reserve(D, V, S):
        """LA RÉSERVE : un bocal large, socle et couvercle d'acier, quatre
        montants (les deux de devant au verre), une graduation sur la vitre"""
        Rg, Ri = 0.34, 0.33
        D.tour('interieur', [(0, -0.36), (Ri, -0.36), (Ri, 0.26), (0, 0.26)], seg=128)
        S.tour('sonde', [(0, -0.36), (Ri, -0.36), (Ri, 0.26), (0, 0.26)], seg=128)
        vitre(V, Rg, -0.361, 0.261, 128)
        # le socle en couronne autour du verre, et son plancher un rien plus
        # bas que le liquide : à la même cote, le fond du liquide en cache et
        # le dessus du socle se disputaient les mêmes pixels
        V.tour('acier', [(Rg - 0.004, -0.47), (0.38, -0.47), (0.395, -0.458), (0.395, -0.395), (0.372, -0.378), (0.35, -0.36),
                         (Rg - 0.004, -0.36)], seg=128, ferme=True, var=0.2)
        D.tour('acier', [(0, -0.47), (Rg, -0.47), (Rg, -0.362), (0, -0.362)], seg=128, var=0.2)
        V.tour('rayures', [(0.3955, -0.452), (0.397, -0.452), (0.397, -0.402), (0.3955, -0.402)], seg=128, ferme=True)
        V.tour('acier', [(0, 0.258), (0.375, 0.258), (0.392, 0.272), (0.392, 0.33), (0.362, 0.354), (0.15, 0.368), (0.13, 0.392),
                         (0.08, 0.405), (0, 0.408)], seg=128, var=-0.2)
        V.tour('clair', [(0, 0.404), (0.045, 0.404), (0.05, 0.425), (0.035, 0.44), (0, 0.443)])
        for a in (30, 150, 210, 330):
            x, y = 0.372 * math.cos(math.radians(a)), 0.372 * math.sin(math.radians(a))
            (V if y < 0 else D).tube('clair', (x, y, -0.37), (x, y, 0.265), 0.014)
        for k in range(11):
            z = -0.3 + 0.5 * k / 10
            x = -0.22
            y = -math.sqrt(Rg * Rg - x * x) - 0.0015
            long = 0.04 if k % 5 == 0 else 0.022
            V.boite('cyan', x, x + long, z - 0.0022, z + 0.0022, y - 0.0015, y + 0.006, rot=RZ(-math.degrees(math.asin(x / Rg))))

    def siege(at, z):
        """un siège d'anneau vide : un collier, sa gorge sombre"""
        at.tour('acier', [(0.112, z - 0.02), (0.146, z - 0.02), (0.146, z - 0.008), (0.139, z - 0.008), (0.139, z + 0.008),
                          (0.146, z + 0.008), (0.146, z + 0.02), (0.112, z + 0.02)], seg=96, ferme=True, var=0.2)
        at.tour('creux', [(0.13, z - 0.008), (0.14, z - 0.008), (0.14, z + 0.008), (0.13, z + 0.008)], seg=96, ferme=True)

    def cuve_maitrise(D, V, S):
        """LA COLONNE DE MAÎTRISE : un tube de verre entre un socle et un
        chapeau octogonaux, deux tirants, trois sièges d'anneau VIDES — l'anneau
        (une case à part) vient s'y poser"""
        Rt, ri = 0.11, 0.1
        D.tour('interieur', [(0, -0.38), (ri, -0.38), (ri, 0.36), (0, 0.36)], seg=64)
        S.tour('sonde', [(0, -0.38), (ri, -0.38), (ri, 0.36), (0, 0.36)], seg=64)
        vitre(V, Rt, -0.381, 0.361, 96)
        # (le socle en couronne, son plancher un rien plus bas : voir le bocal)
        V.tour('acier', [(Rt - 0.004, -0.47), (0.21, -0.47), (0.222, -0.456), (0.222, -0.42), (0.175, -0.4), (0.15, -0.38),
                         (Rt - 0.004, -0.38)], seg=8, phase=0.5, ferme=True, var=0.2)
        D.tour('acier', [(0, -0.47), (Rt, -0.47), (Rt, -0.382), (0, -0.382)], seg=64, var=0.2)
        V.tour('acier', [(0, 0.358), (0.15, 0.358), (0.172, 0.378), (0.2, 0.398), (0.2, 0.43), (0.172, 0.452), (0, 0.46)], seg=8, phase=0.5, var=-0.2)
        for z in SIEGES:
            siege(V, z)
        for x in (-0.176, 0.176):
            D.tube('clair', (x, 0, -0.4), (x, 0, 0.385), 0.012)
            for z in (-0.39, 0.37):
                D.tour('sombre', [(0, -0.008), (0.02, -0.008), (0.02, 0.008), (0, 0.008)], M=T(x, 0, z), seg=6, phase=0.5)

    def anneau(A, brise):
        """l'ANNEAU DE PALIER, au siège du milieu : un collier d'acier et sa
        gorge qui luit. Brisé : six morceaux écartés, tombés, une braise"""
        col = [(0.113, -0.024), (0.153, -0.024), (0.157, -0.016), (0.157, 0.016), (0.153, 0.024), (0.113, 0.024)]
        gorge = [(0.15, -0.009), (0.16, -0.009), (0.16, 0.009), (0.15, 0.009)]
        if not brise:
            A.tour('clair', col, seg=96, ferme=True)
            A.tour('ambre', gorge, seg=96, ferme=True)
        else:
            rng = random.Random(7)
            coupes = [0, 52, 118, 170, 236, 298, 360]
            for a, b in zip(coupes, coupes[1:]):
                a0, a1 = math.radians(a + 4), math.radians(b - 4)
                m = math.radians((a + b) / 2)
                d = rng.uniform(0.012, 0.03)
                M = T(d * math.cos(m), d * math.sin(m), -rng.uniform(0.004, 0.03)) @ Matrix.Rotation(math.radians(rng.uniform(-9, 9)), 4, Vector((-math.sin(m), math.cos(m), 0)))
                A.secteur('clair', col, a0, a1, M=M, seg=24)
                A.secteur('braise', gorge, a0, a1, M=M, seg=24)
            for k in range(9):
                a = math.radians(rng.uniform(200, 340))
                r = rng.uniform(0.12, 0.2)
                c = (r * math.cos(a), r * math.sin(a), -rng.uniform(0.03, 0.11))
                e = rng.uniform(0.004, 0.009)
                A.boite('clair', c[0] - e, c[0] + e, c[2] - e, c[2] + e, c[1] - e, c[1] + e, rot=RY(rng.uniform(0, 90)))

    BATIS_CUVES = {'bonbonne': cuve_bonbonne, 'reserve': cuve_reserve, 'maitrise': cuve_maitrise}
    GROUPES = {}      # nom de pièce → {couche: [objets]}
    GEOMETRIE = {}    # ce que l'assemblage hors de Blender doit savoir (cadres, sièges)

    def poser(ateliers, pose):
        for at in ateliers:
            for bm in at.bm.values():
                bmesh.ops.transform(bm, matrix=pose, verts=bm.verts[:])

    def cuves():
        global PREFIXE
        PREFIXE = 'cuve-'
        sc = scene_neuve()
        GROUPES.clear()
        GEOMETRIE.clear()
        mats = matieres_cuves()
        biseau = {'corps': 0.004, 'acier': 0.004, 'sombre': 0.003, 'clair': 0.0025}
        incl = RX(INCL_CUVE)
        for nom in CUVES:
            P = parent(sc, nom)
            at = {c: Atelier() for c in COUCHES}
            BATIS_CUVES[nom](at['dos'], at['verre'], at['sonde'])
            poser(at.values(), incl)
            # recentrée sur sa boîte (dos et verre), une unité de haut
            pts = [v.co for c in ('dos', 'verre') for bm in at[c].bm.values() for v in bm.verts]
            cx = (max(p.x for p in pts) + min(p.x for p in pts)) / 2
            cz = (max(p.z for p in pts) + min(p.z for p in pts)) / 2
            centre = T(-cx, 0, -cz)
            poser(at.values(), centre)
            pose = centre @ incl
            larg = max(p.x for p in pts) - min(p.x for p in pts)
            if nom == 'maitrise':
                larg = max(larg, COTE_ANNEAU)
            wpx = math.ceil((larg + 0.06) * PX_CUVE / 32) * 32
            w = wpx / PX_CUVE
            GROUPES[nom] = {}
            for c in COUCHES:
                C = sous(P, f'{nom}-{c}')
                at[c].objets(C, mats, biseau, lisse=True, prefixe=f'cuve-{nom}-{c}')
                GROUPES[nom][c] = list(C.objects)
                declare(f'{nom}-{c}', P, -w / 2, w / 2, -0.5, 0.5, alpha=True)
            if nom == 'bonbonne':
                cu = bpy.data.curves.new('sujet21', 'FONT')
                cu.body = 'SUJET 21'
                cu.size = 0.028
                cu.align_x = 'CENTER'
                cu.align_y = 'CENTER'
                cu.extrude = 0.0006
                cu.space_character = 1.2
                ob = bpy.data.objects.new('cuve-bonbonne-dos-marquage', cu)
                ob.data.materials.append(mats['trait'])
                ob.matrix_world = pose @ T(0, -0.2068, 0.1875) @ RX(90)
                sous_dos = next(c for c in P.children if c.name.startswith('bonbonne-dos'))
                sous_dos.objects.link(ob)
                GROUPES[nom]['dos'].append(ob)
            GEOMETRIE[nom] = {'cadre': [-w / 2, w / 2, -0.5, 0.5], 'px': [wpx, PX_CUVE]}
            if nom == 'maitrise':
                GEOMETRIE[nom]['sieges'] = [[(pose @ Vector((0, 0, z))).x, (pose @ Vector((0, 0, z))).z] for z in SIEGES]
                for etat in ANNEAUX:
                    Q = parent(sc, 'anneau-' + etat)
                    A, H = Atelier(), Atelier()
                    anneau(A, etat == 'brise')
                    # le tube de la colonne, en CACHE : la moitié arrière de
                    # l'anneau passe derrière lui
                    H.tour('trou', [(0, -0.12), (0.1105, -0.12), (0.1105, 0.12), (0, 0.12)], seg=96)
                    poser((A, H), T(0, 0, SIEGES[1]))
                    poser((A, H), pose)
                    A.objets(Q, mats, {'clair': 0.0025}, lisse=True, prefixe='anneau-' + etat)
                    H.objets(Q, mats, {}, lisse=True, prefixe='anneau-' + etat + '-cache')
                    for ob in Q.objects:
                        ob.is_holdout = ob.name.startswith(f'anneau-{etat}-cache')
                    sx, sz = GEOMETRIE[nom]['sieges'][1]
                    declare('anneau-' + etat, Q, sx - COTE_ANNEAU / 2, sx + COTE_ANNEAU / 2, sz - COTE_ANNEAU / 2, sz + COTE_ANNEAU / 2, alpha=True)
                GEOMETRIE['anneau'] = {'cote': COTE_ANNEAU}
        lumiere_camera(sc)
        sc.cycles.device = 'GPU'
        return sc

    def role(ob, sonde):
        """le rôle d'un objet dans les passes : 'sonde', 'vitre', 'interieur'
        ou 'opaque' — il tient à sa matière, pas au calque où on l'a rangé"""
        if ob in sonde:
            return 'sonde'
        mat = ob.data.materials[0].name if ob.data and ob.data.materials else ''
        if mat.startswith(VITRES):
            return 'vitre'
        return 'interieur' if mat.startswith('cuve-interieur') else 'opaque'

    def couche(nom):
        """prépare une passe — dos, verre ou sonde (voir plus haut) ; rend le
        nombre de px par unité de la pièce"""
        if nom.startswith('anneau-'):
            return 1024 / COTE_ANNEAU
        objet, c = nom.rsplit('-', 1)
        G = GROUPES[objet]
        sonde = set(G['sonde'])
        visible = {
            'dos': {'opaque', 'interieur'},
            'verre': {'opaque', 'vitre', 'sonde'},
            'sonde': {'opaque', 'sonde'},
        }[c]
        cache = {'dos': set(), 'verre': {'sonde'}, 'sonde': {'opaque'}}[c]
        for obs in G.values():
            for ob in obs:
                r = role(ob, sonde)
                ob.hide_render = r not in visible
                ob.visible_camera = True
                ob.is_holdout = r in cache
        return PX_CUVE

    def lance_cuves(sortie, echantillons=192):
        """comme lance(), passe par passe ; écrit aussi cuves.json (les cadres
        et la place des sièges, pour l'assemblage)"""
        import time
        json.dump(GEOMETRIE, open(os.path.join(sortie, 'cuves.json'), 'w'))
        file = [f'{n}-{c}' for n in CUVES for c in COUCHES] + ['anneau-' + e for e in ANNEAUX]
        journal = os.path.join(sortie, 'journal.jsonl')
        for f in (journal, os.path.join(sortie, 'fini.txt')):
            if os.path.exists(f):
                os.remove(f)

        def pas():
            global PX
            if not file:
                open(os.path.join(sortie, 'fini.txt'), 'w').write('fini')
                return None
            n = file.pop(0)
            t = time.time()
            try:
                PX = couche(n)
                m = rend(n, sortie, 16 if n.endswith('-sonde') else echantillons, 100)
                m['secondes'] = round(time.time() - t, 1)
            except Exception as e:
                import traceback
                m = {'nom': n, 'erreur': repr(e), 'trace': traceback.format_exc()[-600:]}
            open(journal, 'a', encoding='utf-8').write(json.dumps(m, ensure_ascii=False) + '\n')
            return 0.2
        bpy.app.timers.register(pas, first_interval=0.5)


    # -------------------------------------------------------- les instruments
    # UNE CASE PAR INSTRUMENT (instruments.ts), et l'objet dit son EFFET : la
    # buse calibrée souffle, l'aimant à rosée attire des gouttes, le ballast
    # pèse, la lentille de visée vise… Les CONTREPARTIES sont du même acier,
    # mais ABÎMÉ — encrassé, fendu, percé, qui fuit : le prix se voit sur
    # l'objet. Ces icônes s'affichent PETIT (cartes de tirage, ATH, journal,
    # canvas du module, 24 à 32 px) : peu de pièces, une silhouette franche,
    # et chaque objet agrandi jusqu'à REMPLIR sa case (DEMI_INSTR), quand les
    # icônes de cérémonie, vues en grand, gardaient leurs proportions.
    DEMI_INSTR = 0.222

    def matieres_instruments():
        mats = matieres_ceremonie()
        # l'acier ENCRASSÉ des contreparties : plus sombre, un voile de crasse
        # grise (une rouille franche aurait fait chaud, et la charte le refuse)
        # (au premier essai, 2e3234 / 52585a : la gourde, la buse, l'antenne
        # et la bonbonne de gaz se perdaient dans le fond à 24 px — abîmé ne
        # veut pas dire noir)
        mats['crasse'] = mat_brosse('instr-crasse', (0x46, 0x4a, 0x4a), (0x74, 0x7a, 0x78), 95, brosse=0.04, rouille=(0x34, 0x32, 0x2c))
        next(n for n in mats['crasse'].node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Metallic'].default_value = 0.15
        mats['gras'] = mat_simple('instr-gras', (0x0c, 0x0e, 0x10), rug=0.1)
        mats['vapeur'] = mat_simple('instr-vapeur', (0x8a, 0xa0, 0xac), rug=0.9, emission=(0x6a, 0x84, 0x90), force=0.25)
        mats['membrane'] = mat_simple('instr-membrane', (0x9c, 0xa8, 0xae), rug=0.5)
        mats['eteint'] = mat_simple('instr-eteint', (0x0c, 0x18, 0x1a), rug=0.3)
        # le matelas de la gaine : la toile aluminisée de l'atelier (4a4f55)
        # sortait en boudin noir à 24 px
        mats['isolant'] = mat_simple('instr-isolant', (0x74, 0x7a, 0x80), rug=0.7, metal=0.2)
        return mats

    def i_echantillon(at):
        """l'échantillon de secours : une éprouvette pleine, bouchée, dans sa pince"""
        at.tour('verre', [(0, -0.19), (0.03, -0.185), (0.045, -0.165), (0.048, -0.14), (0.048, 0.15), (0, 0.15)])
        at.tour('eau', [(0, -0.182), (0.028, -0.178), (0.04, -0.16), (0.041, -0.14), (0.041, 0.06), (0, 0.06)])
        at.tour('acier', [(0, 0.145), (0.056, 0.145), (0.058, 0.17), (0.05, 0.2), (0, 0.205)])
        at.tore('clair', 0.053, 0.011, T(0, 0, -0.03))
        at.boite('clair', 0.05, 0.13, -0.045, -0.015, -0.012, 0.012)
        at.tube('sombre', (0.13, 0, -0.2), (0.13, 0, 0.03), 0.013)
        at.tour('acier', [(0, -0.21), (0.06, -0.21), (0.06, -0.19), (0, -0.19)], M=T(0.13, 0, 0))

    def gaine(at, fendue=False):
        """la gaine isolante : une conduite sous un matelas cousu — fendue, un
        coussin éclaté, le tuyau à nu, et le givre qui sort"""
        M = RY(90)
        at.tour('crasse' if fendue else 'acier', [(0, -0.21), (0.048, -0.21), (0.048, 0.21), (0, 0.21)], M=M)
        for k in range(5):
            z = -0.14 + 0.07 * k
            prof = [(0.048, z - 0.033), (0.082, z - 0.03), (0.094, z), (0.082, z + 0.03), (0.048, z + 0.033)]
            if fendue and k == 2:
                at.secteur('isolant', prof, math.radians(-40), math.radians(200), M=M, seg=32)
                # le givre sort de la fente, en aiguilles vers la caméra
                for a, dz, long in ((-90, 0.0, 0.11), (-60, -0.02, 0.08), (-120, 0.02, 0.085), (-75, 0.025, 0.06), (-105, -0.025, 0.065)):
                    d = M @ Vector((math.cos(math.radians(a)), math.sin(math.radians(a)), 0.0)) - M @ Vector((0, 0, 0))
                    c = M @ Vector((0.0, 0.0, z + dz)) + d * 0.045
                    at.tube('cristal', tuple(c), tuple(c + d * long), 0.016, seg=6, r2=0.002)
            else:
                at.tour('isolant', prof, M=M, ferme=True)
        for z in (-0.19, 0.19):
            at.tour('clair', [(0.04, z - 0.012), (0.075, z - 0.012), (0.075, z + 0.012), (0.04, z + 0.012)], M=M, ferme=True)
        if fendue:
            at.tore('cristal', 0.098, 0.006, M @ T(0, 0, 0.105), segr=6)

    def i_gaine(at):
        gaine(at)

    def buse(at, encrassee=False):
        """la buse calibrée : un cône à bague graduée, et son jet — encrassée,
        bouchée d'un bouchon de crasse qui coule"""
        M = T(-0.04, 0, 0) @ RY(90)
        at.tour('crasse' if encrassee else 'acier', [(0, -0.17), (0.062, -0.17), (0.062, -0.09), (0.078, -0.09), (0.078, -0.06),
                                                    (0.058, -0.05), (0.03, 0.07), (0.022, 0.08), (0, 0.08)], M=M)
        at.tore('sombre' if encrassee else 'cyan', 0.064, 0.008, T(-0.12, 0, 0) @ RY(90), segr=8)
        if encrassee:
            at.sphere('gras', (0.045, 0, 0), 0.035)
            at.tube('gras', (0.045, -0.005, -0.02), (0.05, -0.01, -0.12), 0.018, r2=0.006)
            at.sphere('gras', (0.05, -0.01, -0.13), 0.014)
        else:
            for k in range(3):
                at.tore('cyan', 0.03 + 0.022 * k, 0.008, T(0.07 + 0.045 * k, 0, 0) @ RX(90), seg=24, segr=8,
                        a0=math.radians(-55), a1=math.radians(55))

    def i_buse(at):
        buse(at)

    def i_aimant(at):
        """l'aimant à rosée : un fer à cheval aux pôles qui luisent, et les
        gouttes qu'il attire"""
        at.tore('acier', 0.1, 0.042, T(0, 0, 0.06) @ RX(90), a0=0, a1=math.pi, segr=16)
        for x in (-0.1, 0.1):
            at.tube('acier', (x, 0, 0.06), (x, 0, -0.07), 0.042, seg=32)
            at.tube('cyan', (x, 0, -0.07), (x, 0, -0.115), 0.043, seg=32)
        for (x, z, r) in ((0.0, -0.15, 0.03), (-0.04, -0.2, 0.02), (0.045, -0.19, 0.017)):
            at.sphere('eau', (x, -0.01, z), r)

    def i_chambre_froide(at):
        """la chambre froide : un cube de glace dans sa cage d'acier"""
        a = 0.14
        at.boite('acier', -a - 0.01, a + 0.01, -a - 0.03, -a, -a - 0.01, a + 0.01, var=0.2)
        at.boite('acier', -a - 0.01, a + 0.01, a, a + 0.03, -a - 0.01, a + 0.01, var=-0.2)
        for x in (-a, a):
            for y in (-a, a):
                at.tube('clair', (x, y, -a), (x, y, a), 0.012)
        at.boite('cristal', -0.09, 0.09, -0.09, 0.09, -0.09, 0.09, rot=RZ(28) @ RX(14))
        at.boite('voyant', -0.03, 0.03, -a - 0.024, -a - 0.006, -a - 0.016, -a - 0.009)

    def i_peau(at):
        """la peau tendue : une membrane sur son cadre, ses tirants, une goutte
        qui y perle"""
        at.tour('acier', [(0.165, -0.07), (0.185, -0.07), (0.185, 0.03), (0.165, 0.03)], seg=64, ferme=True, var=0.2)
        at.tour('membrane', [(0, 0.026), (0.17, 0.026), (0.17, 0.034), (0, 0.034)], seg=64)
        at.tore('clair', 0.178, 0.009, T(0, 0, 0.034), segr=8)
        for k in range(8):
            th = 2 * math.pi * (k + 0.5) / 8
            c, s_ = 0.19 * math.cos(th), 0.19 * math.sin(th)
            at.tube('clair', (c, s_, -0.06), (c, s_, 0.03), 0.008)
        at.sphere('eau', (0.03, -0.02, 0.06), 0.038)

    def i_vanne(at):
        """la vanne de secours : un corps de vanne sur sa conduite, et son
        volant à bandes de danger"""
        at.tube('acier', (-0.2, 0, -0.12), (0.2, 0, -0.12), 0.045, seg=40)
        for x in (-0.16, 0.16):
            at.tube('clair', (x - 0.012, 0, -0.12), (x + 0.012, 0, -0.12), 0.06, seg=40)
        at.sphere('acier', (0, 0, -0.11), 0.072)
        at.tube('clair', (0, 0, -0.06), (0, 0, 0.07), 0.016)
        at.tore('rayures', 0.13, 0.02, T(0, 0, 0.08), segr=10)
        for a in (0, 60, 120):
            c, s_ = math.cos(math.radians(a)), math.sin(math.radians(a))
            at.tube('sombre', (-0.13 * c, -0.13 * s_, 0.08), (0.13 * c, 0.13 * s_, 0.08), 0.008)
        at.sphere('clair', (0, 0, 0.085), 0.025)

    def i_plastron(at):
        """le plastron : un bouclier riveté, sa bande et sa plaque claire"""
        ecu = [(-0.17, 0.12), (-0.12, 0.17), (0.12, 0.17), (0.17, 0.12), (0.17, -0.03), (0.0, -0.2), (-0.17, -0.03)]
        at.prisme('acier', ecu, -0.02, 0.02, var=0.2)
        at.prisme('clair', mise_a_l_echelle(ecu, 0.72, 0, 0.0), -0.028, -0.02)
        at.prisme('sombre', [(-0.17, 0.035), (0.17, 0.035), (0.17, 0.0), (-0.17, 0.0)], -0.034, -0.02)
        for (x, z) in ((-0.145, 0.13), (0.145, 0.13), (-0.145, -0.02), (0.145, -0.02), (0.0, -0.165)):
            at.dome('clair', x, z, 0.012, -0.02)

    def i_detendeur(at):
        """le détendeur : un corps de régulateur, son molette, l'entrée et la
        sortie, et son petit cadran"""
        at.tour('acier', [(0, -0.07), (0.085, -0.07), (0.09, -0.06), (0.09, 0.06), (0.085, 0.07), (0, 0.07)], var=0.2)
        at.tour('clair', [(0, 0.068), (0.05, 0.068), (0.055, 0.08), (0.055, 0.15), (0.045, 0.165), (0, 0.168)], seg=16)
        for x0, x1 in ((-0.21, -0.08), (0.08, 0.21)):
            at.tube('acier', (x0, 0, -0.02), (x1, 0, -0.02), 0.03, seg=32)
        at.tube('clair', (-0.2, 0, -0.02), (-0.18, 0, -0.02), 0.04, seg=32)
        at.tube('clair', (0.18, 0, -0.02), (0.2, 0, -0.02), 0.04, seg=32)
        M = T(0, -0.085, -0.01) @ FACE
        at.tour('clair', [(0, 0.0), (0.05, 0.0), (0.05, 0.012), (0, 0.012)], M=M)
        at.tour('cadran', [(0, 0.012), (0.04, 0.012), (0.04, 0.015), (0, 0.015)], M=M)
        at.boite('aiguille', -0.003, 0.003, -0.01, 0.025, -0.102, -0.099, rot=RY(-40))

    def i_patins(at):
        """les patins de givre : une lame polie sur sa monture, sa trace de glace"""
        lame = [(-0.21, -0.11), (0.14, -0.11), (0.19, -0.08), (0.205, -0.04), (0.19, -0.03), (0.15, -0.085), (-0.21, -0.085)]
        at.prisme('clair', lame, -0.008, 0.008)
        for x in (-0.15, 0.08):
            at.boite('acier', x - 0.02, x + 0.02, -0.088, 0.0, -0.025, 0.025)
        at.prisme('acier', chanfrein(-0.19, 0.13, 0.0, 0.06, (0.02, 0.0, 0.03, 0.02)), -0.05, 0.05, var=0.2)
        at.boite('cyan', -0.21, 0.1, -0.135, -0.124, -0.01, 0.01)

    def i_lentille(at):
        """la lentille de visée : une lunette, sa lentille qui luit vers vous"""
        M = RZ(-35) @ RY(90)
        at.tour('acier', [(0, -0.2), (0.032, -0.2), (0.032, -0.15), (0.042, -0.14), (0.042, 0.08), (0.06, 0.1), (0.06, 0.19), (0, 0.19)], M=M, var=0.2)
        at.tour('voyant', [(0, 0.19), (0.05, 0.19), (0.05, 0.196), (0, 0.2)], M=M)
        at.tore('clair', 0.06, 0.008, M @ T(0, 0, 0.188), segr=8)
        for z in (-0.06, 0.03):
            at.tore('sombre', 0.046, 0.01, M @ T(0, 0, z), segr=8)
        at.tube('sombre', tuple(M @ Vector((0, 0, -0.015))), tuple(M @ Vector((0, 0, -0.015)) + Vector((0, 0, -0.12))), 0.012)
        at.tour('acier', [(0, -0.01), (0.06, -0.01), (0.06, 0.01), (0, 0.01)], M=T(*(M @ Vector((0, 0, -0.015)) + Vector((0, 0, -0.13)))))

    def i_gueule(at):
        """la gueule ouverte : une bouche d'aspiration en entonnoir, ses
        aubes en spirale qui luisent, le noir du conduit au fond"""
        at.tour('acier', [(0.06, -0.06), (0.085, -0.06), (0.205, 0.035), (0.205, 0.055), (0.185, 0.055), (0.06, -0.035)], M=FACE, seg=64, ferme=True, var=0.2)
        at.tour('fond', [(0, -0.07), (0.065, -0.07), (0.065, -0.04), (0, -0.04)], M=FACE)
        at.tore('clair', 0.197, 0.012, T(0, -0.055, 0) @ RX(90), segr=8)
        for k in range(6):
            th = 60 * k
            r = 0.125
            x, z = r * math.cos(math.radians(th)), r * math.sin(math.radians(th))
            at.boite('cyan', x - 0.055, x + 0.055, z - 0.008, z + 0.008, -0.02, -0.01, rot=RY(-(th + 62)))

    def i_filtre(at):
        """le filtre à condensat : une cartouche à plis, et la goutte qu'il rend"""
        at.tour('clair', [(0, 0.12), (0.112, 0.12), (0.112, 0.16), (0.09, 0.175), (0, 0.178)], var=0.2)
        at.tour('acier', [(0, -0.16), (0.1, -0.16), (0.1, 0.12), (0, 0.12)], var=0.1)
        for k in range(14):
            a = math.radians(180 + 180 * (k + 0.5) / 14)
            x, y = 0.102 * math.cos(a), 0.102 * math.sin(a)
            at.boite('sombre', x - 0.006, x + 0.006, -0.13, 0.09, y - 0.006, y + 0.006, rot=RZ(math.degrees(a)))
        at.tour('clair', [(0, -0.19), (0.112, -0.19), (0.112, -0.155), (0, -0.155)])
        at.tore('cyan', 0.104, 0.007, T(0, 0, 0.0), segr=8)
        at.tube('acier', (0, 0, -0.19), (0, 0, -0.215), 0.02)
        at.tour('eau', [(0, -0.29), (0.02, -0.285), (0.027, -0.27), (0.02, -0.255), (0.007, -0.24), (0, -0.23)])

    def i_ballast(at):
        """le ballast : un lest d'acier massif, sa bande de danger, son anneau"""
        at.prisme('acier', [(-0.18, -0.17), (0.18, -0.17), (0.13, 0.07), (-0.13, 0.07)], -0.08, 0.08, var=0.2)
        at.prisme('rayures', [(-0.17, -0.13), (0.17, -0.13), (0.16, -0.08), (-0.16, -0.08)], -0.084, -0.079)
        at.tore('clair', 0.065, 0.018, T(0, 0, 0.12) @ RX(90), segr=10)
        at.boite('sombre', -0.03, 0.03, 0.06, 0.085, -0.02, 0.02)

    def i_bascule(at):
        """la bascule rapide : un interrupteur à levier sur son socle, un voyant
        allumé, l'autre éteint"""
        at.prisme('acier', chanfrein(-0.18, 0.18, -0.2, -0.06, (0, 0, 0.03, 0.03)), -0.1, 0.1, var=0.2)
        at.tour('clair', [(0, -0.06), (0.045, -0.06), (0.035, -0.035), (0, -0.03)], M=T(0, 0, 0))
        at.boite('clair', -0.018, 0.018, -0.04, 0.13, -0.025, 0.025, rot=RY(28))
        at.sphere('clair', (0.07, 0, 0.115), 0.032)
        at.sphere('voyant', (-0.12, -0.1, -0.13), 0.022)
        at.sphere('eteint', (0.12, -0.1, -0.13), 0.022)

    def i_chambre_etanche(at):
        """la chambre étanche : une porte ronde, ses six crabots, et son
        hublot où dort une vapeur"""
        at.tour('acier', [(0, 0.0), (0.18, 0.0), (0.185, 0.01), (0.185, 0.03), (0, 0.03)], M=FACE, seg=64, var=0.2)
        at.tour('clair', [(0.15, 0.03), (0.185, 0.03), (0.185, 0.045), (0.15, 0.045)], M=FACE, seg=64, ferme=True)
        for k in range(6):
            th = 60 * k + 30
            x, z = 0.19 * math.cos(math.radians(th)), 0.19 * math.sin(math.radians(th))
            at.boite('sombre', x - 0.028, x + 0.028, z - 0.016, z + 0.016, -0.05, 0.0, rot=RY(-th))
        at.tour('clair', [(0.06, 0.03), (0.085, 0.03), (0.085, 0.05), (0.06, 0.05)], M=FACE, ferme=True)
        at.tour('veille', [(0, 0.03), (0.062, 0.03), (0.062, 0.036), (0, 0.036)], M=FACE)
        for (x, z, r) in ((-0.015, 0.0, 0.026), (0.02, 0.012, 0.02), (0.01, -0.025, 0.018)):
            at.sphere('vapeur', (x, -0.036, z), r)

    def i_tamis(at):
        """le tamis fin : un cadre rond tendu d'une maille, sa poignée"""
        at.tour('acier', [(0.16, -0.035), (0.19, -0.035), (0.19, 0.03), (0.16, 0.03)], seg=64, ferme=True, var=0.2)
        # (treize fils de 0,006 : une grisaille à 24 px ; neuf, plus épais)
        n = 9
        for k in range(n):
            c = -0.16 + 0.32 * (k + 0.5) / n
            L = math.sqrt(max(0.161 ** 2 - c * c, 0))
            at.boite('clair', -L, L, -0.005, 0.005, c - 0.006, c + 0.006)
            at.boite('clair', c - 0.006, c + 0.006, -0.005, 0.005, -L, L)
        at.tube('sombre', (0.19, 0, 0.0), (0.27, 0, 0.0), 0.016)
        at.sphere('sombre', (0.27, 0, 0), 0.02)

    def i_semelles(at):
        """les semelles polies : une paire de semelles, lisses à briller"""
        def semelle(dx, dz, ang):
            pts = []
            for k in range(28):
                t = 2 * math.pi * k / 28
                # une semelle : large à l'avant, cintrée, le talon rond
                x = 0.065 * math.cos(t) * (1.0 if math.sin(t) > 0 else 0.85)
                z = 0.17 * math.sin(t) + (0.0 if abs(math.sin(t)) > 0.3 else 0.0)
                x *= 1.0 - 0.25 * math.exp(-((math.sin(t) + 0.15) ** 2) / 0.05)
                pts.append((x, z))
            pts = tourne(pts, ang)
            pts = [(x + dx, z + dz) for x, z in pts]
            at.prisme('acier', pts, -0.012, 0.012, var=0.2)
            at.prisme('clair', mise_a_l_echelle(pts, 0.82, dx, dz), -0.018, -0.012)
            for k in range(3):
                z = dz - 0.06 + 0.06 * k
                at.boite('cyan', dx - 0.03, dx + 0.03, z - 0.004, z + 0.004, -0.02, -0.017, rot=RY(-25 - ang))
        semelle(-0.075, 0.0, 8)
        semelle(0.075, -0.015, -8)

    def i_eclateur(at):
        """l'éclateur : une charge cerclée de danger, son détonateur qui luit,
        les éclats qu'il détache"""
        at.tour('sombre', [(0, -0.2), (0.075, -0.2), (0.08, -0.19), (0.08, 0.07), (0, 0.07)], var=0.2)
        at.tour('rayures', [(0.0805, -0.08), (0.083, -0.08), (0.083, -0.03), (0.0805, -0.03)], ferme=True)
        at.tour('acier', [(0, 0.065), (0.085, 0.065), (0.085, 0.09), (0.03, 0.11), (0, 0.112)])
        at.tube('clair', (0, 0, 0.11), (0, 0, 0.15), 0.012)
        at.sphere('voyant', (0, 0, 0.165), 0.03)
        for (x, z, r, a) in ((0.075, 0.2, 0.02, 20), (-0.07, 0.19, 0.016, -30), (0.11, 0.13, 0.014, 50)):
            at.boite('cristal', x - r, x + r, z - r * 1.6, z + r * 1.6, -r, r, rot=RY(a))

    def i_croc(at):
        """le croc du sas : un crochet forgé au bout de sa tige, son œil"""
        at.tube('acier', (0.1, 0, -0.04), (0.1, 0, 0.17), 0.022, seg=24)
        at.tore('clair', 0.04, 0.014, T(0.1, 0, 0.205) @ RX(90), segr=10)
        at.tore('acier', 0.1, 0.022, T(0, 0, -0.04) @ RX(90), seg=48, segr=12, a0=math.radians(160), a1=math.radians(360))
        tip = (0.1 * math.cos(math.radians(160)), 0, -0.04 + 0.1 * math.sin(math.radians(160)))
        at.tube('clair', tip, (tip[0] + 0.02, 0, tip[2] + 0.07), 0.024, r2=0.003)

    def i_sur_regime(at):
        """le sur-régime : un compte-tours en demi-lune, l'aiguille collée dans
        la zone qui luit"""
        # (un contour à 27 sommets, premier essai, se triangulait de travers :
        # des triangles noirs au pied — la demi-lune est un secteur de tour)
        M = T(0, 0, -0.06) @ FACE
        at.secteur('acier', [(0.001, -0.02), (0.19, -0.02), (0.19, 0.01), (0.001, 0.01)], 0, math.pi, M=M, seg=32, var=0.2)
        at.secteur('cadran', [(0.001, 0.01), (0.165, 0.01), (0.165, 0.016), (0.001, 0.016)], 0, math.pi, M=M, seg=32)
        at.boite('acier', -0.2, 0.2, -0.11, -0.055, -0.03, 0.02, var=-0.2)
        at.tore('ambre', 0.14, 0.009, T(0, -0.017, -0.06) @ RX(90), seg=16, segr=8, a0=0, a1=math.radians(42))
        for k in range(9):
            th = math.radians(180 - 22.5 * k)
            at.boite('trait', 0.12 * math.cos(th) - 0.014, 0.12 * math.cos(th) + 0.014, -0.06 + 0.12 * math.sin(th) - 0.004,
                     -0.06 + 0.12 * math.sin(th) + 0.004, -0.019, -0.015, rot=RY(-math.degrees(th)))
        aig = tourne([(-0.02, -0.008), (0.14, -0.002), (0.15, 0.0), (0.14, 0.002), (-0.02, 0.008)], 14)
        at.prisme('aiguille', [(x, z - 0.06) for x, z in aig], -0.024, -0.018)
        at.tour('clair', [(0, 0.018), (0.02, 0.018), (0.02, 0.028), (0, 0.03)], M=T(0, 0, -0.06) @ FACE)

    def i_ration(at):
        """la ration de survie : une boîte de conserve, son étiquette, sa
        languette à tirer"""
        at.tour('acier', [(0, -0.16), (0.115, -0.16), (0.12, -0.15), (0.12, 0.12), (0.115, 0.13), (0, 0.13)], var=0.2)
        for z in (-0.155, 0.125):
            at.tore('clair', 0.118, 0.01, T(0, 0, z), segr=8)
        at.tour('etiquette', [(0.1205, -0.1), (0.1225, -0.1), (0.1225, 0.07), (0.1205, 0.07)], ferme=True)
        at.tore('cyan', 0.1235, 0.006, T(0, 0, -0.015), segr=8)
        at.tore('clair', 0.03, 0.008, T(0.05, 0, 0.138), segr=8)
        at.sphere('clair', (0.02, 0, 0.134), 0.012)

    def i_oeilleres(at):
        """les œillères : deux verres de visée qui luisent, et les volets qui
        ferment le côté"""
        for s_ in (-1, 1):
            x = s_ * 0.085
            at.tour('clair', [(0.05, 0.0), (0.072, 0.0), (0.072, 0.03), (0.05, 0.03)], M=T(x, 0, 0.0) @ FACE, ferme=True)
            at.tour('voyant', [(0, 0.004), (0.052, 0.004), (0.052, 0.012), (0, 0.014)], M=T(x, 0, 0.0) @ FACE)
            volet = [(s_ * 0.155, 0.08), (s_ * 0.215, 0.11), (s_ * 0.215, -0.11), (s_ * 0.155, -0.08)]
            at.prisme('acier', volet, -0.02, 0.0, var=0.3)
            at.boite('sombre', min(s_ * 0.155, s_ * 0.17), max(s_ * 0.155, s_ * 0.17), -0.075, 0.075, -0.025, 0.0)
        at.boite('acier', -0.02, 0.02, -0.01, 0.025, -0.02, 0.0)
        at.boite('sombre', -0.215, 0.215, 0.07, 0.09, 0.0, 0.015)

    def i_carnet(at):
        """le carnet du Semblable : un carnet relié, ses coins, sa sangle et
        l'octogone du Semblable"""
        at.prisme('sombre', chanfrein(-0.145, 0.145, -0.195, 0.195, (0.0,) * 4), -0.022, 0.022, var=0.2)
        at.boite('etiquette', 0.13, 0.15, -0.185, 0.185, -0.016, 0.016)
        for (sx, sz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            x, z = sx * 0.145, sz * 0.195
            at.prisme('clair', [(x, z), (x - sx * 0.05, z), (x, z - sz * 0.05)], -0.026, 0.026)
        at.boite('acier', 0.07, 0.1, -0.2, 0.2, -0.027, 0.027)
        at.prisme('cyan', polygone(-0.03, 0.03, 0.06, 8), -0.028, -0.022)
        at.prisme('sombre', polygone(-0.03, 0.03, 0.04, 8), -0.031, -0.026)

    # ---- les contreparties : le même acier, abîmé
    def c_fuite_lente(at):
        """la fuite lente : une gourde encrassée, percée au fond, qui goutte"""
        at.tour('crasse', [(0, -0.12), (0.09, -0.12), (0.11, -0.09), (0.115, -0.03), (0.11, 0.05), (0.08, 0.1), (0.035, 0.12),
                           (0.035, 0.16), (0, 0.16)], var=0.3)
        at.tour('sombre', [(0, 0.155), (0.045, 0.155), (0.045, 0.19), (0, 0.19)])
        at.tore('sombre', 0.114, 0.008, T(0, 0, -0.04), segr=8)
        at.prisme('fond', [(-0.012, -0.1), (0.01, -0.095), (0.004, -0.115), (-0.008, -0.118)], -0.12, -0.08)
        for (x, z, r) in ((0.0, -0.15, 0.016), (0.0, -0.19, 0.012)):
            at.sphere('eau', (x, -0.06, z), r)
        at.tour('eau', [(0, -0.215), (0.08, -0.215), (0.07, -0.205), (0, -0.2)], M=T(0, -0.04, 0))

    def c_residu(at):
        """le résidu collant : une plaque prise dans un gras noir qui coule"""
        at.prisme('crasse', chanfrein(-0.18, 0.18, -0.18, 0.18, (0.04,) * 4), 0.0, 0.025, var=0.3)
        for (x, z, r, l) in ((-0.08, 0.1, 0.06, 0.18), (0.06, 0.06, 0.05, 0.12), (0.1, 0.13, 0.035, 0.07), (-0.02, -0.02, 0.045, 0.14)):
            at.sphere('gras', (x, -0.005, z), r)
            at.tube('gras', (x, -0.01, z), (x + 0.004, -0.01, z - l), r * 0.55, r2=r * 0.25)
            at.sphere('gras', (x + 0.004, -0.012, z - l), r * 0.32)

    def c_gaine_fendue(at):
        gaine(at, fendue=True)

    def c_buse_encrassee(at):
        buse(at, encrassee=True)

    def c_bonbonne_percee(at):
        """la bonbonne percée : la bonbonne de livraison, presque vide, et son
        jet qui fuit par le trou"""
        bonbonne(at, Matrix.Identity(4), liquide=0.22)
        at.prisme('fond', [(0.045, -0.03), (0.07, -0.02), (0.075, -0.045), (0.055, -0.055)], -0.1, -0.07)
        for k, (x, z, r) in enumerate(((0.1, -0.05, 0.016), (0.135, -0.075, 0.014), (0.165, -0.11, 0.012), (0.18, -0.15, 0.01))):
            at.sphere('eau', (x, -0.09, z), r)

    def c_fuite_prioritaire(at):
        """classé fuite prioritaire : une antenne encrassée qui vous traque,
        et son signal haché"""
        # (tournée de -55°, premier essai, elle montrait son dos : la coupe
        # vers la caméra, son cornet et son signal devant)
        M = T(-0.04, 0, 0.02) @ RY(-35) @ RX(55)
        at.tour('crasse', [(0, -0.01), (0.08, 0.004), (0.14, 0.035), (0.155, 0.05), (0.14, 0.055), (0.08, 0.026), (0, 0.012)], M=M, seg=48, var=0.3)
        at.tube('clair', tuple(M @ Vector((0, 0, 0.01))), tuple(M @ Vector((0, 0, 0.11))), 0.01)
        at.sphere('voyant', tuple(M @ Vector((0, 0, 0.115))), 0.018)
        at.tube('sombre', tuple(M @ Vector((0, 0, -0.01))), (-0.04, 0, -0.19), 0.016)
        at.tour('sombre', [(0, -0.21), (0.07, -0.21), (0.07, -0.19), (0, -0.19)], M=T(-0.04, 0, 0), seg=8, phase=0.5)
        c = M @ Vector((0, 0, 0.115))
        for k, (a0, a1) in enumerate(((10, 40), (55, 80), (5, 25), (45, 85))):
            R = 0.05 if k < 2 else 0.09
            at.tore('cyan', R, 0.009, T(c.x, c.y - 0.02, c.z) @ RX(90), seg=12, segr=6, a0=math.radians(a0), a1=math.radians(a1))

    def c_vapeur_eventee(at):
        """la vapeur éventée : une bonbonne de gaz encrassée, sa vanne cassée,
        et le gaz qui s'en va en bouffées"""
        at.tour('crasse', [(0, -0.2), (0.08, -0.2), (0.09, -0.19), (0.09, 0.02), (0.075, 0.06), (0.04, 0.075), (0, 0.078)], var=0.3)
        at.tore('sombre', 0.091, 0.008, T(0, 0, -0.08), segr=8)
        at.tube('sombre', (0, 0, 0.07), (0.02, 0, 0.11), 0.015)
        at.tube('sombre', (0.025, 0, 0.11), (0.06, 0, 0.12), 0.012)
        for (x, z, r) in ((0.06, 0.13, 0.022), (0.09, 0.16, 0.03), (0.13, 0.19, 0.038), (0.03, 0.18, 0.02)):
            at.sphere('vapeur', (x, -0.02, z), r)

    FABRIQUES_INSTR = {
        'echantillon-secours': (i_echantillon, 8, 18), 'gaine-isolante': (i_gaine, 14, -22),
        'buse-calibree': (i_buse, 0, -12), 'aimant-rosee': (i_aimant, 6, 12),
        'chambre-froide': (i_chambre_froide, 18, 0), 'peau-tendue': (i_peau, 34, 0),
        'vanne-de-secours': (i_vanne, 26, 0), 'plastron': (i_plastron, 0, 0),
        'detendeur': (i_detendeur, 14, 0), 'patins-de-givre': (i_patins, 14, -8),
        'lentille-de-visee': (i_lentille, 4, -22), 'gueule-ouverte': (i_gueule, 0, 0),
        'filtre-a-condensat': (i_filtre, 12, 0), 'ballast': (i_ballast, 16, 0),
        'bascule-rapide': (i_bascule, 20, 0), 'chambre-etanche': (i_chambre_etanche, 0, 0),
        'tamis-fin': (i_tamis, 38, 0), 'semelles-polies': (i_semelles, 0, 0),
        'eclateur': (i_eclateur, 10, 18), 'croc-du-sas': (i_croc, 0, 0),
        'sur-regime': (i_sur_regime, 0, 0), 'ration-de-survie': (i_ration, 22, 0),
        'oeilleres': (i_oeilleres, 6, 0), 'carnet-du-semblable': (i_carnet, 0, 8),
        'fuite-lente': (c_fuite_lente, 10, 0), 'residu-collant': (c_residu, 0, 0),
        'gaine-fendue': (c_gaine_fendue, 14, -22), 'buse-encrassee': (c_buse_encrassee, 0, -12),
        'bonbonne-percee': (c_bonbonne_percee, 10, 0), 'fuite-prioritaire': (c_fuite_prioritaire, 0, 0),
        'vapeur-eventee': (c_vapeur_eventee, 10, 0),
    }

    def instruments():
        global PREFIXE
        PREFIXE = 'instr-'
        sc = scene_neuve()
        monte_cases(sc, matieres_instruments(), INSTRUMENTS, FABRIQUES_INSTR, COLONNES_INSTR, 'instr-',
                    lambda nom, demi: DEMI_INSTR / demi)
        lumiere_camera(sc)
        sc.cycles.device = 'GPU'
        return sc


# ------------------------------------------------- l'assemblage, hors de Blender
PLANCHES = {
    # planche : (les cases dans l'ordre, colonnes, rangées, préfixe des rendus, côté d'une case)
    'icones': (ICONES, COLONNES, RANGEES, 'ico-', CASE),
    'sceaux': (SCEAUX, COLONNES_SCEAUX, RANGEES_SCEAUX, 'sceau-', CASE),
    'instruments': (INSTRUMENTS, COLONNES_INSTR, RANGEES_INSTR, 'instr-', CASE_INSTR),
}


def assemble(planche_nom, dossier, sortie, controle=None):
    """les rendus détourés (alpha/<préfixe><nom>.png, 1024²) en une planche
    de cases de 512² (256² pour les instruments) ; et, si demandé, une planche de contrôle : chaque case
    à 32 et à 64 px sur le fond du voile, pour juger la lisibilité"""
    from PIL import Image
    noms, colonnes, rangees, prefixe, case = PLANCHES[planche_nom]
    planche = Image.new('RGBA', (colonnes * case, rangees * case), (0, 0, 0, 0))
    cases = []
    for i, nom in enumerate(noms):
        im = Image.open(os.path.join(dossier, 'alpha', prefixe + nom + '.png')).convert('RGBA')
        # prémultiplié pendant la réduction : sinon le noir du vide (alpha
        # nul) bave en liseré sombre autour de l'objet
        im = im.convert('RGBa').resize((case, case), Image.LANCZOS).convert('RGBA')
        planche.paste(im, ((i % colonnes) * case, (i // colonnes) * case))
        cases.append(im)
    planche.save(sortie)
    if controle:
        fond = (0x0b, 0x12, 0x18, 255)
        pas = 80
        ctl = Image.new('RGBA', (colonnes * pas * 2, rangees * pas), fond)
        for i, im in enumerate(cases):
            x, y = (i % colonnes) * pas * 2, (i // colonnes) * pas
            for k, cote in enumerate((32, 64)):
                petit = im.convert('RGBa').resize((cote, cote), Image.LANCZOS).convert('RGBA')
                ctl.alpha_composite(petit, (x + 8 + k * 44, y + (pas - cote) // 2))
        ctl.save(controle)


# la part du liquide visible que le calque verre peut voiler à plus de moitié.
# Mesuré sur les cuves livrées le 13/11 : bonbonne 0,0006, bocal 0,0036,
# colonne 0,0015 — la vitre, claire de face, ne passe presque jamais 0,5. Un
# verre qui éteint le liquide (premier essai) mesurait 1,0. Le plafond reste
# à quelques fois la mesure : une régression modérée de la vitre se voit
VOILE_MAX = 0.02


def _reduit(chemin, taille):
    from PIL import Image
    im = Image.open(chemin).convert('RGBA')
    return im.convert('RGBa').resize(taille, Image.LANCZOS).convert('RGBA')


def assemble_cuves(dossier, masters, controle=None):
    """les cuves : chaque calque réduit de moitié (2048 → 1024 de haut) en
    master ; la fenêtre du liquide MESURÉE sur la sonde ; l'anneau (deux
    cases de 512²) ; et ce qu'il faut recopier dans OBJETS / ANNEAUX_MAITRISE
    (ceremonieObjets.ts). Renvoie les mesures : `pixels_nus` compte les pixels
    de la fenêtre où le liquide ne se voit pas et qui ne sont pas couverts —
    le liquide y déborderait ; l'appel en ligne de commande échoue s'il y en
    a, ou si le voile dépasse VOILE_MAX. « Couvert » : sous le calque VERRE à
    plus de moitié opaque — l'alpha du calque entier, vitre comprise ; le
    voile mesuré montre que la vitre seule n'y atteint presque jamais, si bien
    que ce qui couvre, ce sont les opaques."""
    import numpy as np
    from PIL import Image
    geo = json.load(open(os.path.join(dossier, 'cuves.json')))
    res = {}
    vues = []
    for nom in CUVES:
        wpx, hpx = geo[nom]['px']
        taille = (wpx // 2, hpx // 2)
        calques = {}
        for c in ('dos', 'verre', 'sonde'):
            calques[c] = _reduit(os.path.join(dossier, 'alpha', f'cuve-{nom}-{c}.png'), taille)
        for c in ('dos', 'verre'):
            calques[c].save(os.path.join(masters, f'ceremonie-{nom}-{c}.png'))
        sonde = np.asarray(calques['sonde'])[..., 3] / 255.0
        verre = np.asarray(calques['verre'])[..., 3] / 255.0
        ys, xs = np.nonzero(sonde > 0.5)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        # un pixel de plus d'un côté s'il tombe sous le calque verre à plus de
        # moitié opaque (vitre comprise : voir VOILE_MAX) : la
        # lisière anticrénelée ne laisse pas voir le fond entre liquide et
        # cadre. Contre une paroi de verre clair, non : le liquide s'y
        # verrait dans l'épaisseur du verre (premier essai, partout élargie,
        # la colonne avait deux colonnes de pixels nus)
        couvert = lambda bande: float((verre[bande] > 0.5).mean()) > 0.95
        x0 -= couvert((slice(y0, y1), x0 - 1))
        x1 += couvert((slice(y0, y1), x1))
        y0 -= couvert((y0 - 1, slice(x0, x1)))
        y1 += couvert((y1, slice(x0, x1)))
        boite = (slice(y0, y1), slice(x0, x1))
        # « nu » : ni liquide visible, ni verre à moitié opaque. (Au seuil de
        # 0,9, premier essai, les lisières anticrénelées des cadres et des
        # colliers — 0,86 d'opacité en médiane — passaient pour des trous :
        # 279, 125 et 1266 pixels ; à 0,5, aucun.)
        nu = (sonde[boite] < 0.5) & (verre[boite] < 0.5)
        W, H = taille
        res[nom] = {'largeur': W, 'hauteur': H,
                    'liquide': {'x': round(x0 / W, 4), 'y': round(y0 / H, 4), 'l': round((x1 - x0) / W, 4), 'h': round((y1 - y0) / H, 4)},
                    'pixels_nus': int(nu.sum()),
                    # la part de la zone où le liquide SE VOIT que le verre
                    # voile à plus de moitié : le verre transparent doit
                    # laisser voir le liquide (le fond d'un tube fermé, vu au
                    # rasant, l'assombrissait en ellipse — premier essai)
                    'voile': round(float(((sonde > 0.5) & (verre > 0.5)).sum() / max((sonde > 0.5).sum(), 1)), 4)}
        vues.append((nom, calques, (x0, y0, x1, y1)))
    # l'anneau : intact | brisé
    planche = Image.new('RGBA', (2 * CASE, CASE), (0, 0, 0, 0))
    for i, e in enumerate(ANNEAUX):
        planche.paste(_reduit(os.path.join(dossier, 'alpha', f'cuve-anneau-{e}.png'), (CASE, CASE)), (i * CASE, 0))
    planche.save(os.path.join(masters, 'ceremonie-anneau.png'))
    # où poser la case de l'anneau sur chaque siège, en fractions de l'image
    # de la colonne (un carré : l·largeur = h·hauteur en pixels)
    x0, x1, z0, z1 = geo['maitrise']['cadre']
    c = geo['anneau']['cote']
    res['anneaux'] = [{'x': round((sx - c / 2 - x0) / (x1 - x0), 4), 'y': round((z1 - sz - c / 2) / (z1 - z0), 4),
                       'l': round(c / (x1 - x0), 4), 'h': round(c / (z1 - z0), 4)} for sx, sz in geo['maitrise']['sieges']]
    if controle:
        # chaque cuve remplie aux deux tiers d'un sarcelle uni (ce que fera le
        # CSS), et la colonne avec un anneau intact et un brisé posés
        fond = (0x0b, 0x12, 0x18, 255)
        larg = sum(cal['dos'].width for _, cal, _ in vues) + 40 * len(vues)
        ctl = Image.new('RGBA', (larg, 1024), fond)
        x = 20
        for nom, cal, (a, b, c_, d) in vues:
            img = Image.new('RGBA', cal['dos'].size, (0, 0, 0, 0))
            img.alpha_composite(cal['dos'])
            hauteur = round((d - b) * 0.66)
            img.alpha_composite(Image.new('RGBA', (c_ - a, hauteur), (0x2a, 0xc8, 0xbc, 235)), (a, d - hauteur))
            img.alpha_composite(cal['verre'])
            if nom == 'maitrise':
                an = Image.open(os.path.join(masters, 'ceremonie-anneau.png')).convert('RGBA')
                for k, f in enumerate(res['anneaux'][:2]):
                    case = an.crop(((1 - k) * CASE, 0, (2 - k) * CASE, CASE))
                    cote = round(f['l'] * img.width)
                    img.alpha_composite(case.resize((cote, cote), Image.LANCZOS), (round(f['x'] * img.width), round(f['y'] * img.height)))
            ctl.alpha_composite(img, (x, 0))
            x += img.width + 40
        ctl.save(controle)
    return res


if __name__ == '__main__' and not DANS_BLENDER:
    if sys.argv[1] == 'cuves':
        r = assemble_cuves(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
        print(json.dumps(r, indent=1))
        if any(v.get('pixels_nus') for v in r.values() if isinstance(v, dict)):
            sys.exit('des pixels de la fenêtre ne sont couverts ni par le liquide visible, ni par le verre')
        if any(v.get('voile', 0) > VOILE_MAX for v in r.values() if isinstance(v, dict)):
            sys.exit(f'le verre voile plus de {VOILE_MAX:.0%} du liquide visible')
    else:
        assemble(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
