"""LE DESSUS DU RIDEAU LAMELLAIRE (27/11) — le rail vu d'en haut, et le chapeau
de ses montants.

Le rideau était UNE image, vue de FACE (les lanières pendues à leur rail),
plaquée sur le dessus du bloc. Tant que le jeu se regardait à plat, cela se
lisait ; relief allumé, le bloc a un DESSUS et une PAROI VERTICALE, et la
porte à lanières se retrouvait couchée sur le toit — avec son animation —
pendant que la paroi, elle, ne portait que des rayures tracées (le
concepteur, 27/11 : « la partie animée est celle du dessus alors que
maintenant cela devrait être la paroi verticale »).

Les lanières (le tronçon et le montant de l'atlas des filtres, inchangés)
descendent donc sur la tranche, où le shader les anime ; et le dessus
devient ce qu'on voit d'un rideau en le survolant, modélisé ici :
  · rideau-dessus : un tronçon de HUIT lanières, qui se raccorde bord à
    bord — deux longerons boulonnés au ras des faces, au milieu le rail
    porteur que coiffent les lanières repliées (du PVC givré, en écailles :
    chacune recouvre la suivante d'un tiers, comme vues de face), chacune
    tenue par sa pince à deux rivets. Entre le rail et chaque longeron, une
    FENTE, VIDE dans l'image (alpha nul) : le shader y peint le noir du
    dessous, et les lanières que la glace pousse y paraissent ;
  · rideau-chapeau : le dessus du poteau qui ferme un bout — une platine
    boulonnée, son voyant cyan. Plus haut que le tronçon, il en coiffe le
    bout ; l'autre bout se lit en miroir, comme le montant vu de face.

Tout se dessine en UNITÉS DE JEU pour un rideau épais de T = 40 (x le long
du rail, z en travers, la hauteur vers la caméra en y négatif), puis chaque
objet est mis à l'échelle : la PÉRIODE (huit lanières) tient dans 1 — le
bruit des matières est pris sur un tore de période 1, le raccord vient par
construction, et deux copies prolongent le tronçon de part et d'autre.

LUMIÈRE NEUTRE (chaud_tole.py : lumiere_neutre). Le dessus pivote avec le
rideau (couché, debout) : un soleil peint éclairerait d'en haut l'un, de
côté l'autre. Le jeu éclaire lui-même.

Dans Blender :
    DOSSIER = r'...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\rideau_dessus.py', encoding='utf-8').read())
    rideau_dessus() ; lance(NOMS, SORTIE, 256)
ou sans interface, avec le module bpy (pip install bpy) :
    python3 -c "DOSSIER='tools/images/blender'; SORTIE='/chemin/rendus'; \\
      exec(open(DOSSIER + '/rideau_dessus.py', encoding='utf-8').read()); \\
      rideau_dessus(gpu=False); [print(rend(n, SORTIE, 256)) for n in NOMS]"
puis copier SORTIE/alpha/rideau-dessus.png et rideau-chapeau.png dans
masters/images/sources/ et lancer tools/images/filtres_atlas.py.
"""
import bpy, math, os, random

_src = os.path.join(DOSSIER, 'surfaces.py')
exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

NOMS = ['rideau-dessus', 'rideau-chapeau']
PREFIXE = ''
T = 40.0                      # l'épaisseur du rideau de référence, en unités de jeu
# JUMEAUX de game/formes.ts (rideau.spec.ts les tient) : le pas d'une lanière
# et la largeur d'un montant, en fractions de T
PAS_SUR_T = (880 / 8 / 440) * ((1466 - 116) / 1468) * 1.8
MONTANT_SUR_T = 332 / 1468
LANIERES = 8
PAS = PAS_SUR_T * T
PERIODE = LANIERES * PAS      # ce qui tient dans 1 : 1024 px
K = 1.0 / PERIODE
# en travers (fractions de T) : longeron | fente | rail coiffé | fente | longeron
# — JUMEAUX de RIDEAU_DESSUS (game/formes.ts) : le shader peint dans les fentes
LONGERON = 0.17
FENTE = (0.20, 0.365)
RAIL = (0.40, 0.60)


def filants(at, rng):
    """ce qui file d'un bout à l'autre, d'UN SEUL TENANT sur trois périodes :
    coupés à la période et recopiés, les longerons montraient leur bout
    biseauté — un trait sombre au raccord (essais 1 et 2)"""
    a, b = -PERIODE, 2 * PERIODE
    # les deux longerons, au ras des faces : ce que la tranche montre en rail
    # boulonné, vu d'en haut. Une feuillure les borde vers la fente.
    for z0, z1, l0, l1 in ((0.0, LONGERON, LONGERON, FENTE[0]), (1 - LONGERON, 1.0, 1 - FENTE[0], 1 - LONGERON)):
        at.boite('rail', a, b, z0 * T, z1 * T, -6.0, 0.0, 0)
        at.boite('plat', a, b, l0 * T, l1 * T, -4.2, 0.0, 0.2)
    # le rail porteur, plus bas que les longerons
    at.boite('rail', a, b, RAIL[0] * T, RAIL[1] * T, -3.0, 0.0, 0)


def troncon(at, rng):
    for z0, z1 in ((0.0, LONGERON), (1 - LONGERON, 1.0)):
        zc = (z0 + z1) / 2 * T
        for k in range(LANIERES * 2):
            at.cylindre('ecrou', (k + 0.5) * PAS / 2, zc, 1.15, -7.0, -6.0, 0, seg=6)
    # une entretoise à chaque lanière : elle tient le rail aux longerons, en
    # travers des fentes
    for k in range(LANIERES):
        x = k * PAS
        at.boite('plat', x - 0.55, x + 0.55, LONGERON * T, (1 - LONGERON) * T, -2.6, 0.0, 0.4)
    # les lanières repliées sur le rail, en ÉCAILLES : chacune part sous sa
    # voisine de gauche et monte vers la droite, où elle recouvre la suivante
    # d'un tiers (de face, c'est le même recouvrement). Son bord qui recouvre
    # porte un jonc clair : le reflet que chaque lanière a sur l'image de face
    # — sous la lumière neutre, sans lui, les écailles se fondaient en un
    # ruban uni (essai 1). (Les voisines du bord viennent des copies : les
    # poser ici aussi doublait deux lanières, sorties noires — essai 1.)
    rot = Matrix.Rotation(math.radians(-8.0), 4, 'Z')
    for k in range(LANIERES):
        x0 = k * PAS
        x1 = x0 + PAS * 1.33
        z0, z1 = (RAIL[0] - 0.025) * T, (RAIL[1] + 0.025) * T
        var = rng.uniform(-1, 1)
        at.boite('pvc', x0, x1, z0, z1, -4.6, -3.6, var, rot=rot)
        xm = (x0 + x1) / 2
        dy = -math.sin(math.radians(8.0)) * (x1 - 0.45 - xm)
        at.boite('jonc', x1 - 0.9, x1, z0, z1, -4.75 + dy, -3.6 + dy, var)
        # la pince : une plaquette d'acier, deux rivets
        xc = x0 + PAS * 0.60
        at.boite('plat', xc - PAS * 0.24, xc + PAS * 0.24, 0.445 * T, 0.555 * T, -5.9, -4.2, rng.uniform(-1, 1))
        for dx in (-0.13, 0.13):
            at.dome('rivet', xc + dx * PAS, 0.5 * T, 0.85, -5.9, 0.2)


def chapeau(at, rng):
    m = MONTANT_SUR_T * T
    # le poteau, plus haut que tout le tronçon : il coiffe le bout des rails
    at.boite('rail', 0, m, 0, T, -8.0, 0.0, 0)
    at.boite('plat', 0.7, m - 0.7, 1.0, T - 1.0, -9.0, -8.0, 0.3)
    for z in (4.2, T - 4.2):
        at.cylindre('ecrou', m / 2, z, 1.5, -10.2, -9.0, 0, seg=6)
    # la plaquette gravée, et le voyant cyan du montant
    at.boite('rail', m / 2 - 2.2, m / 2 + 2.2, 0.60 * T, 0.76 * T, -9.5, -9.0, 0)
    at.cylindre('plat', m / 2, 0.36 * T, 2.1, -9.8, -9.0, 0, seg=20)
    at.cylindre('voyant', m / 2, 0.36 * T, 1.35, -10.1, -9.8, 0, seg=20)


def mat_pvc():
    """le PVC givré des lanières : bleu glace pâle, laiteux, plus blanc là où
    le givre a pris (charte : #8fb8cc à #cfe6f2)"""
    mat = bpy.data.materials.new('pvc')
    nt, N, L = noeuds(mat)
    out = N.new('ShaderNodeOutputMaterial')
    b = N.new('ShaderNodeBsdfPrincipled')
    L.new(b.outputs[0], out.inputs[0])
    var = N.new('ShaderNodeAttribute')
    var.attribute_type = 'GEOMETRY'
    var.attribute_name = 'var'
    givre = bruit_tore(nt, 9.0, 9.0, 57, detail=6, rugo=0.7)
    stries = bruit_tore(nt, 140.0, 3.0, 59, detail=2, rugo=0.5)
    t = op(nt, 'ADD', op(nt, 'MULTIPLY', givre, 0.9), op(nt, 'MULTIPLY', var.outputs['Fac'], 0.12))
    t = op(nt, 'ADD', t, op(nt, 'MULTIPLY', op(nt, 'SUBTRACT', stries, 0.5), 0.25))
    coul = melange(nt, rampe(nt, t, 0.30, 0.85), lin((0x66, 0x96, 0xb0)), lin((0xc0, 0xe0, 0xee)))
    L.new(coul, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.38
    return mat


def matieres_rideau():
    # l'acier FROID de la charte (gunmetal bleu nuit), sans rouille : c'est
    # une porte de chambre froide, pas une pièce de la chaufferie
    return {
        'rail': mat_brosse('rd-rail', (0x1c, 0x24, 0x2e), (0x3c, 0x48, 0x56), 61, brosse=0.05),
        'plat': mat_brosse('rd-plat', (0x2a, 0x35, 0x42), (0x58, 0x66, 0x76), 63, brosse=0.08),
        'rivet': mat_simple('rd-rivet', (0x4a, 0x52, 0x5c), rug=0.45, metal=0.6),
        'ecrou': mat_simple('rd-ecrou', (0x44, 0x4c, 0x56), rug=0.45, metal=0.6),
        'pvc': mat_pvc(),
        'jonc': mat_simple('rd-jonc', (0xd4, 0xec, 0xf6), rug=0.3),
        'voyant': mat_simple('rd-voyant', (0x1c, 0x44, 0x5a), rug=0.2, emission=(0x63, 0xb7, 0xe6), force=1.4),
    }


def _corps(P, mats, nom, bati):
    C = sous(P, nom)
    at = Atelier()
    bati(at, random.Random(len(nom) * 61))
    at.objets(C, mats, {'rail': 0.5, 'plat': 0.35, 'pvc': 0.3}, prefixe=nom)
    for ob in C.objects:
        ob.scale = (K, K, K)
    return C


def rideau_dessus(gpu=True):
    vide_scene()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_rideau()
    P = parent(sc, 'rideau-dessus')
    _corps(P, mats, 'rideau-filants', filants)
    C = _corps(P, mats, 'rideau-troncon', troncon)
    copies(P, C, [(-1, 0), (1, 0)])
    declare('rideau-dessus', P, 0, 1, 0, T * K)
    # le chapeau : seul dans son cadre, qu'il remplit — le tronçon lui arrive
    # par la gauche dans le jeu, et s'arrête contre lui
    Q = parent(sc, 'rideau-chapeau')
    _corps(Q, mats, 'rideau-poteau', chapeau)
    declare('rideau-chapeau', Q, 0, MONTANT_SUR_T * T * K, 0, T * K)
    lumiere_neutre(sc)
    sc.cycles.device = 'GPU' if gpu else 'CPU'
