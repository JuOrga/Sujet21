r"""LE STADE DU HOCKEY DU MULTI (22/11) — l'arène autour de la patinoire.

Le concepteur : « il faudrait que ce soit dans un stade, genre Rocket League
mais mode science-fiction ; tu peux utiliser Blender ». Le jeu est vu de
DESSUS : le stade est donc rendu en UNE image orthographique, la caméra
au-dessus du centre de la piste, et le rendu du multi (src/multi/renduMulti.ts)
la pose sous le terrain — ses lignes, ses cages et ses poteaux restent
dessinés par le shader, par-dessus.

CE QU'ON Y VOIT, du bord de la piste vers le dehors :
  · la PISTE elle-même : des dalles sombres, leurs joints à peine lumineux ;
  · la RAMBARDE : un muret d'acier, un néon froid sur son arête intérieure ;
  · une COURSIVE étroite, ses plots lumineux ;
  · les GRADINS : dix rangées qui montent, une foule de sièges et de
    spectateurs (des taches de couleur), quelques écrans de téléphone qui
    brillent, des escaliers éclairés de loin en loin ;
  · la COURONNE : le haut de l'arène, une bande d'acier et un néon magenta ;
  · aux quatre coins, des PYLÔNES de projecteurs ;
  · au-delà, le VIDE : l'arène flotte dans l'espace, comme la station du jeu,
    avec ses poutres qui partent vers le noir et les étoiles.

LE CONTRAT avec le shader (renduMulti.ts, STADE) — à changer ensemble :
  · l'image couvre le rectangle du monde X ∈ [−560, 3440], Y ∈ [−640, 1860]
    (4 000 × 2 500 unités), y vers le BAS comme le jeu ;
  · la piste est celle de hockey.ts : TERRAIN 2 880 × 1 220, coins de 400.
Ici 1 unité Blender = 100 unités du jeu, et le y du jeu est le −y de Blender.

Hors de Blender, en module (bpy, Python 3.11) :
    python stade_hockey.py masters/images/multi/stade-hockey.png [largeur] [échantillons]
puis :
    python3 tools/images/prepare.py multi/stade-hockey
"""

import math
import random
import sys

import bpy
import bmesh

# ---- le contrat ---------------------------------------------------------------
# (les mêmes nombres que src/multi/hockey.ts et src/multi/renduMulti.ts)
LARGEUR, HAUTEUR = 28.8, 12.2  # la piste, en unités Blender
RAYON_COINS = 4.0
CENTRE = (LARGEUR / 2, -HAUTEUR / 2)
CADRE = (-5.6, 34.4, -18.6, 6.4)  # x min, x max, y min, y max (Blender : y vers le haut)

random.seed(21)


# ---- la forme de base : le rectangle aux coins ronds, décalé ----------------
def contour(decalage: float, pas: int = 18) -> list[tuple[float, float]]:
    """Le bord de la piste poussé de `decalage` vers le dehors : un rectangle
    aux coins ronds (le décalé d'un tel rectangle en est un autre)."""
    hx = LARGEUR / 2 + decalage
    hy = HAUTEUR / 2 + decalage
    r = RAYON_COINS + decalage
    cx, cy = CENTRE
    points = []
    for (sx, sy, a0) in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        ox = cx + sx * (hx - r)
        oy = cy + sy * (hy - r)
        for k in range(pas + 1):
            a = math.radians(a0 + 90 * k / pas)
            points.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return points


def longueur(points: list[tuple[float, float]]) -> float:
    return sum(math.dist(points[i], points[(i + 1) % len(points)]) for i in range(len(points)))


def le_long(points: list[tuple[float, float]], t: float) -> tuple[float, float, float]:
    """Le point à l'abscisse t (0..1) du contour, et la direction (radians)
    de la tangente."""
    total = longueur(points)
    cible = t * total
    for i in range(len(points)):
        a = points[i]
        b = points[(i + 1) % len(points)]
        l = math.dist(a, b)
        if cible <= l:
            f = cible / l if l > 0 else 0
            return a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, math.atan2(b[1] - a[1], b[0] - a[0])
        cible -= l
    a = points[0]
    return a[0], a[1], 0.0


# ---- les matières ----------------------------------------------------------------
def matiere(nom: str, couleur, metal=0.0, rugosite=0.5, emission=None, force=0.0):
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*couleur, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rugosite
    if emission is not None:
        p.inputs['Emission Color'].default_value = (*emission, 1)
        p.inputs['Emission Strength'].default_value = force
    return m


def matiere_dalles(nom: str, couleur, joint, echelle: float, force_joint: float, rugosite=0.35, metal=0.4):
    """Des dalles : une texture de briques sans décalage (une grille), dont
    le joint brille un peu."""
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    n = m.node_tree.nodes
    l = m.node_tree.links
    p = n['Principled BSDF']
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rugosite
    coord = n.new('ShaderNodeTexCoord')
    brique = n.new('ShaderNodeTexBrick')
    brique.offset = 0.0
    brique.squash = 1.0
    brique.inputs['Scale'].default_value = echelle
    brique.inputs['Mortar Size'].default_value = 0.012
    brique.inputs['Brick Width'].default_value = 1.0
    brique.inputs['Row Height'].default_value = 1.0
    brique.inputs['Color1'].default_value = (*couleur, 1)
    brique.inputs['Color2'].default_value = (*[c * 0.85 for c in couleur], 1)
    brique.inputs['Mortar'].default_value = (*joint, 1)
    l.new(coord.outputs['Object'], brique.inputs['Vector'])
    l.new(brique.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Emission Color'].default_value = (*joint, 1)
    l.new(brique.outputs['Fac'], p.inputs['Emission Strength'])
    # le Fac de la brique vaut 1 dans le joint : on le dose
    mult = n.new('ShaderNodeMath')
    mult.operation = 'MULTIPLY'
    mult.inputs[1].default_value = force_joint
    l.new(brique.outputs['Fac'], mult.inputs[0])
    l.new(mult.outputs[0], p.inputs['Emission Strength'])
    return m


def matiere_couleurs(nom: str, rugosite=0.7, attribut='teinte', emission_attribut='lueur'):
    """La couleur portée par le maillage (un attribut par sommet) : la foule,
    chaque siège la sienne, et sa lueur (les écrans de téléphone)."""
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    n = m.node_tree.nodes
    l = m.node_tree.links
    p = n['Principled BSDF']
    p.inputs['Roughness'].default_value = rugosite
    a = n.new('ShaderNodeAttribute')
    a.attribute_name = attribut
    l.new(a.outputs['Color'], p.inputs['Base Color'])
    e = n.new('ShaderNodeAttribute')
    e.attribute_name = emission_attribut
    l.new(e.outputs['Color'], p.inputs['Emission Color'])
    p.inputs['Emission Strength'].default_value = 2.5
    return m


# ---- les maillages ---------------------------------------------------------------
def anneau(nom: str, dedans: float, dehors: float, z0: float, z1: float, mat) -> bpy.types.Object:
    """Le volume entre deux contours décalés, de z0 à z1."""
    a = contour(dedans)
    b = contour(dehors)
    bm = bmesh.new()
    n = len(a)
    bas_a = [bm.verts.new((x, y, z0)) for x, y in a]
    bas_b = [bm.verts.new((x, y, z0)) for x, y in b]
    haut_a = [bm.verts.new((x, y, z1)) for x, y in a]
    haut_b = [bm.verts.new((x, y, z1)) for x, y in b]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((haut_a[i], haut_b[i], haut_b[j], haut_a[j]))  # le dessus
        if z1 > z0:
            bm.faces.new((bas_a[i], haut_a[i], haut_a[j], bas_a[j]))  # le flanc intérieur
            bm.faces.new((bas_b[j], haut_b[j], haut_b[i], bas_b[i]))  # le flanc extérieur
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    o.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(o)
    return o


def disque_plein(nom: str, decalage: float, z: float, mat) -> bpy.types.Object:
    """La surface pleine dans un contour (la piste)."""
    pts = contour(decalage)
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z)) for x, y in pts]
    bm.faces.new(vs)
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    o.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(o)
    return o


def boites(nom: str, poses, mat, couleurs=None, lueurs=None) -> bpy.types.Object:
    """Beaucoup de petites boîtes d'un coup (un seul maillage) : `poses` =
    (x, y, z, angle, largeur, profondeur, hauteur). Chacune peut porter une
    teinte et une lueur (attributs « teinte » et « lueur »)."""
    bm = bmesh.new()
    teinte = bm.loops.layers.float_color.new('teinte') if couleurs else None
    lueur = bm.loops.layers.float_color.new('lueur') if lueurs else None
    for k, (x, y, z, ang, lx, ly, lz) in enumerate(poses):
        c = math.cos(ang)
        s = math.sin(ang)
        coins = []
        for dz in (0, lz):
            for (u, v) in ((-lx / 2, -ly / 2), (lx / 2, -ly / 2), (lx / 2, ly / 2), (-lx / 2, ly / 2)):
                coins.append(bm.verts.new((x + u * c - v * s, y + u * s + v * c, z + dz)))
        faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        for f in faces:
            face = bm.faces.new([coins[i] for i in f])
            for loop in face.loops:
                if teinte:
                    loop[teinte] = (*couleurs[k], 1)
                if lueur:
                    loop[lueur] = (*lueurs[k], 1)
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    o.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(o)
    return o


# ---- la scène ------------------------------------------------------------------
def stade() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene

    # le monde : le noir de l'espace, à peine bleu
    monde = bpy.data.worlds.new('vide')
    monde.use_nodes = True
    monde.node_tree.nodes['Background'].inputs['Color'].default_value = (0.002, 0.003, 0.008, 1)
    monde.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    sc.world = monde

    # ---- le vide et ses étoiles, loin dessous
    etoiles = bpy.data.materials.new('etoiles')
    etoiles.use_nodes = True
    n = etoiles.node_tree.nodes
    l = etoiles.node_tree.links
    n.remove(n['Principled BSDF'])
    sortie = n['Material Output']
    em = n.new('ShaderNodeEmission')
    voro = n.new('ShaderNodeTexVoronoi')
    voro.feature = 'F1'
    voro.inputs['Scale'].default_value = 9.0
    pente = n.new('ShaderNodeValToRGB')
    pente.color_ramp.elements[0].position = 0.0
    pente.color_ramp.elements[0].color = (1, 1, 1, 1)
    pente.color_ramp.elements[1].position = 0.035
    pente.color_ramp.elements[1].color = (0, 0, 0, 1)
    nebuleuse = n.new('ShaderNodeTexNoise')
    nebuleuse.inputs['Scale'].default_value = 0.5
    nebuleuse.inputs['Detail'].default_value = 6
    teinte_neb = n.new('ShaderNodeValToRGB')
    teinte_neb.color_ramp.elements[0].position = 0.45
    teinte_neb.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1)
    teinte_neb.color_ramp.elements[1].position = 0.8
    teinte_neb.color_ramp.elements[1].color = (0.05, 0.02, 0.09, 1)
    somme = n.new('ShaderNodeMix')
    somme.data_type = 'RGBA'
    somme.blend_type = 'ADD'
    somme.inputs['Factor'].default_value = 1.0
    l.new(voro.outputs['Distance'], pente.inputs['Fac'])
    l.new(nebuleuse.outputs['Fac'], teinte_neb.inputs['Fac'])
    l.new(teinte_neb.outputs['Color'], somme.inputs[6])
    l.new(pente.outputs['Color'], somme.inputs[7])
    l.new(somme.outputs[2], em.inputs['Color'])
    em.inputs['Strength'].default_value = 1.2
    l.new(em.outputs['Emission'], sortie.inputs['Surface'])
    bpy.ops.mesh.primitive_plane_add(size=120, location=(CENTRE[0], CENTRE[1], -30))
    bpy.context.object.data.materials.append(etoiles)

    # ---- la piste : des dalles sombres, leurs joints à peine lumineux
    piste = matiere_dalles('piste', (0.008, 0.011, 0.018), (0.03, 0.09, 0.14), 1 / 1.2, 0.12, rugosite=0.25, metal=0.6)
    disque_plein('piste', 0.0, 0.0, piste)

    # ---- la rambarde : un muret d'acier et son néon intérieur
    acier = matiere('acier', (0.16, 0.18, 0.21), metal=0.85, rugosite=0.32)
    anneau('rambarde', 0.0, 0.32, 0.0, 0.55, acier)
    # (un néon trop fort vire au blanc : à 3, il garde sa couleur)
    neon_froid = matiere('neon-froid', (0.2, 0.6, 1.0), emission=(0.15, 0.65, 1.0), force=3.2)
    anneau('neon-rambarde', 0.03, 0.11, 0.551, 0.56, neon_froid)
    # le CHAMP DE FORCE : le long de la rambarde, côté coursive, trois
    # traits de lumière qui s'éteignent vers le dehors
    for k, (d, f) in enumerate(((0.36, 3.0), (0.47, 1.4), (0.58, 0.6))):
        champ = matiere(f'champ-{k}', (0.3, 0.7, 1.0), emission=(0.3, 0.75, 1.0), force=f)
        anneau(f'champ-{k}', d, d + 0.035, -0.19, -0.19, champ)

    # ---- la coursive : étroite, ses plots lumineux
    coursive = matiere_dalles('coursive', (0.03, 0.035, 0.045), (0.12, 0.14, 0.2), 1 / 0.6, 0.25, rugosite=0.5)
    anneau('coursive', 0.32, 0.95, -0.2, -0.2, coursive)
    plot = matiere('plot', (0.5, 0.8, 1.0), emission=(0.4, 0.8, 1.0), force=3.0)
    pts = contour(0.62)
    poses = []
    nb = int(longueur(pts) / 1.4)
    for k in range(nb):
        x, y, a = le_long(pts, k / nb)
        poses.append((x, y, -0.19, a, 0.12, 0.12, 0.02))
    boites('plots', poses, plot)

    # ---- les gradins : dix rangées qui montent, une foule
    marche = matiere('marche', (0.05, 0.055, 0.065), metal=0.3, rugosite=0.6)
    foule = matiere_couleurs('foule')
    escalier = matiere('escalier', (0.3, 0.5, 0.7), emission=(0.3, 0.6, 1.0), force=1.6)
    sieges = []
    teintes = []
    lueurs = []
    marches_escalier = []
    # des vêtements sombres, et des couleurs de toutes sortes : la foule ne
    # porte pas celles de deux camps — les joueurs choisissent les leurs
    PALETTE_FOULE = [
        (0.05, 0.05, 0.06), (0.08, 0.08, 0.09), (0.11, 0.1, 0.09), (0.06, 0.07, 0.1), (0.14, 0.13, 0.12),
        (0.04, 0.14, 0.32), (0.36, 0.16, 0.04), (0.06, 0.24, 0.14), (0.26, 0.08, 0.24), (0.3, 0.06, 0.06),
        (0.2, 0.2, 0.22), (0.05, 0.2, 0.26),
    ]
    RANGEES = 10
    ESCALIERS = 22
    for r in range(RANGEES):
        dedans = 1.05 + r * 0.4
        dehors = dedans + 0.4
        z = 0.2 + r * 0.28
        anneau(f'gradin-{r}', dedans, dehors, -0.2, z, marche)
        pts = contour(dedans + 0.22)
        total = longueur(pts)
        nb = int(total / 0.34)
        for k in range(nb):
            t = k / nb
            # les escaliers : aux MÊMES abscisses relatives d'une rangée à
            # l'autre (les contours décalés se parcourent ensemble), une
            # vingtaine autour de l'arène — pas de siège
            if (t * ESCALIERS) % 1.0 < 0.8 / total * ESCALIERS:
                x, y, a = le_long(pts, t)
                marches_escalier.append((x, y, z + 0.01, a + math.pi / 2, 0.36, 0.05, 0.02))
                continue
            x, y, a = le_long(pts, t)
            vide = random.random() < 0.12
            if vide:
                # un siège vide : on voit son dossier, sombre
                sieges.append((x, y, z, a, 0.26, 0.22, 0.12))
                teintes.append((0.06, 0.07, 0.09))
                lueurs.append((0, 0, 0))
                continue
            # un spectateur : une tache de couleur, un peu de travers
            dx = random.uniform(-0.04, 0.04)
            dy = random.uniform(-0.04, 0.04)
            sieges.append((x + dx, y + dy, z, a + random.uniform(-0.3, 0.3), 0.24, 0.2, random.uniform(0.25, 0.4)))
            c = random.choice(PALETTE_FOULE)
            v = random.uniform(0.7, 1.25)
            teintes.append(tuple(min(1, ch * v) for ch in c))
            # quelques écrans de téléphone allumés
            if random.random() < 0.028:
                lueurs.append(random.choice([(0.8, 0.9, 1.0), (0.6, 0.8, 1.0), (1.0, 0.95, 0.85)]))
            else:
                lueurs.append((0, 0, 0))
    boites('foule', sieges, foule, teintes, lueurs)
    boites('escaliers', marches_escalier, escalier)

    # ---- la couronne : le haut de l'arène, son néon magenta
    haut = 1.05 + RANGEES * 0.4
    anneau('couronne', haut, haut + 0.9, -0.2, 3.4, acier)
    neon_magenta = matiere('neon-magenta', (1.0, 0.1, 0.6), emission=(1.0, 0.06, 0.55), force=3.5)
    anneau('neon-couronne', haut + 0.08, haut + 0.3, 3.401, 3.41, neon_magenta)
    anneau('neon-couronne-2', haut + 0.68, haut + 0.76, 3.401, 3.41, neon_froid)

    # ---- deux ÉCRANS GÉANTS posés sur la couronne, au milieu des grands
    # côtés : des panneaux holographiques, leurs lignes de balayage
    ecran = bpy.data.materials.new('ecran')
    ecran.use_nodes = True
    n = ecran.node_tree.nodes
    l = ecran.node_tree.links
    p = n['Principled BSDF']
    p.inputs['Base Color'].default_value = (0.01, 0.02, 0.03, 1)
    vague = n.new('ShaderNodeTexWave')
    vague.wave_type = 'BANDS'
    vague.bands_direction = 'Y'
    vague.inputs['Scale'].default_value = 40.0
    vague.inputs['Distortion'].default_value = 0.0
    bruit = n.new('ShaderNodeTexNoise')
    bruit.inputs['Scale'].default_value = 3.0
    bruit.inputs['Detail'].default_value = 3.0
    mel = n.new('ShaderNodeMath')
    mel.operation = 'MULTIPLY'
    l.new(vague.outputs['Fac'], mel.inputs[0])
    l.new(bruit.outputs['Fac'], mel.inputs[1])
    rampe = n.new('ShaderNodeValToRGB')
    rampe.color_ramp.elements[0].position = 0.15
    rampe.color_ramp.elements[0].color = (0.0, 0.02, 0.05, 1)
    rampe.color_ramp.elements[1].position = 0.6
    rampe.color_ramp.elements[1].color = (0.1, 0.55, 0.9, 1)
    l.new(mel.outputs[0], rampe.inputs['Fac'])
    l.new(rampe.outputs['Color'], p.inputs['Emission Color'])
    p.inputs['Emission Strength'].default_value = 1.4
    for sy in (1, -1):
        y = CENTRE[1] + sy * (HAUTEUR / 2 + haut + 0.45)
        boites(f'ecran-{sy}', [(CENTRE[0], y, 3.42, 0.0, 7.0, 0.7, 0.05)], ecran)
        cadre_ecran = [(CENTRE[0], y, 3.41, 0.0, 7.4, 0.9, 0.04)]
        boites(f'cadre-ecran-{sy}', cadre_ecran, acier)

    # ---- les poutres : l'arène tient dans le vide par des bras d'acier
    poutre = matiere('poutre', (0.09, 0.1, 0.12), metal=0.9, rugosite=0.4)
    pts = contour(haut + 0.9)
    poses = []
    for k in range(28):
        x, y, a = le_long(pts, k / 28)
        normale = a - math.pi / 2  # le contour tourne en sens direct : le dehors est à droite
        long = 9.0
        poses.append((x + math.cos(normale) * long / 2, y + math.sin(normale) * long / 2, -1.5, normale, long, 0.35, 0.3))
    boites('poutres', poses, poutre)
    feux = matiere('feux', (1, 0.2, 0.2), emission=(1.0, 0.15, 0.1), force=8.0)
    poses = []
    for k in range(28):
        x, y, a = le_long(pts, k / 28)
        normale = a - math.pi / 2
        poses.append((x + math.cos(normale) * 8.6, y + math.sin(normale) * 8.6, -1.2, normale, 0.18, 0.18, 0.05))
    boites('feux-poutres', poses, feux)

    # ---- les pylônes de projecteurs, aux quatre coins
    for sx in (-1, 1):
        for sy in (-1, 1):
            # dans la diagonale du coin, au-delà de la couronne
            d = RAYON_COINS + haut + 2.0
            ox = CENTRE[0] + sx * (LARGEUR / 2 - RAYON_COINS) + sx * d * math.cos(math.radians(45))
            oy = CENTRE[1] + sy * (HAUTEUR / 2 - RAYON_COINS) + sy * d * math.sin(math.radians(45))
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.9, depth=6, location=(ox, oy, 0.5))
            bpy.context.object.data.materials.append(acier)
            bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.55, depth=0.1, location=(ox, oy, 3.55))
            bpy.context.object.data.materials.append(neon_froid)
            bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.38, depth=0.12, location=(ox, oy, 3.56))
            bpy.context.object.data.materials.append(acier)
            # le projecteur : il éclaire la piste, depuis haut
            lum = bpy.data.lights.new(f'projecteur-{sx}-{sy}', 'SPOT')
            lum.energy = 9000
            lum.spot_size = math.radians(70)
            lum.spot_blend = 0.6
            lum.color = (0.85, 0.92, 1.0)
            o = bpy.data.objects.new(lum.name, lum)
            o.location = (ox, oy, 14)
            # visé vers le centre de la piste
            dx = CENTRE[0] - ox
            dy = CENTRE[1] - oy
            dz = 0 - 14
            o.rotation_euler = (0, 0, 0)
            direction = (dx, dy, dz)
            from mathutils import Vector
            o.rotation_euler = Vector(direction).to_track_quat('-Z', 'Y').to_euler()
            sc.collection.objects.link(o)

    # une lumière douce d'ensemble, très haut (le toit de l'arène)
    lum = bpy.data.lights.new('voute', 'AREA')
    lum.energy = 1200
    lum.size = 30
    lum.color = (0.75, 0.82, 1.0)
    o = bpy.data.objects.new('voute', lum)
    o.location = (CENTRE[0], CENTRE[1], 40)
    sc.collection.objects.link(o)

    # ---- la caméra : orthographique, au-dessus du centre du cadre
    cam = bpy.data.cameras.new('camera')
    cam.type = 'ORTHO'
    cam.ortho_scale = CADRE[1] - CADRE[0]
    cam.clip_end = 200
    o = bpy.data.objects.new('camera', cam)
    o.location = ((CADRE[0] + CADRE[1]) / 2, (CADRE[2] + CADRE[3]) / 2, 60)
    sc.collection.objects.link(o)
    sc.camera = o


def rend(chemin: str, largeur: int = 2880, echantillons: int = 64) -> None:
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = echantillons
    sc.cycles.use_denoising = True
    sc.render.resolution_x = largeur
    sc.render.resolution_y = round(largeur * (CADRE[3] - CADRE[2]) / (CADRE[1] - CADRE[0]))
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'None'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.filepath = chemin
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    sortie = sys.argv[1]
    largeur = int(sys.argv[2]) if len(sys.argv) > 2 else 2880
    echantillons = int(sys.argv[3]) if len(sys.argv) > 3 else 64
    stade()
    rend(sortie, largeur, echantillons)
