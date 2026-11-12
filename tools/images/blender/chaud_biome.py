"""LE MODULE CHAUD EN ENTIER — les douze pièces de la coque de la chaufferie
(assets-ia §35), montées dans une seule scène Blender.

Même caméra (orthographique, de face), même échelle (1024 px par largeur de
salle) et mêmes deux soleils pour toutes : seul le cadrage change. Chaque
pièce vit dans sa collection « piece-<nom> », cachée au rendu sauf quand on
la rend. L'atelier (matières, panneaux, lumière) est celui de chaud_tole.py.

  · les TÔLES (tole, tole-2, tole-machines) : carreaux d'une salle, raccord
    sur les quatre bords, fond opaque ;
  · les BORDS (bord-haut, bord-bas) : bandes de deux salles, raccord gauche /
    droite ; la ligne de coque est à z = 0 ;
  · les COLLIERS (bout-gauche, bout-droit) : ce qui dépasse de la coque, la
    ligne de coque à x = 0 ;
  · les ÉLÉMENTS (baie, baie-2, colonne, trappe, machinerie) : détourés, aux
    proportions des pièces tempérées qu'ils remplacent.

Chaque pièce sort deux fois : sur NOIR PUR (ce que lit coque2d.py) et avec
sa couche alpha (dossier alpha/), le détourage exact du rendu.

Dans Blender :
    DOSSIER = r'...\\chaud' ; exec(open(DOSSIER + r'\\chaud_biome.py').read())
    biome() ; rend('baie', DOSSIER + r'\\biome')
"""
import bpy, bmesh, math, os, json
from mathutils import Matrix, Vector

SEUL = False
_src = os.path.join(DOSSIER, 'chaud_tole.py')
exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

PIECES = {}
# le préfixe des fichiers rendus (la serre, qui charge cet atelier, le vide)
PREFIXE = 'chaud-'
BISEAU = {'peinture': 0.003, 'tuyau': 0.0015, 'lame': 0.0008}


# ------------------------------------------------- l'atelier, outils en plus
def _tube(self, mat, p0, p1, r, var=0.0, seg=24, r2=None):
    """un cylindre (ou un cône : r en p0, r2 en p1) d'un point à l'autre"""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    m = Matrix.Translation((p0 + p1) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    res = bmesh.ops.create_cone(self._bm(mat), cap_ends=True, segments=seg, radius1=r,
                                radius2=r if r2 is None else r2, depth=d.length, matrix=m)
    self._marque(mat, res['verts'], var)


def _fut(self, mat, x0, x1, r, var=0.0, y=0.0, z=0.0, seg=48):
    """un fût couché le long de x"""
    self.tube(mat, (x0, y, z), (x1, y, z), r, var, seg)


def _disque(self, mat, x, z, r, yf, yb, var=0.0, seg=40):
    self.cylindre(mat, x, z, r, yf, yb, var, seg=seg)


def _anneau(self, mat, x, z, re, ri, yf, yb, var=0.0, seg=40):
    """une couronne vue de face : re dehors, ri dedans, de yf à yb"""
    bm = self._bm(mat)
    V = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        c, s = math.cos(a), math.sin(a)
        V.append([bm.verts.new((x + r * c, y, z + r * s)) for r, y in ((re, yf), (ri, yf), (ri, yb), (re, yb))])
    faces = []
    for i in range(seg):
        A, B = V[i], V[(i + 1) % seg]
        for k in range(4):
            faces.append(bm.faces.new((A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k])))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    self._marque(mat, [v for q in V for v in q], var)


def _boulons(self, x, z, r, n, y, rr=0.004, var=0.0, phase=0.0):
    for i in range(n):
        a = 2 * math.pi * (i + phase) / n
        self.dome('rivet', x + r * math.cos(a), z + r * math.sin(a), rr, y, var)


def _objets(self, coll, mats, biseau, lisse=False, prefixe='tole'):
    for nom, bm in self.bm.items():
        me = bpy.data.meshes.new(f'{prefixe}-{nom}')
        bm.to_mesh(me)
        bm.free()
        if lisse:
            # les fûts et les couronnes : lisses, arêtes vives gardées
            me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
            try:
                me.set_sharp_from_angle(angle=math.radians(40))
            except Exception as e:
                print('lissage :', e)
        me.materials.append(mats[nom])
        ob = bpy.data.objects.new(f'{prefixe}-{nom}', me)
        coll.objects.link(ob)
        if nom in biseau:
            b = ob.modifiers.new('biseau', 'BEVEL')
            b.width = biseau[nom]
            b.segments = 2
            b.limit_method = 'ANGLE'


Atelier.tube, Atelier.fut, Atelier.disque, Atelier.anneau = _tube, _fut, _disque, _anneau
Atelier.boulons, Atelier.objets = _boulons, _objets


# ---------------------------------------------------- les matières en plus
def mat_tuyau():
    """l'acier des conduites : un cran plus clair que la peinture, encrassé"""
    mat = mat_simple('tuyau', (0x3e, 0x48, 0x54), rug=0.42, metal=0.25)
    nt = mat.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    sale = bruit_tore(nt, 9, 9, 11, detail=6, rugo=0.6)
    c = melange(nt, op(nt, 'MULTIPLY', rampe(nt, sale, 0.4, 0.7), 0.7), lin((0x3e, 0x48, 0x54)), lin(FOND))
    rouil = bruit_tore(nt, 14, 5, 12, detail=4, rugo=0.5)
    c = melange(nt, op(nt, 'MULTIPLY', rampe(nt, rouil, 0.6, 0.72), 0.6), c, lin(ROUILLE))
    nt.links.new(c, b.inputs['Base Color'])
    return mat


def mat_rayures():
    """les bandes de danger : un ocre terne (pas l'ambre, réservé à ce qui
    luit), en biais, période d'un 32e de salle — entière, donc raccordable"""
    mat = mat_simple('rayures', (0x80, 0x62, 0x20), rug=0.7)
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    b = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
    geo = N.new('ShaderNodeNewGeometry')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(geo.outputs['Position'], sep.inputs[0])
    t = op(nt, 'FRACT', op(nt, 'MULTIPLY', op(nt, 'ADD', sep.outputs['X'], sep.outputs['Z']), 32))
    raie = op(nt, 'GREATER_THAN', t, 0.5)
    c = melange(nt, raie, lin((0x80, 0x62, 0x20)), lin((0x0c, 0x0d, 0x0f)))
    use = bruit_tore(nt, 20, 20, 13, detail=6, rugo=0.6)
    c = melange(nt, op(nt, 'MULTIPLY', rampe(nt, use, 0.35, 0.65), 0.6), c, lin(FOND))
    L.new(c, b.inputs['Base Color'])
    return mat


def mat_braise():
    """une résistance : elle ne rougeoie pas partout pareil — du rouge sombre
    à l'orange clair le long du barreau (uniforme, elle faisait un néon,
    aperçu du 12/11)"""
    mat = mat_simple('braise', (0x40, 0x18, 0x06), rug=0.5, emission=(0xe8, 0x80, 0x1a), force=1.0)
    nt = mat.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    chaud = rampe(nt, bruit_tore(nt, 7, 7, 14, detail=3, rugo=0.5), 0.3, 0.7)
    nt.links.new(melange(nt, chaud, lin((0xb8, 0x4a, 0x10)), lin((0xf0, 0x9a, 0x2a))), b.inputs['Emission Color'])
    nt.links.new(op(nt, 'MULTIPLY_ADD', chaud, 0.9, 0.45), b.inputs['Emission Strength'])
    return mat


def matieres_biome():
    m = matieres()
    m['tuyau'] = mat_tuyau()
    m['rayures'] = mat_rayures()
    # ce qui chauffe (charte §3) : les résistances, derrière leurs lames
    m['braise'] = mat_braise()
    # le trait de coque : le cyan de la charte, terni
    m['cyan'] = mat_simple('cyan', (0x4a, 0x94, 0xbe), rug=0.6)
    return m


# ------------------------------------------------------------ les collections
def parent(sc, nom):
    P = bpy.data.collections.new('piece-' + nom)
    sc.collection.children.link(P)
    P.hide_render = True
    return P


def sous(P, nom):
    c = bpy.data.collections.new(nom)
    P.children.link(c)
    return c


def copies(P, motif, decalages):
    for dx, dz in decalages:
        e = bpy.data.objects.new(f'{motif.name}{dx:+g}{dz:+g}', None)
        e.instance_type = 'COLLECTION'
        e.instance_collection = motif
        e.location = (dx, 0, dz)
        P.objects.link(e)


def declare(nom, P, x0, x1, z0, z1, mx=0, mz=0, alpha=True, ancres=None):
    PIECES[nom] = dict(nom=nom, coll=P, x0=x0, x1=x1, z0=z0, z1=z1, mx=mx, mz=mz, alpha=alpha, ancres=ancres or {})


# ------------------------------------------------------------------ les tôles
def boitier(at, x0, x1, z0, z1, yf, var, fin):
    """une boîte de jonction et ses deux conduites qui descendent"""
    plaque(at, x0, x1, z0, z1, yf, var)
    bx = x0 + (x1 - x0) * fin.choice((0.3, 0.5, 0.7))
    bz = z1 - 0.042
    at.boite('peinture', bx - 0.028, bx + 0.028, bz - 0.022, bz + 0.022, yf - 0.016, yf, var + 0.3)
    for dx in (-0.012, 0.012):
        at.tube('tuyau', (bx + dx, yf - 0.007, bz - 0.022), (bx + dx, yf - 0.007, z0 + 0.02), 0.006, seg=12)
        at.boite('peinture', bx + dx - 0.009, bx + dx + 0.009, z0 + 0.013, z0 + 0.025, yf - 0.015, yf, var)


def rayee(at, x0, x1, z0, z1, yf, var, fin):
    plaque(at, x0, x1, z0, z1, yf, var)
    zc = (z0 + z1) / 2
    at.boite('rayures', x0 + 0.022, x1 - 0.022, zc - 0.014, zc + 0.014, yf - 0.003, yf, var)


def grille(at, x0, x1, z0, z1, yf, var, fin):
    """un caillebotis sur un puits sombre"""
    m = 0.014
    cadre(at, x0, x1, z0, z1, yf, var, m)
    rivets(at, x0, x1, z0, z1, yf, var, retrait=0.007, pas=0.04, r=0.0026)
    at.boite('fond', x0 + m, x1 - m, z0 + m, z1 - m, 0.012, FOND_Y, 0)
    pas = 0.011
    x = x0 + m + pas / 2
    while x < x1 - m:
        at.boite('lame', x - 0.0016, x + 0.0016, z0 + m, z1 - m, yf + 0.003, yf + 0.008, var)
        x += pas
    z = z0 + m + pas / 2
    while z < z1 - m:
        at.boite('lame', x0 + m, x1 - m, z - 0.0016, z + 0.0016, yf + 0.002, yf + 0.006, var)
        z += pas


def traits_cyan(at, poses, fin):
    for (x0, x1, z0, z1), yf in poses[:3]:
        at.boite('cyan', x0 + 0.02, x0 + 0.02 + min(0.07, (x1 - x0) * 0.4), z0 + 0.02, z0 + 0.024, yf - 0.001, yf, 0)


def tuile(sc, mats, nom, **kw):
    P = parent(sc, nom)
    C = sous(P, nom + '-carreau')
    compte = construit(C, mats, **kw)
    me = bpy.data.meshes.new(nom + '-fond')
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((0.5, FOND_Y + 0.005, 0.5)) @ Matrix.Diagonal((3, 0.01, 3, 1)))
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats['fond'])
    P.objects.link(bpy.data.objects.new(nom + '-fond', me))
    copies(P, C, [(dx, dz) for dx in (-1, 0, 1) for dz in (-1, 0, 1) if dx or dz])
    declare(nom, P, 0, 1, 0, 1, mx=MARGE, mz=MARGE, alpha=False)
    return compte


# ------------------------------------------------------------------ les bords
def fenetre_braise(at, x0, x1, z0, z1, y, pas=0.027):
    """des barres qui rougeoient à l'horizontale derrière des lames verticales
    (la rampe de résistances de la chaudière, docs/reference/
    chaudiere-reference.webp) — y : le fond, les lames 18 mm devant"""
    at.boite('fond', x0, x1, z0, z1, y, y + 0.004, 0)
    h = z1 - z0
    for t in ((0.33, 0.67) if h < 0.16 else (0.2, 0.4, 0.6, 0.8)):
        at.tube('braise', (x0, y - 0.007, z0 + h * t), (x1, y - 0.007, z0 + h * t), 0.0055, seg=12)
    n = max(2, round((x1 - x0) / pas))
    for k in range(n):
        x = x0 + (k + 0.5) * (x1 - x0) / n
        at.boite('lame', x - 0.0045, x + 0.0045, z0, z1, y - 0.018, y - 0.011, 0)


def bord_haut(sc, mats):
    """LE REBORD DU HAUT : la lèvre de coque, puis le rail des résistances —
    ce que la serre a en vitrage de culture — et une conduite dessous.
    z = 0 : la ligne de coque ; le dedans est dessous."""
    L = 2.0
    P = parent(sc, 'bord-haut')
    lg, mo = Atelier(), Atelier()
    lg.boite('peinture', -L, 2 * L, -0.28, 0.0, 0.0, 0.02, -0.3)
    lg.boite('peinture', -L, 2 * L, -0.03, 0.0, -0.03, 0.0, 0.2)
    lg.boite('cyan', -L, 2 * L, -0.047, -0.042, -0.001, 0.0, 0)
    for z0, z1 in ((-0.076, -0.06), (-0.2, -0.184)):
        lg.boite('peinture', -L, 2 * L, z0, z1, -0.024, 0.0, 0.1)
    lg.tube('tuyau', (-L, -0.015, -0.234), (2 * L, -0.015, -0.234), 0.013)
    n = 5
    pas = L / n
    for i in range(n):
        x0 = i * pas
        # le montant, à cheval sur le bord du motif : sa copie le referme
        mo.boite('peinture', x0 - 0.035, x0 + 0.035, -0.2, -0.06, -0.028, 0.0, 0.4)
        for z in (-0.068, -0.192):
            mo.cylindre('peinture', x0, z, 0.006, -0.032, -0.028, 0.4, seg=6)
        if i % 2:
            voyant(mo, x0, -0.13, -0.028)
        mo.boite('peinture', x0 - 0.011, x0 + 0.011, -0.256, -0.212, -0.034, 0.0, 0.3)
        a, b = x0 + 0.035, x0 + pas - 0.035
        if i == 3:
            # une baie condamnée : une plaque rivée à la place des résistances
            mo.boite('peinture', a, b, -0.184, -0.076, -0.014, 0.0, -0.8)
            rivets(mo, a, b, -0.184, -0.076, -0.014, -0.8, retrait=0.009, pas=0.04, r=0.003)
        else:
            fenetre_braise(mo, a, b, -0.184, -0.076, -0.004)
        mo.fut('tuyau', x0 + pas / 2 - 0.01, x0 + pas / 2 + 0.01, 0.02, 0, -0.015, -0.234, seg=20)
        k = 8
        for j in range(k):
            mo.dome('rivet', x0 + (j + 0.5) * pas / k, -0.015, 0.0036, -0.03, 0.2)
    lg.objets(P, mats, BISEAU, True, 'bord-haut-long')
    M = sous(P, 'bord-haut-motif')
    mo.objets(M, mats, BISEAU, True, 'bord-haut')
    copies(P, M, [(-L, 0), (L, 0)])
    declare('bord-haut', P, 0, L, -0.26, 0.04, mx=MARGE,
            ancres={'ligne_de_coque_depuis_le_haut': 0.04, 'dedans': 0.26, 'dehors': 0.0, 'periode': L})


def bord_bas(sc, mats):
    """LA QUILLE : la poutre de coque, une grosse conduite, un treillis, et
    les tuyères qui dépassent dessous, la gueule rougie. z = 0 : la ligne de
    coque ; le dedans est dessus."""
    L = 2.0
    P = parent(sc, 'bord-bas')
    lg, mo = Atelier(), Atelier()
    lg.boite('peinture', -L, 2 * L, 0.0, 0.22, 0.0, 0.02, -0.3)
    lg.boite('peinture', -L, 2 * L, 0.0, 0.035, -0.035, 0.0, 0.2)
    lg.boite('cyan', -L, 2 * L, 0.042, 0.047, -0.001, 0.0, 0)
    lg.tube('tuyau', (-L, -0.021, 0.08), (2 * L, -0.021, 0.08), 0.02)
    for z0, z1 in ((0.108, 0.12), (0.166, 0.18)):
        lg.boite('peinture', -L, 2 * L, z0, z1, -0.02, 0.0, 0.1)
    ang = math.atan2(0.046, 0.1)
    for k in range(20):
        xc = k * 0.1 + 0.05
        mo.boite('peinture', xc - 0.056, xc + 0.056, 0.14, 0.146, -0.013, -0.005, 0.0,
                 rot=Matrix.Rotation(ang if k % 2 else -ang, 4, 'Y'))
        mo.dome('rivet', k * 0.1, 0.114, 0.0032, -0.02, 0.1)
        mo.dome('rivet', k * 0.1, 0.173, 0.0032, -0.02, 0.1)
    for i in range(4):
        x = i * 0.5
        mo.boite('peinture', x - 0.012, x + 0.012, 0.048, 0.112, -0.046, 0.0, 0.3)
        mo.fut('tuyau', x + 0.238, x + 0.262, 0.028, 0, -0.021, 0.08, seg=24)
    for j in range(40):
        mo.dome('rivet', (j + 0.5) * 0.05, 0.0175, 0.0036, -0.035, 0.2)
    for x in (0.3, 0.95, 1.55):
        mo.boite('peinture', x - 0.05, x + 0.05, 0.0, 0.035, -0.05, 0.0, 0.5)
        mo.tube('tuyau', (x, -0.03, 0.0), (x, -0.03, -0.014), 0.03, seg=24)
        mo.tube('tuyau', (x, -0.03, -0.012), (x, -0.03, -0.085), 0.021, seg=24, r2=0.04)
        mo.tube('braise', (x, -0.03, -0.0852), (x, -0.03, -0.0885), 0.034, seg=24)
    lg.objets(P, mats, BISEAU, True, 'bord-bas-long')
    M = sous(P, 'bord-bas-motif')
    mo.objets(M, mats, BISEAU, True, 'bord-bas')
    copies(P, M, [(-L, 0), (L, 0)])
    declare('bord-bas', P, 0, L, -0.1, 0.2, mx=MARGE,
            ancres={'ligne_de_coque_depuis_le_haut': 0.2, 'dedans': 0.2, 'dehors': 0.1, 'periode': L})


# ---------------------------------------------------------------- les colliers
def _collier(sc, mats, nom, futs, s, nervure, lampes_x, boulons_x):
    """des fûts couchés le long de x, vus de profil ; s = -1 : le dehors est à
    gauche (l'entrée), +1 : à droite (la sortie)"""
    P = parent(sc, nom)
    at = Atelier()
    for x0, x1, r, mat, var in futs:
        at.fut(mat, min(x0, x1), max(x0, x1), r, var)
    # des nervures le long du fût étroit, des boulons sur la bride
    x0, x1, r = nervure
    for a in (-60, -30, 0, 30, 60):
        c, sn = math.cos(math.radians(a)), math.sin(math.radians(a))
        at.boite('peinture', min(x0, x1), max(x0, x1), r * sn - 0.007, r * sn + 0.007, -r * c - 0.008, -r * c + 0.004, 0.2)
    for bx, br in boulons_x:
        for a in range(-80, 81, 16):
            c, sn = math.cos(math.radians(a)), math.sin(math.radians(a))
            at.dome('rivet', bx, br * sn, 0.0055, -br * c, 0.1, aplati=1.0)
    for z in (-0.2, 0.2):
        y = -math.sqrt(0.4 ** 2 - z ** 2)
        at.cylindre('ambre', lampes_x, z, 0.008, y - 0.005, y + 0.004, 0, seg=16)
    at.objets(P, mats, BISEAU, True, nom)
    xa, xb = (-0.44, 0.1) if s < 0 else (-0.1, 0.44)
    declare(nom, P, xa, xb, -0.42, 0.42,
            ancres={'ligne_de_coque_depuis_la_gauche': -xa, 'morsure': 0.1, 'dehors': 0.44, 'hauteur': 0.84})


def colliers(sc, mats):
    _collier(sc, mats, 'bout-gauche', [
        (-0.06, 0.1, 0.4, 'peinture', 0.1),
        (-0.1, -0.06, 0.36, 'tuyau', 0),
        (-0.3, -0.1, 0.33, 'peinture', -0.5),
        (-0.2, -0.165, 0.36, 'tuyau', 0),
        (-0.277, -0.265, 0.3315, 'cyan', 0),
        (-0.345, -0.3, 0.36, 'peinture', 0.4),
        (-0.42, -0.345, 0.3, 'tuyau', 0),
    ], -1, (-0.3, -0.2, 0.33), 0.06, [(-0.03, 0.4), (-0.3225, 0.36)])
    _collier(sc, mats, 'bout-droit', [
        (-0.1, 0.05, 0.4, 'peinture', 0.1),
        (0.05, 0.2, 0.37, 'peinture', -0.3),
        (0.105, 0.145, 0.3715, 'rayures', 0),
        (0.2, 0.245, 0.4, 'tuyau', 0),
        (0.245, 0.37, 0.29, 'peinture', 0.5),
        (0.3, 0.312, 0.2915, 'cyan', 0),
        (0.37, 0.42, 0.32, 'tuyau', 0),
    ], 1, (0.245, 0.3, 0.29), -0.06, [(0.0, 0.4), (0.2225, 0.4)])


# --------------------------------------------------------------- les éléments
def baie(sc, mats):
    """LA GRANDE BAIE : trois travées de résistances derrière leurs lames"""
    P = parent(sc, 'baie')
    at = Atelier()
    W, H = 0.475, 0.1875
    m = 0.04
    cadre(at, -W, W, -H, H, -0.035, 0.1, m)
    rivets(at, -W, W, -H, H, -0.035, 0.1, retrait=0.012, pas=0.05, r=0.0042)
    at.boite('fond', -W + m, W - m, -H + m, H - m, -0.002, 0.02, 0)
    for xm in (-0.145, 0.145):
        at.boite('peinture', xm - 0.016, xm + 0.016, -H + m, H - m, -0.03, 0.0, 0.4)
    for xa, xb in ((-W + m, -0.161), (-0.129, 0.129), (0.161, W - m)):
        fenetre_braise(at, xa, xb, -H + m, H - m, -0.004)
        voyant(at, (xa + xb) / 2, H - m / 2, -0.035)
    for sx in (-1, 1):
        for sz in (-1, 1):
            cx, cz = sx * (W - 0.03), sz * (H - 0.03)
            at.boite('peinture', cx - 0.03, cx + 0.03, cz - 0.03, cz + 0.03, -0.043, -0.03, 0.6)
            at.cylindre('peinture', cx, cz, 0.009, -0.049, -0.043, 0.6, seg=6)
    at.boite('cyan', -W + 0.017, -W + 0.022, -0.09, 0.09, -0.036, -0.035, 0)
    at.objets(P, mats, dict(BISEAU, peinture=0.004), True, 'baie')
    declare('baie', P, -W, W, -H, H, ancres={'largeur_posee': 0.95})


def baie2(sc, mats):
    """LA RANGÉE DE REGARDS : quatre hublots de chaudière"""
    P = parent(sc, 'baie-2')
    at = Atelier()
    W, H = 0.45, 0.145
    at.boite('peinture', -W, W, -H, H, -0.02, 0.02, -0.2)
    cadre(at, -W, W, -H, H, -0.032, 0.2, 0.02)
    rivets(at, -W, W, -H, H, -0.032, 0.2, retrait=0.01, pas=0.05, r=0.0036)
    for i in range(4):
        x = -0.3375 + i * 0.225
        at.anneau('peinture', x, 0, 0.1, 0.076, -0.046, -0.02, 0.5)
        at.boulons(x, 0, 0.088, 8, -0.046, rr=0.0045, var=0.5, phase=0.5)
        at.disque('fond', x, 0, 0.077, -0.022, -0.02, 0)
        for dz in (-0.045, -0.015, 0.015, 0.045):
            d = math.sqrt(0.072 ** 2 - dz ** 2)
            at.tube('braise', (x - d, -0.028, dz), (x + d, -0.028, dz), 0.0055, seg=12)
        for dx in (-0.036, 0, 0.036):
            d = math.sqrt(0.076 ** 2 - dx ** 2)
            at.boite('lame', x + dx - 0.0045, x + dx + 0.0045, -d, d, -0.041, -0.034, 0)
        if i < 3:
            voyant(at, x + 0.1125, 0.1, -0.02)
    for sx in (-1, 1):
        at.boite('cyan', sx * (W - 0.035) - 0.0025, sx * (W - 0.035) + 0.0025, -0.07, 0.07, -0.021, -0.02, 0)
    at.objets(P, mats, dict(BISEAU, peinture=0.004), True, 'baie-2')
    declare('baie-2', P, -W, W, -H, H, ancres={'largeur_posee': 0.9})


def colonne(sc, mats):
    """LA COLONNE : un échangeur debout, ses barreaux entre deux conduites"""
    P = parent(sc, 'colonne')
    at = Atelier()
    W, H = 0.157, 0.512
    at.boite('peinture', -W, W, -H, H, -0.02, 0.02, -0.2)
    cadre(at, -W, W, -H, H, -0.034, 0.2, 0.03)
    rivets(at, -W, W, -H, H, -0.034, 0.2, retrait=0.012, pas=0.05, r=0.0038)
    at.boite('fond', -0.085, 0.085, -0.44, 0.44, -0.022, -0.02, 0)
    z = -0.42
    while z <= 0.4201:
        at.tube('braise', (-0.05, -0.029, z), (0.05, -0.029, z), 0.005, seg=12)
        z += 0.04
    for x in (-0.058, 0.058):
        at.tube('tuyau', (x, -0.034, -0.44), (x, -0.034, 0.44), 0.012)
    for zc in (-0.33, -0.11, 0.11, 0.33):
        at.boite('peinture', -0.105, 0.105, zc - 0.012, zc + 0.012, -0.05, -0.02, 0.5)
        for x in (-0.09, 0.09):
            at.cylindre('peinture', x, zc, 0.007, -0.055, -0.05, 0.5, seg=6)
    for sz in (-1, 1):
        at.boite('peinture', -0.11, 0.11, sz * 0.46 - 0.022, sz * 0.46 + 0.022, -0.046, -0.02, 0.6)
        voyant(at, 0, sz * 0.46, -0.046)
    at.boite('cyan', W - 0.019, W - 0.014, -0.2, 0.2, -0.035, -0.034, 0)
    at.objets(P, mats, dict(BISEAU, peinture=0.004), True, 'colonne')
    declare('colonne', P, -W, W, -H, H, ancres={'hauteur_sur_largeur': H / W})


def trappe_ronde(sc, mats):
    """LA TRAPPE : une porte de foyer ronde, son volant, deux regards"""
    P = parent(sc, 'trappe')
    at = Atelier()
    at.disque('peinture', 0, 0, 0.25, -0.02, 0.02, 0.1, seg=64)
    at.anneau('peinture', 0, 0, 0.25, 0.205, -0.04, -0.02, 0.4, seg=64)
    at.boulons(0, 0, 0.228, 16, -0.04, rr=0.0055, var=0.4, phase=0.5)
    at.disque('peinture', 0, 0, 0.192, -0.03, -0.02, -0.5, seg=64)
    at.anneau('rayures', 0, 0, 0.186, 0.156, -0.033, -0.03, 0, seg=64)
    for a in range(4):
        r = Matrix.Rotation(a * math.pi / 2, 4, 'Y')
        # quatre verrous : le même, tourné d'un quart de tour autour du centre
        c = r @ Vector((0, 0, 0.212))
        horiz = a % 2
        w, h = (0.036, 0.03) if horiz else (0.03, 0.036)
        at.boite('peinture', c.x - w, c.x + w, c.z - h, c.z + h, -0.056, -0.02, 0.7)
        at.cylindre('peinture', c.x, c.z, 0.012, -0.064, -0.056, 0.7, seg=6)
    at.disque('peinture', 0, 0, 0.04, -0.05, -0.03, 0.3)
    at.anneau('tuyau', 0, 0, 0.088, 0.072, -0.062, -0.05, 0)
    for k in range(3):
        at.boite('tuyau', -0.078, 0.078, -0.006, 0.006, -0.058, -0.051, 0, rot=Matrix.Rotation(k * math.pi / 3, 4, 'Y'))
    at.disque('tuyau', 0, 0, 0.022, -0.068, -0.05, 0)
    for x in (-0.122, 0.122):
        at.anneau('peinture', x, 0, 0.02, 0.009, -0.042, -0.03, 0.6, seg=24)
        at.disque('braise', x, 0, 0.0095, -0.034, -0.03, 0, seg=24)
    at.objets(P, mats, dict(BISEAU, peinture=0.004), True, 'trappe')
    declare('trappe', P, -0.25, 0.25, -0.25, 0.25, ancres={'largeur_posee': 0.5})


def machinerie(sc, mats):
    """LA MACHINERIE : deux ballons, un corps de chauffe entre eux, le
    collecteur dessus, le tout sur son châssis"""
    P = parent(sc, 'machinerie')
    at = Atelier()
    Z0 = -0.2075
    at.boite('peinture', -0.385, 0.385, Z0, -0.172, -0.13, 0.0, 0.3)
    rivets(at, -0.385, 0.385, Z0, -0.172, -0.13, 0.3, retrait=0.01, pas=0.06, r=0.004)
    at.boite('cyan', -0.3, 0.3, -0.1915, -0.1875, -0.131, -0.13, 0)
    at.boite('peinture', -0.31, 0.31, -0.172, 0.15, -0.012, 0.0, -0.7)
    for x in (-0.235, 0.235):
        at.tube('peinture', (x, -0.085, -0.172), (x, -0.085, 0.1), 0.08, 0.2 if x < 0 else -0.2, seg=40)
        at.coussin('peinture', x, 0.1, 0.08, 0.036, 0.08, -0.085, 0.2 if x < 0 else -0.2)
        for zb in (-0.1, 0.03):
            at.tube('tuyau', (x, -0.085, zb), (x, -0.085, zb + 0.016), 0.084, seg=40)
        at.tube('tuyau', (x, -0.085, 0.125), (x, -0.085, 0.185), 0.02)
        at.tube('tuyau', (x, -0.085, 0.15), (x, -0.085, 0.16), 0.03)
        at.coussin('tuyau', x, 0.185, 0.02, 0.02, 0.02, -0.085, 0)
        at.cylindre('ambre', x, -0.04, 0.008, -0.17, -0.16, 0, seg=16)
        s = 1 if x > 0 else -1
        at.fut('tuyau', min(x + s * 0.07, s * 0.41), max(x + s * 0.07, s * 0.41), 0.022, 0, -0.085, -0.06, seg=24)
        at.fut('tuyau', min(s * 0.385, s * 0.41), max(s * 0.385, s * 0.41), 0.032, 0, -0.085, -0.06, seg=24)
        at.fut('tuyau', min(x + s * 0.07, s * 0.39), max(x + s * 0.07, s * 0.39), 0.014, 0, -0.085, -0.135, seg=20)
        at.anneau('tuyau', s * 0.345, -0.06, 0.03, 0.022, -0.126, -0.118, 0, seg=24)
        at.disque('tuyau', s * 0.345, -0.06, 0.008, -0.13, -0.107, 0, seg=12)
        for k in range(2):
            at.boite('tuyau', s * 0.345 - 0.026, s * 0.345 + 0.026, -0.063, -0.057, -0.124, -0.119, 0, rot=Matrix.Rotation(k * math.pi / 2, 4, 'Y'))
    at.fut('tuyau', -0.235, 0.235, 0.018, 0, -0.085, 0.185, seg=24)
    # le corps de chauffe
    cadre(at, -0.115, 0.115, -0.165, 0.115, -0.09, 0.5, 0.02)
    rivets(at, -0.115, 0.115, -0.165, 0.115, -0.09, 0.5, retrait=0.01, pas=0.045, r=0.0036)
    fenetre_braise(at, -0.095, 0.095, -0.145, 0.095, -0.04, pas=0.022)
    at.boite('peinture', -0.135, 0.135, 0.115, 0.158, -0.1, 0.0, 0.7)
    for x in (-0.09, 0.09):
        voyant(at, x, 0.137, -0.1)
    at.tube('tuyau', (0, -0.085, 0.158), (0, -0.085, 0.185), 0.016)
    at.objets(P, mats, dict(BISEAU, peinture=0.004), True, 'machinerie')
    declare('machinerie', P, -0.41, 0.41, Z0, 0.2075, ancres={'largeur_posee': 0.8})


# -------------------------------------------------------------------- la scène
def biome():
    vide_scene()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_biome()
    c = {}
    c['tole'] = tuile(sc, mats, 'tole')
    c['tole-2'] = tuile(sc, mats, 'tole-2', graine=34)
    # la salle des machines : plus serrée, des boîtes de jonction, des
    # caillebotis, des bandes de danger — et les traits cyan de la charte
    c['tole-machines'] = tuile(
        sc, mats, 'tole-machines', graine=55,
        tirage=[(0.16, 'event', 0.14, 0.22, 0.14), (0.32, 'nervures', 0.16, 9, 0), (0.46, 'grille', 0.14, 0.26, 0.12),
                (0.62, 'boitier', 0.14, 9, 0.14), (0.72, 'rayee', 0.16, 9, 0), (0.84, 'trappe', 0.14, 9, 0)],
        hauteurs=[0.13, 0.17, 0.12, 0.2, 0.15, 0.11, 0.12], largeurs=[0.1, 0.14, 0.18, 0.22, 0.26],
        extra={'boitier': boitier, 'rayee': rayee, 'grille': grille}, apres=traits_cyan)
    bord_haut(sc, mats)
    bord_bas(sc, mats)
    colliers(sc, mats)
    baie(sc, mats)
    baie2(sc, mats)
    colonne(sc, mats)
    trappe_ronde(sc, mats)
    machinerie(sc, mats)
    lumiere_camera(sc)
    return c


def rend(nom, sortie, echantillons=ECHANTILLONS, pourcent=100):
    """rend UNE pièce : cadre la caméra sur elle (l'échelle ne bouge pas : 1024
    px par salle), cache les autres, rogne la marge, écrit la version sur noir
    et la version détourée, et mesure."""
    import numpy as np
    sc = bpy.context.scene
    p = PIECES[nom]
    for q in PIECES.values():
        # (par collection : plusieurs pièces peuvent cadrer la même, découpée)
        q['coll'].hide_render = q['coll'] is not p['coll']
    w = p['x1'] - p['x0'] + 2 * p['mx'] / PX
    h = p['z1'] - p['z0'] + 2 * p['mz'] / PX
    cam = sc.camera
    cam.data.ortho_scale = max(w, h)
    cam.location = ((p['x0'] + p['x1']) / 2, -3, (p['z0'] + p['z1']) / 2)
    r = sc.render
    r.resolution_x, r.resolution_y = round(w * PX), round(h * PX)
    r.resolution_percentage = pourcent
    r.film_transparent = p['alpha']
    sc.cycles.samples = echantillons
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    brut = os.path.join(sortie, 'brut', f'{PREFIXE}{nom}.png')
    r.filepath = brut
    bpy.ops.render.render(write_still=True)
    r.resolution_percentage = 100
    im = bpy.data.images.load(brut, check_existing=False)
    W, H = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(H, W, 4)
    bpy.data.images.remove(im)
    k = pourcent / 100
    mx, mz = round(p['mx'] * k), round(p['mz'] * k)
    a = a[mz:H - mz, mx:W - mx]
    H, W = a.shape[:2]
    al = a[..., 3:4] if p['alpha'] else np.ones((H, W, 1), np.float32)
    noir = np.concatenate([a[..., :3] * al, np.ones((H, W, 1), np.float32)], axis=2)

    def ecrit(chemin, t, alpha):
        o = bpy.data.images.new('sortie', W, H, alpha=alpha)
        o.pixels.foreach_set(np.ascontiguousarray(t, dtype=np.float32).ravel())
        o.filepath_raw = chemin
        o.file_format = 'PNG'
        o.save()
        bpy.data.images.remove(o)
    ecrit(os.path.join(sortie, f'{PREFIXE}{nom}.png'), noir, False)
    if p['alpha']:
        ecrit(os.path.join(sortie, 'alpha', f'{PREFIXE}{nom}.png'), np.concatenate([a[..., :3], al], axis=2), True)
    rgb = a[..., :3]
    poids = al[..., 0]
    tot = max(float(poids.sum()), 1.0)
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    mxc, mnc = rgb.max(2), rgb.min(2)
    chaud = (rgb[..., 0] >= mxc) & (rgb[..., 0] - rgb[..., 2] > 0.06) & ((mxc - mnc) / np.maximum(mxc, 1e-6) > 0.25)
    m = {'nom': nom, 'taille': [W, H], 'lum': round(float((lum * poids).sum() / tot), 3),
         'chauds': round(float((chaud * poids).sum() / tot), 3), 'plein': round(tot / (W * H), 3), 'ancres': p['ancres']}

    def raccord(t):
        pas = np.abs(np.diff(t, axis=1)).mean(axis=(0, 2))
        bord = np.abs(t[:, -1] - t[:, 0]).mean()
        return [round(float(bord / max(pas.mean(), 1 / 255)), 2), round(float((pas < bord).mean() * 100))]
    if p['mx']:
        m['raccord_x'] = raccord(noir[..., :3])
    if p['mz']:
        m['raccord_y'] = raccord(noir[..., :3].transpose(1, 0, 2))
    return m


def lance(noms, sortie, echantillons=ECHANTILLONS, pourcent=100):
    """rend les pièces une à une SANS bloquer l'appel : un minuteur de Blender
    prend la suite, écrit journal.jsonl à mesure et fini.txt au bout — un rendu
    long coupait la liaison avec l'appelant (12/11)"""
    import time
    file = list(noms)
    journal = os.path.join(sortie, 'journal.jsonl')
    for f in (journal, os.path.join(sortie, 'fini.txt')):
        if os.path.exists(f):
            os.remove(f)

    def pas():
        if not file:
            open(os.path.join(sortie, 'fini.txt'), 'w').write('fini')
            return None
        n = file.pop(0)
        t = time.time()
        try:
            m = rend(n, sortie, echantillons, pourcent)
            m['secondes'] = round(time.time() - t, 1)
        except Exception as e:
            import traceback
            m = {'nom': n, 'erreur': repr(e), 'trace': traceback.format_exc()[-600:]}
        open(journal, 'a', encoding='utf-8').write(json.dumps(m, ensure_ascii=False) + '\n')
        return 0.2
    bpy.app.timers.register(pas, first_interval=0.5)
