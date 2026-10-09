# Choisit le passage d'un morceau : départ sur un premier temps, courbe d'énergie voulue
import sys, json, subprocess, numpy as np
from beat import charge, enveloppe, FPS, SR, HOP
B = json.load(open('beats.json'))
def premiers_temps(nom, path):
    x = charge(path)
    # attaques graves : le premier temps de la mesure porte la basse / le kick
    n = len(x) // HOP
    from numpy.fft import rfft
    on, rms = enveloppe(x)
    bpm, ph = B[nom]['bpm'], B[nom]['phase']; per = 60 / bpm
    # énergie grave par temps
    lo = np.convolve(x, np.ones(64) / 64, 'same')  # passe-bas grossier
    temps = np.arange(ph, len(x) / SR - per, per)
    g = np.array([np.sqrt((lo[int(t * SR):int((t + 0.08) * SR)] ** 2).mean()) for t in temps])
    k = int(np.argmax([g[i::4].mean() for i in range(4)]))
    return temps[k::4], rms, per
def choisit(nom, path, duree, profil):
    mesures, rms, per = premiers_temps(nom, path)
    E = np.array([rms[int(i * FPS / 4):int((i + 1) * FPS / 4)].mean() for i in range(int(len(rms) / FPS * 4))])  # par 0,25 s
    E = E / E.max()
    def moy(a, b): return E[int(a * 4):max(int(a * 4) + 1, int(b * 4))].mean()
    best = None
    for s in mesures:
        if s + duree + 1 > len(E) / 4: break
        if s < 2.5: continue
        sc = profil(lambda a, b: moy(s + a, s + b))
        if np.isnan(sc): continue
        if best is None or sc > best[0]: best = (sc, s)
    return round(float(best[1]), 3), round(float(best[0]), 3), round(60 / per, 2)
import os
M = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../masters/sound/')
out = {}
# V2 : intense de bout en bout, et une entrée franche
out['V2'] = ('zone-chambre-v2',) + choisit('zone-chambre-v2', M + 'zone-chambre-v2.mp3', 17.1, lambda m: m(0, 15) + 0.5 * (m(0, 2) - m(-2, 0)))
# V1 (85,7 BPM, mesure 2,8 s) : retenu sur 3 mesures, puis ça monte à l'arrivée au sas (mesure 4)
b1 = 4 * 60 / 85.7
out['V1'] = ('temps-suspendu-v2',) + choisit('temps-suspendu-v2', M + 'temps-suspendu-v2.mp3', 7 * b1, lambda m: 1.5 * (m(4 * b1, 6 * b1) - m(0, 3 * b1)) + 0.3 * m(0, 7 * b1))
# V3 : régulier, ni trou ni explosion
b3 = 4 * 60 / 99
out['V3'] = ('zone-hublot-v2',) + choisit('zone-hublot-v2', M + 'zone-hublot-v2.mp3', 6 * b3, lambda m: m(0, 6 * b3) - abs(m(0, 3 * b3) - m(3 * b3, 6 * b3)))
print(json.dumps(out, indent=1)); json.dump(out, open('extraits.json', 'w'))
