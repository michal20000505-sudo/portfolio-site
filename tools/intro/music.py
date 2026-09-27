"""5 s energetyczny podkład, 120 BPM, a-moll. Siatka: beat = 0.5 s, 16tka = 0.125 s.
Pierwszy downbeat w 0.5 s, impact w 3.5 s. Zgrane z intro.html."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
DUR = 5.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)
revL = np.zeros(N); revR = np.zeros(N)   # wysyłka na pogłos
duck = np.ones(N)                        # sidechain od stopy

def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def idx(t): return int(round(t * SR))

def add(sig, t, gain=1.0, pan=0.0, rev=0.0):
    i = idx(t)
    if i >= N: return
    s = sig[: N - i] * gain
    gl = np.cos((pan + 1) * np.pi / 4); gr = np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(s)] += s * gl; R[i:i + len(s)] += s * gr
    if rev:
        revL[i:i + len(s)] += s * gl * rev; revR[i:i + len(s)] += s * gr * rev

def env_exp(n, tau): return np.exp(-np.arange(n) / (tau * SR))

def filt(x, kind, f, order=2):
    if isinstance(f, (list, tuple)):
        sos = butter(order, [f[0] / (SR / 2), f[1] / (SR / 2)], btype=kind, output='sos')
    else:
        sos = butter(order, f / (SR / 2), btype=kind, output='sos')
    return sosfilt(sos, x)

def saw(freq, n, maxh=16000):
    t = np.arange(n) / SR
    out = np.zeros(n)
    ph = rng.uniform(0, 2 * np.pi)
    k = 1
    while k * freq < maxh and k < 80:
        out += np.sin(2 * np.pi * freq * k * t + ph * k) / k
        k += 1
    return out * (2 / np.pi)

# ---------- instrumenty ----------
def kick(big=False):
    n = idx(0.9 if big else 0.4)
    t = np.arange(n) / SR
    f = 45 + 140 * np.exp(-t / 0.035) if not big else 32 + 170 * np.exp(-t / 0.05)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env_exp(n, 0.32 if big else 0.16)
    click = filt(rng.standard_normal(n), 'highpass', 2500) * env_exp(n, 0.004) * 0.5
    return np.tanh((body + click) * 1.6)

def clap():
    n = idx(0.35)
    noise = filt(rng.standard_normal(n), 'bandpass', (900, 4500))
    e = np.zeros(n)
    for d in (0.0, 0.011, 0.022):
        j = idx(d); e[j:] += env_exp(n - j, 0.006 if d < 0.02 else 0.09)
    return noise * e * 0.9

def hat(open_=False):
    n = idx(0.25 if open_ else 0.06)
    x = filt(rng.standard_normal(n), 'highpass', 7500)
    return x * env_exp(n, 0.07 if open_ else 0.012)

def snare_hit():
    n = idx(0.12)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 190 * t) * env_exp(n, 0.03)
    nz = filt(rng.standard_normal(n), 'bandpass', (1500, 8000)) * env_exp(n, 0.04)
    return tone * 0.5 + nz

def supersaw(notes, dur, cutoff, tau, voices=7, spread=0.18):
    n = idx(dur)
    l = np.zeros(n); r = np.zeros(n)
    for m in notes:
        for v in range(voices):
            det = (v - (voices - 1) / 2) / ((voices - 1) / 2) * spread
            s = saw(midi(m + det), n)
            p = (v / (voices - 1)) * 2 - 1
            l += s * (1 - p) / 2; r += s * (1 + p) / 2
    e = env_exp(n, tau) * np.minimum(1, np.arange(n) / (0.003 * SR))
    l = filt(l, 'lowpass', cutoff, 2) * e; r = filt(r, 'lowpass', cutoff, 2) * e
    g = 1 / (len(notes) * voices) * 2.2
    return l * g, r * g

def add_st(lr, t, gain=1.0, rev=0.0):
    l, r = lr
    i = idx(t)
    if i >= N: return
    l = l[: N - i] * gain; r = r[: N - i] * gain
    L[i:i + len(l)] += l; R[i:i + len(r)] += r
    if rev:
        revL[i:i + len(l)] += l * rev; revR[i:i + len(r)] += r * rev

def bass_note(m, dur):
    n = idx(dur)
    s = saw(midi(m), n, 4000) * 0.6 + np.sin(2 * np.pi * midi(m) * np.arange(n) / SR) * 0.7
    e = env_exp(n, 0.09) * np.minimum(1, np.arange(n) / (0.002 * SR))
    fe = filt(s, 'lowpass', 900, 2)
    return np.tanh(fe * e * 1.5)

def pluck(m, dur=0.2):
    n = idx(dur)
    s = saw(midi(m), n, 12000) * 0.5 + saw(midi(m) * 1.004, n, 12000) * 0.5
    return filt(s, 'lowpass', 3800, 2) * env_exp(n, 0.06)

def riser(t0, t1, f0, f1, gain):
    """szum z przestrajanym filtrem pasmowym (SVF), narastający"""
    n = idx(t1 - t0)
    x = rng.standard_normal(n)
    y = np.zeros(n); low = 0.0; band = 0.0
    q = 0.35
    fs = f0 * (f1 / f0) ** (np.arange(n) / n)
    for i in range(n):
        f = 2 * np.sin(np.pi * fs[i] / SR)
        low += f * band
        high = x[i] - low - q * band
        band += f * high
        y[i] = band
    e = (np.arange(n) / n) ** 2
    return y * e * gain

def crash(dur=1.6):
    n = idx(dur)
    x = filt(rng.standard_normal(n), 'highpass', 4000)
    return x * env_exp(n, 0.45)

def sub_drop(t0):
    n = idx(1.4)
    t = np.arange(n) / SR
    f = 30 + 50 * np.exp(-t / 0.25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.6)

def sidechain(t, depth=0.65, rel=0.18):
    i = idx(t)
    n = min(N - i, idx(0.45))
    tt = np.arange(n) / SR
    g = 1 - depth * np.exp(-tt / rel * 2.2)
    duck[i:i + n] = np.minimum(duck[i:i + n], g)

# ---------- aranżacja ----------
B = 0.5; S = 0.125
# 0.0-0.5 : wejście - riser + tykające 16tki (arpeggio w górę)
add(riser(0.0, 0.5, 400, 7000, 0.10), 0.0, pan=0.0, rev=0.3)
for k, m in enumerate([69, 72, 76, 81]):
    add(pluck(m, 0.14), k * S, 0.30 + k * 0.05, pan=(-0.4 if k % 2 else 0.4), rev=0.35)

drops = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
chords = {0.5: [57, 60, 64, 69], 1.0: [57, 60, 64, 69], 1.5: [53, 57, 60, 65], 2.0: [53, 57, 60, 65],
          2.5: [55, 59, 62, 67], 3.0: [52, 56, 59, 64]}
bassn = {0.5: 33, 1.0: 33, 1.5: 29, 2.0: 29, 2.5: 31, 3.0: 28}

for t in drops:
    add(kick(), t, 0.95); sidechain(t)
    add_st(supersaw(chords[t], 0.42, 5200, 0.10), t, 0.55 if t != 0.5 else 0.8, rev=0.25)
    if t in (1.0, 2.0, 3.0):
        add(clap(), t, 0.55, rev=0.35)
    # offbeat hat + bas na ósemkach
    if t < 3.0:
        add(hat(True), t + 0.25, 0.22, pan=0.3)
        for j, off in enumerate((0.125, 0.25, 0.375)):
            add(bass_note(bassn[t] + (12 if j == 1 else 0), 0.12), t + off, 0.42)
    for j in range(4):
        add(hat(), t + j * S, 0.10 + (0.06 if j % 2 else 0), pan=-0.25)

add(crash(1.2), 0.5, 0.18, rev=0.2)

# arpeggio trance w 16tkach nad całością dropu (0.5-3.0)
arp = {0.5: [69, 72, 76, 72], 1.0: [69, 72, 76, 81], 1.5: [65, 69, 72, 69], 2.0: [65, 69, 72, 77],
       2.5: [67, 71, 74, 79], 3.0: [68, 71, 76, 80]}
for t, ns in arp.items():
    for j, m in enumerate(ns):
        add(pluck(m + 12, 0.11), t + j * S, 0.13, pan=(0.5 if j % 2 else -0.5), rev=0.3)

# 3.0-3.5 : build - werbel coraz gęściej + riser
roll = [3.0 + j * S for j in range(4)] + [3.25 + j * S / 2 for j in range(4)]
for k, t in enumerate(roll):
    add(snare_hit(), t, 0.25 + k * 0.05, pan=(0.15 if k % 2 else -0.15), rev=0.25)
add(riser(3.0, 3.5, 600, 12000, 0.16), 3.0, rev=0.4)

# 3.5 : IMPACT - MJ.
add(kick(big=True), 3.5, 1.05); sidechain(3.5, 0.8, 0.3)
add(sub_drop(3.5), 3.5, 0.55)
add(crash(1.5), 3.5, 0.35, rev=0.4)
add_st(supersaw([45, 57, 60, 64, 69, 72], 1.2, 6500, 0.35, spread=0.25), 3.5, 1.0, rev=0.5)

# 3.5-5.0 : outro - dekodowanie napisu w 16tkach, ostatni akcent 4.5
for k in range(6):
    t = 3.75 + k * S / 2 * 1.0
for k in range(8):   # tyknięcia dekodera
    add(pluck(84 + (k % 4) * 3, 0.05), 3.75 + k * S / 2, 0.08, pan=(k / 7) * 1.4 - 0.7, rev=0.2)
add(kick(), 4.0, 0.7); sidechain(4.0)
add(clap(), 4.0, 0.4, rev=0.5)
add(hat(True), 4.25, 0.18, pan=0.3)
add(kick(), 4.5, 0.85); sidechain(4.5, 0.7, 0.25)
add_st(supersaw([57, 64, 69, 72, 76], 0.9, 4200, 0.28, spread=0.22), 4.5, 0.75, rev=0.6)
add(crash(0.8), 4.5, 0.12, rev=0.3)

# ---------- miks ----------
# bas i pady pod sidechainem (wszystko poza stopą ducka - uproszczenie: duck całej sumy poza stopami robimy
# osobno trudno, więc duck tylko pogłosu i lekko całości)
ir_n = idx(1.8)
tt = np.arange(ir_n) / SR
irL = rng.standard_normal(ir_n) * np.exp(-tt / 0.45); irR = rng.standard_normal(ir_n) * np.exp(-tt / 0.45)
irL = filt(irL, 'lowpass', 6000); irR = filt(irR, 'lowpass', 6000)
irL /= np.sqrt(np.sum(irL ** 2)); irR /= np.sqrt(np.sum(irR ** 2))
wetL = fftconvolve(filt(revL, 'highpass', 300), irL)[:N] * 0.9
wetR = fftconvolve(filt(revR, 'highpass', 300), irR)[:N] * 0.9

outL = L + wetL * duck
outR = R + wetR * duck
# sidechain "pump" na całości poza transjentem stopy
outL *= 0.75 + 0.25 * duck; outR *= 0.75 + 0.25 * duck

# fade na końcu
fade = np.ones(N); fn = idx(0.35); fade[-fn:] = np.linspace(1, 0, fn) ** 1.5
outL *= fade; outR *= fade

peak = max(np.abs(outL).max(), np.abs(outR).max())
outL = np.tanh(outL / peak * 1.6) / np.tanh(1.6) * 0.93
outR = np.tanh(outR / peak * 1.6) / np.tanh(1.6) * 0.93
st = np.stack([outL, outR], 1)
wavfile.write('music.wav', SR, (st * 32767).astype(np.int16))
print('ok', peak)
