"""LA TÔLE DE LA CHAUFFERIE — un carreau qui se raccorde sur ses quatre bords
(assets-ia §35 : la pièce de fond de la coque, biome « chaud »).

Vue de FACE, orthographique : le mur est dans le plan XZ, sa face regarde -Y,
la caméra regarde +Y. 1 unité = une largeur de salle = 1024 px.

Pourquoi ce carreau se raccorde PAR CONSTRUCTION, et pas par un fondu après
coup (raccorde() de coque2d.py fond les bords, ce qui décale le motif) :
  · le bruit des matières est pris sur un TORE (cos/sin de x et de z, en 4D) :
    il est périodique de période 1 dans les deux sens ;
  · le carreau est entouré de ses huit copies (instances de collection) : un
    panneau qui déborde à droite réapparaît à gauche, une ombre portée par la
    rangée du dessus tombe aussi dans le carreau ;
  · le rendu déborde de MARGE px de chaque côté, rognés ensuite : le
    débruitage ne voit jamais le bord de l'image, il ne peut pas y faire de
    couture.

À exécuter dans Blender :  exec(open(r'...\\chaud_tole.py').read())
"""
import bpy, bmesh, math, random
from mathutils import Matrix, Vector

GRAINE = 21
PX = 1024            # px par largeur de salle
MARGE = 64           # px rendus autour du carreau, rognés
ECHANTILLONS = 96

# la palette (charte §3), en sRGB : l'acier des coques et ce que la chaleur y
# laisse — une patine brune de l'acier de la conduite (docs/reference/
# conduite-reference.webp), la rouille, la suie ; l'ambre sur les voyants seuls
ACIER_FROID = (0x2a, 0x35, 0x42)
PATINE = (0x55, 0x48, 0x3c)
ROUILLE = (0x5e, 0x34, 0x1f)
METAL_NU = (0x8a, 0x91, 0x97)
FOND = (0x06, 0x08, 0x0b)
ISOLANT = (0x4a, 0x4f, 0x55)
AMBRE = (0xe8, 0x95, 0x1f)


def lin(c):
    """sRGB 8 bits → linéaire (ce que prennent les nœuds)"""
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


# ------------------------------------------------------------------ la scène
def vide_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.collections, bpy.data.meshes, bpy.data.materials,
                 bpy.data.lights, bpy.data.cameras):
        for d in list(coll):
            coll.remove(d)


# ------------------------------------------------------------ la géométrie
class Atelier:
    """Un bmesh par matière ; chaque face porte 'var', le tirage de son
    panneau (lu par le shader : un panneau plus usé, plus brun qu'un autre)."""

    def __init__(self):
        self.bm = {}

    def _bm(self, mat):
        if mat not in self.bm:
            bm = bmesh.new()
            bm.faces.layers.float.new('var')
            self.bm[mat] = bm
        return self.bm[mat]

    def _marque(self, mat, verts, var):
        lay = self._bm(mat).faces.layers.float['var']
        for f in {f for v in verts for f in v.link_faces}:
            f[lay] = var

    def boite(self, mat, x0, x1, z0, z1, yf, yb, var=0.0, rot=None):
        """une boîte de x0..x1, z0..z1, face avant à yf (plus négatif = plus
        près de la caméra), fond à yb"""
        bm = self._bm(mat)
        m = Matrix.Translation(((x0 + x1) / 2, (yf + yb) / 2, (z0 + z1) / 2))
        if rot is not None:
            m = m @ rot
        m = m @ Matrix.Diagonal((x1 - x0, yb - yf, z1 - z0, 1))
        r = bmesh.ops.create_cube(bm, size=1.0, matrix=m)
        self._marque(mat, r['verts'], var)

    def dome(self, mat, x, z, r, y, var=0.0, aplati=0.55):
        m = Matrix.Translation((x, y, z)) @ Matrix.Diagonal((1, aplati, 1, 1))
        res = bmesh.ops.create_uvsphere(self._bm(mat), u_segments=10, v_segments=6, radius=r, matrix=m)
        self._marque(mat, res['verts'], var)

    def coussin(self, mat, x, z, rx, rz, ry, y, var=0.0):
        m = Matrix.Translation((x, y, z)) @ Matrix.Diagonal((rx, ry, rz, 1))
        res = bmesh.ops.create_uvsphere(self._bm(mat), u_segments=12, v_segments=8, radius=1.0, matrix=m)
        self._marque(mat, res['verts'], var)

    def cylindre(self, mat, x, z, r, y0, y1, var=0.0, seg=6, axe='Y', long=None):
        """axe Y : un écrou, un voyant (vu de face, rond) ; axe Z : une nervure
        verticale de longueur long, centrée en z, à moitié noyée"""
        if axe == 'Y':
            m = Matrix.Translation((x, (y0 + y1) / 2, z)) @ Matrix.Rotation(math.pi / 2, 4, 'X')
            depth = abs(y1 - y0)
        else:
            m = Matrix.Translation((x, (y0 + y1) / 2, z))
            depth = long
        res = bmesh.ops.create_cone(self._bm(mat), cap_ends=True, segments=seg, radius1=r, radius2=r, depth=depth, matrix=m)
        self._marque(mat, res['verts'], var)

    def objets(self, coll, mats, biseau):
        for nom, bm in self.bm.items():
            me = bpy.data.meshes.new(f'tole-{nom}')
            bm.to_mesh(me)
            bm.free()
            me.materials.append(mats[nom])
            ob = bpy.data.objects.new(f'tole-{nom}', me)
            coll.objects.link(ob)
            if nom in biseau:
                b = ob.modifiers.new('biseau', 'BEVEL')
                b.width = biseau[nom]
                b.segments = 2
                b.limit_method = 'ANGLE'


# ---------------------------------------------------------------- les panneaux
JEU = 0.006          # le joint entre deux panneaux
FOND_Y = 0.022       # la tôle de fond, au fond des joints


def rivets(at, x0, x1, z0, z1, yf, var, retrait=0.0095, pas=0.032, r=0.0034):
    """des rivets tout autour d'un panneau ; les coins par les côtés haut et bas"""
    for a, b, fixe, horiz in ((x0, x1, z0, True), (x0, x1, z1, True), (z0, z1, x0, False), (z0, z1, x1, False)):
        a2, b2 = a + retrait, b - retrait
        n = max(1, round((b2 - a2) / pas))
        for i in range(n + 1):
            t = a2 + (b2 - a2) * i / n
            if horiz:
                at.dome('rivet', t, fixe + (retrait if fixe == z0 else -retrait), r, yf, var)
            elif 0 < i < n:
                at.dome('rivet', fixe + (retrait if fixe == x0 else -retrait), t, r, yf, var)


def plaque(at, x0, x1, z0, z1, yf, var):
    at.boite('peinture', x0, x1, z0, z1, yf, FOND_Y, var)
    rivets(at, x0, x1, z0, z1, yf, var)


def cadre(at, x0, x1, z0, z1, yf, var, m):
    """une plaque percée : quatre bandes autour d'un trou"""
    at.boite('peinture', x0, x1, z1 - m, z1, yf, FOND_Y, var)
    at.boite('peinture', x0, x1, z0, z0 + m, yf, FOND_Y, var)
    at.boite('peinture', x0, x0 + m, z0 + m, z1 - m, yf, FOND_Y, var)
    at.boite('peinture', x1 - m, x1, z0 + m, z1 - m, yf, FOND_Y, var)


def event(at, x0, x1, z0, z1, yf, var, rng, suies):
    """l'ouïe de chaleur : des lames inclinées vers le bas dans un cadre, et la
    suie qui en est montée sur la tôle au-dessus"""
    m = 0.016
    cadre(at, x0, x1, z0, z1, yf, var, m)
    rivets(at, x0, x1, z0, z1, yf, var, retrait=0.0075, pas=0.04, r=0.0028)
    at.boite('fond', x0 + m, x1 - m, z0 + m, z1 - m, 0.016, FOND_Y, 0)
    pas = 0.0125
    n = int((z1 - z0 - 2 * m) / pas)
    z = z0 + m + pas / 2 + ((z1 - z0 - 2 * m) - n * pas) / 2
    rot = Matrix.Rotation(math.radians(-38), 4, 'X')
    for _ in range(n):
        at.boite('lame', x0 + m - 0.001, x1 - m + 0.001, z - 0.0011, z + 0.0011, yf + 0.004, yf + 0.016, var, rot=rot)
        z += pas
    suies.append((x0 + m, x1 - m, z1 - m * 0.5, rng.uniform(0.11, 0.18)))


def nervures(at, x0, x1, z0, z1, yf, var):
    """l'écran thermique ondulé : des nervures verticales sur une plaque"""
    plaque(at, x0, x1, z0, z1, yf, var)
    m = 0.02
    pas = 0.0135
    n = int((x1 - x0 - 2 * m) / pas)
    x = x0 + m + ((x1 - x0 - 2 * m) - (n - 1) * pas) / 2
    for _ in range(n):
        at.cylindre('peinture', x, (z0 + z1) / 2, 0.0048, yf, yf, var, seg=12, axe='Z', long=z1 - z0 - 2 * m)
        x += pas
    # les deux fers plats qui les tiennent
    for zz in (z0 + m + 0.004, z1 - m - 0.004):
        at.boite('peinture', x0 + m * 0.6, x1 - m * 0.6, zz - 0.004, zz + 0.004, yf - 0.006, yf, var)
        for xx in (x0 + m * 0.6 + 0.008, x1 - m * 0.6 - 0.008):
            at.dome('rivet', xx, zz, 0.0028, yf - 0.006, var)


def matelas(at, x0, x1, z0, z1, yf, var, rng):
    """le matelas isolant : des coussins piqués dans un cadre, deux sangles"""
    m = 0.012
    cadre(at, x0, x1, z0, z1, yf, var, m)
    rivets(at, x0, x1, z0, z1, yf, var, retrait=0.0065, pas=0.04, r=0.0026)
    at.boite('fond', x0 + m, x1 - m, z0 + m, z1 - m, 0.004, FOND_Y, 0)
    # des coussins plats et serrés qui se chevauchent : ronds et saillants,
    # ils se lisaient comme des boules (essai du 12/11)
    nx = max(2, round((x1 - x0 - 2 * m) / 0.042))
    nz = max(2, round((z1 - z0 - 2 * m) / 0.038))
    cw = (x1 - x0 - 2 * m) / nx
    ch = (z1 - z0 - 2 * m) / nz
    for i in range(nx):
        for j in range(nz):
            at.coussin('isolant', x0 + m + cw * (i + 0.5), z0 + m + ch * (j + 0.5), cw * 0.62, ch * 0.62, 0.0032, 0.003, var + rng.uniform(-0.1, 0.1))
    for t in (0.33, 0.67):
        zz = z0 + (z1 - z0) * t
        at.boite('peinture', x0 + m * 0.4, x1 - m * 0.4, zz - 0.0045, zz + 0.0045, -0.009, 0.0, var)
        bx = x0 + (x1 - x0) * (0.3 if t < 0.5 else 0.7)
        at.boite('peinture', bx - 0.008, bx + 0.008, zz - 0.007, zz + 0.007, -0.012, -0.004, var)


def trappe(at, x0, x1, z0, z1, yf, var):
    """la trappe de visite : une plaque en relief, quatre écrous, une poignée"""
    at.boite('peinture', x0, x1, z0, z1, yf, FOND_Y, var)
    rivets(at, x0, x1, z0, z1, yf, var, retrait=0.008, pas=0.045, r=0.003)
    i = 0.02
    at.boite('peinture', x0 + i, x1 - i, z0 + i, z1 - i, yf - 0.005, yf, var)
    for xx in (x0 + i + 0.009, x1 - i - 0.009):
        for zz in (z0 + i + 0.009, z1 - i - 0.009):
            at.cylindre('peinture', xx, zz, 0.0052, yf - 0.009, yf - 0.005, var, seg=6)
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    lw = min(0.06, (x1 - x0) * 0.35)
    at.boite('peinture', cx - lw / 2, cx + lw / 2, cz - 0.0035, cz + 0.0035, yf - 0.017, yf - 0.012, var)
    for xx in (cx - lw / 2 + 0.003, cx + lw / 2 - 0.003):
        at.boite('peinture', xx - 0.003, xx + 0.003, cz - 0.0035, cz + 0.0035, yf - 0.013, yf - 0.005, var)


def voyant(at, x, z, yf):
    """une veilleuse ambre sous verre, dans son boîtier — les seuls points
    chauds de la tôle (charte §3 : l'ambre n'est qu'aux voyants)"""
    at.boite('peinture', x - 0.012, x + 0.012, z - 0.016, z + 0.016, yf - 0.006, yf, 0.3)
    at.cylindre('ambre', x, z + 0.003, 0.0062, yf - 0.011, yf - 0.006, 0, seg=16)
    at.boite('peinture', x - 0.009, x + 0.009, z - 0.0115, z - 0.0085, yf - 0.008, yf - 0.006, 0.3)


def dispose(rng, hauteurs=None, largeurs=None):
    """la mise en page du carreau : des rangées dont les hauteurs font 1, et
    dans chaque rangée des panneaux dont les largeurs font 1, décalés d'une
    phase — comme les rangées font le tour, rien ne bute au bord"""
    hauteurs = hauteurs or [0.15, 0.19, 0.14, 0.2, 0.16, 0.16]
    largeurs = largeurs or [0.12, 0.16, 0.2, 0.24, 0.3]
    panneaux = []
    z = 0.0
    for h in hauteurs:
        ls = []
        while sum(ls) < 1 - 1e-6:
            reste = 1 - sum(ls)
            l = rng.choice(largeurs)
            if reste - l < 0.1:
                l = reste
            ls.append(l)
        x = rng.uniform(0, 1)
        for l in ls:
            if l <= 0.14 and h >= 0.18 and rng.random() < 0.5:
                # deux petites plaques empilées
                panneaux.append((x, x + l, z, z + h / 2, 'plaque'))
                panneaux.append((x, x + l, z + h / 2, z + h, 'plaque'))
            else:
                panneaux.append((x, x + l, z, z + h, None))
            x += l
        z += h
    return panneaux


# LE TIRAGE des panneaux : (seuil, sorte, largeur mini, largeur maxi, hauteur
# mini) — le premier dont le seuil dépasse le tirage ET dont le gabarit tient ;
# sinon une plaque nue
TIRAGE = [(0.11, 'event', 0.14, 0.24, 0.14), (0.27, 'nervures', 0.16, 9, 0), (0.42, 'matelas', 0.2, 9, 0.15), (0.6, 'trappe', 0.14, 9, 0)]


def construit(coll, mats, graine=None, tirage=None, hauteurs=None, largeurs=None, extra=None, apres=None):
    """graine, tirage, hauteurs, largeurs : une autre tôle du même atelier ;
    extra : des sortes de panneaux en plus, {nom: f(at, x0, x1, z0, z1, yf,
    var, fin)} ; apres(at, plaques nues restantes, fin) : ce qui se pose à la fin"""
    graine = GRAINE if graine is None else graine
    table = tirage or TIRAGE
    # deux tirages : la MISE EN PAGE (rng) et les DÉTAILS (fin) — un réglage
    # de coussin ou de suie redistribuait tous les panneaux suivants
    rng = random.Random(graine)
    fin = random.Random(graine + 1000)
    at = Atelier()
    suies = []
    poses = []
    compte = {}
    for (x0, x1, z0, z1, sorte) in dispose(rng, hauteurs, largeurs):
        w, h = x1 - x0, z1 - z0
        if sorte is None:
            # (réglé à l'essai 3 : les ouïes étroites et rares — six, dont de
            # 0,3 salle, faisaient une rangée de trous noirs ; le matelas, ce
            # qui dit « chaufferie » le plus nettement, plus souvent)
            tir = rng.random()
            sorte = 'plaque'
            for seuil, nom, wmin, wmax, hmin in table:
                if tir < seuil and wmin <= w <= wmax and h >= hmin:
                    sorte = nom
                    break
        compte[sorte] = compte.get(sorte, 0) + 1
        g = JEU / 2
        a = (x0 + g, x1 - g, z0 + g, z1 - g)
        yf = rng.choice((0.0, 0.0, -0.003, -0.006))
        var = rng.uniform(-1, 1)
        if sorte == 'event':
            event(at, *a, yf, var, fin, suies)
        elif sorte == 'nervures':
            nervures(at, *a, yf, var)
        elif sorte == 'matelas':
            matelas(at, *a, yf, var, fin)
        elif sorte == 'trappe':
            trappe(at, *a, yf, var)
        elif extra and sorte in extra:
            extra[sorte](at, *a, yf, var, fin)
        else:
            plaque(at, *a, yf, var)
            poses.append((a, yf))
    # trois veilleuses, sur des plaques nues, dans un coin haut
    rng.shuffle(poses)
    for (x0, x1, z0, z1), yf in poses[:3]:
        voyant(at, x1 - 0.03, z1 - 0.035, yf)
    if apres:
        apres(at, poses[3:], fin)
    at.objets(coll, mats, {'peinture': 0.0022, 'lame': 0.0008, 'fond': 0.001})
    # la suie montée des ouïes : des voiles posés devant, sans ombre. Leur
    # opacité est portée par les SOMMETS d'une petite grille (attribut
    # 'voile') : le dégradé par UV ne passait pas au rendu (essai du 12/11,
    # voiles invisibles), un attribut de point s'interpole à coup sûr
    NU, NV = 10, 8
    for i, (x0, x1, zb, hh) in enumerate(suies):
        me = bpy.data.meshes.new(f'suie-{i}')
        bm = bmesh.new()
        voile = bm.verts.layers.float.new('voile')
        grille = []
        for j in range(NV + 1):
            v = j / NV
            # le panache s'évase en montant
            xa, xb = x0 - 0.01 - 0.025 * v, x1 + 0.01 + 0.025 * v
            ligne = []
            for k in range(NU + 1):
                u = k / NU
                pt = bm.verts.new((xa + (xb - xa) * u, -0.0185, zb + hh * v))
                bord = min(1.0, min(u, 1 - u) / 0.22)
                pt[voile] = (1 - v) ** 1.5 * bord
                ligne.append(pt)
            grille.append(ligne)
        for j in range(NV):
            for k in range(NU):
                bm.faces.new((grille[j][k], grille[j][k + 1], grille[j + 1][k + 1], grille[j + 1][k]))
        bm.to_mesh(me)
        bm.free()
        me.materials.append(mats['suie'])
        ob = bpy.data.objects.new(f'suie-{i}', me)
        ob.visible_shadow = False
        coll.objects.link(ob)
    return compte


# --------------------------------------------------------------- les matières
def noeuds(mat):
    try:
        mat.use_nodes = True
    except AttributeError:
        pass
    nt = mat.node_tree
    nt.nodes.clear()
    return nt, nt.nodes, nt.links


def op(nt, o, *entrees):
    """un nœud Math ; chaque entrée est un nombre ou une sortie de nœud"""
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = o
    for k, s in enumerate(entrees):
        if isinstance(s, (int, float)):
            n.inputs[k].default_value = s
        else:
            nt.links.new(s, n.inputs[k])
    return n.outputs[0]


def bruit_tore(nt, rx, rz, graine, detail=4.0, rugo=0.55):
    """un bruit PÉRIODIQUE de période 1 en x et en z : la position est
    enroulée sur un tore, (rx·cos 2πx, rx·sin 2πx, rz·cos 2πz) + W = rz·sin
    2πz. rx et rz règlent la finesse dans chaque sens (rz petit devant rx :
    des coulures verticales). Retourne la sortie Fac."""
    N, L = nt.nodes, nt.links
    geo = N.new('ShaderNodeNewGeometry')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(geo.outputs['Position'], sep.inputs[0])
    ax = op(nt, 'MULTIPLY', sep.outputs['X'], 2 * math.pi)
    az = op(nt, 'MULTIPLY', sep.outputs['Z'], 2 * math.pi)
    comb = N.new('ShaderNodeCombineXYZ')
    L.new(op(nt, 'MULTIPLY', op(nt, 'COSINE', ax), rx), comb.inputs[0])
    L.new(op(nt, 'MULTIPLY', op(nt, 'SINE', ax), rx), comb.inputs[1])
    L.new(op(nt, 'MULTIPLY', op(nt, 'COSINE', az), rz), comb.inputs[2])
    w = op(nt, 'MULTIPLY_ADD', op(nt, 'SINE', az), rz, graine * 7.31)
    nz = N.new('ShaderNodeTexNoise')
    nz.noise_dimensions = '4D'
    L.new(comb.outputs[0], nz.inputs['Vector'])
    L.new(w, nz.inputs['W'])
    nz.inputs['Scale'].default_value = 1.0
    nz.inputs['Detail'].default_value = detail
    nz.inputs['Roughness'].default_value = rugo
    return nz.outputs['Fac']


def rampe(nt, fac, a, b):
    """fac remappé de a..b vers 0..1, borné (a > b : renversé)"""
    r = nt.nodes.new('ShaderNodeMapRange')
    r.clamp = True
    nt.links.new(fac, r.inputs['Value'])
    r.inputs['From Min'].default_value = a
    r.inputs['From Max'].default_value = b
    return r.outputs['Result']


def melange(nt, fac, c1, c2):
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'RGBA'
    for k, v in ((0, fac), (6, c1), (7, c2)):
        if isinstance(v, (tuple, int, float)):
            m.inputs[k].default_value = v
        else:
            nt.links.new(v, m.inputs[k])
    return m.outputs[2]


def mat_peinture():
    """l'acier peint : une patine brune par plaques (chaque panneau tire sa
    part), des coulures de rouille, l'arête usée jusqu'au métal"""
    mat = bpy.data.materials.new('peinture')
    nt, N, L = noeuds(mat)
    out = N.new('ShaderNodeOutputMaterial')
    bsdf = N.new('ShaderNodeBsdfPrincipled')
    L.new(bsdf.outputs[0], out.inputs[0])
    var = N.new('ShaderNodeAttribute')
    var.attribute_type = 'GEOMETRY'
    var.attribute_name = 'var'
    v01 = op(nt, 'MULTIPLY_ADD', var.outputs['Fac'], 0.5, 0.5)
    # l'acier, plus froid ou plus brun selon le panneau et une marbrure large
    # — le premier essai mélangeait deux teintes de même valeur : rien ne se
    # voyait. La patine est désormais plus claire ET plus chaude que l'acier
    marbre = bruit_tore(nt, 2.2, 2.2, 1, detail=6, rugo=0.6)
    # la patine sur QUELQUES panneaux seulement : partout, elle faisait virer
    # toute la tôle au brun de bois (essai 2) ; la charte la veut froide
    part = op(nt, 'ADD', op(nt, 'MULTIPLY', v01, 0.7), op(nt, 'MULTIPLY', rampe(nt, marbre, 0.4, 0.6), 0.6))
    base = melange(nt, rampe(nt, part, 0.62, 1.25), lin(ACIER_FROID), lin(PATINE))
    # des taches sombres larges : la peinture qui a cuit
    cuit = bruit_tore(nt, 3.5, 3.5, 8, detail=5, rugo=0.65)
    base = melange(nt, op(nt, 'MULTIPLY', rampe(nt, cuit, 0.5, 0.68), 0.7), base, lin(FOND))
    # le grain de la peinture, fin
    grain = bruit_tore(nt, 40, 40, 2, detail=8, rugo=0.7)
    base = melange(nt, op(nt, 'MULTIPLY', rampe(nt, grain, 0.3, 0.7), 0.35), base, lin(FOND))
    # LE GRAIN FIN et les rayures : sans eux la tôle, agrandie deux fois quand
    # le tableau tient l'écran, paraissait floue — trois à quatre fois moins de
    # détail fin que les pièces peintes (contraste local 3 contre 12, mesuré le
    # 12/11). Un piqué serré, et des griffures horizontales jusqu'au métal
    # (à 190 tours de tore le grain passait sous le pixel : rien au rendu. 60 :
    # des grains de 4 à 5 px à 1536 px par salle)
    pique = bruit_tore(nt, 60, 60, 22, detail=6, rugo=0.75)
    base = melange(nt, op(nt, 'MULTIPLY', rampe(nt, pique, 0.47, 0.3), 0.6), base, lin(FOND))
    base = melange(nt, op(nt, 'MULTIPLY', rampe(nt, pique, 0.58, 0.74), 0.4), base, lin((0x62, 0x6c, 0x78)))
    griffe = bruit_tore(nt, 5, 70, 23, detail=3, rugo=0.6)
    ou = bruit_tore(nt, 4, 4, 24, detail=2, rugo=0.5)
    base = melange(nt, op(nt, 'MULTIPLY', op(nt, 'MULTIPLY', rampe(nt, griffe, 0.66, 0.7), rampe(nt, ou, 0.5, 0.6)), 0.3), base, lin(METAL_NU))
    # les coulures de crasse, verticales et nombreuses, puis celles de
    # rouille, plus rares : un bruit étiré en hauteur, seuillé, qu'un second
    # bruit large n'allume que par endroits
    crasse = bruit_tore(nt, 22, 2.0, 9, detail=6, rugo=0.55)
    base = melange(nt, op(nt, 'MULTIPLY', rampe(nt, crasse, 0.52, 0.66), 0.45), base, lin(FOND))
    coul = bruit_tore(nt, 16, 1.6, 3, detail=5, rugo=0.5)
    zones = bruit_tore(nt, 1.6, 1.6, 4, detail=2, rugo=0.5)
    rouille = op(nt, 'MULTIPLY', rampe(nt, coul, 0.52, 0.64), rampe(nt, zones, 0.52, 0.64))
    base = melange(nt, op(nt, 'MULTIPLY', rouille, 0.7), base, lin(ROUILLE))
    # la crasse au creux : joints, pieds des rivets, dessous des fers plats
    ao = N.new('ShaderNodeAmbientOcclusion')
    ao.inputs['Distance'].default_value = 0.012
    ao.samples = 8
    base = melange(nt, op(nt, 'MULTIPLY', op(nt, 'SUBTRACT', 1.0, ao.outputs['AO']), 0.85), base, lin(FOND))
    # l'arête usée : où la normale biseautée s'écarte de la vraie normale
    bev = N.new('ShaderNodeBevel')
    bev.inputs['Radius'].default_value = 0.0018
    geo = N.new('ShaderNodeNewGeometry')
    dot = N.new('ShaderNodeVectorMath')
    dot.operation = 'DOT_PRODUCT'
    L.new(bev.outputs[0], dot.inputs[0])
    L.new(geo.outputs['Normal'], dot.inputs[1])
    usure = bruit_tore(nt, 30, 30, 5, detail=6, rugo=0.6)
    arete = op(nt, 'MULTIPLY', rampe(nt, dot.outputs['Value'], 0.985, 0.9), rampe(nt, usure, 0.4, 0.62))
    base = melange(nt, arete, base, lin(METAL_NU))
    L.new(base, bsdf.inputs['Base Color'])
    L.new(arete, bsdf.inputs['Metallic'])
    rug = op(nt, 'MULTIPLY_ADD', grain, 0.3, 0.45)
    L.new(op(nt, 'SUBTRACT', rug, op(nt, 'MULTIPLY', arete, 0.25)), bsdf.inputs['Roughness'])
    # le relief du grain : c'est la lumière du haut qui le fait lire, bien
    # plus que sa couleur sur un acier aussi sombre
    bosse = N.new('ShaderNodeBump')
    bosse.inputs['Strength'].default_value = 0.6
    bosse.inputs['Distance'].default_value = 0.0015
    L.new(op(nt, 'ADD', pique, op(nt, 'MULTIPLY', grain, 0.5)), bosse.inputs['Height'])
    L.new(bev.outputs[0], bosse.inputs['Normal'])
    L.new(bosse.outputs[0], bsdf.inputs['Normal'])
    return mat


def mat_simple(nom, couleur, rug=0.6, metal=0.0, emission=None, force=0.0):
    mat = bpy.data.materials.new(nom)
    nt, N, L = noeuds(mat)
    out = N.new('ShaderNodeOutputMaterial')
    b = N.new('ShaderNodeBsdfPrincipled')
    L.new(b.outputs[0], out.inputs[0])
    b.inputs['Base Color'].default_value = lin(couleur)
    b.inputs['Roughness'].default_value = rug
    b.inputs['Metallic'].default_value = metal
    if emission:
        b.inputs['Emission Color'].default_value = lin(emission)
        b.inputs['Emission Strength'].default_value = force
    return mat


def mat_isolant():
    """le matelas : une toile aluminisée ternie, grise et froide"""
    mat = mat_simple('isolant', ISOLANT, rug=0.75, metal=0.2)
    nt = mat.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    sale = bruit_tore(nt, 6, 6, 6, detail=6, rugo=0.6)
    nt.links.new(melange(nt, rampe(nt, sale, 0.35, 0.75), lin(ISOLANT), lin((0x2c, 0x2e, 0x30))), b.inputs['Base Color'])
    return mat


def mat_suie():
    """un voile de suie : opaque en bas, dissous en haut, déchiqueté"""
    mat = bpy.data.materials.new('suie')
    nt, N, L = noeuds(mat)
    out = N.new('ShaderNodeOutputMaterial')
    tr = N.new('ShaderNodeBsdfTransparent')
    noir = N.new('ShaderNodeBsdfPrincipled')
    noir.inputs['Base Color'].default_value = lin((0x05, 0x05, 0x05))
    noir.inputs['Roughness'].default_value = 1.0
    # sans reflet : la peinture est si sombre que son reflet fait l'essentiel
    # de sa clarté — une suie qui reflète autant ne l'assombrissait pas
    # (essai 3, voiles invisibles)
    noir.inputs['Specular IOR Level'].default_value = 0.0
    mix = N.new('ShaderNodeMixShader')
    voile = N.new('ShaderNodeAttribute')
    voile.attribute_type = 'GEOMETRY'
    voile.attribute_name = 'voile'
    # une fumée, pas des flammes : un bruit large et doux (fin et étiré en
    # hauteur, il dessinait des langues blanches — essai du 12/11)
    dechire = bruit_tore(nt, 5, 3, 7, detail=3, rugo=0.5)
    a = op(nt, 'MULTIPLY', voile.outputs['Fac'], rampe(nt, dechire, 0.25, 0.55))
    L.new(op(nt, 'MULTIPLY', a, 0.92), mix.inputs[0])
    L.new(tr.outputs[0], mix.inputs[1])
    L.new(noir.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], out.inputs[0])
    return mat


def matieres():
    p = mat_peinture()
    return {
        'peinture': p,
        'rivet': p,
        'lame': mat_simple('lame', (0x26, 0x2b, 0x31), rug=0.55, metal=0.3),
        'fond': mat_simple('fond', FOND, rug=0.9),
        'isolant': mat_isolant(),
        # l'ambre, pas le blanc : à force 4 sur un verre pâle, la veilleuse
        # sortait blanche (essai du 12/11)
        'ambre': mat_simple('ambre', (0x6a, 0x3c, 0x0e), rug=0.2, emission=AMBRE, force=1.2),
        'suie': mat_suie(),
    }


# ----------------------------------------------------- lumière, caméra, rendu
# réglées sur la luminance des sources de la serre : la tôle tempérée livrée
# mesure 0,085 de luminance moyenne après l'assombrissement de 0,72 de
# coque2d.py, soit ~0,12 en source (mesuré le 12/11) ; le premier essai, à
# 4,0 et 0,9, mesurait 0,26 ; le second, à 2,2 et 0,3, 0,17
FORCE_HAUT = 1.6
# le débouché, partagé entre la face et le dessous (0,22 de face seule au
# premier rendu de la tôle) : une face plane reçoit la même clarté, 0,13 +
# 0,13 × cos 45°, mais le dessous d'un fût ne tombe plus dans le noir du fond
# — le détourage l'aurait mangé (colliers, aperçu du 12/11)
FORCE_FACE = 0.13
FORCE_BAS = 0.13


def lumiere_camera(sc):
    w = bpy.data.worlds.get('noir') or bpy.data.worlds.new('noir')
    try:
        w.use_nodes = True
    except AttributeError:
        pass
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0, 0, 0, 1)
    bg.inputs['Strength'].default_value = 0.0
    sc.world = w

    # LA LUMIÈRE DE LA CHARTE : froide, égale, venue du haut — un soleil (égal
    # partout : rien ne marque un endroit du carreau plus qu'un autre),
    # incliné de 50° depuis la face vers le haut : les dessus des reliefs
    # s'allument, les ombres tombent courtes vers le bas
    def soleil(nom, d, force, couleur, ombre, angle):
        l = bpy.data.lights.new(nom, 'SUN')
        l.energy = force
        l.color = couleur
        l.angle = math.radians(angle)
        l.use_shadow = ombre
        o = bpy.data.objects.new(nom, l)
        o.rotation_euler = Vector(d).normalized().to_track_quat('-Z', 'Y').to_euler()
        sc.collection.objects.link(o)

    a = math.radians(50)
    soleil('haut', (0, math.cos(a), -math.sin(a)), FORCE_HAUT, (0.86, 0.93, 1.0), True, 4)
    # le débouché de face, faible et sans ombre : sans lui, ce que le haut
    # éclaire en rasant restait d'un noir de trou
    soleil('face', (0, 1, 0), FORCE_FACE, (0.9, 0.95, 1.0), False, 10)
    b = math.radians(45)
    soleil('bas', (0, math.cos(b), math.sin(b)), FORCE_BAS, (0.9, 0.95, 1.0), False, 10)
    cam = bpy.data.cameras.new('face')
    cam.type = 'ORTHO'
    cam.ortho_scale = 1 + 2 * MARGE / PX
    co = bpy.data.objects.new('face', cam)
    co.location = (0.5, -3, 0.5)
    co.rotation_euler = (math.pi / 2, 0, 0)
    sc.collection.objects.link(co)
    sc.camera = co
    r = sc.render
    try:
        r.engine = 'CYCLES'
    except TypeError as e:
        print('moteur :', e)
    sc.cycles.samples = ECHANTILLONS
    # PAS DE DÉBRUITAGE : il gommait le grain avec le bruit, et tout sortait
    # lisse (12/11). Des échantillons à la place — la carte graphique suit
    sc.cycles.use_denoising = False
    sc.cycles.use_adaptive_sampling = False
    r.resolution_x = r.resolution_y = PX + 2 * MARGE
    r.resolution_percentage = 100
    r.film_transparent = False
    # STANDARD, pas AgX : la palette de la charte est donnée en sRGB, elle
    # doit sortir telle quelle (AgX désature et tasse les noirs)
    try:
        sc.view_settings.view_transform = 'Standard'
    except TypeError as e:
        print('vue :', e)
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0
    sc.view_settings.gamma = 1


def scene():
    vide_scene()
    sc = bpy.context.scene
    mats = matieres()
    carreau = bpy.data.collections.new('carreau')
    sc.collection.children.link(carreau)
    compte = construit(carreau, mats)
    # la tôle de fond, au fond des joints, d'un seul tenant sous les copies
    me = bpy.data.meshes.new('fond-joints')
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((0.5, FOND_Y + 0.005, 0.5)) @ Matrix.Diagonal((3, 0.01, 3, 1)))
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats['fond'])
    sc.collection.objects.link(bpy.data.objects.new('fond-joints', me))
    # les huit voisins : un panneau qui déborde, une ombre qui tombe d'une
    # rangée à l'autre, tout franchit le bord comme dans le jeu
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            if dx == 0 and dz == 0:
                continue
            e = bpy.data.objects.new(f'voisin{dx:+d}{dz:+d}', None)
            e.instance_type = 'COLLECTION'
            e.instance_collection = carreau
            e.location = (dx, 0, dz)
            sc.collection.objects.link(e)
    lumiere_camera(sc)
    return compte


def rendu(chemin, echantillons=ECHANTILLONS, pourcent=100):
    """rend, rogne la marge, écrit le carreau et le mesure : luminance (comme
    tools/images/prepare.py : moyenne Rec. 709 des valeurs sRGB), part de
    pixels chauds (charte §3 : ≤ 15 % pour une surface répétée) et RACCORD —
    l'écart entre la dernière et la première colonne (ligne) rapporté à
    l'écart moyen entre deux colonnes (lignes) voisines : ~1, rien ne se voit."""
    import numpy as np
    sc = bpy.context.scene
    sc.cycles.samples = echantillons
    sc.render.resolution_percentage = pourcent
    brut = chemin.replace('.png', '-brut.png')
    sc.render.filepath = brut
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    bpy.ops.render.render(write_still=True)
    sc.render.resolution_percentage = 100
    im = bpy.data.images.load(brut, check_existing=False)
    w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(im)
    m = round(MARGE * w / (PX + 2 * MARGE))
    c = a[m:h - m, m:w - m]
    n = c.shape[0]
    out = bpy.data.images.new('carreau', n, n, alpha=False)
    out.pixels.foreach_set(c.ravel())
    out.filepath_raw = chemin
    out.file_format = 'PNG'
    out.save()
    bpy.data.images.remove(out)
    rgb = c[..., :3]
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(2), rgb.min(2)
    chaud = ((r >= mx) & (r - b > 0.06) & ((mx - mn) / np.maximum(mx, 1e-6) > 0.25)).mean()

    def raccord(t):
        """(la mesure de prepare.py, et le RANG de la couture parmi tous les
        pas entre colonnes voisines) — prepare.py compare une seule colonne à
        une moyenne : un joint vertical qui tombe au bord la fait monter sans
        couture. Le rang tranche : une couture vraie est au-dessus de 99 %"""
        pas = np.abs(np.diff(t, axis=1)).mean(axis=(0, 2))
        bord = np.abs(t[:, -1] - t[:, 0]).mean()
        return round(float(bord / max(pas.mean(), 1 / 255)), 2), round(float((pas < bord).mean() * 100))
    rx, ry = raccord(rgb), raccord(rgb.transpose(1, 0, 2))
    return {
        'taille': n,
        'lum': round(float(lum.mean()), 3),
        'p95': round(float(np.percentile(lum, 95)), 3),
        'chauds': round(float(chaud), 3),
        'raccord_x': rx[0], 'rang_x_%': rx[1],
        'raccord_y': ry[0], 'rang_y_%': ry[1],
    }


# SEUL = False : chargé comme atelier par chaud_biome.py, qui monte tout
if globals().get('SEUL', True):
    compte = scene()
    print('scène prête :', len(bpy.data.objects), 'objets ;', compte)
