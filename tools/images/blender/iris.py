"""L'IRIS, la bouche du sas de sortie (18/11) — `iris.webp` refait dans
Blender (docs/assets-ia.md §4).

L'ancien était OPAQUE sur un fond brun (33 % de pixels chauds) et son anneau
VERT — la charte réserve le vert à la serre et fait de l'iris l'accent
sarcelle ; ses veilleuses sont ambre, comme celles du sas de raccord, dont il
se lit comme le frère (même acier, mêmes veilleuses : sas_raccord.py).

LES RAYONS SONT CEUX DU SHADER (renderer.ts, la bouche du sas) : l'image
couvre 2 · frameR, le shader la découpe au cercle de 0,45 de la largeur, et
fait TOURNER ce qui est à moins de 0,40 · frameR du centre, en fondu jusqu'à
0,55 — soit, sur 1024 px, les lamelles jusqu'à 205 px du centre, la
transition de 205 à 282 px, le cadre fixe au-delà. La transition doit donc
être INVARIANTE PAR ROTATION (des anneaux lisses : rien n'y trahit qu'elle
tourne) ; l'anneau lumineux du shader respire à 281 px.

Unités : 1 = 1024 px, centre en (0, 0,5), l'avant en y négatif.

Dans Blender :
    DOSSIER = r'...\\tools\\images\\blender'
    exec(open(DOSSIER + r'\\iris.py', encoding='utf-8').read())
    iris() ; lance(['iris'], SORTIE, 384)
puis copier SORTIE/alpha/iris.png dans masters/images/ et lancer prepare.py iris.
"""
import bpy, bmesh, math, os
from mathutils import Matrix, Vector

_src = os.path.join(DOSSIER, 'sas_raccord.py')
exec(compile(open(_src, encoding='utf-8').read(), _src, 'exec'), globals())

CX, CZ = 0.0, 0.5
R_LAMES = 205 / 1024        # ce qui tourne
R_TRANSITION = 282 / 1024   # la fin du fondu : au-delà, le cadre fixe
R_CADRE = 440 / 1024        # le bord du cadre, sous la découpe du shader (461 px)
R_TROU = 0.06


def matieres_iris():
    mats = matieres_sas()
    mats['lame'] = mat_brosse('iris-lame', (0x26, 0x2b, 0x31), (0x62, 0x6a, 0x74), 71, brosse=0.14)
    # le sarcelle de la charte (#63b7e6), qui luit — un filet, pas un néon
    mats['sarcelle'] = mat_simple('iris-sarcelle', (0x14, 0x3a, 0x4c), rug=0.3, emission=(0x63, 0xb7, 0xe6), force=1.6)
    return mats


def lames(at):
    """douze lamelles d'obturateur en moulinet autour du trou : chacune un
    rectangle tangent au trou, INCLINÉ sur sa longueur pour accrocher la
    lumière (essai 1, à plat : les huit lamelles se fondaient en un disque
    uni autour d'un octogone), un liseré clair au bord d'attaque, une ombre
    au bord de fuite"""
    n, w, L, a = 12, 0.13, 0.24, 0.025
    for k in range(n):
        th = 2 * math.pi * k / n
        nr = Vector((math.cos(th), 0, math.sin(th)))
        tg = Vector((-math.sin(th), 0, math.cos(th)))
        c = Vector((CX, 0, CZ)) + nr * (R_TROU + w / 2) + tg * (L / 2 - a)
        # (essai 2 : couchées devant, leur bout incliné passait par-dessus
        # l'anneau ; reculées, l'anneau de transition les recouvre)
        y = 0.035 - 0.0022 * k
        rot = Matrix.Rotation(-(th + math.pi / 2), 4, 'Y') @ Matrix.Rotation(0.25, 4, 'X')
        at.boite('lame', c.x - L / 2, c.x + L / 2, c.z - w / 2, c.z + w / 2, y - 0.002, y, 0.25 * math.sin(3 * th), rot=rot)
        bord = c + nr * (-w / 2 + 0.005)
        at.boite('chrome', bord.x - L / 2, bord.x + L / 2, bord.z - 0.0035, bord.z + 0.0035, y - 0.004, y - 0.002, 0, rot=rot)
        fuite = c + nr * (w / 2 - 0.006)
        at.boite('creux', fuite.x - L / 2, fuite.x + L / 2, fuite.z - 0.006, fuite.z + 0.006, y - 0.004, y - 0.002, 0, rot=rot)
    # le trou, noir profond, derrière les lamelles
    at.cylindre('creux', CX, CZ, R_LAMES, 0.05, 0.06, 0, seg=96)


def cadre(at):
    """la transition (anneaux lisses, invariants par rotation), le filet
    sarcelle, puis le cadre fixe : soudure, boulons, quatre veilleuses"""
    at.anneau('acier', CX, CZ, R_TRANSITION, R_LAMES - 0.004, -0.03, 0.0, -0.2, seg=128)
    at.anneau('sarcelle', CX, CZ, 0.262, 0.252, -0.033, -0.03, 0, seg=128)
    at.anneau('creux', CX, CZ, R_LAMES + 0.006, R_LAMES - 0.004, -0.032, -0.03, 0, seg=128)
    at.anneau('bride', CX, CZ, R_CADRE, R_TRANSITION, -0.05, 0.0, -0.1, seg=128)
    # la soudure du cadre, et sa couronne de boulons
    at.anneau('creux', CX, CZ, 0.318, 0.312, -0.052, -0.05, 0, seg=128)
    for k in range(24):
        a = 2 * math.pi * (k + 0.5) / 24
        at.cylindre('acier', CX + 0.395 * math.cos(a), CZ + 0.395 * math.sin(a), 0.011, -0.062, -0.05, 0, seg=6)
    # quatre veilleuses ambre, en diagonale, sur leurs platines
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        x, z = CX + 0.35 * math.cos(a), CZ + 0.35 * math.sin(a)
        veilleuse(at, x, z, -0.05)


def iris():
    vide_scene()
    PIECES.clear()
    sc = bpy.context.scene
    mats = matieres_iris()
    nom = 'iris'
    P = parent(sc, nom)
    at = Atelier()
    lames(at)
    cadre(at)
    at.objets(P, mats, dict(BISEAU_SAS, lame=0.0015), True, nom)
    declare(nom, P, -0.5, 0.5, 0.0, 1.0)
    lumiere_camera(sc)
    sc.cycles.device = 'GPU'
