# Petite boîte à rythmes / synthé en numpy — tout est généré, aucun échantillon externe.
import numpy as np
from scipy import signal
SR = 44100
rng = np.random.default_rng(21)

def t_(d): return np.arange(int(d * SR)) / SR
def env_ad(n, a, d, curve=4.0):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), np.exp(-(t - a) * curve / max(d, 1e-6)))
    return e
def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc / (SR / 2), 0.99), 'low'); return signal.lfilter(b, a, x)
def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high'); return signal.lfilter(b, a, x)
def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band'); return signal.lfilter(b, a, x)
def note_hz(n): return 440.0 * 2 ** ((n - 69) / 12)
def sat(x, k=2.0): return np.tanh(k * x) / np.tanh(k)

def kick(d=0.5, f0=150, f1=45, punch=0.03, dist=1.5):
    t = t_(d)
    f = f1 + (f0 - f1) * np.exp(-t / punch)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 6)
    click = lp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 300) * 0.3
    return sat(x + click, dist)
def k808(d, n, glide_from=None, dist=2.5, decay=1.2):
    t = t_(d)
    f = np.full(len(t), note_hz(n))
    if glide_from is not None:
        f = note_hz(n) + (note_hz(glide_from) - note_hz(n)) * np.exp(-t / 0.08)
    f = f + 120 * np.exp(-t / 0.012)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    x *= np.minimum(1, (len(t) - np.arange(len(t))) / (0.01 * SR))
    return sat(x, dist) * 0.9
def clap(d=0.35):
    t = t_(d)
    nz = rng.standard_normal(len(t))
    e = np.zeros(len(t))
    for o in (0, 0.011, 0.022):
        i = int(o * SR); e[i:] += np.exp(-(t[: len(t) - i]) * (60 if o < 0.02 else 18))
    return bp(nz, 900, 5000) * e * 0.7
def snare(d=0.3, tone=190):
    t = t_(d)
    body = np.sin(2 * np.pi * tone * t) * np.exp(-t * 30)
    nz = hp(rng.standard_normal(len(t)), 1500) * np.exp(-t * 22)
    return sat(0.6 * body + 0.7 * nz, 1.5) * 0.7
def hat(d=0.06, open_=False):
    t = t_(0.35 if open_ else d)
    nz = hp(rng.standard_normal(len(t)), 7000)
    return nz * np.exp(-t * (9 if open_ else 70)) * 0.35
def cowbell(n, d=0.35):
    t = t_(d)
    f = note_hz(n)
    x = signal.square(2 * np.pi * f * t) + signal.square(2 * np.pi * f * 1.48 * t)
    x = bp(x, f * 0.8, f * 4)
    return x * (np.exp(-t * 10) * 0.8 + 0.2 * np.exp(-t * 3)) * 0.4
def saw_voice(n, d, detune=0.12, voices=5, cutoff=1800, a=0.02, r=0.3):
    t = t_(d)
    x = np.zeros(len(t))
    for v in range(voices):
        dt = (v - (voices - 1) / 2) * detune / max(1, voices - 1)
        f = note_hz(n + dt)
        ph = rng.random()
        x += 2 * ((f * t + ph) % 1) - 1
    x /= voices
    x = lp(x, cutoff)
    e = np.minimum(1, t / a) * np.minimum(1, (d - t) / r).clip(0, 1)
    return x * e
def pluck(n, d=0.5, cutoff=3000, decay=6):
    t = t_(d)
    f = note_hz(n)
    x = (2 * ((f * t) % 1) - 1) * 0.6 + np.sin(2 * np.pi * f * t) * 0.6
    cut = 300 + cutoff * np.exp(-t * decay)
    # filtre variable approché par morceaux
    y = np.zeros(len(t)); seg = 512
    zi = None
    for i in range(0, len(t), seg):
        b, a_ = signal.butter(2, min(cut[i] / (SR / 2), 0.99), 'low')
        if zi is None: zi = signal.lfilter_zi(b, a_) * 0
        y[i:i + seg], zi = signal.lfilter(b, a_, x[i:i + seg], zi=zi)
    return y * np.exp(-t * decay * 0.6)
def bell(n, d=1.2):
    t = t_(d); f = note_hz(n)
    x = np.sin(2 * np.pi * f * t + 2.0 * np.sin(2 * np.pi * f * 3.5 * t) * np.exp(-t * 4))
    return x * np.exp(-t * 3) * 0.5
def riser(d=2.0, f0=200, f1=3000):
    t = t_(d)
    nz = rng.standard_normal(len(t))
    y = np.zeros(len(t)); seg = 1024; zi = None
    for i in range(0, len(t), seg):
        fc = f0 * (f1 / f0) ** (t[i] / d)
        b, a_ = signal.butter(2, [fc * 0.7 / (SR / 2), min(fc * 1.4 / (SR / 2), 0.99)], 'band')
        if zi is None: zi = signal.lfilter_zi(b, a_) * 0
        y[i:i + seg], zi = signal.lfilter(b, a_, nz[i:i + seg], zi=zi)
    return y * (t / d) ** 2 * 0.8
def impact(d=2.5):
    t = t_(d)
    boom = np.sin(2 * np.pi * np.cumsum(30 + 90 * np.exp(-t / 0.05)) / SR) * np.exp(-t * 2.2)
    nz = lp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 5) * 0.5
    return sat(boom + nz, 1.8)
def reverb(x, dur=2.2, mix=0.3, damp=3000):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 6.9 / dur)
    ir = lp(ir, damp)
    ir /= np.sqrt(np.sum(ir ** 2))
    if x.ndim == 1:
        w = signal.fftconvolve(x, ir)[: len(x)]
        return x * (1 - mix) + w * mix
    return np.stack([reverb(x[:, c], dur, mix, damp) for c in range(x.shape[1])], 1)
def delay(x, t, fb=0.35, mix=0.3):
    d = int(t * SR); y = x.copy()
    for k in range(1, 6):
        g = fb ** k
        if d * k >= len(x): break
        y[d * k:] += x[: len(x) - d * k] * g * mix / fb
    return y
class Piste:
    def __init__(self, dur):
        self.L = np.zeros(int(dur * SR) + SR); self.R = np.zeros(int(dur * SR) + SR)
    def add(self, x, at, gain=1.0, pan=0.0):
        i = int(at * SR)
        if i >= len(self.L): return
        x = x[: len(self.L) - i]
        gl = gain * np.sqrt((1 - pan) / 2) * 1.414; gr = gain * np.sqrt((1 + pan) / 2) * 1.414
        self.L[i:i + len(x)] += x * gl; self.R[i:i + len(x)] += x * gr
    def stereo(self): return np.stack([self.L, self.R], 1)
def duck(st, temps, depth=0.6, rel=0.18):
    """side-chain : on creuse la piste à chaque coup de kick"""
    g = np.ones(len(st))
    for t0 in temps:
        i = int(t0 * SR); n = int(rel * 2.5 * SR)
        e = 1 - depth * np.exp(-np.arange(n) / SR / rel * 2)
        j = min(len(g), i + n); g[i:j] = np.minimum(g[i:j], e[: j - i])
    return st * g[:, None]
def master(st, cible_db=-11.0):
    st = st - st.mean(0)
    st = hp(st.T, 28).T
    pk = np.max(np.abs(st)) + 1e-9
    st = st / pk
    st = np.tanh(st * 1.6) / np.tanh(1.6)
    rms = np.sqrt(np.mean(st ** 2))
    st = st * (10 ** (cible_db / 20) / rms)
    st = np.clip(st, -0.98, 0.98)
    return st
def ecrit(path, st):
    from scipy.io import wavfile
    wavfile.write(path, SR, (st * 32767).astype(np.int16))
