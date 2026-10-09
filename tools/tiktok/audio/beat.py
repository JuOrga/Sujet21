# Tempo fin + phase des temps, par peigne sur l'enveloppe d'attaques
import sys, json, subprocess, numpy as np
SR = 22050; HOP = 128; FPS = SR / HOP
def charge(p):
    o = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(o, np.float32)
def enveloppe(x):
    n = len(x) // HOP; fr = x[: n * HOP].reshape(n, HOP)
    # attaques : flux spectral grossier sur 4 bandes (basse, bas-médium, médium, aigu)
    win = 1024
    pad = np.pad(x, (win // 2, win // 2))
    idx = np.arange(n) * HOP
    frames = np.stack([pad[i:i + win] for i in idx]) * np.hanning(win)
    S = np.abs(np.fft.rfft(frames, axis=1))
    S = np.log1p(10 * S)
    flux = np.maximum(0, np.diff(S, axis=0, prepend=S[:1])).sum(1)
    flux -= np.convolve(flux, np.ones(64) / 64, 'same')
    return np.maximum(flux, 0), np.sqrt((fr ** 2).mean(1))
def tempo(on, lo=70, hi=170):
    t = np.arange(len(on)) / FPS
    best = None
    for bpm in np.arange(lo, hi, 0.1):
        per = 60 / bpm
        ph = np.linspace(0, per, 24, endpoint=False)
        sc = []
        for p in ph:
            k = ((np.arange(p, t[-1], per)) * FPS).astype(int)
            sc.append(on[k].mean())
        sc = np.array(sc); i = sc.argmax()
        if best is None or sc[i] > best[1]: best = (bpm, sc[i], ph[i], sc.mean())
    return best
def principal():
  res = {}
  for p in sys.argv[1:]:
      x = charge(p); on, rms = enveloppe(x)
      bpm, s, ph, moy = tempo(on)
      nom = p.split('/')[-1][:-4]
      sec = [float(rms[int(i * FPS):int((i + 1) * FPS)].mean()) for i in range(int(len(rms) / FPS))]
      res[nom] = dict(bpm=round(float(bpm), 2), phase=round(float(ph), 3), nettete=round(float(s / (moy + 1e-9)), 2), energie=sec)
      print(f'{nom:22s} {bpm:6.2f} bpm  phase {ph:.3f}s  netteté {s / (moy + 1e-9):.2f}')
  json.dump(res, open('beats.json', 'w'))

if __name__ == '__main__':
    principal()
