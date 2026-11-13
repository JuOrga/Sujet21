"""L'ATELIER DE LA CÉRÉMONIE « STATION » (13/11) — les pictogrammes rendus qui
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

Dans Blender (le rendu ne bloque pas l'appel : lance() passe par un minuteur) :
    DOSSIER = r'\\\\wsl.localhost\\Ubuntu\\...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\ceremonie.py', encoding='utf-8').read())
    atelier() ; lance(ICONES, SORTIE, 192)
puis, hors de Blender, l'assemblage de la planche (et une planche de contrôle
réduite à 32 et 64 px, pour juger la lisibilité) :
    python -I tools/images/blender/ceremonie.py <dossier des rendus> masters/images/ceremonie-icones.png [contrôle.png]
"""
import math, os, random, sys

DANS_BLENDER = 'bpy' in sys.modules

# l'ORDRE des cases : recopié de ICONES_CEREMONIE (iconesStation.ts)
ICONES = [
    'condensat', 'memoire', 'tirage', 'orbe', 'livre', 'reserve', 'maitrise',
    'instruments', 'chrono', 'note', 'secours', 'profondeur', 'repos', 'don', 'rencontre',
    'cache', 'economat', 'carte', 'danger', 'couperet', 'palet', 'rafales',
    'orbites', 'cibles', 'minijeu', 'contrepartie',
]
COLONNES, RANGEES, CASE = 7, 4, 512

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
    # Chaque fonction bâtit son objet autour de l'origine, dans |x|, |z| < 0,21
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
    # demi-taille d'un objet dans sa case (0,25), qui laisse au moins ~20 px
    # transparents au bord d'une case de 512 (prepare.py mesure le bord)
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

    def atelier(noms=None):
        efface()
        PIECES.clear()
        sc = bpy.data.scenes.new('ceremonie')
        fen = bpy.context.window or bpy.context.window_manager.windows[0]
        fen.scene = sc
        mats = matieres_ceremonie()
        for i, nom in enumerate(ICONES):
            if noms and nom not in noms:
                continue
            fab, incl, roulis = FABRIQUES[nom]
            P = parent(sc, nom)
            at = Atelier()
            fab(at)
            cx = (i % COLONNES) * 0.6
            cz = -(i // COLONNES) * 0.6
            pose = RX(incl) @ RY(roulis)
            for bm in at.bm.values():
                bmesh.ops.transform(bm, matrix=pose, verts=bm.verts[:])
            # RECENTRÉ sur sa boîte, et borné : incliné vers la caméra, un fût
            # descend dans sa case (le bocal finissait à 14 px du bord bas,
            # premier essai) ; et un objet plat (le palet) y flottait petit
            xs = [v.co.x for bm in at.bm.values() for v in bm.verts]
            zs = [v.co.z for bm in at.bm.values() for v in bm.verts]
            demi = max(max(xs) - min(xs), max(zs) - min(zs)) / 2
            k = min(ECHELLE.get(nom, 1.0), DEMI_MAX / demi)
            cadre = T(cx, 0, cz) @ Matrix.Diagonal((k, k, k, 1)) @ T(-(max(xs) + min(xs)) / 2, 0, -(max(zs) + min(zs)) / 2)
            for bm in at.bm.values():
                bmesh.ops.transform(bm, matrix=cadre, verts=bm.verts[:])
            at.objets(P, mats, BISEAU_ICO, lisse=True, prefixe='ico-' + nom)
            declare(nom, P, cx - DEMI, cx + DEMI, cz - DEMI, cz + DEMI, alpha=True)
        lumiere_camera(sc)
        sc.cycles.device = 'GPU'
        return sc


# ------------------------------------------------- l'assemblage, hors de Blender
def assemble(dossier, sortie, controle=None):
    """les rendus détourés (alpha/ico-<nom>.png, 1024²) en une planche 7×4 de
    cases de 512² ; et, si demandé, une planche de contrôle : chaque icône à
    32 et à 64 px sur le fond du voile, pour juger la lisibilité"""
    from PIL import Image
    planche = Image.new('RGBA', (COLONNES * CASE, RANGEES * CASE), (0, 0, 0, 0))
    cases = []
    for i, nom in enumerate(ICONES):
        im = Image.open(os.path.join(dossier, 'alpha', 'ico-' + nom + '.png')).convert('RGBA')
        # prémultiplié pendant la réduction : sinon le noir du vide (alpha
        # nul) bave en liseré sombre autour de l'objet
        im = im.convert('RGBa').resize((CASE, CASE), Image.LANCZOS).convert('RGBA')
        planche.paste(im, ((i % COLONNES) * CASE, (i // COLONNES) * CASE))
        cases.append(im)
    planche.save(sortie)
    if controle:
        fond = (0x0b, 0x12, 0x18, 255)
        pas = 80
        ctl = Image.new('RGBA', (COLONNES * pas * 2, RANGEES * pas), fond)
        for i, im in enumerate(cases):
            x, y = (i % COLONNES) * pas * 2, (i // COLONNES) * pas
            for k, cote in enumerate((32, 64)):
                petit = im.convert('RGBa').resize((cote, cote), Image.LANCZOS).convert('RGBA')
                ctl.alpha_composite(petit, (x + 8 + k * 44, y + (pas - cote) // 2))
        ctl.save(controle)


if __name__ == '__main__' and not DANS_BLENDER:
    d = sys.argv[1]
    assemble(d, sys.argv[2] if len(sys.argv) > 2 else os.path.join(d, 'ceremonie-icones.png'),
             sys.argv[3] if len(sys.argv) > 3 else None)
