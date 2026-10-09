import numpy as np
from synth import *

def phonk(path):
    bpm = 130; b = 60 / bpm; bar = 4 * b; nb = 9
    P = Piste(nb * bar + 3); D = Piste(nb * bar + 3); B = Piste(nb * bar + 3)
    riff = [77, None, 80, None, 84, None, 80, 77, None, 85, None, 84, None, 80, None, 82]
    riff2 = [77, None, 80, None, 84, None, 87, 85, None, 84, None, 80, None, 77, 75, None]
    kicks = []
    for k in range(nb):
        t0 = k * bar
        r = riff if k % 2 == 0 else riff2
        for i, n in enumerate(r):
            if n is None: continue
            cb = cowbell(n, 0.3)
            if k == 0: cb = lp(cb, 1400)
            P.add(cb, t0 + i * b / 4, 0.55, pan=0.15 if i % 2 else -0.15)
        if k == 0:
            P.add(riser(bar, 300, 6000), t0, 0.35)
            for i in range(8): D.add(hat(), t0 + i * b / 2, 0.5)
            B.add(k808(b * 1.2, 29, glide_from=41), t0 + 3 * b, 0.9)
            continue
        if k == 8:  # carte de fin : le riff seul, l'impact, la queue
            D.add(impact(3.0), t0, 0.8); B.add(k808(bar, 29, decay=1.5), t0, 0.9); kicks.append(t0)
            continue
        stop = (k == 5)  # « les murs ont soif » : le coup d'arrêt
        pat_k = [0, 1.5, 2.5] if k % 2 else [0, 0.75, 2.5, 3.25]
        for kb in pat_k:
            if stop and kb >= 2: continue
            D.add(kick(0.4, dist=2.2), t0 + kb * b, 0.9); kicks.append(t0 + kb * b)
        for cb_ in (1, 3):
            if stop and cb_ == 3: continue
            D.add(clap(), t0 + cb_ * b, 0.8); D.add(snare(), t0 + cb_ * b, 0.35)
        for i in range(16 if not stop else 8):
            roll = (k % 2 == 1 and i >= 12)
            if i % 2 == 0 or roll:
                D.add(hat(), t0 + i * b / 4, 0.45 if i % 4 == 0 else 0.3, pan=0.3)
        if roll if False else (k % 2 == 1):
            for j in range(6): D.add(hat(0.03), t0 + 3.5 * b + j * b / 12, 0.25, pan=0.3)
        D.add(hat(open_=True), t0 + 2.5 * b, 0.3, pan=-0.3)
        bass = [29, 29, 32, 27] if k % 2 == 0 else [29, 25, 27, 24]
        for i, n in enumerate(bass):
            if stop and i >= 2: continue
            B.add(k808(b * 0.95, n, glide_from=(bass[i - 1] if i else None), dist=3), t0 + i * b, 0.85)
        if stop:
            P.add(riser(2 * b, 2000, 200), t0 + 2 * b, 0.2)
            D.add(impact(1.2), t0 + 4 * b - 0.02, 0.0)
    D.add(impact(2.0), 1 * bar, 0.55)  # la goutte tombe dans le rythme
    D.add(impact(2.0), 6 * bar, 0.5)
    st = duck(reverb(P.stereo(), 1.8, 0.25), kicks, 0.5) + D.stereo() + duck(B.stereo(), kicks, 0.3)
    ecrit(path, master(st, -10.5)); return bpm

def lofi(path):
    bpm = 90; b = 60 / bpm; bar = 4 * b; nb = 7
    P = Piste(nb * bar + 4); D = Piste(nb * bar + 4); M = Piste(nb * bar + 4)
    chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59, 64], [55, 59, 62, 64]]  # Am7 Fmaj7 Cmaj7 G6
    bass = [45, 41, 36, 43]
    mel = [(0, 76), (0.75, 74), (1.5, 72), (2, 69), (3, 72), (3.5, 74)]
    kicks = []
    for k in range(nb):
        t0 = k * bar; c = chords[k % 4]
        for n in c: P.add(saw_voice(n, bar + 0.3, cutoff=900 if k < 3 else 1500, a=0.25, r=0.6), t0, 0.16)
        if k >= 1:
            P.add(lp(saw_voice(bass[k % 4] - 12, bar, voices=1, cutoff=300, a=0.01), 200), t0, 0.7)
        if k in (1, 2, 4, 5):
            for (o, n) in mel:
                n2 = n if k in (1, 4) else n - (2 if n != 69 else 0)
                M.add(pluck(n2, 0.6, 2500), t0 + o * b, 0.28, pan=0.2)
        if k == 6:
            M.add(bell(81, 2.5), t0, 0.3); M.add(bell(76, 2.5), t0 + b, 0.25)
        if k == 0:
            # intro : vinyle et pas de batterie, juste le pad et une cloche
            M.add(bell(76, 2.0), t0 + 0.0, 0.25); M.add(bell(81, 2.0), t0 + 2 * b, 0.2)
            continue
        if k == 3: P.add(riser(bar * 0.9, 300, 5000), t0 + bar * 0.1, 0.22)
        if k == 6:
            D.add(impact(3), t0, 0.6); kicks.append(t0); continue
        half = (k == 3)
        for kb in ([0, 2.5] if not half else [0]):
            D.add(kick(0.45, f0=120, f1=48, dist=1.4), t0 + kb * b, 0.8); kicks.append(t0 + kb * b)
        for sb in (1, 3):
            D.add(clap(0.25), t0 + sb * b, 0.45 if not half else 0.25)
        for i in range(8):
            D.add(hat(0.05), t0 + i * b / 2 + (0.03 if i % 2 else 0), 0.3 if i % 2 == 0 else 0.18, pan=0.25)
        if k >= 4:
            for j in range(6): D.add(hat(0.03), t0 + 3 * b + j * b / 6, 0.15, pan=0.25)
    D.add(impact(2.5), 4 * bar, 0.55)  # l'arrivée au sas
    vin = lp(rng.standard_normal(len(P.L)), 3000) * 0.012
    for i in rng.integers(0, len(P.L), 120): vin[i] += rng.uniform(-0.25, 0.25)
    st = duck(reverb(P.stereo() + M.stereo(), 2.5, 0.3), kicks, 0.35) + D.stereo()
    st[:, 0] += vin; st[:, 1] += vin
    st = lp(st.T, 9000).T
    ecrit(path, master(st, -12)); return bpm

def hypno(path):
    bpm = 100; b = 60 / bpm; bar = 4 * b; nb = 6
    P = Piste(nb * bar + 4); D = Piste(nb * bar + 4); A = Piste(nb * bar + 4)
    prog = [[48, 51, 55, 58, 62], [44, 48, 51, 55, 60], [41, 44, 48, 51, 55], [43, 47, 50, 53, 58]]  # Cm9 Ab Fm G7
    kicks = []
    for k in range(nb):
        t0 = k * bar; c = prog[k % 4]
        for n in c[:3]: P.add(saw_voice(n, bar + 0.4, cutoff=700, a=0.4, r=0.8, detune=0.2), t0, 0.14)
        arp = c[1:] + [c[2] + 12, c[3] + 12]
        for i in range(16):
            n = arp[(i * 3) % len(arp)] + 12
            A.add(pluck(n, 0.4, 3500, decay=9), t0 + i * b / 4, 0.18 if i % 4 else 0.26, pan=0.4 * np.sin(i))
        if k >= 1:
            for kb in (0, 2):
                D.add(kick(0.5, f0=110, f1=42, dist=1.2), t0 + kb * b, 0.65); kicks.append(t0 + kb * b)
            for i in range(8): D.add(hat(0.04), t0 + i * b / 2 + b / 4, 0.18, pan=-0.3)
            D.add(clap(0.3), t0 + 3 * b, 0.3)
        A.add(bell(c[0] + 36, 2.0), t0, 0.12)
    A2 = A.stereo(); A2 = np.stack([delay(A2[:, 0], b * 0.75, 0.4, 0.5), delay(A2[:, 1], b * 0.5, 0.4, 0.5)], 1)
    st = duck(reverb(P.stereo() + A2, 3.0, 0.35), kicks, 0.3) + D.stereo()
    # boucle : la queue retombe sur l'attaque
    ecrit(path, master(st, -12.5)); return bpm

if __name__ == '__main__':
    import sys
    for f in sys.argv[1:]:
        print(f, {'phonk': phonk, 'lofi': lofi, 'hypno': hypno}[f](f + '.wav'))
