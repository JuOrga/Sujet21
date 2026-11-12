"""LA VANNE, refaite dans Blender (13/11) — decal-vanne.webp et sa planche
de vues decal-vanne-anime.webp (charte §8 : le volant tourne).

L'ancienne sortait d'un générateur d'images : fond blanc, conduite coupée par
le cadre en haut et en bas (prepare.py --audit : « bord plein à 11 % »), et
aucune vue d'une autre position du volant. Ici une scène : la pièce entière
dans le cadre, sur fond transparent, et le même modèle donne les vues.

LA BOUCLE SANS ACCROC. Le volant a CINQ rayons et cinq poignées : tourné de
72°, il est identique à lui-même — la planche couvre ces 72° en VUES vues
(12 par seconde au moteur, render/planche.ts). La rouille du volant est prise
en coordonnées polaires repliées tous les 72° (nœud PINGPONG) : sinon, au
bout du tour, la rouille aurait tourné et la boucle sauterait.

Repère : la conduite le long de z, la face vers -y, la caméra regarde +y.
Le cadre fait 1 de large sur 1,5 de haut (1024 × 1536 px).

Dans Blender :
    DOSSIER = r'\\\\wsl.localhost\\Ubuntu\\home\\...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\vanne.py', encoding='utf-8').read())
    scene() ; lance(SORTIE)          # les VUES vues par minuteur ; la 0 est la fixe
"""
import bpy, bmesh, math, os, json, time
from mathutils import Matrix, Vector

LARGEUR, HAUTEUR = 1024, 1536
VUES = 8
SYMETRIE = 5                      # rayons du volant : la période est 360/5
ECHANTILLONS = 256

# la palette : l'acier sombre des conduites (charte §3), la rouille, le
# sarcelle des repères peints de l'ancienne vanne
ACIER = (0x3c, 0x44, 0x4e)
ACIER_CLAIR = (0x72, 0x7c, 0x86)
ROUILLE = (0x6a, 0x3b, 0x22)
SARCELLE = (0x1f, 0x72, 0x6c)


def lin(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


def vide_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for d in list(coll):
            coll.remove(d)


# ------------------------------------------------------------ les matières
def op(nt, o, a, b=None):
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = o
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def bruit(nt, vec, echelle, detail=6.0, rugo=0.6, graine=0.0):
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.noise_dimensions = '4D'
    n.inputs['Scale'].default_value = echelle
    n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rugo
    n.inputs['W'].default_value = graine
    nt.links.new(vec, n.inputs['Vector'])
    return n.outputs['Fac']


def rampe(nt, fac, a, b):
    r = nt.nodes.new('ShaderNodeMapRange')
    r.inputs['From Min'].default_value = a
    r.inputs['From Max'].default_value = b
    nt.links.new(fac, r.inputs['Value'])
    return r.outputs['Result']


def melange(nt, fac, c1, c2):
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'RGBA'
    nt.links.new(fac, m.inputs['Factor'])
    for k, c in ((6, c1), (7, c2)):
        if isinstance(c, tuple):
            m.inputs[k].default_value = c
        else:
            nt.links.new(c, m.inputs[k])
    return m.outputs[2]


def coord_polaires(nt):
    """les coordonnées de l'objet, l'angle autour de y replié tous les
    360/SYMETRIE degrés (en miroir : pas de couture sur la ligne du pli)"""
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    x, y, z = sep.outputs[0], sep.outputs[1], sep.outputs[2]
    a = op(nt, 'ARCTAN2', z, x)
    a = op(nt, 'PINGPONG', op(nt, 'ADD', a, 4 * math.pi), math.pi / SYMETRIE)
    r = op(nt, 'SQRT', op(nt, 'ADD', op(nt, 'MULTIPLY', x, x), op(nt, 'MULTIPLY', z, z)))
    c = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(op(nt, 'MULTIPLY', r, op(nt, 'COSINE', a)), c.inputs[0])
    nt.links.new(y, c.inputs[1])
    nt.links.new(op(nt, 'MULTIPLY', r, op(nt, 'SINE', a)), c.inputs[2])
    return c.outputs[0]


def mat_metal(nom, peinture=None, polaire=False, graine=0.0):
    """l'acier sombre, piqué de rouille ; `peinture` : une couleur posée
    dessus, écaillée là où le grain fin passe sous un seuil"""
    mat = bpy.data.materials.new(nom)
    mat.use_nodes = True
    nt = mat.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    vec = coord_polaires(nt) if polaire else nt.nodes.new('ShaderNodeTexCoord').outputs['Object']
    grand = bruit(nt, vec, 3.0, 4, 0.5, graine)
    fin = bruit(nt, vec, 38.0, 8, 0.7, graine + 3)
    pique = bruit(nt, vec, 120.0, 4, 0.6, graine + 7)
    # l'acier : deux tons, un marbrage large et un grain fin
    acier = melange(nt, rampe(nt, op(nt, 'ADD', grand, op(nt, 'MULTIPLY', fin, 0.5)), 0.55, 1.05), lin(ACIER), lin(ACIER_CLAIR))
    # la rouille : en taches, là où le bruit large et le fin s'accordent
    rouille = rampe(nt, op(nt, 'MULTIPLY', grand, fin), 0.26, 0.37)
    coul = melange(nt, rouille, acier, lin(ROUILLE))
    metal = op(nt, 'MULTIPLY', op(nt, 'SUBTRACT', 1.0, rouille), 0.75)
    rug = op(nt, 'ADD', 0.38, op(nt, 'MULTIPLY', rouille, 0.45))
    if peinture:
        tient = rampe(nt, op(nt, 'ADD', fin, op(nt, 'MULTIPLY', pique, 0.35)), 0.36, 0.42)
        coul = melange(nt, tient, coul, lin(peinture))
        metal = op(nt, 'MULTIPLY', metal, op(nt, 'SUBTRACT', 1.0, tient))
        rug = op(nt, 'ADD', op(nt, 'MULTIPLY', rug, op(nt, 'SUBTRACT', 1.0, tient)), op(nt, 'MULTIPLY', tient, 0.52))
    nt.links.new(coul, b.inputs['Base Color'])
    nt.links.new(metal, b.inputs['Metallic'])
    nt.links.new(rug, b.inputs['Roughness'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.35
    bump.inputs['Distance'].default_value = 0.002
    nt.links.new(op(nt, 'ADD', fin, op(nt, 'MULTIPLY', pique, 0.6)), bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat


# ------------------------------------------------------------ la géométrie
class Piece:
    """un bmesh par matière, un objet par matière au bout"""

    def __init__(self, nom, mats):
        self.nom, self.mats, self.bm = nom, mats, {}

    def _bm(self, m):
        return self.bm.setdefault(m, bmesh.new())

    def cylindre(self, m, p0, p1, r, seg=48, r2=None):
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        mat = Matrix.Translation((p0 + p1) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.create_cone(self._bm(m), cap_ends=True, segments=seg, radius1=r,
                              radius2=r if r2 is None else r2, depth=d.length, matrix=mat)

    def sphere(self, m, c, r):
        bmesh.ops.create_uvsphere(self._bm(m), u_segments=16, v_segments=8, radius=r, matrix=Matrix.Translation(c))

    def boite(self, m, c, t, rot=None):
        mat = Matrix.Translation(c) @ (rot or Matrix.Identity(4)) @ Matrix.Diagonal((*t, 1))
        bmesh.ops.create_cube(self._bm(m), size=1.0, matrix=mat)

    def tore(self, m, R, r, seg=128, segr=20, a0=None, a1=None):
        """un tore centré à l'origine, dans le plan xz — ou un arc de a0 à a1,
        fermé à ses deux bouts"""
        bm = self._bm(m)
        ferme = a0 is None
        n = seg if ferme else seg + 1
        anneaux = []
        for i in range(n):
            a = 2 * math.pi * i / seg if ferme else a0 + (a1 - a0) * i / seg
            ca, sa = math.cos(a), math.sin(a)
            anneaux.append([bm.verts.new(((R + r * math.cos(b)) * ca, r * math.sin(b), (R + r * math.cos(b)) * sa))
                            for b in (2 * math.pi * j / segr for j in range(segr))])
        for i in range(seg):
            A, B = anneaux[i], anneaux[(i + 1) % n]
            for j in range(segr):
                bm.faces.new((A[j], A[(j + 1) % segr], B[(j + 1) % segr], B[j]))
        if not ferme:
            bm.faces.new(anneaux[0])
            bm.faces.new(anneaux[-1])

    def ecrou(self, m, c, axe, r, h):
        """un écrou hexagonal posé sur une face, `axe` sa normale"""
        c, axe = Vector(c), Vector(axe).normalized()
        self.cylindre(m, c, c + axe * h, r, seg=6)
        self.cylindre(m, c + axe * h, c + axe * (h + r * 0.35), r * 0.45, seg=16, r2=r * 0.2)

    def objet(self, coll, biseau=0.004):
        obs = []
        for m, bm in self.bm.items():
            me = bpy.data.meshes.new(f'{self.nom}-{m}')
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bm.to_mesh(me)
            bm.free()
            me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
            try:
                me.set_sharp_from_angle(angle=math.radians(35))
            except Exception as e:
                print('lissage :', e)
            me.materials.append(self.mats[m])
            ob = bpy.data.objects.new(f'{self.nom}-{m}', me)
            coll.objects.link(ob)
            if biseau:
                b = ob.modifiers.new('biseau', 'BEVEL')
                b.width = biseau
                b.segments = 2
                b.limit_method = 'ANGLE'
            obs.append(ob)
        return obs


def bride(p, z, R, ep, n_boulons, vers):
    """une bride boulonnée autour de la conduite : le disque, sa contre-bride
    du côté `vers` (+1 : au-dessus), leurs écrous"""
    p.cylindre('acier', (0, 0, z - ep), (0, 0, z + ep), R, seg=96)
    p.cylindre('acier', (0, 0, z + ep * vers), (0, 0, z + ep * 1.9 * vers), R * 0.82, seg=96)
    for i in range(n_boulons):
        a = 2 * math.pi * (i + 0.5) / n_boulons
        x, y = R * 0.8 * math.cos(a), R * 0.8 * math.sin(a)
        p.ecrou('ecrou', (x, y, z - ep * vers), (0, 0, -vers), 0.024, 0.022)
        p.ecrou('ecrou', (x, y, z + ep * vers), (0, 0, vers), 0.02, 0.016)


def corps(coll, mats):
    p = Piece('corps', mats)
    # la conduite et ses deux abouts : la pièce s'arrête DANS le cadre
    p.cylindre('acier', (0, 0, -0.66), (0, 0, 0.66), 0.088, seg=64)
    for s in (-1, 1):
        p.cylindre('acier', (0, 0, s * 0.64), (0, 0, s * 0.69), 0.118, seg=64)
        for i in range(6):
            a = 2 * math.pi * (i + 0.5) / 6
            p.ecrou('ecrou', (0.10 * math.cos(a), 0.10 * math.sin(a), s * 0.69), (0, 0, s), 0.014, 0.012)
        # les grandes brides de la vanne, la contre-bride du côté de la conduite
        bride(p, s * 0.48, 0.235, 0.032, 8, s)
        # le col de la bride au corps, cerclé de sarcelle
        p.cylindre('acier', (0, 0, s * 0.45), (0, 0, s * 0.30), 0.112, seg=64)
        p.cylindre('sarcelle', (0, 0, s * 0.405), (0, 0, s * 0.375), 0.122, seg=64)
        p.cylindre('acier', (0, 0, s * 0.30), (0, 0, s * 0.26), 0.135, seg=64)
    # le corps : un bloc à pans, ses couvercles boulonnés à gauche et à droite
    p.boite('acier', (0, 0, 0), (0.30, 0.24, 0.50))
    p.boite('acier', (0, -0.005, 0), (0.24, 0.26, 0.56))
    for s in (-1, 1):
        p.cylindre('acier', (s * 0.15, 0, 0), (s * 0.20, 0, 0), 0.105, seg=64)
        p.cylindre('sarcelle', (s * 0.20, 0, 0), (s * 0.215, 0, 0), 0.085, seg=64)
        p.cylindre('acier', (s * 0.215, 0, 0), (s * 0.235, 0, 0), 0.06, seg=48)
        for i in range(6):
            a = 2 * math.pi * i / 6
            p.ecrou('ecrou', (s * 0.20, 0.09 * math.cos(a), 0.09 * math.sin(a)), (s, 0, 0), 0.012, 0.01)
    # le chapeau qui porte la tige, face caméra, cerclé de sarcelle
    p.cylindre('acier', (0, -0.12, 0), (0, -0.16, 0), 0.14, seg=64)
    p.cylindre('sarcelle', (0, -0.16, 0), (0, -0.19, 0), 0.115, seg=64)
    p.cylindre('acier', (0, -0.19, 0), (0, -0.215, 0), 0.075, seg=48)
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        p.ecrou('ecrou', (0.125 * math.cos(a), -0.16, 0.125 * math.sin(a)), (0, -1, 0), 0.012, 0.01)
    # la ligne de commande : un petit tube qui court sur la gauche
    pts = [(-0.15, -0.06, 0.18), (-0.27, -0.06, 0.18), (-0.30, -0.06, 0.15), (-0.30, -0.06, -0.15),
           (-0.27, -0.06, -0.18), (-0.15, -0.06, -0.18)]
    for a, b in zip(pts, pts[1:]):
        p.cylindre('tube', a, b, 0.011, seg=16)
    for q in pts[1:-1]:
        p.sphere('tube', q, 0.011)
    p.cylindre('ecrou', (-0.30, -0.06, 0.05), (-0.30, -0.06, 0.09), 0.018, seg=6)
    return p.objet(coll)


def volant(coll, mats):
    """le volant : jante, cinq rayons, moyeu, cinq poignées sarcelle — son
    centre à l'origine, dans le plan xz ; l'objet tourne autour de y"""
    p = Piece('volant', mats)
    R, r = 0.40, 0.042
    p.tore('jante', R, r)
    for k in range(SYMETRIE):
        a = math.pi / 2 + 2 * math.pi * k / SYMETRIE
        ca, sa = math.cos(a), math.sin(a)
        rot = Matrix.Rotation(-a, 4, 'Y')
        # le rayon : une lame épaisse, une nervure dessus, posée dans le plan
        p.boite('jante', ((0.08 + R) / 2 * ca, 0, (0.08 + R) / 2 * sa), (R - 0.08, 0.045, 0.072), rot)
        p.boite('jante', ((0.08 + R) / 2 * ca, -0.026, (0.08 + R) / 2 * sa), (R - 0.12, 0.012, 0.026), rot)
        # le gousset où le rayon s'évase contre la jante
        p.boite('jante', ((R - 0.05) * ca, 0, (R - 0.05) * sa), (0.045, 0.045, 0.15), rot)
        # la poignée peinte entre deux rayons : un manchon qui épouse la jante,
        # une bague d'acier à chaque bout
        b = a + math.pi / SYMETRIE
        p.tore('poignee', R, r * 1.18, seg=24, segr=20, a0=b - 0.15, a1=b + 0.15)
        for t in (b - 0.16, b + 0.16):
            ct, st = math.cos(t), math.sin(t)
            tg = Vector((-st, 0, ct)) * 0.012
            c = Vector((R * ct, 0, R * st))
            p.cylindre('jante', c - tg, c + tg, r * 1.3, seg=32)
    # le moyeu
    p.cylindre('jante', (0, 0.025, 0), (0, -0.035, 0), 0.10, seg=64)
    p.cylindre('poignee', (0, -0.035, 0), (0, -0.05, 0), 0.06, seg=48)
    p.cylindre('jante', (0, -0.05, 0), (0, -0.075, 0), 0.04, seg=6)
    for i in range(6):
        a = 2 * math.pi * i / 6
        p.ecrou('ecrou', (0.08 * math.cos(a), -0.035, 0.08 * math.sin(a)), (0, -1, 0), 0.011, 0.008)
    return p.objet(coll)


def lampe(coll, nom, pos, force, taille, coul=(1, 1, 1)):
    l = bpy.data.lights.new(nom, 'AREA')
    l.energy, l.size, l.color = force, taille, coul
    o = bpy.data.objects.new(nom, l)
    o.location = pos
    o.rotation_euler = (-Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    coll.objects.link(o)


def scene():
    vide_scene()
    sc = bpy.context.scene
    mats = {
        'acier': mat_metal('acier', graine=1.0),
        'ecrou': mat_metal('ecrou', graine=5.0),
        'tube': mat_metal('tube', graine=9.0),
        'sarcelle': mat_metal('sarcelle', peinture=SARCELLE, graine=2.0),
        'jante': mat_metal('jante', polaire=True, graine=4.0),
        'poignee': mat_metal('poignee', peinture=SARCELLE, polaire=True, graine=6.0),
    }
    coll = sc.collection
    corps(coll, mats)
    pivot = bpy.data.objects.new('volant', None)
    pivot.location = (0, -0.30, 0.02)
    coll.objects.link(pivot)
    for ob in volant(coll, mats):
        ob.parent = pivot
    p = Piece('tige', mats)
    p.cylindre('acier', (0, -0.21, 0.02), (0, -0.29, 0.02), 0.03, seg=32)
    p.objet(coll)
    # la caméra : orthographique, un rien plongeante pour lire le dessus des brides
    cam = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 1.5
    incl = math.radians(9)
    cam.rotation_euler = (math.pi / 2 - incl, 0, 0)
    cam.location = (0, -4 * math.cos(incl), 4 * math.sin(incl))
    coll.objects.link(cam)
    sc.camera = cam
    # la lumière : une clé en haut à gauche, un débouché froid, un contre-jour
    lampe(coll, 'cle', (-2.2, -2.6, 2.4), 420, 1.6, (1.0, 0.97, 0.92))
    lampe(coll, 'debouche', (2.6, -2.0, -0.6), 130, 2.5, (0.75, 0.88, 1.0))
    lampe(coll, 'contre', (0.6, 2.5, 2.8), 160, 1.2, (0.8, 0.95, 1.0))
    w = sc.world or bpy.data.worlds.new('monde')
    sc.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.02, 0.025, 0.03, 1)
    bg.inputs['Strength'].default_value = 1.0
    r = sc.render
    try:
        r.engine = 'CYCLES'
    except TypeError as e:
        print(e)
    sc.cycles.device = 'GPU'
    sc.cycles.use_denoising = False
    sc.cycles.samples = ECHANTILLONS
    r.resolution_x, r.resolution_y = LARGEUR, HAUTEUR
    r.film_transparent = True
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'


def pose(k):
    """la vue k : le volant tourné de k/VUES de sa période"""
    bpy.data.objects['volant'].rotation_euler = (0, 2 * math.pi / SYMETRIE * k / VUES, 0)


def lance(sortie, echantillons=ECHANTILLONS, pourcent=100, vues=None):
    """rend les vues par minuteur (la 0 est la fixe) : journal.jsonl à
    mesure, fini.txt au bout — un rendu long coupe la liaison MCP"""
    os.makedirs(os.path.join(sortie, 'vues'), exist_ok=True)
    os.makedirs(bpy.app.tempdir, exist_ok=True)
    sc = bpy.context.scene
    sc.cycles.samples = echantillons
    sc.render.resolution_percentage = pourcent
    journal = os.path.join(sortie, 'journal.jsonl')
    for f in (journal, os.path.join(sortie, 'fini.txt')):
        if os.path.exists(f):
            os.remove(f)
    file = list(range(VUES)) if vues is None else list(vues)

    def pas():
        if not file:
            open(os.path.join(sortie, 'fini.txt'), 'w').write('fini')
            return None
        k = file.pop(0)
        t = time.time()
        pose(k)
        sc.render.filepath = os.path.join(sortie, 'vues', f'vue-{k:02d}.png')
        bpy.ops.render.render(write_still=True)
        open(journal, 'a', encoding='utf-8').write(json.dumps({'vue': k, 'secondes': round(time.time() - t, 1)}) + '\n')
        return 0.2
    bpy.app.timers.register(pas, first_interval=0.5)
