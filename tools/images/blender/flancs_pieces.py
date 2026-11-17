"""LES FLANCS DES ÉLÉMENTS À PIÈCES (17/11) — la tranche de la chaudière et
celle du surchauffeur, pour le relief 2.5D.

Relief allumé, un mur se dresse : son dessus glisse, sa tranche porte sa
matière. La chaudière et le surchauffeur, eux, sont composés par pièces
(leur dessus est une IMAGE de l'atlas des chaleurs) : l'image se soulevait
bien, mais RIEN ne se peignait entre son pied et elle — la rampe flottait à
plat à côté de parois qui avaient leur volume (le concepteur, 17/11 : « quand
on voit la perspective il n'y a pas de texture pour cet élément »).

Ici, leur SOCLE vu de côté, une bande qui se répète le long de l'arête :
  · flanc-chaud : le carter de la rampe — un socle boulonné, des persiennes
    où rougeoient les résistances, un montant entre deux panneaux, une
    corniche rivetée ;
  · flanc-surch : la borne à vapeur — le même socle, et entre deux cerclages
    le verre où bout la vapeur dorée.

La bande se dessine en UNITÉS DE JEU (x : 0 à PERIODE le long de l'arête ;
h : 0 au pied, HAUTEUR au sommet ; la profondeur vers la caméra, négative),
puis chaque objet est mis à l'échelle : la PERIODE tient dans 1 (le bruit des
matières est pris sur un tore de période 1 : le raccord vient par
construction), la HAUTEUR dans 120 px. Le rendu déborde de MARGE_BANDE px de
chaque côté : chaudiere_atlas.py le ramène à 1024 px (période 992, 16 px de
répétition de part et d'autre — le shader ne lit jamais le bord du cadre).

Dans Blender :
    DOSSIER = r'...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\flancs_pieces.py', encoding='utf-8').read())
    flancs() ; lance(NOMS, SORTIE, 384)
puis copier SORTIE/flanc-chaud.png et flanc-surch.png dans
masters/images/sources/ et lancer tools/images/chaudiere_atlas.py.
"""
import bpy, math, os, random

_src = os.path.join(DOSSIER, 'surfaces.py')
exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

NOMS = ['flanc-chaud', 'flanc-surch']
PERIODE = 580.0     # unités de jeu le long de l'arête, pour une répétition
HAUTEUR = 140.0     # celle d'un mur haut (volume.ts : HAUTEUR_DE_RANG.haut)
PX_HAUT = 120       # la hauteur de la bande dans l'atlas
MARGE_BANDE = 20    # px rendus de chaque côté, que l'assemblage resserre
# (pas MARGE : c'est celle des carreaux de l'atelier, chaud_tole.py)
KX = 1.0 / PERIODE
KZ = PX_HAUT / PX / HAUTEUR
PAS = PERIODE / 4   # un panneau, un cerclage


def socle_et_corniche(at):
    """ce que les deux flancs partagent : la tôle du fond, le socle boulonné
    au pied, la corniche rivetée sous le dessus"""
    at.boite('carter', 0, PERIODE, 0, HAUTEUR, 0.0, 6.0, 0)
    at.boite('rail', -5, PERIODE + 5, 0, 16, -5.0, 0.0, 0)
    at.boite('plat', -5, PERIODE + 5, 122, HAUTEUR, -6.0, 0.0, 0.2)
    at.boite('rail', -5, PERIODE + 5, 117, 122, -3.0, 0.0, 0)
    n = 20
    for k in range(n):
        x = (k + 0.5) * PERIODE / n
        at.cylindre('ecrou', x, 8, 2.8, -7.2, -5.0, 0, seg=6)
        at.dome('rivet', x, 131, 2.0, -6.0, 0.2)


def flanc_chaud(at, rng):
    socle_et_corniche(at)
    for k in range(4):
        x0 = k * PAS
        # le montant entre deux panneaux, trois boulons
        at.boite('rail', x0 - 7, x0 + 7, 16, 117, -4.0, 0.0, 0)
        for h in (30, 66, 103):
            at.cylindre('ecrou', x0, h, 2.6, -6.0, -4.0, 0, seg=6)
        # la persienne : au fond les résistances, devant des lames debout
        a, b = x0 + 24, x0 + PAS - 24
        at.boite('fond', a, b, 36, 104, -0.3, 0.0, 0)
        at.boite('braise', a + 1, b - 1, 38, 102, -0.8, -0.3, 0)
        nl = 11
        for i in range(nl):
            x = a + (i + 0.5) * (b - a) / nl
            at.boite('lame', x - 2.6, x + 2.6, 37, 103, -3.2, -0.8, 0)
        for (p, q, r, s) in ((a - 5, b + 5, 104, 109), (a - 5, b + 5, 31, 36), (a - 5, a, 36, 104), (b, b + 5, 36, 104)):
            at.boite('plat', p, q, r, s, -4.2, 0.0, 0.2)
        # un panneau sur deux, la bande de danger sous la persienne
        if k % 2 == 0:
            at.boite('rayures', a, b, 20, 27, -0.8, 0.0, 0)


def flanc_surch(at, rng):
    socle_et_corniche(at)
    # le verre, et la vapeur qui bout derrière ; deux joncs le sertissent
    at.boite('vapeur', 0, PERIODE, 36, 104, -1.0, 0.0, 0)
    at.boite('plat', -5, PERIODE + 5, 28, 36, -4.5, 0.0, 0.2)
    at.boite('plat', -5, PERIODE + 5, 104, 112, -4.5, 0.0, 0.2)
    for k in range(4):
        x0 = k * PAS
        # le cerclage : une frette d'acier qui ceinture le tube, ses écrous
        at.boite('rail', x0 - 9, x0 + 9, 16, 117, -6.0, 0.0, 0)
        for h in (32, 108):
            for dx in (-4.5, 4.5):
                at.cylindre('ecrou', x0 + dx, h, 2.4, -8.0, -6.0, 0, seg=6)
        # entre deux cerclages, une tringle fine devant le verre
        xm = x0 + PAS / 2
        at.boite('lame', xm - 1.6, xm + 1.6, 36, 104, -3.0, -1.0, 0)


def mat_vapeur():
    """la vapeur surchauffée derrière son verre : de l'ambre profond au blanc
    chaud, en volutes larges (les teintes de `dore`, chaudiere_atlas.py)"""
    mat = mat_simple('vapeur', (0x40, 0x1c, 0x04), rug=0.25, emission=(0xff, 0xb0, 0x28), force=1.0)
    nt = mat.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    # (la bande est tassée en hauteur : 580 unités dans 1 en x, 1195 en z —
    # à 2,2 / 0,5, les volutes sortaient en coulures verticales, essai 1)
    volute = bruit_tore(nt, 3.0, 6.2, 91, detail=5, rugo=0.6)
    t = rampe(nt, volute, 0.28, 0.74)
    c = melange(nt, rampe(nt, t, 0.0, 0.55), lin((0x96, 0x3e, 0x08)), lin((0xff, 0xb0, 0x28)))
    c = melange(nt, rampe(nt, t, 0.55, 1.0), c, lin((0xff, 0xf4, 0xcd)))
    nt.links.new(c, b.inputs['Emission Color'])
    nt.links.new(op(nt, 'MULTIPLY_ADD', t, 1.3, 0.5), b.inputs['Emission Strength'])
    # (le soleil de face reviendrait d'aplomb dans un verre poli : bridé)
    for nom in ('Specular IOR Level', 'Specular'):
        if nom in b.inputs:
            b.inputs[nom].default_value = 0.1
            break
    return mat


def matieres_flancs():
    mats = matieres_biome()
    # l'acier des pièces de l'atlas des chaleurs : sombre, revenu, mangé de
    # rouille aux bords — pas le bleu nuit des parois (essai 1, un cran plus
    # sombre : sous la lumière du jeu, qui assombrit encore le pied et la face
    # à l'ombre, le socle sortait noir)
    mats['carter'] = mat_brosse('fl-carter', (0x2a, 0x2f, 0x36), (0x58, 0x60, 0x6a), 81, brosse=0.06, rouille=(0x4e, 0x30, 0x1a))
    mats['rail'] = mat_brosse('fl-rail', (0x1e, 0x22, 0x28), (0x40, 0x47, 0x50), 83, brosse=0.04, rouille=(0x44, 0x2a, 0x18))
    mats['plat'] = mat_brosse('fl-plat', (0x34, 0x3a, 0x42), (0x66, 0x6e, 0x78), 85, brosse=0.08, rouille=(0x52, 0x34, 0x1c))
    mats['rivet'] = mats['plat']
    mats['ecrou'] = mat_simple('ecrou', (0x4a, 0x4e, 0x54), rug=0.45, metal=0.6)
    mats['fond'] = mat_simple('fond', (0x04, 0x04, 0x05), rug=0.9)
    mats['vapeur'] = mat_vapeur()
    return mats


def bande(sc, mats, nom, bati):
    """une bande : `bati(at, rng)` la pose en unités de jeu, chaque objet est
    ramené à l'échelle de l'atlas, deux copies la prolongent de part et
    d'autre (le raccord), la caméra cadre la période et sa marge"""
    P = parent(sc, nom)
    C = sous(P, nom + '-bande')
    at = Atelier()
    bati(at, random.Random(len(nom) * 53))
    at.objets(C, mats, {'rail': 1.0, 'plat': 0.8, 'lame': 0.5}, prefixe=nom)
    for ob in C.objects:
        ob.scale = (KX, KZ, KZ)
    copies(P, C, [(-1, 0), (1, 0)])
    declare(nom, P, -MARGE_BANDE / PX, 1 + MARGE_BANDE / PX, 0, PX_HAUT / PX, alpha=False)


def flancs():
    vide_scene()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_flancs()
    bande(sc, mats, 'flanc-chaud', flanc_chaud)
    bande(sc, mats, 'flanc-surch', flanc_surch)
    # la lumière de la charte, venue du haut : sur une face verticale, c'est
    # elle qui allume les dessus des reliefs et couche les ombres vers le pied
    lumiere_camera(sc)
    sc.cycles.device = 'GPU'
