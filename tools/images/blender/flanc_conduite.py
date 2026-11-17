"""LE FLANC DE LA CONDUITE D'AMMONIAC (17/11) — sa tranche, pour le relief 2.5D.

Même chantier que flancs_pieces.py (la chaudière et le surchauffeur) : relief
allumé, l'image de la conduite se soulevait sans rien entre son pied et elle.
Ici, la conduite VUE DE CÔTÉ, en une bande qui se répète le long de l'arête :
le tuyau d'acier froid couché de tout son long, la croûte de givre sur son
dos, la barbe de glace et les stalactites sous son ventre, les selles qui le
portent et le bourrelet de givre au pied.

Pas de bride ni de joint : sur le dessus, leur pas suit l'ÉPAISSEUR du bloc
(CONDUITE.motif, en fractions de T), la bande, elle, une période fixe en
unités de jeu — deux brides ne tomberaient jamais l'une sur l'autre. Les
selles, elles, sont sous le tuyau : le dessus ne les montre pas.

Mêmes conventions que flancs_pieces.py : la bande se dessine en UNITÉS DE JEU
(x : 0 à PERIODE ; h : 0 au pied, HAUTEUR au sommet ; l'avant en y négatif),
puis chaque objet est mis à l'échelle ; les copies de part et d'autre font le
raccord (tout ce qui est tiré au hasard dans [0, PERIODE) se répète).

Dans Blender :
    DOSSIER = r'...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\flanc_conduite.py', encoding='utf-8').read())
    flanc_conduite() ; lance(['flanc-conduite'], SORTIE, 384)
puis copier SORTIE/flanc-conduite.png dans masters/images/sources/ et lancer
tools/images/conduite_atlas.py.
"""
import bpy, math, os, random

_src = os.path.join(DOSSIER, 'flancs_pieces.py')
exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

RAYON = 60.0         # le tuyau, givre compris, presque toute la hauteur
AXE = 76.0           # la hauteur de son axe : le dos à 136, le ventre à 16
SELLE = PERIODE / 2  # deux selles par période


def bati_conduite(at, rng):
    # le fond : la face d'ombre sous le ventre, entre les selles
    at.boite('ombre', 0, PERIODE, 0, AXE, 2.0, 8.0, 0)
    # le tuyau couché, de bout en bout — PILE sur la période : un tuyau qui
    # dépassait sous sa copie montrait ses bouchons, un trait sombre à chaque
    # raccord (essai 1)
    at.fut('acier', 0, PERIODE, RAYON - 4.0, 0, 0.0, AXE)
    for k in range(2):
        x = k * SELLE + SELLE / 2
        # la selle : une semelle, une joue qui embrasse le ventre
        at.boite('selle', x - 22, x + 22, 0, 9, -RAYON * 0.55, RAYON * 0.55, 0)
        at.boite('selle', x - 16, x + 16, 9, AXE - RAYON * 0.55, -RAYON * 0.45, -RAYON * 0.30, 0)
        for dx in (-15, 15):
            at.cylindre('ecrou', x + dx, 5, 2.6, -RAYON * 0.6, -RAYON * 0.5, 0, seg=6)
    # LE GIVRE DU DOS est dans la matière du tuyau (mat_acier_givre) ; ici,
    # seulement la CROÛTE qui en déborde : de petits coussins aplatis, serrés
    # sur la ligne du dos, qui cassent l'arête qu'on voit d'en haut.
    # (Essai 1 : de gros coussins ronds, des flocons de coton ; essai 2 : des
    # aiguilles, dont la face à l'ombre se lisait en éclats noirs.)
    for _ in range(360):
        x = rng.uniform(0, PERIODE)
        a = rng.uniform(-0.15, 0.55)
        r = rng.uniform(1.6, 3.6)
        z = AXE + (RAYON - 3.5) * math.cos(a)
        y = -(RAYON - 3.5) * math.sin(a)
        at.coussin('givre', x, z, r * 1.4, r, r * 0.8, y - r * 0.4, 0.3)
    # quelques CRISTAUX dressés sur le dos, en étoile : ceux du dessus de la
    # conduite, vus de profil (le givre luit un peu par lui-même : leur face
    # à l'ombre ne tombe plus au noir, essai 2)
    for _ in range(55):
        x = rng.uniform(0, PERIODE)
        a = rng.uniform(-0.1, 0.35)
        base = (x, -(RAYON - 4.0) * math.sin(a), AXE + (RAYON - 4.0) * math.cos(a))
        for k in range(rng.randint(3, 5)):
            ang = rng.uniform(-1.1, 1.1)
            long = rng.uniform(4.0, 9.0)
            bout = (x + math.sin(ang) * long * 0.5, base[1] - 1.0, base[2] + math.cos(ang) * long)
            at.tube('givre', base, bout, rng.uniform(0.9, 1.6), 0.3, seg=6, r2=0.1)
    # LA BARBE ET LES STALACTITES sous le ventre, plus longues entre les selles
    for _ in range(110):
        x = rng.uniform(0, PERIODE)
        loin = abs((x % SELLE) - SELLE / 2) / (SELLE / 2)  # 0 sur la selle, 1 entre deux
        long = rng.uniform(5.0, 20.0) * (0.35 + loin)
        haut = AXE - RAYON * 0.86 + rng.uniform(-2, 2)
        y = -RAYON * rng.uniform(0.30, 0.55)
        r = rng.uniform(1.0, 2.6)
        at.tube('glace', (x, y, haut + 2.0), (x, y, max(haut - long, 2.0)), r, 0.2, seg=10, r2=0.25)
    # LE BOURRELET DE GIVRE au pied, où l'eau qui coule gèle
    at.boite('givre', -5, PERIODE + 5, 0, 4, -RAYON * 0.7, RAYON * 0.6, 0.2)
    for _ in range(120):
        x = rng.uniform(0, PERIODE)
        r = rng.uniform(1.6, 3.6)
        at.coussin('givre', x, 3.5, r * 1.6, r, r, -RAYON * rng.uniform(0.45, 0.7), 0.3)


def mat_acier_givre():
    """l'acier froid de la conduite, que le givre gagne par le dos : plus la
    face regarde le haut, plus elle est blanche, rompue par un bruit fin en
    plaques — le tronçon de conduite-atlas vu de côté"""
    mat = mat_brosse('cn-acier', (0x2a, 0x34, 0x42), (0x6a, 0x7a, 0x8e), 87, brosse=0.05)
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    b = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
    acier = b.inputs['Base Color'].links[0].from_socket
    geo = N.new('ShaderNodeNewGeometry')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(geo.outputs['Normal'], sep.inputs[0])
    plaques = bruit_tore(nt, 14.0, 9.0, 93, detail=6, rugo=0.7)
    # le haut du dos franchement blanc, le flanc tacheté, le ventre nu
    haut = rampe(nt, sep.outputs['Z'], 0.15, 0.85)
    givre = rampe(nt, op(nt, 'ADD', haut, op(nt, 'MULTIPLY', op(nt, 'SUBTRACT', plaques, 0.5), 1.4)), 0.35, 0.75)
    coul = melange(nt, givre, acier, lin((0xc6, 0xda, 0xec)))
    # LE REFLET : la bande claire qui court le long du tuyau sur l'image du
    # dessus, posée là où la face regarde à mi-hauteur vers le haut (essai 3 :
    # sans elle, l'acier sortait d'un gris sourd à côté du dessus)
    reflet = op(nt, 'MULTIPLY', rampe(nt, sep.outputs['Z'], -0.05, 0.25), rampe(nt, sep.outputs['Z'], 0.55, 0.30))
    coul = melange(nt, op(nt, 'MULTIPLY', reflet, 0.75), coul, lin((0xb4, 0xc8, 0xe0)))
    L.new(coul, b.inputs['Base Color'])
    L.new(op(nt, 'ADD', 0.42, op(nt, 'MULTIPLY', givre, 0.3)), b.inputs['Roughness'])
    L.new(op(nt, 'MULTIPLY', op(nt, 'SUBTRACT', 1.0, givre), 0.45), b.inputs['Metallic'])
    return mat


def matieres_conduite():
    mats = matieres_flancs()
    # l'acier de la conduite : froid, bleu-gris, brossé, sans rouille — les
    # tons du tronçon de conduite-atlas (pas l'acier revenu de la chaudière)
    mats['acier'] = mat_acier_givre()
    mats['selle'] = mat_brosse('cn-selle', (0x1c, 0x21, 0x29), (0x3c, 0x45, 0x52), 91, brosse=0.04)
    mats['ombre'] = mat_simple('cn-ombre', (0x05, 0x07, 0x0a), rug=0.9)
    # le givre : blanc bleuté, mat ; la glace : plus bleue, un peu lisse —
    # jamais transmissive (un verre transmissif sortait gris uni, 13/11)
    mats['givre'] = mat_simple('cn-givre', (0xc4, 0xd8, 0xea), rug=0.55)
    mats['glace'] = mat_simple('cn-glace', (0x8c, 0xb8, 0xdc), rug=0.2)
    for m in (mats['givre'], mats['glace']):
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        # le givre DIFFUSE la lumière dans sa masse : un peu de lueur propre,
        # sans quoi la face d'un cristal à l'ombre sortait noire (essai 2)
        b.inputs['Emission Color'].default_value = b.inputs['Base Color'].default_value
        b.inputs['Emission Strength'].default_value = 0.35
        for nom in ('Specular IOR Level', 'Specular'):
            if nom in b.inputs:
                b.inputs[nom].default_value = 0.15
                break
    return mats


def flanc_conduite():
    vide_scene()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_conduite()
    bande(sc, mats, 'flanc-conduite', bati_conduite)
    lumiere_camera(sc)
    sc.cycles.device = 'GPU'
