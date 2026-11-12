"""L'ÉCLAT DE MÉMOIRE, refait dans Blender (13/11) — meta-eclat.webp devient
une BANDE de vues : le cristal tourne sur lui-même.

L'ancien était une vignette générée (214 × 512) que le moteur faisait pivoter
dans le plan, comme une aiguille. Une bande de vues carrées le fait tourner
sur son axe : dessineEclat (main.ts) reconnaît la bande à ses proportions
(metaAssets.vuesEclat : rapport ≥ 3,5, une vue CARRÉE par tranche) et puise
la vue selon la phase — un tour de phase, un tour du cristal.

Le cristal n'est PAS symétrique (ses facettes sont tirées au sort) : la bande
couvre un tour entier, VUES vues, et la dernière précède la première.

24 VUES, pas 12 : le moteur fait un tour en 4,5 s (main.ts, phase = t × 1,4) ;
à 12 vues, chacune restait 0,37 s à l'écran et le cristal tournait par
saccades. L'éclat se dessine petit (r × 3,2, quelques dizaines de pixels) :
24 vues de 170 px tiennent dans 4096 sans qu'on perde rien.

Dans Blender :
    DOSSIER = r'...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\eclat.py', encoding='utf-8').read())
    scene() ; lance(SORTIE)
"""
import bpy, bmesh, math, os, json, time, random
from mathutils import Vector

VUES = 24
COTE = 512                 # une vue carrée ; la bande est réduite à 4096 de large à la livraison
ECHANTILLONS = 256
GRAINE = 21

# le vert d'eau de l'ancien éclat (charte : la mémoire est froide)
VERT = (0x26, 0xb8, 0x88)
VERT_PROFOND = (0x06, 0x3a, 0x30)


def lin(c, a=1.0):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), a)


def vide_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for d in list(coll):
            coll.remove(d)


def cristal(rng):
    """une double pyramide allongée, trois couronnes de facettes irrégulières"""
    bm = bmesh.new()
    haut = bm.verts.new((0, 0, 1.0))
    bas = bm.verts.new((rng.uniform(-0.02, 0.02), 0, -1.0))
    n = 6

    def couronne(z, r, dz):
        out = []
        for i in range(n):
            a = 2 * math.pi * (i + rng.uniform(-0.12, 0.12)) / n
            rr = r * rng.uniform(0.86, 1.08)
            out.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z + rng.uniform(-dz, dz))))
        return out
    c1 = couronne(0.38, 0.22, 0.05)
    c2 = couronne(0.0, 0.40, 0.04)
    c3 = couronne(-0.42, 0.22, 0.05)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((haut, c1[i], c1[j]))
        bm.faces.new((c1[i], c2[i], c2[j], c1[j]))
        bm.faces.new((c2[i], c3[i], c3[j], c2[j]))
        bm.faces.new((c3[i], bas, c3[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # les quadrilatères gauchis en deux triangles : des facettes nettes
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) == 4])
    me = bpy.data.meshes.new('eclat')
    bm.to_mesh(me)
    bm.free()
    return me


def mat_cristal():
    """du verre vert, éclairé de l'intérieur : la transmission seule rendrait
    un cristal noir sur le fond transparent du jeu — la lueur interne et des
    arêtes plus vives le gardent lisible sur l'eau"""
    mat = bpy.data.materials.new('cristal')
    mat.use_nodes = True
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    b = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = lin(VERT)
    b.inputs['Roughness'].default_value = 0.08
    b.inputs['IOR'].default_value = 1.6
    b.inputs['Transmission Weight'].default_value = 0.85
    # la lueur : plus forte face à la caméra (le cœur), veinée d'un bruit
    lw = N.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.45
    tc = N.new('ShaderNodeTexCoord')
    bruit = N.new('ShaderNodeTexNoise')
    bruit.inputs['Scale'].default_value = 6.0
    bruit.inputs['Detail'].default_value = 8.0
    L.new(tc.outputs['Object'], bruit.inputs['Vector'])
    veines = N.new('ShaderNodeMapRange')
    veines.inputs['From Min'].default_value = 0.42
    veines.inputs['From Max'].default_value = 0.62
    L.new(bruit.outputs['Fac'], veines.inputs['Value'])
    coeur = N.new('ShaderNodeMath')
    coeur.operation = 'SUBTRACT'
    coeur.inputs[0].default_value = 1.0
    L.new(lw.outputs['Facing'], coeur.inputs[1])
    mix = N.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    L.new(veines.outputs['Result'], mix.inputs['Factor'])
    mix.inputs[6].default_value = lin(VERT_PROFOND)
    mix.inputs[7].default_value = lin(VERT)
    L.new(mix.outputs[2], b.inputs['Emission Color'])
    force = N.new('ShaderNodeMath')
    force.operation = 'MULTIPLY_ADD'
    L.new(coeur.outputs[0], force.inputs[0])
    force.inputs[1].default_value = 0.9
    force.inputs[2].default_value = 0.08
    L.new(force.outputs[0], b.inputs['Emission Strength'])
    return mat


def scene():
    vide_scene()
    rng = random.Random(GRAINE)
    sc = bpy.context.scene
    coll = sc.collection
    ob = bpy.data.objects.new('eclat', cristal(rng))
    ob.data.materials.append(mat_cristal())
    coll.objects.link(ob)
    # les arêtes : un fil lumineux, comme le liseré de l'ancien éclat
    fil = ob.modifiers.new('aretes', 'WIREFRAME')
    fil.thickness = 0.006
    fil.use_replace = False
    fil.material_offset = 1
    m2 = bpy.data.materials.new('arete')
    m2.use_nodes = True
    e = next(n for n in m2.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    e.inputs['Base Color'].default_value = lin(VERT)
    e.inputs['Emission Color'].default_value = lin((0x6a, 0xf0, 0xc0))
    e.inputs['Emission Strength'].default_value = 0.9
    ob.data.materials.append(m2)
    cam = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 2.12
    cam.location = (0, -6, 0)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    coll.objects.link(cam)
    sc.camera = cam
    for nom, pos, force, coul in (('cle', (-3, -3, 3), 220, (1, 1, 1)), ('contre', (2, 3, 1), 120, (0.7, 1, 0.9))):
        l = bpy.data.lights.new(nom, 'AREA')
        l.energy, l.size, l.color = force, 2.0, coul
        o = bpy.data.objects.new(nom, l)
        o.location = pos
        o.rotation_euler = (-Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        coll.objects.link(o)
    w = sc.world or bpy.data.worlds.new('monde')
    sc.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.01, 0.02, 0.02, 1)
    bg.inputs['Strength'].default_value = 1.0
    r = sc.render
    try:
        r.engine = 'CYCLES'
    except TypeError as e:
        print(e)
    sc.cycles.device = 'GPU'
    sc.cycles.use_denoising = False
    sc.cycles.samples = ECHANTILLONS
    r.resolution_x = r.resolution_y = COTE
    r.film_transparent = True
    sc.cycles.film_transparent_glass = True
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'


def pose(k):
    bpy.data.objects['eclat'].rotation_euler = (0, 0, 2 * math.pi * k / VUES)


def lance(sortie, echantillons=ECHANTILLONS, pourcent=100):
    """rend les VUES vues par minuteur : journal.jsonl à mesure, fini.txt au bout"""
    os.makedirs(os.path.join(sortie, 'vues'), exist_ok=True)
    os.makedirs(bpy.app.tempdir, exist_ok=True)
    sc = bpy.context.scene
    sc.cycles.samples = echantillons
    sc.render.resolution_percentage = pourcent
    journal = os.path.join(sortie, 'journal.jsonl')
    for f in (journal, os.path.join(sortie, 'fini.txt')):
        if os.path.exists(f):
            os.remove(f)
    file = list(range(VUES))

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
