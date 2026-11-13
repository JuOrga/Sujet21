r"""LES DEUX SCÈNES DE FIN (13/11) — fin-capsule.webp et fin-fiole-brisee.webp,
1600×900, l'écran qui suit la cinématique quand la descente se termine
(conception de la cérémonie « station », étape 7).

  · LA DESCENTE BOUCLÉE : la bonbonne livrée, SCELLÉE dans sa capsule, part
    vers la géante gazeuse ; la station derrière. Le plus grand moment du
    jeu — la bonbonne est celle de la cérémonie (cuve_bonbonne, B3), même
    objet, même acier ; la station suit la silhouette du canon (assets-ia
    §26 : l'arc de coque à gauche portant le module Méduse, les modules
    octogonaux, le nœud, l'observatoire à dôme, le mât aux quatre panneaux
    à droite) ; la planète est celle du canon aussi : une géante gazeuse
    froide, à bandes, ceinte d'un anneau fin, éclairée en croissant.
  · L'ÉCHANTILLON PERDU : une fiole brisée sur le caillebotis, dans le noir,
    sous une seule lumière froide ; le fluide qui s'éteint. Sobre, froid,
    sans or.

Aucune image générée n'y entre : les étoiles, la planète et son anneau sont
procéduraux, tout le reste est modélisé ici, avec les outils, l'acier et le
verre de l'atelier (ceremonie.py, qui charge surfaces.py). Ce sont des
SCÈNES, pas des pièces : caméra en perspective, un soleil qui marque, là où
l'atelier éclaire à plat — mais la palette reste la sienne (froide, l'ambre
aux seules veilleuses).

Le BAS DU CADRE RESTE SOMBRE : le relevé de la descente (sceaux et
chiffres) s'y pose. La mesure le vérifie (mesure(), hors de Blender).

Dans Blender, en UN SEUL appel (le MCP ne garde rien d'un appel à l'autre) :
    DOSSIER = r'\\wsl.localhost\Ubuntu\home\julian\projets\sujet21\tools\images\blender'
    exec(compile(open(DOSSIER + r'\fins.py', encoding='utf-8').read(), DOSSIER + r'\fins.py', 'exec'))
    lance_fins(MASTERS, 384)          # MASTERS : ...\masters\images
Chaque scène vit dans sa propre scène Blender (« fin-capsule »,
« fin-fiole-brisee ») ; la fenêtre bascule dessus, on revient à la main à la
scène d'origine. La capsule est rendue à 3200×1800 et réduite par
prepare.py ; la fiole, à 1600×900, débruitée (REGLAGES). Puis :
    python -I tools/images/blender/fins.py masters/images/fin-capsule.png masters/images/fin-fiole-brisee.png
    python3 tools/images/prepare.py fin-capsule fin-fiole-brisee
"""
import json, math, os, random, sys

DANS_BLENDER = 'bpy' in sys.modules
SCENES = ['fin-capsule', 'fin-fiole-brisee']
LARGEUR, HAUTEUR = 3200, 1800
# la bande du bas où le relevé se pose, et la luminance qu'elle ne doit pas
# dépasser (le relevé y écrit en clair)
BAS = 0.3
BAS_MAX = 0.06

if DANS_BLENDER:
    import bpy, bmesh
    from mathutils import Matrix, Vector
    _src = os.path.join(DOSSIER, 'ceremonie.py')
    exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

    # ------------------------------------------------------------ la scène
    def scene_fin(nom):
        """une scène neuve, à elle : l'essai précédent de CETTE scène est
        retiré, rien d'autre (la scène ouverte par le concepteur reste)"""
        sc = bpy.data.scenes.get(nom)
        if sc:
            for o in list(sc.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            for c in list(sc.collection.children_recursive):
                bpy.data.collections.remove(c)
            bpy.data.scenes.remove(sc)
        sc = bpy.data.scenes.new(nom)
        (bpy.context.window or bpy.context.window_manager.windows[0]).scene = sc
        r = sc.render
        try:
            r.engine = 'CYCLES'
        except TypeError as e:
            print('moteur :', e)
        sc.cycles.device = 'GPU'
        sc.cycles.use_denoising = False
        r.resolution_x, r.resolution_y = LARGEUR, HAUTEUR
        r.resolution_percentage = 100
        r.film_transparent = False
        r.image_settings.file_format = 'PNG'
        r.image_settings.color_mode = 'RGB'
        # STANDARD, comme l'atelier : la palette est donnée en sRGB
        sc.view_settings.view_transform = 'Standard'
        sc.view_settings.look = 'None'
        return sc

    def lie(sc, at, mats, prefixe, biseau=None, lisse=True):
        C = bpy.data.collections.new(prefixe)
        sc.collection.children.link(C)
        at.objets(C, mats, biseau or {'acier': 0.004, 'sombre': 0.003, 'clair': 0.0025}, lisse=lisse, prefixe=prefixe)
        return C

    def camera(sc, pos, cible, focale, decalage_y=0.0):
        cam = bpy.data.cameras.new('fin')
        cam.lens = focale
        cam.shift_y = decalage_y
        cam.clip_end = 2000
        co = bpy.data.objects.new('fin-camera', cam)
        co.location = pos
        co.rotation_euler = (Vector(cible) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        sc.collection.objects.link(co)
        sc.camera = co
        return co

    def lampe(sc, nom, type_, pos, cible, energie, couleur, **kw):
        l = bpy.data.lights.new(nom, type_)
        l.energy = energie
        l.color = couleur
        for k, v in kw.items():
            setattr(l, k, v)
        o = bpy.data.objects.new(nom, l)
        o.location = pos
        o.rotation_euler = (Vector(cible) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        sc.collection.objects.link(o)
        return o

    # ------------------------------------------------------------ les matières
    def ciel(sc, etoiles=True):
        """le noir de l'espace, et des étoiles PROCÉDURALES (un Voronoï : une
        cellule sur sept porte une étoile, d'éclat tiré) — vues seulement par
        la caméra : elles n'éclairent rien"""
        w = bpy.data.worlds.new(sc.name + '-ciel')
        try:
            w.use_nodes = True
        except AttributeError:
            pass
        nt = w.node_tree
        N, L = nt.nodes, nt.links
        N.clear()
        out = N.new('ShaderNodeOutputWorld')
        fond = N.new('ShaderNodeBackground')
        fond.inputs['Color'].default_value = lin((0x01, 0x02, 0x05))
        fond.inputs['Strength'].default_value = 1.0
        if etoiles:
            tc = N.new('ShaderNodeTexCoord')
            vo = N.new('ShaderNodeTexVoronoi')
            vo.inputs['Scale'].default_value = 260.0
            L.new(tc.outputs['Generated'], vo.inputs['Vector'])
            sep = N.new('ShaderNodeSeparateColor')
            L.new(vo.outputs['Color'], sep.inputs[0])
            tirage = op(nt, 'GREATER_THAN', sep.outputs[0], 0.86)
            point = rampe(nt, vo.outputs['Distance'], 0.05, 0.0)
            eclat = op(nt, 'MULTIPLY', op(nt, 'MULTIPLY', tirage, point), op(nt, 'MULTIPLY_ADD', sep.outputs[1], 2.5, 0.3))
            col = melange(nt, eclat, lin((0x01, 0x02, 0x05)), lin((0xd8, 0xe6, 0xff)))
            L.new(col, fond.inputs['Color'])
        noir = N.new('ShaderNodeBackground')
        noir.inputs['Color'].default_value = (0, 0, 0, 1)
        lp = N.new('ShaderNodeLightPath')
        mix = N.new('ShaderNodeMixShader')
        L.new(lp.outputs['Is Camera Ray'], mix.inputs[0])
        L.new(noir.outputs[0], mix.inputs[1])
        L.new(fond.outputs[0], mix.inputs[2])
        L.new(mix.outputs[0], out.inputs[0])
        sc.world = w

    def mat_lueur_fondue(nom, couleur, force, axe='Z', inverse=False):
        """une lueur qui s'efface le long d'un axe (la poussée d'un moteur, le
        halo d'un anneau) : émission mêlée de transparence"""
        mat = bpy.data.materials.new(nom)
        nt, N, L = noeuds(mat)
        out = N.new('ShaderNodeOutputMaterial')
        tc = N.new('ShaderNodeTexCoord')
        sep = N.new('ShaderNodeSeparateXYZ')
        L.new(tc.outputs['Generated'], sep.inputs[0])
        t = sep.outputs[axe]
        if inverse:
            t = op(nt, 'SUBTRACT', 1.0, t)
        em = N.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = lin(couleur)
        # et elle s'efface vers le bord du cône (vu de biais, le cône de
        # lumière n'a pas d'arête : quatre cônes francs se lisaient en
        # prismes de verre, deuxième essai)
        lw = N.new('ShaderNodeLayerWeight')
        lw.inputs['Blend'].default_value = 0.5
        coeur = op(nt, 'POWER', op(nt, 'SUBTRACT', 1.0, lw.outputs['Facing']), 2.5)
        L.new(op(nt, 'MULTIPLY', op(nt, 'MULTIPLY', op(nt, 'POWER', t, 2.2), coeur), force), em.inputs['Strength'])
        # une lueur ADDITIVE : transparente partout, elle ajoute sa lumière à
        # ce qu'il y a derrière (mêlée de transparence, premier essai, elle
        # faisait un trapèze opaque)
        tr = N.new('ShaderNodeBsdfTransparent')
        add = N.new('ShaderNodeAddShader')
        L.new(tr.outputs[0], add.inputs[0])
        L.new(em.outputs[0], add.inputs[1])
        L.new(add.outputs[0], out.inputs[0])
        return mat

    # d'où la planète est éclairée (vers le soleil) : en haut à gauche et un
    # peu DERRIÈRE elle — le croissant du canon (§26), la nuit à droite
    SOLEIL_PLANETE = (-0.72, 0.18, 0.62)

    def mat_planete():
        """la géante gazeuse du canon : des bandes froides, horizontales, que
        des remous déforment — bleu nuit, gris-bleu, un trait pâle. Son jour
        est CALCULÉ (le produit de la normale et de SOLEIL_PLANETE) : éclairée
        par le soleil de la scène, qui vient de face pour sculpter la capsule,
        elle sortait pleine lune, sans croissant (premier essai)"""
        mat = bpy.data.materials.new('fin-planete')
        nt, N, L = noeuds(mat)
        out = N.new('ShaderNodeOutputMaterial')
        b = N.new('ShaderNodeEmission')
        L.new(b.outputs[0], out.inputs[0])
        geo = N.new('ShaderNodeNewGeometry')
        dot = N.new('ShaderNodeVectorMath')
        dot.operation = 'DOT_PRODUCT'
        L.new(geo.outputs['Normal'], dot.inputs[0])
        dot.inputs[1].default_value = Vector(SOLEIL_PLANETE).normalized()
        jour = rampe(nt, dot.outputs['Value'], -0.05, 0.6)
        L.new(op(nt, 'MULTIPLY', jour, 0.9), b.inputs['Strength'])
        tc = N.new('ShaderNodeTexCoord')
        sep = N.new('ShaderNodeSeparateXYZ')
        L.new(tc.outputs['Object'], sep.inputs[0])
        remous = N.new('ShaderNodeTexNoise')
        remous.inputs['Scale'].default_value = 3.0
        remous.inputs['Detail'].default_value = 6.0
        L.new(tc.outputs['Object'], remous.inputs['Vector'])
        z = op(nt, 'MULTIPLY_ADD', remous.outputs['Fac'], 0.09, sep.outputs['Z'])
        bandes = op(nt, 'SINE', op(nt, 'MULTIPLY', z, 23.0))
        bandes2 = op(nt, 'SINE', op(nt, 'MULTIPLY', z, 61.0))
        t = op(nt, 'MULTIPLY_ADD', bandes, 0.35, op(nt, 'MULTIPLY_ADD', bandes2, 0.15, 0.5))
        c = melange(nt, rampe(nt, t, 0.15, 0.85), lin((0x16, 0x26, 0x3a)), lin((0x5a, 0x70, 0x86)))
        c = melange(nt, op(nt, 'MULTIPLY', rampe(nt, bandes2, 0.85, 0.98), 0.5), c, lin((0x9c, 0xb0, 0xc0)))
        L.new(c, b.inputs['Color'])
        return mat

    def mat_atmosphere():
        """le liseré de l'atmosphère : un halo au bord de la planète (la
        couleur de la charte, 63b7e6), transparent de face"""
        mat = bpy.data.materials.new('fin-atmosphere')
        nt, N, L = noeuds(mat)
        out = N.new('ShaderNodeOutputMaterial')
        lw = N.new('ShaderNodeLayerWeight')
        lw.inputs['Blend'].default_value = 0.5
        geo = N.new('ShaderNodeNewGeometry')
        dot = N.new('ShaderNodeVectorMath')
        dot.operation = 'DOT_PRODUCT'
        L.new(geo.outputs['Normal'], dot.inputs[0])
        dot.inputs[1].default_value = Vector(SOLEIL_PLANETE).normalized()
        # le halo suit le jour : tout autour, il dessinait un cercle de néon
        bord = op(nt, 'MULTIPLY', op(nt, 'POWER', lw.outputs['Facing'], 5.0), rampe(nt, dot.outputs['Value'], -0.4, 0.3))
        em = N.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = lin((0x63, 0xb7, 0xe6))
        L.new(op(nt, 'MULTIPLY', bord, 1.4), em.inputs['Strength'])
        tr = N.new('ShaderNodeBsdfTransparent')
        mix = N.new('ShaderNodeMixShader')
        L.new(bord, mix.inputs[0])
        L.new(tr.outputs[0], mix.inputs[1])
        L.new(em.outputs[0], mix.inputs[2])
        L.new(mix.outputs[0], out.inputs[0])
        return mat

    def mat_anneau_planete():
        """l'anneau fin : des sillons clairs et sombres, à demi transparent"""
        mat = bpy.data.materials.new('fin-anneau')
        nt, N, L = noeuds(mat)
        out = N.new('ShaderNodeOutputMaterial')
        b = N.new('ShaderNodeBsdfPrincipled')
        b.inputs['Base Color'].default_value = lin((0x8a, 0x98, 0xa8))
        b.inputs['Roughness'].default_value = 0.9
        tc = N.new('ShaderNodeTexCoord')
        r = N.new('ShaderNodeVectorMath')
        r.operation = 'LENGTH'
        L.new(tc.outputs['Object'], r.inputs[0])
        sillons = op(nt, 'MULTIPLY_ADD', op(nt, 'SINE', op(nt, 'MULTIPLY', r.outputs['Value'], 90.0)), 0.25,
                     op(nt, 'MULTIPLY_ADD', op(nt, 'SINE', op(nt, 'MULTIPLY', r.outputs['Value'], 23.0)), 0.25, 0.45))
        tr = N.new('ShaderNodeBsdfTransparent')
        mix = N.new('ShaderNodeMixShader')
        L.new(sillons, mix.inputs[0])
        L.new(tr.outputs[0], mix.inputs[1])
        L.new(b.outputs[0], mix.inputs[2])
        L.new(mix.outputs[0], out.inputs[0])
        return mat

    def mat_solaire():
        """les panneaux solaires : des cellules bleu nuit, une grille plus
        claire — un reflet qui dit « verre »"""
        mat = bpy.data.materials.new('fin-solaire')
        nt, N, L = noeuds(mat)
        out = N.new('ShaderNodeOutputMaterial')
        b = N.new('ShaderNodeBsdfPrincipled')
        L.new(b.outputs[0], out.inputs[0])
        tc = N.new('ShaderNodeTexCoord')
        sep = N.new('ShaderNodeSeparateXYZ')
        L.new(tc.outputs['Object'], sep.inputs[0])
        gx = op(nt, 'GREATER_THAN', op(nt, 'FRACT', op(nt, 'MULTIPLY', sep.outputs['X'], 4.0)), 0.93)
        gz = op(nt, 'GREATER_THAN', op(nt, 'FRACT', op(nt, 'MULTIPLY', sep.outputs['Z'], 4.0)), 0.93)
        grille = op(nt, 'MAXIMUM', gx, gz)
        L.new(melange(nt, grille, lin((0x0c, 0x18, 0x30)), lin((0x50, 0x5c, 0x68))), b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = 0.25
        b.inputs['Metallic'].default_value = 0.4
        return mat

    def mat_verre_vrai():
        """du verre qui réfracte (la scène a un sol à réfracter, l'atelier
        n'avait que du noir)"""
        mat = bpy.data.materials.new('fin-verre')
        nt, N, L = noeuds(mat)
        out = N.new('ShaderNodeOutputMaterial')
        b = N.new('ShaderNodeBsdfPrincipled')
        L.new(b.outputs[0], out.inputs[0])
        b.inputs['Base Color'].default_value = lin((0xd8, 0xea, 0xf0))
        b.inputs['Roughness'].default_value = 0.03
        for nom in ('Transmission Weight', 'Transmission'):
            if nom in b.inputs:
                b.inputs[nom].default_value = 1.0
                break
        b.inputs['IOR'].default_value = 1.45
        return mat

    # ------------------------------------------------------------ la station
    def module_octo(at, mat, c, L, R, axe, var=0.0, hublots=0):
        """un module octogonal (la forme du plan de la station) : un fût à huit
        pans, ses deux bouts chanfreinés, deux cerclages, des hublots qui
        veillent"""
        M = T(*c) @ axe
        at.tour(mat, [(0, -L / 2), (R * 0.72, -L / 2), (R, -L / 2 + R * 0.25), (R, L / 2 - R * 0.25), (R * 0.72, L / 2), (0, L / 2)],
                M=M, seg=8, phase=0.5, var=var)
        for z in (-L / 2 + R * 0.4, L / 2 - R * 0.4):
            at.tour('sombre', [(R * 0.98, z - 0.06), (R * 1.04, z - 0.06), (R * 1.04, z + 0.06), (R * 0.98, z + 0.06)], M=M, seg=8, phase=0.5, ferme=True)
        for k in range(hublots):
            z = -L / 2 + R * 0.7 + (L - R * 1.4) * (k + 0.5) / hublots
            p = M @ Vector((0, -R * math.cos(math.pi / 8) - 0.01, z))
            d = (M.to_3x3() @ Vector((0, 0, 1))).normalized()
            at.tube('veille', tuple(p - d * 0.09), tuple(p + d * 0.09), 0.07, seg=12)

    def treillis(at, a, b, cote=0.3):
        """une poutre en treillis de a à b : quatre longerons, des montants
        et des diagonales"""
        a, b = Vector(a), Vector(b)
        d = (b - a)
        n = max(2, int(d.length / cote))
        u = d.normalized()
        v = u.cross(Vector((0, 0, 1)) if abs(u.z) < 0.9 else Vector((1, 0, 0))).normalized()
        w = u.cross(v).normalized()
        coins = [v * cote / 2 + w * cote / 2, -v * cote / 2 + w * cote / 2, -v * cote / 2 - w * cote / 2, v * cote / 2 - w * cote / 2]
        for c in coins:
            at.tube('acier', tuple(a + c), tuple(b + c), 0.025, seg=8)
        for k in range(n + 1):
            p = a + d * k / n
            for i in range(4):
                at.tube('sombre', tuple(p + coins[i]), tuple(p + coins[(i + 1) % 4]), 0.015, seg=6)
            if k < n:
                q = a + d * (k + 1) / n
                at.tube('sombre', tuple(p + coins[0]), tuple(q + coins[2]), 0.012, seg=6)

    def aile(at, centre, l, h, rot):
        """une aile solaire : un panneau sur son mât, un cadre"""
        M = T(*centre) @ rot
        at.prisme('solaire', chanfrein(-l / 2, l / 2, -h / 2, h / 2, (0,) * 4), -0.02, 0.02, M=M)
        at.tube('clair', tuple(M @ Vector((-l / 2, 0, 0))), tuple(M @ Vector((l / 2, 0, 0))), 0.04, seg=8)

    def station(at):
        """la station du canon (assets-ia §26), de gauche à droite : l'arc de
        coque portant le module Méduse, trois modules octogonaux empilés au
        bout de leurs coursives, un nœud rond, de petits modules, le grand
        observatoire octogonal à dôme vitré, puis le mât incliné aux quatre
        panneaux et à la parabole"""
        X = RY(90)          # un fût couché le long de x
        # l'arc de coque, en croissant, et le module Méduse (le hub, haut et étroit)
        # (un arc fin, premier essai, se lisait en tuyau : un croissant épais,
        # à huit pans, qui porte le hub)
        at.tore('acier', 2.9, 0.75, T(-7.3, 0, 0.3) @ RX(90), seg=48, segr=8, a0=math.radians(115), a1=math.radians(245), var=0.2)
        module_octo(at, 'acier', (-10.0, 0, 0.3), 4.6, 0.9, Matrix.Identity(4), var=-0.2, hublots=4)
        at.tour('voyant', [(0, -0.06), (0.45, -0.06), (0.45, 0.06), (0, 0.06)], M=T(-10.0, -0.85, 2.2) @ FACE, seg=24)
        # trois coursives vers trois modules octogonaux empilés
        for k, z in enumerate((2.0, 0.3, -1.4)):
            at.tube('sombre', (-7.0, 0, z), (-4.9, 0, z), 0.22, seg=12)
            module_octo(at, 'acier', (-3.2, 0, z), 3.2, 0.72, X, var=0.3 - 0.3 * k, hublots=3)
        # le nœud rond, et ses petits modules, dont deux s'allongent en capsules
        at.tube('sombre', (-1.6, 0, 0.3), (0.3, 0, 0.3), 0.26, seg=12)
        at.sphere('acier', (1.2, 0, 0.3), 1.0, var=0.1)
        for (c, axe, L, R) in (((1.2, 0, 2.3), Matrix.Identity(4), 2.2, 0.5), ((1.2, 0, -1.6), Matrix.Identity(4), 2.0, 0.5),
                               ((1.2, 0, 3.9), Matrix.Identity(4), 1.1, 0.34), ((1.2, 0, -3.1), Matrix.Identity(4), 1.0, 0.34)):
            module_octo(at, 'acier', c, L, R, axe, var=0.2, hublots=1)
        # le grand observatoire octogonal, son dôme vitré, le télescope amarré
        at.tube('sombre', (2.2, 0, 0.3), (3.4, 0, 0.3), 0.26, seg=12)
        module_octo(at, 'acier', (5.2, 0, 0.3), 3.6, 1.45, X, var=-0.1, hublots=0)
        at.sphere('dome', (5.2, 0, 1.55), 1.0)
        at.tour('sombre', [(0.9, -0.1), (1.12, -0.1), (1.12, 0.1), (0.9, 0.1)], M=T(5.2, 0, 1.45), seg=8, phase=0.5, ferme=True)
        at.tube('acier', (6.3, -0.4, -1.0), (7.7, -0.4, -2.2), 0.28, seg=16)
        at.tour('voyant', [(0, -0.02), (0.24, -0.02), (0.24, 0.02), (0, 0.02)], M=T(7.75, -0.4, -2.25) @ Matrix.Rotation(math.radians(40), 4, 'Y') @ RX(180), seg=16)
        # le mât incliné, ses quatre panneaux, la parabole
        at.tube('sombre', (7.0, 0, 0.3), (8.2, 0, 0.3), 0.2, seg=12)
        base, sommet = Vector((8.6, 0, -1.6)), Vector((11.2, 0, 4.8))
        treillis(at, base, sommet, 0.36)
        dmat = (sommet - base).normalized()
        for k, t in enumerate((0.22, 0.42, 0.62, 0.82)):
            p = base + (sommet - base) * t
            for s_ in (-1, 1):
                aile(at, tuple(p + Vector((s_ * 2.0, -0.2, 0))), 3.2, 1.0, RZ(s_ * 12) @ RX(18))
        M = T(*(sommet + Vector((0.2, -0.3, 0.4)))) @ RY(-30) @ RX(-60)
        at.tour('clair', [(0, -0.05), (0.7, 0.12), (0.75, 0.18), (0.68, 0.17), (0, 0.0)], M=M, seg=40)
        at.tube('sombre', tuple(M @ Vector((0, 0, 0))), tuple(M @ Vector((0, 0, 0.55))), 0.03, seg=8)

    # ------------------------------------------------------------ la capsule
    def capsule(D, V, S):
        """LA BONBONNE SCELLÉE, montée en capsule : la bonbonne de la
        cérémonie (cuve_bonbonne), dans un berceau de deux cerclages et quatre
        rails, un sceau octogonal sur le robinet, quatre tuyères et leur
        poussée, deux veilleuses"""
        cuve_bonbonne(D, V, S)
        for z in (-0.33, 0.2):
            V.tore('clair', 0.262, 0.016, T(0, 0, z), segr=10)
        for k in range(4):
            a = math.radians(45 + 90 * k)
            x, y = 0.262 * math.cos(a), 0.262 * math.sin(a)
            V.tube('acier', (x, y, -0.52), (x, y, 0.36), 0.014, seg=10)
        # le sceau : un chapeau octogonal sur le robinet, cerclé de cyan
        V.tour('acier', [(0, 0.39), (0.11, 0.39), (0.125, 0.41), (0.125, 0.5), (0.1, 0.53), (0, 0.535)], seg=8, phase=0.5, var=0.2)
        V.tore('cyan', 0.127, 0.009, T(0, 0, 0.45), seg=8, segr=8)
        V.tour('acier', [(0, -0.52), (0.24, -0.52), (0.24, -0.47), (0, -0.47)], seg=8, phase=0.5)
        for k in range(4):
            a = math.radians(90 * k)
            x, y = 0.13 * math.cos(a), 0.13 * math.sin(a)
            V.tube('sombre', (x, y, -0.52), (x, y, -0.6), 0.04, seg=16, r2=0.06)
            V.tube('poussee', (x, y, -0.6), (x * 1.2, y * 1.2, -1.3), 0.05, seg=24, r2=0.1)
        for k in (0, 2):
            a = math.radians(45 + 90 * k)
            V.sphere('veilleuse', (0.262 * math.cos(a), 0.262 * math.sin(a), 0.37), 0.018)

    def fin_capsule():
        sc = scene_fin('fin-capsule')
        ciel(sc)
        mats = matieres_cuves()
        mats['interieur'] = mats['eau']   # la jauge pleine : la bonbonne est livrée
        mats['dome'] = mat_verre_vrai()
        mats['solaire'] = mat_solaire()
        mats['planete'] = mat_planete()
        mats['atmosphere'] = mat_atmosphere()
        mats['anneau-planete'] = mat_anneau_planete()
        # (à 6, premier essai, un trapèze blanc opaque ; la poussée d'un
        # moteur froid se devine plus qu'elle ne brûle)
        mats['poussee'] = mat_lueur_fondue('fin-poussee', (0x7c, 0xd8, 0xff), 2.4, axe='Z')
        # la veilleuse de la capsule : l'ambre, réservé à ce qui luit
        mats['veilleuse'] = mat_simple('fin-veilleuse', (0x6a, 0x3c, 0x0e), rug=0.2, emission=(0xff, 0xb0, 0x40), force=6.0)
        # la station
        S_ = Atelier()
        station(S_)
        # loin derrière, à droite, en entier, devant la nuit de la planète
        # (premier essai à 26 m : la station semblait posée sur la capsule)
        poser([S_], T(8.0, 46.0, 8.5) @ RZ(-8) @ Matrix.Diagonal((1.25, 1.25, 1.25, 1)))
        lie(sc, S_, mats, 'station')
        # la planète, loin derrière, et son anneau presque de profil
        P = Atelier()
        P.sphere('planete', (0, 0, 0), 60.0, u=128, v=64)
        P.sphere('atmosphere', (0, 0, 0), 61.2, u=128, v=64)
        P.tour('anneau-planete', [(78, -0.05), (96, -0.05), (96, 0.05), (78, 0.05)], seg=192, ferme=True)
        poser([P], T(70, 300, 80) @ RX(8) @ RY(-14))
        lie(sc, P, mats, 'planete', lisse=True)
        # la capsule : elle part, en haut à gauche, sa poussée vers la station
        D, V, Sd = Atelier(), Atelier(), Atelier()
        capsule(D, V, Sd)
        poser([D, V], T(-2.2, -4.5, 2.2) @ RX(16) @ RY(-36) @ Matrix.Diagonal((1.75, 1.75, 1.75, 1)))
        lie(sc, D, mats, 'capsule-dos')
        lie(sc, V, mats, 'capsule')
        # la lumière : le soleil, froid, d'en haut à gauche (le croissant de la
        # planète est éclairé de là), et le reflet bleuté de la planète
        lampe(sc, 'soleil', 'SUN', (-10, -10, 10), (0, 0, 0), 3.2, (0.92, 0.96, 1.0), angle=math.radians(0.6))
        lampe(sc, 'planete', 'SUN', (10, 20, 8), (0, 0, 0), 0.25, (0.45, 0.65, 0.9), angle=math.radians(20))
        camera(sc, (0.0, -14.0, 0.2), (0.0, 0.0, 2.6), 38, decalage_y=0.02)
        return sc

    # ------------------------------------------------------------ la fiole brisée
    def fiole_morceau(at, mat, z0s, z1s, M, r_ext=0.11, r_int=0.104, seg=12):
        """un morceau de fiole : la paroi de verre en tranches, chaque tranche
        avec sa hauteur — un bord cassé en dents. z0s, z1s : le bas et le haut
        de chaque tranche"""
        n = len(z0s)
        for k in range(n):
            a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
            prof = [(r_int, z0s[k]), (r_ext, z0s[k]), (r_ext, z1s[k]), (r_int, z1s[k])]
            at.secteur(mat, prof, a0, a1, M=M, seg=3)

    def fin_fiole():
        sc = scene_fin('fin-fiole-brisee')
        ciel(sc, etoiles=False)
        mats = matieres_ceremonie()
        mats['verre-vrai'] = mat_verre_vrai()
        mats['sol'] = mat_brosse('fin-sol', (0x12, 0x18, 0x1c), (0x28, 0x32, 0x3a), 101, brosse=0.08)
        mats['fond'] = mat_simple('fin-fond', (0x02, 0x03, 0x04), rug=0.9)
        # le fluide qui s'éteint : le sarcelle de la cérémonie, à peine lumineux
        # (à 0,22 de lueur, la flaque sortait en aplat de peinture : un film
        # sombre et miroitant, qui ne garde qu'un souffle de sarcelle)
        mats['flaque'] = mat_simple('fin-flaque', (0x03, 0x14, 0x16), rug=0.04, emission=(0x2a, 0x9a, 0x94), force=0.04)
        rng = random.Random(21)
        # le sol : un caillebotis de plaques rivetées (un mur de l'atelier, couché)
        A = Atelier()
        pas = 0.6
        for i in range(-6, 7):
            for j in range(-4, 9):
                x0, z0 = i * pas, j * pas
                var = rng.uniform(-1, 1)
                A.boite('sol', x0 + 0.006, x0 + pas - 0.006, z0 + 0.006, z0 + pas - 0.006, -0.02, 0.0, var)
                for (dx, dz) in ((0.04, 0.04), (pas - 0.04, 0.04), (pas - 0.04, pas - 0.04), (0.04, pas - 0.04)):
                    A.dome('sol', x0 + dx, z0 + dz, 0.012, -0.02, var)
        A.boite('fond', -4.0, 4.0, -2.6, 5.4, -0.002, 0.02)
        # une grille d'évent, au fond : le noir où le fluide s'en va
        for k in range(8):
            A.boite('fond', 0.6 + 0.07 * k, 0.635 + 0.07 * k, 1.8, 2.3, -0.021, 0.0)
        poser([A], RX(-90))
        lie(sc, A, mats, 'sol', biseau={'sol': 0.004})
        # la fiole : le fond, couché, au bord cassé ; le col et son bouchon, plus loin
        F = Atelier()
        # (le dessus du caillebotis est à 0,02 : premier essai, la flaque et
        # les éclats, posés à 0, passaient dessous)
        SOL = 0.02
        M_fond = T(0.0, 0.0, SOL + 0.112) @ RZ(18) @ RY(90)
        n = 14
        hauts = [rng.uniform(-0.02, 0.09) for _ in range(n)]
        fiole_morceau(F, 'verre-vrai', [-0.24] * n, hauts, M_fond)
        F.tour('verre-vrai', [(0, -0.3), (0.06, -0.29), (0.1, -0.265), (0.11, -0.24), (0.104, -0.24), (0.095, -0.26), (0.055, -0.282), (0, -0.29)], M=M_fond, ferme=True, seg=24)
        # ce qui reste dedans : un fond de fluide, au creux du verre couché
        # (plein, premier essai, la fiole se lisait en gélule de sarcelle)
        F.secteur('flaque', [(0.06, -0.235), (0.098, -0.235), (0.098, -0.04), (0.06, -0.04)], -0.55, 0.55, M=M_fond, seg=8)
        M_col = T(0.62, 0.42, SOL + 0.078) @ RZ(-50) @ RY(96)
        fiole_morceau(F, 'verre-vrai', [rng.uniform(0.1, 0.17) for _ in range(n)], [0.24] * n, M_col, r_ext=0.06, r_int=0.055)
        F.tour('acier', [(0, 0.23), (0.072, 0.23), (0.078, 0.25), (0.078, 0.31), (0.06, 0.325), (0, 0.33)], M=M_col, var=0.2)
        F.tore('cyan', 0.079, 0.006, M_col @ T(0, 0, 0.28), segr=6)
        # les éclats
        for k in range(16):
            r = rng.uniform(0.18, 0.75)
            a = rng.uniform(-0.3, math.pi + 0.3)
            x, y = r * math.cos(a) + 0.15, r * math.sin(a) * 0.8 + 0.1
            e = rng.uniform(0.02, 0.06)
            pts = [(rng.uniform(-e, e), rng.uniform(-e, e)) for _ in range(3)]
            F.prisme('verre-vrai', pts, -0.002, 0.002, M=T(x, y, SOL + 0.004) @ RZ(rng.uniform(0, 180)) @ RX(90 + rng.uniform(-12, 12)))
        # la flaque : elle s'étale du goulot vers l'évent, et s'éteint
        bord = []
        for k in range(40):
            t = 2 * math.pi * k / 40
            r = 0.2 * (1 + 0.25 * math.sin(3 * t + 1) + 0.12 * math.sin(7 * t))
            bord.append((0.36 + r * math.cos(t) * 1.3, 0.1 + r * math.sin(t) * 0.75))
        F.prisme('flaque', bord, -SOL - 0.003, -SOL + 0.0005, M=RX(-90))
        lie(sc, F, mats, 'fiole', biseau={})
        # UNE lumière froide, d'en haut, serrée sur la fiole ; un liseré bleu
        # derrière pour détacher le verre du noir
        lampe(sc, 'plafonnier', 'SPOT', (0.2, 0.9, 3.6), (0.2, 0.25, 0.0), 220.0, (0.82, 0.9, 1.0),
              spot_size=math.radians(20), spot_blend=0.75, shadow_soft_size=0.25)
        # (le contre-jour, plus large et plus fort au premier essai, se
        # mirait sur le caillebotis jusqu'au bas du cadre : 0,08 de luminance)
        lampe(sc, 'contre', 'SPOT', (0.0, 3.5, 1.6), (0.15, 0.1, 0.12), 45.0, (0.45, 0.65, 0.95),
              spot_size=math.radians(15), spot_blend=0.8, shadow_soft_size=0.4)
        camera(sc, (-0.5, -2.6, 0.95), (0.3, 0.2, 0.05), 62, decalage_y=-0.14)
        # pas de caustiques : le verre éclaté semait des étincelles parasites
        # sur tout le caillebotis (premier essai)
        sc.cycles.caustics_reflective = False
        sc.cycles.caustics_refractive = False
        sc.cycles.blur_glossy = 1.0
        return sc

    BATIS_FINS = {'fin-capsule': fin_capsule, 'fin-fiole-brisee': fin_fiole}
    # LA FIOLE se rend à la taille livrée, débruitée : le verre éclaté sur un
    # caillebotis brillant demande des milliers d'échantillons sans
    # débruiteur (mesuré : 77 s pour un aperçu de 800×450 à 64 échantillons,
    # encore grêlé) — l'atelier s'en passe pour garder le grain de l'acier,
    # mais une scène dans le noir n'a pas ce grain à perdre
    REGLAGES = {'fin-fiole-brisee': {'pourcent': 50, 'echantillons': 192, 'debruite': True}}

    def lance_fins(sortie, echantillons=384, pourcent=100, noms=SCENES):
        """bâtit et rend les scènes une à une, par un minuteur (un rendu long
        coupait la liaison avec l'appelant, chaud_biome.py) ; écrit
        <sortie>/<nom>.png, puis fini-fins.txt"""
        import time
        file = list(noms)
        fini = os.path.join(sortie, 'fini-fins.txt')
        if os.path.exists(fini):
            os.remove(fini)
        journal = []

        def pas():
            if not file:
                open(fini, 'w').write(json.dumps(journal))
                return None
            nom = file.pop(0)
            t = time.time()
            try:
                sc = BATIS_FINS[nom]()
                r = REGLAGES.get(nom, {}) if pourcent == 100 else {}
                sc.cycles.samples = r.get('echantillons', echantillons)
                sc.render.resolution_percentage = r.get('pourcent', pourcent)
                sc.cycles.use_denoising = r.get('debruite', False)
                sc.render.filepath = os.path.join(sortie, nom + '.png')
                bpy.ops.render.render(write_still=True, scene=sc.name)
                journal.append({'nom': nom, 'secondes': round(time.time() - t, 1)})
            except Exception as e:
                import traceback
                journal.append({'nom': nom, 'erreur': repr(e), 'trace': traceback.format_exc()[-800:]})
            return 0.2
        bpy.app.timers.register(pas, first_interval=0.5)


# -------------------------------------------------- la mesure, hors de Blender
def mesure(chemin):
    """la luminance de l'image entière (comme prepare.py : Rec. 709 des
    valeurs sRGB) et celle de la bande du BAS, où se pose le relevé"""
    import numpy as np
    from PIL import Image
    a = np.asarray(Image.open(chemin).convert('RGB'), dtype=np.float32) / 255.0
    y = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    h = y.shape[0]
    return {'image': os.path.basename(chemin), 'luminance': round(float(y.mean()), 3),
            'bas': round(float(y[int(h * (1 - BAS)):].mean()), 3)}


if __name__ == '__main__' and not DANS_BLENDER:
    mauvais = False
    for c in sys.argv[1:]:
        m = mesure(c)
        print(json.dumps(m, ensure_ascii=False))
        mauvais |= m['bas'] > BAS_MAX
    if mauvais:
        sys.exit(f'le bas du cadre dépasse {BAS_MAX} de luminance : le relevé ne s’y lirait pas')
