"""LA SERRE ORBITALE, REFAITE DANS BLENDER — toutes les pièces du cylindre de
culture (assets-ia §35).

Deux défauts de la serre peinte par générateur, et ce qui y répond ici :
  · la RÉPÉTITION (deux bandes d'étagère pour tout le cylindre) : chaque bande
    est plantée par un tirage, on en rend autant qu'on veut au même gabarit ;
  · un décor que personne n'habite : la serre est un LIEU DE TRAVAIL, en
    orbite — une bande sur trois porte une passerelle et un poste (analyse,
    nutriments, semis), les cloisons entre capsules ont leur échelle et leur
    porte étanche, le berceau sa coursive. Aucun outil de jardin terrestre :
    culture hors-sol, bonbonnes sanglées, caisses à loquets, consoles à tube.

Même atelier que la chaufferie (chaud_biome.py : caméra de face, 1024 px par
salle, mêmes soleils). L'échelle humaine : 1 m = 0,244 salle (une bande
d'étagère, 274 px, vaut 1,1 m ; une personne 0,44 salle).

LE VÉGÉTAL est fait de modèles de Poly Haven (CC0), importés une fois dans
la scène par l'addon : fern_02, anthurium_botany_01, calathea_orbifolia_01,
nettle_plant, shrub_04, shrub_01, pachira_aquatica_01. Chaque plant en est
une copie liée, tournée, mise à l'échelle.

Les pièces :
  serre-bas, serre-haut (2048 × 255 et 429) : la poutre de coque et la
    première / dernière culture ; raccord gauche-droite (période 2 salles) ;
  serre-bande-<culture> et serre-poste-<poste> (2048 × 274) : s'empilent dans
    n'importe quel ordre — chacune va du substrat d'un bac au dessus du bac
    suivant ;
  serre-anneau (218 × 1516) : la cloison, découpée en bas / bande / haut ;
  serre-berceau, serre-dome-gauche, serre-dome-droit, serre-cellule.

Dans Blender :
    DOSSIER = r'...' ; exec(open(DOSSIER + r'\\serre.py').read())
    serre() ; lance(list(PIECES), DOSSIER + r'\\serre')
"""
import bpy, bmesh, math, os, random
from mathutils import Matrix, Vector

_src = os.path.join(DOSSIER, 'chaud_biome.py')
exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

PREFIXE = ''
L = 2.0                 # la période des bandes, en salles
M_ = 0.244              # un mètre
H_BAS, H_BANDE, H_HAUT = 255 / 1024, 274 / 1024, 429 / 1024
H_BAC = 0.058           # un bac de culture
H_POUTRE = 0.15         # la poutre de coque, en haut et en bas
F = -1.0                # le tirage « froid » de la peinture : pas de patine brune

BIBLIOTHEQUES = ('fern_02', 'anthurium_botany_01', 'calathea_orbifolia_01', 'nettle_plant', 'shrub_04', 'shrub_01',
                 'pachira_aquatica_01', 'watering_can_metal_01', 'garden_hose_wall_mounted_01', 'Barrel_02',
                 'rusted_spade_01', 'metal_jerrycan_green', 'potted_plant_01', 'potted_plant_02')
MODELES = {
    'feuillus': ('anthurium_botany_01_a', 'anthurium_botany_01_b', 'anthurium_botany_01_c', 'anthurium_botany_04_d',
                 'calathea_orbifolia_01_a', 'calathea_orbifolia_01_b', 'calathea_orbifolia_01_c'),
    'fougeres': ('fern_02_a', 'fern_02_b', 'fern_02_c', 'fern_02_d', 'fern_02_b', 'fern_02_c', 'calathea_orbifolia_01_d'),
    'aromates': ('nettle_plant_tall_a_LOD0', 'nettle_plant_tall_b_LOD0', 'nettle_plant_medium_a_LOD0', 'shrub_04_a_LOD0',
                 'shrub_04_b_LOD0', 'shrub_04_c_LOD0', 'shrub_04_d_LOD0', 'shrub_01_a_LOD0', 'shrub_01_b_LOD0',
                 'shrub_01_c_LOD0', 'shrub_01_d_LOD0'),
    'semis': ('nettle_plant_small_a_LOD0', 'nettle_plant_medium_b_LOD0', 'shrub_01_e_LOD0', 'shrub_01_f_LOD0',
              'calathea_orbifolia_01_d', 'calathea_orbifolia_01_e', 'anthurium_botany_05_e', 'anthurium_botany_06_f'),
}
MODELES['mixte'] = MODELES['feuillus'] + MODELES['fougeres'] + MODELES['aromates']
PENDANTS = ('shrub_04_a_LOD0', 'shrub_04_b_LOD0', 'nettle_plant_tall_a_LOD0', 'shrub_01_d_LOD0', 'shrub_01_e_LOD0')


# ------------------------------------------------------------ poser un modèle
def boite_de(noms):
    pts = [bpy.data.objects[n].matrix_world @ Vector(c) for n in noms for c in bpy.data.objects[n].bound_box]
    return (Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)]))


def pose(coll, noms, x, y, z, e, rz=0.0, ecrase=0.4, retourne=False):
    """une copie liée d'un modèle (un ou plusieurs objets), son pied en (x, y,
    z). L'épaisseur (y) est écrasée : de face cela ne se voit pas, et un plant
    large ne traverse ni le vitrage ni la cloison. retourne : pendu par le pied."""
    mn, mx = boite_de(noms)
    centre = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z + 0.02 * (mx.z - mn.z)))
    m = (Matrix.Translation((x, y, z)) @ Matrix.Diagonal((e, ecrase * e, -e if retourne else e, 1))
         @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Translation(-centre))
    for n in noms:
        s = bpy.data.objects[n]
        o = bpy.data.objects.new(n + '.plant', s.data)
        o.matrix_world = m @ s.matrix_world
        coll.objects.link(o)


def plante_bac(coll, rng, z, hauteur, culture, x0=0.0, x1=L, rangs=((0.085, 1.0), (0.04, 0.62)), large=0.34, ecrase=0.4):
    """garnit un bac : serré, deux rangs en profondeur (le fond haut, le
    devant bas — sinon on voyait le noir de la cloison entre les plants)"""
    noms = MODELES[culture]
    for y, k in rangs:
        x = x0 + rng.uniform(0, 0.03)
        while x < x1:
            nom = rng.choice(noms)
            mn, mx = boite_de((nom,))
            l, h = max(mx.x - mn.x, mx.y - mn.y), mx.z - mn.z
            e = min(hauteur * k * rng.uniform(0.65, 1.0) / h, large / l)
            pose(coll, (nom,), x, y + rng.uniform(-0.01, 0.01), z, e, rng.uniform(0, 6.28), ecrase=ecrase)
            x += max(0.028, l * e * rng.uniform(0.32, 0.5))


def pendants(coll, rng, z, n, x0=0.0, x1=L):
    """des rameaux qui retombent du bord d'un bac"""
    for _ in range(n):
        nom = rng.choice(PENDANTS)
        mn, mx = boite_de((nom,))
        pose(coll, (nom,), rng.uniform(x0, x1), -0.016, z, rng.uniform(0.05, 0.11) / (mx.z - mn.z), rng.uniform(0, 6.28), retourne=True)


# ---------------------------------------------------------------- les matières
CLARTE_VEGETAL = 2.1


def eclaircit_vegetal():
    """Les feuillages de Poly Haven ont leur vraie clarté, faible : sous les
    deux soleils de l'atelier, réglés pour l'acier, la serre sortait noire
    (rendu du 12/11 : 0,11 de luminance, les plants se perdaient dans la
    cloison). Leur couleur est multipliée une fois, dans la matière."""
    for bib in BIBLIOTHEQUES[:7]:
        for mat in bpy.data.materials:
            if not mat.name.startswith(bib) or mat.get('eclairci') or not mat.node_tree:
                continue
            nt = mat.node_tree
            b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if not b or not b.inputs['Base Color'].is_linked:
                continue
            src = b.inputs['Base Color'].links[0].from_socket
            hsv = nt.nodes.new('ShaderNodeHueSaturation')
            hsv.inputs['Value'].default_value = CLARTE_VEGETAL
            hsv.inputs['Saturation'].default_value = 1.1
            nt.links.new(src, hsv.inputs['Color'])
            nt.links.new(hsv.outputs['Color'], b.inputs['Base Color'])
            mat['eclairci'] = True


def mat_verre():
    """le vitrage : presque rien, quelques traînées de buée"""
    mat = bpy.data.materials.new('verre')
    nt, N, Lk = noeuds(mat)
    out = N.new('ShaderNodeOutputMaterial')
    tr = N.new('ShaderNodeBsdfTransparent')
    voile = N.new('ShaderNodeBsdfDiffuse')
    voile.inputs['Color'].default_value = lin((0xa8, 0xc8, 0xb8))
    mix = N.new('ShaderNodeMixShader')
    buee = bruit_tore(nt, 12, 1.0, 31, detail=3, rugo=0.5)
    # à 0,025 + 0,1 la buée lavait toute la serre en gris et faisait une pluie (essai 1)
    Lk.new(op(nt, 'MULTIPLY_ADD', rampe(nt, buee, 0.55, 0.8), 0.03, 0.006), mix.inputs[0])
    Lk.new(tr.outputs[0], mix.inputs[1])
    Lk.new(voile.outputs[0], mix.inputs[2])
    Lk.new(mix.outputs[0], out.inputs[0])
    return mat


def mat_algue():
    """la culture d'algues dans son tube : un vert qui luit faiblement, plus
    dense par endroits"""
    mat = mat_simple('algue', (0x10, 0x38, 0x1c), rug=0.25, emission=(0x30, 0xb8, 0x60), force=0.4)
    nt = mat.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    d = rampe(nt, bruit_tore(nt, 18, 5, 41, detail=4, rugo=0.6), 0.3, 0.75)
    nt.links.new(melange(nt, d, lin((0x1c, 0x78, 0x40)), lin((0x62, 0xd8, 0x86))), b.inputs['Emission Color'])
    nt.links.new(op(nt, 'MULTIPLY_ADD', d, 0.35, 0.15), b.inputs['Emission Strength'])
    return mat


def matieres_serre():
    m = matieres_biome()
    m['verre'] = mat_verre()
    m['algue'] = mat_algue()
    # la rampe de culture : un blanc verdi, le seul éclairage propre de l'étagère
    m['rampe'] = mat_simple('rampe', (0x30, 0x40, 0x34), rug=0.3, emission=(0xa8, 0xe8, 0xb4), force=2.4)
    m['substrat'] = mat_simple('substrat', (0x12, 0x10, 0x0e), rug=0.95)
    m['etiquette'] = mat_simple('etiquette', (0x9a, 0xa3, 0xab), rug=0.6)
    # un tube cathodique allumé : le cyan de la charte
    m['ecran'] = mat_simple('ecran', (0x0a, 0x14, 0x20), rug=0.2, emission=(0x4a, 0x94, 0xbe), force=0.3)
    return m


# ------------------------------------------------------- la structure commune
def cloison(lg, mo, rng, z0, z1):
    """le fond de la serre : une cloison sombre, ses conduites"""
    lg.boite('fond', -L, 2 * L, z0 - 0.02, z1 + 0.02, 0.13, 0.14, 0)
    if z1 - z0 > 0.1:
        for _ in range(2):
            z = rng.uniform(z0 + 0.03, z1 - 0.03)
            lg.tube('lame', (-L, 0.115, z), (2 * L, 0.115, z), rng.uniform(0.007, 0.012), seg=12)
        for _ in range(9):
            x = rng.uniform(0, L)
            mo.tube('lame', (x, 0.118, z0), (x, 0.118, z1), rng.uniform(0.006, 0.011), seg=12)


def poutre(lg, mo, z0, z1):
    """la poutre de coque : un caisson, un gros fût, des éclisses, des
    veilleuses, le trait cyan — et ce qu'il faut à qui sort l'entretenir :
    des mains courantes, des trappes à poignée, des ouïes"""
    zc, h = (z0 + z1) / 2, z1 - z0
    lg.boite('peinture', -L, 2 * L, z0, z1, -0.03, 0.13, F)
    lg.tube('peinture', (-L, -0.03, zc), (2 * L, -0.03, zc), h * 0.3, -0.8, seg=32)
    for s in (-1, 1):
        lg.boite('peinture', -L, 2 * L, zc + s * h * 0.44 - 0.008, zc + s * h * 0.44 + 0.008, -0.045, -0.03, -0.9)
        lg.tube('tuyau', (-L, -0.04, zc + s * h * 0.36), (2 * L, -0.04, zc + s * h * 0.36), 0.006, seg=12)
    yf = -0.03 - h * 0.3
    for i in range(4):
        x = 0.5 * i
        # l'éclisse, à cheval sur le bord du motif quand i = 0
        mo.boite('peinture', x - 0.022, x + 0.022, z0 + 0.004, z1 - 0.004, -0.085, -0.03, -0.6)
        for dz in (-0.3, 0.3):
            for dx in (-0.011, 0.011):
                mo.dome('rivet', x + dx, zc + dz * h, 0.0042, -0.085, -0.6)
        xl = x + 0.25
        if i % 2 == 0:
            mo.boite('peinture', xl - 0.05, xl + 0.05, zc - 0.022, zc + 0.022, -0.085, -0.03, -0.7)
            mo.boite('ambre', xl - 0.024, xl + 0.024, zc - 0.005, zc + 0.005, -0.088, -0.085, 0)
        else:
            # une trappe de visite et sa poignée
            mo.boite('peinture', xl - 0.07, xl + 0.07, zc - 0.03, zc + 0.03, yf - 0.012, -0.03, -0.3)
            rivets(mo, xl - 0.07, xl + 0.07, zc - 0.03, zc + 0.03, yf - 0.012, -0.3, retrait=0.008, pas=0.04, r=0.003)
            mo.tube('tuyau', (xl - 0.025, yf - 0.02, zc), (xl + 0.025, yf - 0.02, zc), 0.0035, seg=10)
            for dx in (-0.025, 0.025):
                mo.tube('tuyau', (xl + dx, yf - 0.02, zc), (xl + dx, yf - 0.01, zc), 0.0035, seg=10)
        # la main courante, au-dessus du fût
        xm = x + 0.12
        mo.tube('tuyau', (xm - 0.04, yf - 0.012, zc + 0.3 * h), (xm + 0.04, yf - 0.012, zc + 0.3 * h), 0.004, seg=10)
        for dx in (-0.04, 0.04):
            mo.tube('tuyau', (xm + dx, yf - 0.012, zc + 0.3 * h), (xm + dx, -0.04, zc + 0.3 * h), 0.004, seg=10)
        for dx in (-0.13, 0.13):
            mo.boite('cyan', xl + dx - 0.035, xl + dx + 0.035, zc + h * 0.44 - 0.002, zc + h * 0.44 + 0.002, -0.0465, -0.045, 0)
        # une ouïe sous le fût
        xo = x + 0.4
        for k in range(4):
            mo.boite('lame', xo - 0.03, xo + 0.03, zc - 0.4 * h + k * 0.006, zc - 0.4 * h + k * 0.006 + 0.003, -0.047, -0.045, 0)


def bac(lg, mo, z, rampe_dessous=True):
    """un bac de culture hors-sol, de z à z + H_BAC : sa face, sa lèvre, ses
    équerres, le substrat, la ligne de goutte-à-goutte et ses vannes, des
    étiquettes de lot ; dessous, la rampe qui éclaire l'étagère d'en bas"""
    lg.boite('peinture', -L, 2 * L, z, z + H_BAC, -0.012, 0.1, F)
    lg.boite('peinture', -L, 2 * L, z + H_BAC - 0.01, z + H_BAC, -0.018, 0.1, -0.7)
    lg.boite('substrat', -L, 2 * L, z + H_BAC - 0.004, z + H_BAC + 0.003, -0.008, 0.095, 0)
    lg.tube('tuyau', (-L, -0.019, z + 0.013), (2 * L, -0.019, z + 0.013), 0.0038, seg=10)
    for i in range(8):
        x = 0.125 + 0.25 * i
        mo.boite('peinture', x - 0.012, x + 0.012, z + 0.022, z + H_BAC - 0.012, -0.02, -0.012, -0.5)
        mo.dome('rivet', x, z + H_BAC * 0.62, 0.0036, -0.02, -0.5)
        mo.boite('tuyau', x - 0.006, x + 0.006, z + 0.006, z + 0.02, -0.027, -0.014, 0)
        mo.cylindre('cyan', x, z + 0.013, 0.0045, -0.031, -0.027, 0, seg=10)
        if i % 3 != 1:
            mo.boite('etiquette', x + 0.04, x + 0.085, z + 0.026, z + 0.044, -0.0135, -0.012, 0)
            mo.boite('lame', x + 0.045, x + 0.075, z + 0.037, z + 0.0395, -0.014, -0.0135, 0)
            mo.boite('lame', x + 0.045, x + 0.066, z + 0.031, z + 0.0335, -0.014, -0.0135, 0)
    if rampe_dessous:
        rampes(lg, mo, z)


def rampes(lg, mo, z):
    """la rampe de culture, sous z"""
    lg.boite('peinture', -L, 2 * L, z - 0.012, z, 0.0, 0.05, -0.9)
    for i in range(4):
        mo.tube('rampe', (0.04 + 0.5 * i, 0.022, z - 0.017), (0.46 + 0.5 * i, 0.022, z - 0.017), 0.003, seg=10)
        for dx in (0.03, 0.47):
            mo.boite('peinture', 0.5 * i + dx - 0.006, 0.5 * i + dx + 0.006, z - 0.024, z - 0.01, 0.012, 0.032, -0.6)


def vitrage(lg, mo, z0, z1):
    lg.boite('verre', -L, 2 * L, z0, z1, -0.0205, -0.02, 0)
    for x in (0.0, 1.0):
        mo.boite('peinture', x - 0.012, x + 0.012, z0, z1, -0.034, -0.015, -0.9)


def passerelle(lg, mo, z):
    """la coursive devant les cultures : un caillebotis, sa plinthe, un
    garde-corps à deux lisses"""
    lg.boite('peinture', -L, 2 * L, z, z + 0.012, -0.125, -0.03, -0.8)
    lg.boite('peinture', -L, 2 * L, z + 0.012, z + 0.026, -0.125, -0.121, -0.6)
    lg.tube('tuyau', (-L, -0.121, z + 0.236), (2 * L, -0.121, z + 0.236), 0.005, seg=12)
    lg.tube('tuyau', (-L, -0.121, z + 0.13), (2 * L, -0.121, z + 0.13), 0.0032, seg=10)
    for i in range(8):
        x = 0.25 * i
        mo.tube('tuyau', (x, -0.121, z + 0.012), (x, -0.121, z + 0.236), 0.0045, seg=10)
        mo.boite('peinture', x - 0.009, x + 0.009, z + 0.012, z + 0.03, -0.13, -0.118, -0.5)
    for k in range(100):
        mo.boite('fond', k * 0.02 + 0.004, k * 0.02 + 0.014, z + 0.003, z + 0.009, -0.1255, -0.125, 0)


# ------------------------------------------------------ le matériel de station
def caisse(at, x, z, w=0.12, h=0.09, y=-0.075):
    """une caisse étanche : cornières, deux loquets, une étiquette, sanglée"""
    at.boite('peinture', x - w / 2, x + w / 2, z, z + h, y - 0.03, y + 0.03, -0.2)
    at.boite('peinture', x - w / 2 - 0.003, x + w / 2 + 0.003, z + h * 0.62, z + h * 0.7, y - 0.033, y + 0.03, -0.6)
    for s in (-1, 1):
        at.boite('tuyau', x + s * w * 0.28 - 0.006, x + s * w * 0.28 + 0.006, z + h * 0.52, z + h * 0.74, y - 0.037, y - 0.03, 0)
        at.boite('lame', x + s * (w / 2 - 0.006) - 0.004, x + s * (w / 2 - 0.006) + 0.004, z, z + h, y - 0.032, y - 0.03, 0)
    at.boite('etiquette', x - 0.02, x + 0.02, z + h * 0.18, z + h * 0.42, y - 0.0315, y - 0.03, 0)


def bonbonne(at, x, z, h=0.19, r=0.026, y=-0.075, marque='cyan'):
    """une bonbonne de nutriments ou de gaz : son dôme, son robinet, sa bague"""
    at.tube('peinture', (x, y, z), (x, y, z + h), r, -0.4, seg=20)
    at.coussin('peinture', x, z + h, r, r * 0.6, r, y, -0.4)
    at.tube('tuyau', (x, y, z + h + r * 0.4), (x, y, z + h + r * 0.4 + 0.016), 0.007, seg=10)
    at.tube('tuyau', (x - 0.012, y, z + h + r * 0.4 + 0.012), (x + 0.012, y, z + h + r * 0.4 + 0.012), 0.004, seg=8)
    at.tube(marque, (x, y, z + h * 0.72), (x, y, z + h * 0.8), r + 0.0008, 0, seg=20)


def ratelier(at, x, z, n, **kw):
    """des bonbonnes côte à côte, tenues par une sangle"""
    y = kw.get('y', -0.075)
    for i in range(n):
        bonbonne(at, x + i * 0.06, z, marque='rayures' if i == n - 1 else 'cyan', **kw)
    at.boite('lame', x - 0.034, x + (n - 1) * 0.06 + 0.034, z + 0.085, z + 0.097, y - 0.029, y - 0.025, 0)
    at.boite('peinture', x - 0.04, x + (n - 1) * 0.06 + 0.04, z, z + 0.014, y - 0.035, y + 0.035, -0.5)


def console(at, x, z, w=0.17, h=0.2, y=-0.075):
    """un pupitre : un tube cathodique bombé, trois voyants, un clavier"""
    at.boite('peinture', x - w / 2, x + w / 2, z, z + h, y - 0.03, y + 0.03, -0.3)
    at.boite('peinture', x - w / 2 - 0.004, x + w / 2 + 0.004, z + h * 0.42, z + h * 0.48, y - 0.05, y + 0.03, -0.6)
    at.boite('fond', x - w * 0.36, x + w * 0.1, z + h * 0.55, z + h * 0.92, y - 0.032, y - 0.03, 0)
    at.boite('ecran', x - w * 0.31, x + w * 0.05, z + h * 0.6, z + h * 0.87, y - 0.034, y - 0.032, 0)
    for k in range(3):
        at.cylindre('ambre' if k == 1 else 'etiquette', x + w * 0.28, z + h * (0.62 + 0.11 * k), 0.005, y - 0.034, y - 0.03, 0, seg=10)
    for k in range(5):
        at.boite('etiquette', x - w * 0.36 + k * w * 0.16, x - w * 0.36 + k * w * 0.16 + w * 0.1, z + h * 0.485, z + h * 0.5, y - 0.046, y - 0.036, 0)
    rivets(at, x - w / 2, x + w / 2, z, z + h * 0.4, y - 0.03, -0.3, retrait=0.008, pas=0.05, r=0.003)


def tabouret(at, x, z, y=-0.07):
    at.tube('tuyau', (x, y, z), (x, y, z + 0.1), 0.006, seg=10)
    at.tube('peinture', (x, y, z + 0.1), (x, y, z + 0.112), 0.034, -0.5, seg=20)
    at.tube('peinture', (x, y, z), (x, y, z + 0.006), 0.026, -0.5, seg=16)


def etabli(at, x0, x1, z, ht=0.19, y=-0.075):
    """une paillasse boulonnée au caillebotis"""
    at.boite('peinture', x0, x1, z + ht - 0.012, z + ht, y - 0.035, y + 0.035, -0.4)
    at.boite('peinture', x0 + 0.015, x1 - 0.015, z + 0.05, z + 0.058, y - 0.03, y + 0.03, -0.6)
    for x in (x0 + 0.01, x1 - 0.01):
        at.boite('peinture', x - 0.006, x + 0.006, z, z + ht - 0.012, y - 0.034, y - 0.022, -0.7)
    return z + ht


def plateau(at, coll, rng, x, z, w=0.1, y=-0.075):
    """un plateau d'échantillons, ses jeunes plants"""
    at.boite('lame', x - w / 2, x + w / 2, z, z + 0.012, y - 0.028, y + 0.028, 0)
    plante_bac(coll, rng, z + 0.011, 0.045, 'semis', x - w / 2 + 0.008, x + w / 2 - 0.008, rangs=((y, 1.0),), large=0.04)


def poste_analyse(at, coll, rng, z):
    zt = etabli(at, 0.22, 0.66, z)
    plateau(at, coll, rng, 0.31, zt)
    plateau(at, coll, rng, 0.44, zt)
    # une loupe binoculaire : un pied, une potence, deux tubes
    at.boite('peinture', 0.555, 0.615, zt, zt + 0.008, -0.1, -0.05, -0.2)
    at.tube('tuyau', (0.6, -0.07, zt), (0.6, -0.07, zt + 0.06), 0.005, seg=10)
    at.boite('peinture', 0.565, 0.61, zt + 0.045, zt + 0.062, -0.09, -0.06, -0.2)
    at.tube('tuyau', (0.578, -0.08, zt + 0.02), (0.578, -0.08, zt + 0.05), 0.007, seg=10)
    at.tube('lame', (0.572, -0.085, zt + 0.062), (0.566, -0.085, zt + 0.078), 0.004, seg=8)
    caisse(at, 0.31, z + 0.058, 0.1, 0.07)
    caisse(at, 0.5, z + 0.058, 0.13, 0.085)
    tabouret(at, 0.78, z)
    console(at, 1.22, z)
    ratelier(at, 1.48, z, 3, h=0.15)
    caisse(at, 1.78, z, 0.14, 0.1)
    caisse(at, 1.77, z + 0.1, 0.1, 0.07)


def poste_nutriments(at, coll, rng, z):
    ratelier(at, 0.2, z, 6)
    # le doseur : une cuve, sa jauge, sa pompe, le flexible qui part au rail
    at.tube('peinture', (0.8, -0.075, z + 0.02), (0.8, -0.075, z + 0.2), 0.05, -0.3, seg=24)
    at.coussin('peinture', 0.8, z + 0.2, 0.05, 0.02, 0.05, -0.075, -0.3)
    for k in range(3):
        at.tube('tuyau', (0.8 + (k - 1) * 0.03, -0.075, z), (0.8 + (k - 1) * 0.03, -0.075, z + 0.03), 0.005, seg=8)
    at.boite('etiquette', 0.792, 0.808, z + 0.06, z + 0.16, -0.127, -0.125, 0)
    at.boite('algue', 0.7955, 0.8045, z + 0.065, z + 0.12, -0.128, -0.127, 0)
    at.boite('peinture', 0.88, 0.96, z, z + 0.07, -0.105, -0.045, -0.5)
    at.tube('tuyau', (0.92, -0.075, z + 0.07), (0.92, -0.075, z + 0.1), 0.02, seg=16)
    pts = [(0.92, z + 0.1), (0.95, z + 0.14), (1.02, z + 0.16), (1.08, z + 0.2), (1.1, z + 0.224)]
    for a, b in zip(pts, pts[1:]):
        at.tube('lame', (a[0], -0.112, a[1]), (b[0], -0.112, b[1]), 0.005, seg=8)
    console(at, 1.3, z, w=0.13, h=0.16)
    caisse(at, 1.55, z, 0.13, 0.09)
    caisse(at, 1.7, z, 0.13, 0.09)
    caisse(at, 1.62, z + 0.09, 0.13, 0.09)
    tabouret(at, 1.88, z)


def poste_semis(at, coll, rng, z):
    zt = etabli(at, 0.15, 0.95, z, ht=0.13)
    for k in range(6):
        plateau(at, coll, rng, 0.22 + k * 0.125, zt)
    # la rampe basse des semis, sur deux potences
    for x in (0.17, 0.93):
        at.tube('tuyau', (x, -0.045, zt), (x, -0.045, zt + 0.085), 0.004, seg=8)
    at.boite('peinture', 0.16, 0.94, zt + 0.085, zt + 0.095, -0.09, -0.04, -0.6)
    at.tube('rampe', (0.19, -0.075, zt + 0.082), (0.91, -0.075, zt + 0.082), 0.0028, seg=8)
    caisse(at, 0.3, z, 0.12, 0.05)
    caisse(at, 0.7, z, 0.16, 0.05)
    tabouret(at, 1.08, z)
    ratelier(at, 1.3, z, 2, h=0.16)
    console(at, 1.6, z, w=0.15, h=0.18)
    caisse(at, 1.84, z, 0.12, 0.11)


POSTES = {'analyse': poste_analyse, 'nutriments': poste_nutriments, 'semis': poste_semis}


def bioreacteurs(lg, mo, rng, z0, h):
    """la culture d'algues : des tubes de verre entre deux collecteurs, une
    pompe par travée"""
    lg.tube('tuyau', (-L, 0.04, z0 + 0.016), (2 * L, 0.04, z0 + 0.016), 0.012, seg=14)
    lg.tube('tuyau', (-L, 0.04, z0 + h - 0.014), (2 * L, 0.04, z0 + h - 0.014), 0.009, seg=14)
    n = 24
    for i in range(n):
        x = (i + 0.5) * L / n
        if i % 8 == 5:
            mo.boite('peinture', x - 0.03, x + 0.03, z0 + 0.03, z0 + 0.1, 0.0, 0.07, -0.4)
            mo.tube('tuyau', (x, 0.03, z0 + 0.1), (x, 0.03, z0 + h - 0.014), 0.008, seg=10)
            mo.cylindre('ambre', x + 0.015, z0 + 0.08, 0.005, -0.004, 0.0, 0, seg=10)
            mo.disque('tuyau', x - 0.008, z0 + 0.06, 0.014, -0.006, 0.0, 0, seg=16)
            continue
        r = 0.021
        mo.tube('algue', (x, 0.04, z0 + 0.04), (x, 0.04, z0 + h - 0.035), r, 0, seg=16)
        for zz in (z0 + 0.028, z0 + h - 0.035):
            mo.tube('peinture', (x, 0.04, zz), (x, 0.04, zz + 0.014), r + 0.005, -0.5, seg=16)


# -------------------------------------------------------------- les bandes
def _bande(sc, mats, nom, graine, hauteur, corps):
    P = parent(sc, nom)
    M = sous(P, nom + '-motif')
    lg, mo = Atelier(), Atelier()
    rng = random.Random(graine)
    corps(lg, mo, M, rng)
    lg.objets(P, mats, BISEAU, True, nom + '-long')
    mo.objets(M, mats, BISEAU, True, nom)
    copies(P, M, [(-L, 0), (L, 0)])
    for o in P.objects:
        if o.name.endswith('-verre'):
            o.visible_shadow = False
    declare(nom, P, 0, L, 0, hauteur, mx=MARGE, alpha=False, ancres={'periode': L})


def bande(sc, mats, nom, graine, culture, poste=None):
    """UNE BANDE : du substrat d'un bac (z = 0, le haut de l'image du dessous)
    au dessus du bac suivant"""
    def corps(lg, mo, M, rng):
        zb = H_BANDE - H_BAC
        cloison(lg, mo, rng, 0, H_BANDE)
        bac(lg, mo, zb)
        if culture == 'algues':
            bioreacteurs(lg, mo, rng, 0.0, zb - 0.02)
        else:
            plante_bac(M, rng, 0.0, (zb - 0.03) * 0.95, culture)
            pendants(M, rng, zb + 0.006, rng.randint(5, 9))
        vitrage(lg, mo, 0, H_BANDE)
        if poste:
            passerelle(lg, mo, 0.0)
            POSTES[poste](mo, M, rng, 0.012)
    _bande(sc, mats, nom, graine, H_BANDE, corps)


def haut(sc, mats, nom='serre-haut', graine=101, culture='mixte'):
    def corps(lg, mo, M, rng):
        zp = H_HAUT - H_POUTRE
        cloison(lg, mo, rng, 0, zp)
        plante_bac(M, rng, 0.0, (zp - 0.05) * 0.9, culture)
        rampes(lg, mo, zp - 0.006)
        poutre(lg, mo, zp, H_HAUT)
        vitrage(lg, mo, 0, zp)
    _bande(sc, mats, nom, graine, H_HAUT, corps)


def bas(sc, mats, nom='serre-bas', graine=102):
    def corps(lg, mo, M, rng):
        cloison(lg, mo, rng, H_POUTRE, H_BAS)
        poutre(lg, mo, 0.0, H_POUTRE)
        bac(lg, mo, H_BAS - H_BAC, rampe_dessous=False)
        # sous le premier bac, le collecteur d'arrosage et ses piquages
        lg.tube('tuyau', (-L, -0.01, H_POUTRE + 0.02), (2 * L, -0.01, H_POUTRE + 0.02), 0.011, seg=14)
        for i in range(8):
            x = 0.125 + 0.25 * i
            mo.tube('tuyau', (x, -0.012, H_POUTRE + 0.02), (x, -0.019, H_BAS - H_BAC + 0.013), 0.0038, seg=8)
            mo.tube('tuyau', (x - 0.01, -0.01, H_POUTRE + 0.02), (x + 0.01, -0.01, H_POUTRE + 0.02), 0.015, seg=14)
        vitrage(lg, mo, H_POUTRE, H_BAS)
    _bande(sc, mats, nom, graine, H_BAS, corps)


# ----------------------------------------------------------------- la cloison
A_L, A_BAS, A_BANDE, A_HAUT = 218 / 1024, 491 / 1024, 260 / 1024, 765 / 1024


def anneau(sc, mats, nom='serre-anneau'):
    """LA CLOISON entre deux capsules, au gabarit de l'anneau (218 px ; bas
    491, bande 260 répétée, haut 765). On y monte : une porte étanche en bas,
    une échelle sur toute la hauteur (quatre barreaux par bande), des paliers."""
    P = parent(sc, nom)
    at = Atelier()
    w = A_L / 2
    HT = A_BAS + A_BANDE + A_HAUT
    at.boite('peinture', -w, w, 0, HT, -0.03, 0.14, F)
    for s in (-1, 1):
        xa, xb = (w - 0.03, w) if s > 0 else (-w, -w + 0.03)
        at.boite('peinture', xa, xb, 0, HT, -0.075, -0.03, -0.7)
        z = 0.03
        while z < HT:
            at.dome('rivet', s * (w - 0.015), z, 0.004, -0.075, -0.7)
            z += A_BANDE / 4
    at.boite('fond', -w + 0.036, w - 0.036, 0, HT, -0.034, -0.03, 0)
    at.boite('cyan', w - 0.034, w - 0.031, 0, HT, -0.0765, -0.075, 0)
    at.tube('lame', (-w + 0.045, -0.04, 0), (-w + 0.045, -0.04, HT), 0.005, seg=8)
    # la porte étanche : à taille humaine (1,85 m), son hublot, son volant
    zp, hp = 0.02, 1.85 * M_
    at.boite('rayures', -0.066, 0.066, 0, zp - 0.008, -0.062, -0.03, 0)
    at.boite('peinture', -0.066, 0.066, zp - 0.008, zp + hp + 0.012, -0.05, -0.03, -0.3)
    at.boite('peinture', -0.057, 0.057, zp, zp + hp, -0.058, -0.05, -0.6)
    rivets(at, -0.057, 0.057, zp, zp + hp, -0.058, -0.6, retrait=0.007, pas=0.045, r=0.003)
    at.anneau('tuyau', 0, zp + hp * 0.74, 0.03, 0.02, -0.066, -0.058, 0, seg=24)
    at.disque('ecran', 0, zp + hp * 0.74, 0.02, -0.06, -0.058, 0, seg=24)
    at.anneau('tuyau', 0, zp + hp * 0.42, 0.028, 0.022, -0.072, -0.066, 0, seg=20)
    for k in range(3):
        at.boite('tuyau', -0.026, 0.026, zp + hp * 0.42 - 0.0025, zp + hp * 0.42 + 0.0025, -0.07, -0.066, 0, rot=Matrix.Rotation(k * math.pi / 3, 4, 'Y'))
    at.disque('tuyau', 0, zp + hp * 0.42, 0.008, -0.076, -0.058, 0, seg=12)
    # l'échelle, au-dessus du bas : un barreau tous les quarts de bande — la
    # bande répétée les garde au pas
    z0e = A_BAS + A_BANDE / 8
    for s in (-1, 1):
        at.tube('tuyau', (s * 0.036, -0.062, A_BAS - 0.008), (s * 0.036, -0.062, HT - 0.1), 0.0045, seg=10)
    z = z0e
    while z < HT - 0.11:
        at.tube('tuyau', (-0.036, -0.062, z), (0.036, -0.062, z), 0.0034, seg=8)
        z += A_BANDE / 4
    voyant(at, 0, A_BAS - 0.02, -0.03)
    # un palier, là où l'on quitte l'échelle
    zz = A_BAS + A_BANDE + 0.3
    at.boite('peinture', -w + 0.03, w - 0.03, zz, zz + 0.01, -0.09, -0.03, -0.5)
    at.boite('rayures', -w + 0.03, w - 0.03, zz + 0.002, zz + 0.008, -0.0905, -0.09, 0)
    # la tête : un boîtier, une veilleuse
    at.boite('peinture', -0.07, 0.07, HT - 0.09, HT - 0.02, -0.07, -0.03, -0.4)
    at.boite('ambre', -0.03, 0.03, HT - 0.06, HT - 0.05, -0.072, -0.07, 0)
    rivets(at, -0.07, 0.07, HT - 0.09, HT - 0.02, -0.07, -0.4, retrait=0.008, pas=0.04, r=0.003)
    at.objets(P, mats, BISEAU, True, nom)
    declare(nom, P, -w, w, 0, HT, alpha=False, ancres={'bas': A_BAS, 'bande': A_BANDE, 'haut': A_HAUT})


# ----------------------------------------------------------------- le berceau
B_H, B_BRIDE = 0.875, 0.17


def berceau(sc, mats, nom='serre-berceau'):
    """LE BERCEAU TECHNIQUE, sous le cylindre : les selles qui le portent, les
    cuves d'eau et de nutriments, une pompe, et la coursive d'où on les
    entretient — son garde-corps, son échelle, son pupitre. z = B_H : le bas
    du cylindre ; les selles le mordent de B_BRIDE."""
    P = parent(sc, nom)
    M = sous(P, nom + '-motif')
    lg, mo = Atelier(), Atelier()
    lg.boite('peinture', -L, 2 * L, 0.0, 0.05, -0.1, 0.1, F)
    lg.boite('cyan', -L, 2 * L, 0.022, 0.026, -0.101, -0.1, 0)
    lg.boite('peinture', -L, 2 * L, 0.66, 0.72, -0.06, 0.1, -0.8)
    lg.tube('tuyau', (-L, -0.07, 0.61), (2 * L, -0.07, 0.61), 0.016, seg=16)
    lg.tube('tuyau', (-L, -0.05, 0.56), (2 * L, -0.05, 0.56), 0.009, seg=12)
    # la coursive basse
    zc = 0.05
    passerelle(lg, mo, zc)
    for i in range(2):
        x = 0.5 + i
        # la selle : un caisson évasé qui monte mordre le cylindre
        mo.boite('peinture', x - 0.16, x + 0.16, 0.72, B_H + B_BRIDE, -0.09, 0.1, -0.5)
        mo.boite('peinture', x - 0.2, x + 0.2, 0.72, 0.78, -0.1, 0.1, -0.7)
        rivets(mo, x - 0.16, x + 0.16, 0.78, B_H + B_BRIDE, -0.09, -0.5, retrait=0.012, pas=0.05, r=0.0045)
        mo.boite('rayures', x - 0.16, x + 0.16, B_H - 0.012, B_H + 0.012, -0.092, -0.09, 0)
        for s in (-1, 1):
            mo.boite('peinture', x + s * 0.13 - 0.02, x + s * 0.13 + 0.02, 0.05, 0.66, -0.02, 0.08, -0.8)
        # la cuve couchée, entre deux selles
        xc = x + 0.5
        mo.fut('peinture', xc - 0.3, xc + 0.3, 0.13, -0.3 + 0.2 * i, 0.0, 0.42, seg=40)
        for s in (-1, 1):
            mo.coussin('peinture', xc + s * 0.3, 0.42, 0.045, 0.13, 0.13, 0.0, -0.3 + 0.2 * i)
            mo.fut('tuyau', xc + s * 0.18 - 0.012, xc + s * 0.18 + 0.012, 0.134, 0, 0.0, 0.42, seg=40)
            mo.boite('peinture', xc + s * 0.18 - 0.02, xc + s * 0.18 + 0.02, 0.05, 0.3, -0.03, 0.06, -0.7)
        mo.fut('cyan' if i == 0 else 'rayures', xc - 0.03, xc + 0.03, 0.1305, 0, 0.0, 0.42, seg=40)
        mo.boite('etiquette', xc - 0.11, xc - 0.05, 0.4, 0.45, -0.132, -0.13, 0)
        mo.tube('tuyau', (xc, 0.0, 0.55), (xc, 0.0, 0.66), 0.014, seg=12)
        mo.tube('tuyau', (xc + 0.1, -0.07, 0.42), (xc + 0.1, -0.07, 0.61), 0.009, seg=10)
        mo.anneau('tuyau', xc + 0.1, 0.5, 0.022, 0.015, -0.094, -0.088, 0, seg=20)
    # la pompe et son pupitre, sur la coursive
    mo.boite('peinture', 0.84, 0.98, zc + 0.012, zc + 0.1, -0.1, -0.04, -0.4)
    mo.fut('tuyau', 0.98, 1.06, 0.035, 0, -0.07, zc + 0.06, seg=20)
    mo.tube('tuyau', (0.91, -0.07, zc + 0.1), (0.91, -0.07, 0.56), 0.008, seg=10)
    console(mo, 1.2, zc + 0.012, w=0.15, h=0.2)
    ratelier(mo, 1.72, zc + 0.012, 3)
    caisse(mo, 0.2, zc + 0.012, 0.14, 0.1)
    caisse(mo, 0.36, zc + 0.012, 0.11, 0.08)
    # l'échelle qui monte de la coursive au cylindre
    for s in (-1, 1):
        mo.tube('tuyau', (0.02 + s * 0.036, -0.105, zc + 0.012), (0.02 + s * 0.036, -0.105, 0.72), 0.0045, seg=10)
    z = zc + 0.06
    while z < 0.71:
        mo.tube('tuyau', (0.02 - 0.036, -0.105, z), (0.02 + 0.036, -0.105, z), 0.0034, seg=8)
        z += 0.0635
    for x in (0.55, 1.45):
        voyant(mo, x, 0.69, -0.06)
    lg.objets(P, mats, BISEAU, True, nom + '-long')
    mo.objets(M, mats, BISEAU, True, nom)
    copies(P, M, [(-L, 0), (L, 0)])
    declare(nom, P, 0, L, 0, B_H + B_BRIDE, mx=MARGE, ancres={'machines': B_H, 'bride': B_BRIDE, 'periode': L})


# ------------------------------------------------------------------- les dômes
D_H, D_A, D_COL = 2.0, 1.32, 0.24


def dome(sc, mats, cote, graine):
    """UN DÔME DE VERRE, à l'échelle d'un cylindre de deux salles de haut
    (le moteur l'étire à la hauteur du module). cote = -1 : l'entrée, à
    gauche — un jardin de repos, des arbres, un banc ; +1 : la sortie — la
    réserve, ses bonbonnes, ses caisses, son pupitre. Le collier d'amarrage
    est au nez."""
    nom = 'serre-dome-gauche' if cote < 0 else 'serre-dome-droit'
    P = parent(sc, nom)
    at = Atelier()
    rng = random.Random(graine)
    b = D_H / 2
    X = lambda v: cote * v
    tri = lambda u, v: tuple(sorted((X(u), X(v))))

    def ellipse(mat, k, y):
        bm = at._bm(mat)
        vs = [bm.verts.new((X(D_A * k * math.cos(t)), y, b * math.sin(t))) for t in [math.pi * (i / 48 - 0.5) for i in range(49)]]
        bm.faces.new(vs)

    def arc(k, r, y, n=30):
        pts = [(X(D_A * k * math.cos(math.radians(t))), y, b * math.sin(math.radians(t))) for t in [-90 + 180 * i / n for i in range(n + 1)]]
        for p, q in zip(pts, pts[1:]):
            at.tube('peinture', p, q, r, -0.7, seg=10)
            at.dome('rivet', q[0], q[2], r, q[1], -0.7, aplati=1.0)

    ellipse('fond', 1.0, 0.14)
    ex = lambda z: D_A * math.sqrt(max(0.0, 1 - (z / b) ** 2))
    # deux ponts : un caillebotis, son garde-corps, d'un bord du verre à l'autre
    zb_, zh_ = -0.56, 0.16
    for zp in (zb_, zh_):
        xa, xb = tri(0.0, ex(zp) - 0.05)
        at.boite('peinture', xa, xb, zp - 0.02, zp, -0.02, 0.12, -0.7)
        # le garde-corps s'arrête où le verre se referme à SA hauteur
        x1 = ex(zp + 0.26 if zp > 0 else zp - 0.02) - 0.06
        xa, xb = tri(0.0, x1)
        for v in (0.15, 0.55, 0.95):
            if v + 0.3 < ex(zp + 0.6) - 0.1:
                at.tube('rampe', (X(v), 0.03, zp + 0.6), (X(v + 0.3), 0.03, zp + 0.6), 0.004, seg=8)
        at.tube('tuyau', (xa, -0.03, zp + 0.236), (xb, -0.03, zp + 0.236), 0.005, seg=10)
        at.tube('tuyau', (xa, -0.03, zp + 0.13), (xb, -0.03, zp + 0.13), 0.0032, seg=8)
        v = 0.1
        while v < x1:
            at.tube('tuyau', (X(v), -0.03, zp), (X(v), -0.03, zp + 0.236), 0.0045, seg=8)
            v += 0.25
    if cote < 0:
        # le jardin de repos : des arbres en bac, un banc, des feuillus au pied
        for v, e in ((0.3, 0.42), (0.62, 0.33), (0.88, 0.25)):
            sfx = rng.choice('acd')
            at.boite('peinture', X(v) - 0.06, X(v) + 0.06, zb_, zb_ + 0.07, 0.0, 0.1, -0.5)
            pose(P, (f'pachira_aquatica_01_bark_{sfx}', f'pachira_aquatica_01_leaves_{sfx}'), X(v), 0.05, zb_ + 0.06, e, rng.uniform(0, 6.28))
        plante_bac(P, rng, zb_, 0.16, 'feuillus', *tri(0.08, 1.0), rangs=((0.09, 1.0),))
        xa, xb = tri(0.42, 0.58)
        at.boite('peinture', xa, xb, zb_ + 0.1, zb_ + 0.112, -0.012, 0.03, -0.3)
        at.boite('peinture', xa, xb, zb_ + 0.13, zb_ + 0.2, 0.02, 0.03, -0.3)
        for x in (xa + 0.012, xb - 0.012):
            at.boite('peinture', x - 0.005, x + 0.005, zb_, zb_ + 0.1, -0.01, 0.0, -0.6)
        plante_bac(P, rng, zh_, 0.2, 'fougeres', *tri(0.06, ex(zh_) - 0.12), rangs=((0.07, 1.0), (0.03, 0.6)))
    else:
        ratelier(at, min(X(0.14), X(0.44)), zb_, 6, y=0.03)
        console(at, X(0.66), zb_, y=0.03)
        caisse(at, X(0.86), zb_, 0.14, 0.1, y=0.03)
        caisse(at, X(0.87), zb_ + 0.1, 0.11, 0.08, y=0.03)
        tabouret(at, X(0.52), zb_, y=0.02)
        plante_bac(P, rng, zh_, 0.2, 'mixte', *tri(0.3, ex(zh_) - 0.12), rangs=((0.07, 1.0), (0.03, 0.6)))
        caisse(at, X(0.16), zh_, 0.14, 0.1, y=0.03)
        console(at, X(0.16), zh_ + 0.1, w=0.12, h=0.12, y=0.03)
    # le verre, puis sa charpente : des méridiens, des cercles, la couronne
    ellipse('verre', 0.995, -0.045)
    for k in (1.0, 0.86, 0.6, 0.3):
        arc(k, 0.014 if k == 1.0 else 0.009, -0.06)
    for v in (0.42, 0.8, 1.1):
        z = b * math.sqrt(1 - (v / D_A) ** 2)
        at.tube('peinture', (X(v), -0.06, -z), (X(v), -0.06, z), 0.008, -0.7, seg=10)
    xa, xb = tri(-0.03, 0.045)
    at.boite('peinture', xa, xb, -b, b, -0.085, 0.13, -0.6)
    xa, xb = tri(0.0, 0.012)
    at.boite('cyan', xa, xb, -b * 0.6, b * 0.6, -0.0865, -0.085, 0)
    # le collier d'amarrage, au nez
    for v0, v1, r, mat, var in ((D_A - 0.05, D_A + 0.03, 0.3, 'peinture', -0.4), (D_A + 0.03, D_A + 0.15, 0.24, 'peinture', -0.8),
                                (D_A + 0.08, D_A + 0.095, 0.2415, 'cyan', 0), (D_A + 0.15, D_A + 0.19, 0.27, 'tuyau', 0),
                                (D_A + 0.19, D_A + D_COL, 0.21, 'tuyau', 0)):
        xa, xb = tri(v0, v1)
        at.fut(mat, xa, xb, r, var)
    for z in (-0.15, 0.15):
        y = -math.sqrt(0.09 - z * z)
        at.cylindre('ambre', X(D_A - 0.01), z, 0.009, y - 0.005, y + 0.004, 0, seg=14)
    at.objets(P, mats, BISEAU, True, nom)
    for o in P.objects:
        if o.name.endswith('-verre'):
            o.visible_shadow = False
    xa, xb = tri(-0.03, D_A + D_COL + 0.01)
    declare(nom, P, xa, xb, -b, b, ancres={'hauteur_cylindre': D_H, 'plat': 0.03, 'deborde': D_A + D_COL + 0.01})


# ------------------------------------------------------------------ la cellule
def cellule(sc, mats, nom='serre-cellule'):
    """LA CAPSULE de la mini-carte : un hublot oblong, neutre — l'état et
    l'icône du nœud se peignent dans le moteur, au centre, qui reste sombre"""
    P = parent(sc, nom)
    at = Atelier()
    rng = random.Random(77)
    W, H = 0.5, 0.206
    r = H
    # le fond du hublot : une lame mince posée devant le corps — épais, ses
    # chants lissés dessinaient deux disques dans le noir (rendu du 12/11)
    for mat, dr, yf, yb, var in (('peinture', 0.0, -0.04, 0.02, -0.4), ('fond', -0.03, -0.0452, -0.045, 0)):
        at.boite(mat, -(W - r), W - r, -(r + dr), r + dr, yf, yb, var)
        for s in (-1, 1):
            at.disque(mat, s * (W - r), 0, r + dr, yf, yb, var, seg=48)
    for s in (-1, 1):
        at.boulons(s * (W - r), 0, r - 0.015, 10, -0.04, rr=0.0045, var=-0.4, phase=0.5)
    for i in range(7):
        for s in (-1, 1):
            at.dome('rivet', -(W - r) + i * (W - r) / 3, s * (r - 0.015), 0.0045, -0.04, -0.4)
    at.boite('peinture', -(W - r), W - r, -(r - 0.03), -(r - 0.03) + 0.03, -0.075, -0.046, F)
    plante_bac(P, rng, -(r - 0.03) + 0.028, 0.075, 'semis', -(W - r) + 0.02, W - r - 0.02, rangs=((-0.06, 1.0),), large=0.08, ecrase=0.15)
    at.tube('rampe', (-(W - r) * 0.8, -0.055, r - 0.045), ((W - r) * 0.8, -0.055, r - 0.045), 0.003, seg=8)
    at.objets(P, mats, BISEAU, True, nom)
    declare(nom, P, -W, W, -H, H, ancres={'largeur_sur_hauteur': W / H})


# -------------------------------------------------------------------- la scène
BANDES = (('serre-bande-feuillus', 11, 'feuillus', None), ('serre-bande-fougeres', 12, 'fougeres', None),
          ('serre-bande-aromates', 13, 'aromates', None), ('serre-bande-mixte', 14, 'mixte', None),
          ('serre-bande-algues', 15, 'algues', None), ('serre-bande-semis', 16, 'semis', None),
          ('serre-poste-analyse', 21, 'fougeres', 'analyse'), ('serre-poste-nutriments', 22, 'feuillus', 'nutriments'),
          ('serre-poste-semis', 23, 'aromates', 'semis'))


def vide_pieces():
    """ôte les pièces, les lumières et la caméra — PAS les modèles importés
    (vide_scene les emporterait, et il faudrait les retélécharger)"""
    for c in [c for c in bpy.data.collections if c.name.startswith('piece-')]:
        for o in list(c.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
        for e in list(c.children_recursive):
            bpy.data.collections.remove(e)
        bpy.data.collections.remove(c)
    for o in [o for o in bpy.data.objects if o.type in ('LIGHT', 'CAMERA')]:
        bpy.data.objects.remove(o, do_unlink=True)
    for c in bpy.data.collections:
        if c.name.split('_LOD')[0] in BIBLIOTHEQUES:
            c.hide_render = True


def serre(quoi=None):
    vide_pieces()
    eclaircit_vegetal()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_serre()
    faire = lambda n: quoi is None or n in quoi
    for nom, graine, culture, poste in BANDES:
        if faire(nom):
            bande(sc, mats, nom, graine, culture, poste)
    if faire('serre-haut'):
        haut(sc, mats)
    if faire('serre-bas'):
        bas(sc, mats)
    if faire('serre-anneau'):
        anneau(sc, mats)
    if faire('serre-berceau'):
        berceau(sc, mats)
    if faire('serre-dome-gauche'):
        dome(sc, mats, -1, 31)
    if faire('serre-dome-droit'):
        dome(sc, mats, 1, 32)
    if faire('serre-cellule'):
        cellule(sc, mats)
    lumiere_camera(sc)
    sc.cycles.device = 'GPU'
