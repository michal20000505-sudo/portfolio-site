"""Ścieżka do reelsa OVERPRINT: 33,75 s, 128 BPM (72 beaty), e-moll (i–VI–III–VII).

Siatka jest wspólna z animacją (src/director.js, src/core.js): beat = 60/128 s.
  B0–4    druk logo: płyty C, M, Y na ósemkach, naklejki, krople spadają ze świstem, ULT na B4
  B4–12   groove + chiptune, odjazd kamery na B8, licznik fal (blipy w górę)
  B12–24  dwanaście broni: każda ma swój dźwięk dokładnie na swoim beacie
  B24–31  tusze: soczewki (pluck), mieszanki (staby), K, werbel i riser, cisza, ULT na B31
  B32–40  bossowie: cztery ciężkie staby, drop na B36 (KRAJARKA, cięcia, lead)
  B40–44  karty (kliknięcia, power-up przy wyborze), sklep, moneta przy zakupie
  B44–52  koniec nakładu: nabijanie wyniku, pisanie nicku, ZAPISZ, cisza, drop tablicy na B48
  B52–64  strona portfolio: pad, pluck, połówki, szuranie przewijania, tapnięcia, GRAJ, werbel do B64
  B64–72  finał: płyty logo, ZAGRAJ / ZA DARMO, lead, akord końcowy
Uruchom:  python music.py   → music.wav
"""

import numpy as np
import numba as nb
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
BPM = 128
BEAT = 60 / BPM
S16 = BEAT / 4
BAR = BEAT * 4
DUR = 72 * BEAT                  # 33,75 s
N = int(SR * (DUR + 3))          # zapas na ogony, przycinane na końcu
rng = np.random.default_rng(2026)


def tb(beat):                     # czas globalnego beatu (może być ułamkowy)
    return beat * BEAT


def midi(m):
    return 440.0 * 2 ** ((np.asarray(m, dtype=float) - 69) / 12)


def idx(t):
    return int(round(t * SR))


# ------------------------------------------------------------------ DSP (numba)
@nb.njit(cache=True)
def osc_saw(freq, phase):
    n = len(freq)
    out = np.empty(n)
    p = phase
    for i in range(n):
        dt = freq[i] / SR
        p += dt
        if p >= 1.0:
            p -= 1.0
        v = 2.0 * p - 1.0
        if p < dt:
            t = p / dt
            v -= t + t - t * t - 1.0
        elif p > 1.0 - dt:
            t = (p - 1.0) / dt
            v -= t * t + t + t + 1.0
        out[i] = v
    return out


@nb.njit(cache=True)
def osc_pulse(freq, duty, phase):
    n = len(freq)
    out = np.empty(n)
    p = phase
    for i in range(n):
        dt = freq[i] / SR
        p += dt
        if p >= 1.0:
            p -= 1.0
        v = 1.0 if p < duty else -1.0
        # polyBLEP na obu zboczach
        if p < dt:
            t = p / dt
            v += t + t - t * t - 1.0
        elif p > 1.0 - dt:
            t = (p - 1.0) / dt
            v += t * t + t + t + 1.0
        q = p - duty
        if q < 0:
            q += 1.0
        if q < dt:
            t = q / dt
            v -= t + t - t * t - 1.0
        elif q > 1.0 - dt:
            t = (q - 1.0) / dt
            v -= t * t + t + t + 1.0
        out[i] = v
    return out


@nb.njit(cache=True)
def svf(x, fc, res, mode):
    """TPT state-variable filter; mode 0 LP, 1 BP, 2 HP. fc: tablica Hz."""
    n = len(x)
    out = np.empty(n)
    ic1 = 0.0
    ic2 = 0.0
    k = 2.0 - 2.0 * res
    for i in range(n):
        f = fc[i]
        if f > SR * 0.45:
            f = SR * 0.45
        if f < 10.0:
            f = 10.0
        g = np.tan(np.pi * f / SR)
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        v3 = x[i] - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == 0:
            out[i] = v2
        elif mode == 1:
            out[i] = v1
        else:
            out[i] = x[i] - k * v1 - v2
    return out


@nb.njit(cache=True)
def pingpong(l, r, dsamp, fb, lp):
    n = len(l)
    bl = np.zeros(dsamp)
    br = np.zeros(dsamp)
    ol = np.zeros(n)
    orr = np.zeros(n)
    sl = 0.0
    sr_ = 0.0
    j = 0
    for i in range(n):
        dl = bl[j]
        dr = br[j]
        sl += lp * (dl - sl)
        sr_ += lp * (dr - sr_)
        ol[i] = sl
        orr[i] = sr_
        bl[j] = (l[i] + r[i]) * 0.5 + sr_ * fb   # wejście mono do lewego, krzyżowo
        br[j] = sl * fb
        j += 1
        if j >= dsamp:
            j = 0
    return ol, orr


@nb.njit(cache=True)
def smooth_gain(g, a):
    gs = g.copy()
    for i in range(1, len(gs)):
        if g[i] > gs[i - 1]:
            gs[i] = a * gs[i - 1] + (1 - a) * g[i]
        else:
            gs[i] = g[i]
    return gs


# ------------------------------------------------------------------ szyny
class Bus:
    def __init__(self):
        self.l = np.zeros(N)
        self.r = np.zeros(N)

    def add(self, sig, t, gain=1.0, pan=0.0):
        """sig: mono (1D) albo stereo (2, n)."""
        i = idx(t)
        if i >= N or i < 0:
            return
        if sig.ndim == 1:
            n = min(len(sig), N - i)
            gl = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
            gr = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
            self.l[i:i + n] += sig[:n] * gain * gl
            self.r[i:i + n] += sig[:n] * gain * gr
        else:
            n = min(sig.shape[1], N - i)
            self.l[i:i + n] += sig[0, :n] * gain
            self.r[i:i + n] += sig[1, :n] * gain


kick_bus, drum_bus, bass_bus, music_bus, fx_bus = Bus(), Bus(), Bus(), Bus(), Bus()
rev_send, dly_send = Bus(), Bus()


def send(bus, sig, t, gain, pan=0.0, rev=0.0, dly=0.0):
    bus.add(sig, t, gain, pan)
    if rev:
        rev_send.add(sig, t, gain * rev, pan)
    if dly:
        dly_send.add(sig, t, gain * dly, pan)


# ------------------------------------------------------------------ narzędzia
def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def adsr(n, a, d, s, r, hold):
    """hold = czas do release (s)."""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel_start = hold
    e = np.where(t > rel_start, e * np.exp(-(t - rel_start) / max(r, 1e-4)), e)
    return e


def filt(x, kind, f, order=2):
    wn = np.array(f) / (SR / 2) if isinstance(f, (list, tuple)) else f / (SR / 2)
    return sosfilt(butter(order, wn, btype=kind, output='sos'), x)


def noise(n):
    return rng.standard_normal(n)


def const(n, v):
    return np.full(n, float(v))


# ------------------------------------------------------------------ instrumenty
def kick(big=False, n_s=0.45):
    n = idx(n_s if not big else 1.1)
    t = np.arange(n) / SR
    f = 48 + 170 * np.exp(-t / 0.028) + 90 * np.exp(-t / 0.004)
    if big:
        f = 38 + 190 * np.exp(-t / 0.05) + 90 * np.exp(-t / 0.006)
    ph = 2 * np.pi * np.cumsum(f) / SR
    amp = np.exp(-t / (0.30 if not big else 0.55)) * np.minimum(1, t / 0.0015)
    body = np.sin(ph) * amp
    click = filt(noise(n), 'highpass', 3000) * env_exp(n, 0.0035) * 0.6
    return np.tanh((body * 1.25 + click) * 1.4) * 0.9


def clap():
    n = idx(0.45)
    nz = filt(noise(n), 'bandpass', (1000, 5200))
    e = np.zeros(n)
    for d in (0.0, 0.009, 0.019, 0.028):
        j = idx(d)
        e[j:] += env_exp(n - j, 0.0045 if d < 0.028 else 0.11)
    body = np.sin(2 * np.pi * 180 * np.arange(n) / SR) * env_exp(n, 0.03) * 0.25
    return nz * e * 0.8 + body


def hat(open_=False, bright=1.0):
    n = idx(0.32 if open_ else 0.07)
    t = np.arange(n) / SR
    metal = np.zeros(n)
    for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0):
        metal += np.sign(np.sin(2 * np.pi * f * 3.1 * t))
    x = filt(metal * 0.15 + noise(n) * 0.9, 'highpass', 7000 * bright)
    return x * env_exp(n, 0.09 if open_ else 0.016) * 0.9


def snare():
    n = idx(0.2)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * (185 + 60 * np.exp(-t / 0.01)) * t) * env_exp(n, 0.045)
    nz = filt(noise(n), 'bandpass', (1400, 9000)) * env_exp(n, 0.06)
    return np.tanh(tone * 0.7 + nz * 0.9)


def crash(dur=2.0, bright=1.0):
    n = idx(dur)
    t = np.arange(n) / SR
    metal = np.zeros(n)
    for f in (431, 587, 739, 1023, 1277, 1543, 1789):
        metal += np.sin(2 * np.pi * f * t * (1 + 0.002 * np.sin(2 * np.pi * 3 * t)) + rng.uniform(0, 6))
    x = filt(noise(n) + metal * 0.05, 'highpass', 3500 * bright)
    return x * env_exp(n, dur * 0.3) * np.minimum(1, t / 0.002)


def rev_crash(dur=1.6):
    c = crash(dur)
    return c[::-1] * np.linspace(0, 1, len(c)) ** 2


def sub_drop(dur=1.6, f0=62, f1=28):
    n = idx(dur)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, dur * 0.45) * np.minimum(1, t / 0.004)


def supersaw(notes, dur, cutoff, tau, voices=7, spread=0.16, fenv=None, attack=0.003, release=None):
    n = idx(dur + (release or 0.0))
    l = np.zeros(n)
    r = np.zeros(n)
    for m in notes:
        for v in range(voices):
            det = (v - (voices - 1) / 2) / ((voices - 1) / 2) * spread
            s = osc_saw(const(n, midi(m + det)), rng.uniform())
            p = (v / (voices - 1)) * 2 - 1
            l += s * (1 - p * 0.8) / 2
            r += s * (1 + p * 0.8) / 2
    fc = const(n, cutoff) if fenv is None else fenv(np.arange(n) / SR)
    e = np.exp(-np.arange(n) / (tau * SR)) * np.minimum(1, np.arange(n) / (attack * SR))
    if release is not None:
        t = np.arange(n) / SR
        e = np.where(t > dur, e * np.exp(-(t - dur) / release), e)
    g = 2.4 / (len(notes) * voices)
    return np.stack([svf(l, fc, 0.1, 0) * e * g, svf(r, fc, 0.1, 0) * e * g])


def pad(notes, dur, cutoff=1400, attack=0.35, release=0.6):
    n = idx(dur + release * 3)
    t = np.arange(n) / SR
    l = np.zeros(n)
    r = np.zeros(n)
    for m in notes:
        for v in range(6):
            det = (v - 2.5) / 2.5 * 0.12
            s = osc_saw(const(n, midi(m + det)), rng.uniform())
            p = v / 5 * 2 - 1
            l += s * (1 - p) / 2
            r += s * (1 + p) / 2
    fc = cutoff * (1 + 0.35 * np.sin(2 * np.pi * 0.5 * t))
    e = np.minimum(1, t / attack) * np.where(t > dur, np.exp(-(t - dur) / release), 1)
    g = 1.6 / (len(notes) * 6)
    return np.stack([svf(l, fc, 0.2, 0) * e * g, svf(r, fc, 0.2, 0) * e * g])


def bass_note(m, dur, cut=1100, env_amt=2200):
    n = idx(dur + 0.03)
    t = np.arange(n) / SR
    f = const(n, midi(m))
    s = osc_saw(f, 0.0) * 0.55 + osc_pulse(f * 1.003, 0.5, 0.25) * 0.35
    fc = cut + env_amt * np.exp(-t / 0.045)
    y = svf(s, fc, 0.35, 0)
    sub = np.sin(2 * np.pi * midi(m) * t) * 0.8
    e = np.minimum(1, t / 0.002) * np.where(t > dur, np.exp(-(t - dur) / 0.008), 1) * (0.55 + 0.45 * np.exp(-t / 0.12))
    return np.tanh((y + sub) * e * 1.3) * 0.8


def pluck(m, dur=0.22, bright=5200):
    n = idx(dur)
    t = np.arange(n) / SR
    f = const(n, midi(m))
    s = osc_saw(f, rng.uniform()) * 0.6 + osc_pulse(f * 2.0 * 1.002, 0.3, rng.uniform()) * 0.25
    fc = 500 + bright * np.exp(-t / 0.05)
    return svf(s, fc, 0.25, 0) * env_exp(n, 0.09) * np.minimum(1, t / 0.001)


def chip(m, dur=0.1, duty=0.125):
    n = idx(dur)
    t = np.arange(n) / SR
    s = osc_pulse(const(n, midi(m)), duty, 0.0)
    e = np.where(t < dur * 0.7, 1.0, np.maximum(0, 1 - (t - dur * 0.7) / (dur * 0.3)))
    return s * e * 0.35


def laser(f0=2400, f1=180, dur=0.11):
    n = idx(dur)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.25))
    s = osc_pulse(f, 0.25, 0.0)
    return svf(s, const(n, 6000), 0.0, 0) * env_exp(n, dur * 0.5) * 0.4


def ui_click(f=1900, dur=0.05):
    n = idx(dur)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) * env_exp(n, 0.008) + filt(noise(n), 'highpass', 6000) * env_exp(n, 0.002) * 0.4) * 0.6


def tick(f=3200):
    n = idx(0.03)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * env_exp(n, 0.004) * 0.5


def stamp(pitch=1.0):
    n = idx(0.16)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (140 * pitch + 200 * np.exp(-t / 0.01)) * t) * env_exp(n, 0.04)
    clack = filt(noise(n), 'bandpass', (1800 * pitch, 7000)) * env_exp(n, 0.012)
    return np.tanh(thump * 0.9 + clack * 0.8)


def whoosh(dur, f0, f1, peak_at=0.8, q=0.55):
    n = idx(dur)
    t = np.arange(n) / SR
    fc = f0 * (f1 / f0) ** (t / dur)
    x = svf(noise(n), fc, q, 1)
    u = t / dur
    e = np.where(u < peak_at, (u / peak_at) ** 2, np.maximum(0, 1 - (u - peak_at) / (1 - peak_at)) ** 1.5)
    return x * e


def riser(dur, f0=180, f1=1800):
    n = idx(dur)
    t = np.arange(n) / SR
    u = t / dur
    f = f0 * (f1 / f0) ** (u ** 1.6)
    s = osc_saw(f, 0.0) * 0.5 + osc_saw(f * 1.01, 0.3) * 0.5
    nz = svf(noise(n), 400 * (30 ** u), 0.4, 1)
    x = svf(s, 300 + 6000 * u ** 2, 0.3, 0) * 0.5 + nz * 0.7
    return x * u ** 2


def power_up():
    out = np.zeros(idx(0.5))
    for k, m in enumerate([72, 76, 79, 84, 88, 91, 96]):
        c = chip(m, 0.06, 0.25)
        i = idx(k * 0.035)
        out[i:i + len(c)] += c[: len(out) - i]
    return out


def lead_note(m, dur, glide_from=None):
    n = idx(dur + 0.08)
    t = np.arange(n) / SR
    f0 = midi(m)
    f = const(n, f0)
    if glide_from is not None:
        f = f0 + (midi(glide_from) - f0) * np.exp(-t / 0.03)
    f = f * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.2))
    l = np.zeros(n)
    r = np.zeros(n)
    for v in range(5):
        det = 2 ** (((v - 2) / 2) * 0.12 / 12)
        s = osc_saw(f * det, rng.uniform())
        p = v / 4 * 2 - 1
        l += s * (1 - p * 0.7) / 2
        r += s * (1 + p * 0.7) / 2
    fc = 1800 + 3500 * np.exp(-t / 0.12)
    e = np.minimum(1, t / 0.004) * (0.8 + 0.2 * np.exp(-t / 0.1)) * np.where(t > dur, np.exp(-(t - dur) / 0.03), 1)
    return np.stack([svf(l, fc, 0.2, 0) * e * 0.3, svf(r, fc, 0.2, 0) * e * 0.3])


# ------------------------------------------------------------------ dźwięki gry (krótkie, pod groove)
def zap(f0=3200, f1=600, dur=0.07, duty=0.3):
    n = idx(dur)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.3))
    return svf(osc_pulse(f, duty, 0.0), const(n, 7000), 0.1, 0) * env_exp(n, dur * 0.4) * 0.45


def blast(dur=0.22, lo=300, hi=5000):
    n = idx(dur)
    t = np.arange(n) / SR
    nz = filt(noise(n), 'bandpass', (lo, hi)) * env_exp(n, dur * 0.25)
    thump = np.sin(2 * np.pi * (70 + 120 * np.exp(-t / 0.02)) * t) * env_exp(n, 0.06)
    return np.tanh(nz * 1.2 + thump * 0.9) * 0.7


def boom(dur=0.9):
    n = idx(dur)
    t = np.arange(n) / SR
    nz = svf(noise(n), 200 + 3000 * np.exp(-t / 0.08), 0.2, 0) * env_exp(n, 0.22)
    sub = np.sin(2 * np.pi * np.cumsum(40 + 90 * np.exp(-t / 0.05)) / SR) * env_exp(n, 0.3)
    return np.tanh(nz * 1.4 + sub * 1.1) * 0.75


def buzz(dur=0.3, f=110, fm=30):
    n = idx(dur)
    t = np.arange(n) / SR
    s = osc_saw(const(n, f) * (1 + 0.05 * np.sin(2 * np.pi * fm * t)), 0.0)
    return svf(s, const(n, 2400), 0.4, 1) * np.minimum(1, t / 0.01) * env_exp(n, dur * 0.5) * 0.5


def hiss(dur=0.35):
    n = idx(dur)
    t = np.arange(n) / SR
    return filt(noise(n), 'bandpass', (3000, 11000)) * np.minimum(1, t / 0.03) * env_exp(n, dur * 0.45) * 0.5


def whistle(dur=0.5, f0=2400, f1=500):
    """spadająca kropla (świst z góry)"""
    n = idx(dur)
    t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t / 0.05) * np.minimum(1, (dur - t) / 0.03 + 0.001) * 0.3


def splat():
    n = idx(0.12)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (160 + 300 * np.exp(-t / 0.008)) * t) * env_exp(n, 0.03)
    wet = filt(noise(n), 'bandpass', (600, 3000)) * env_exp(n, 0.02)
    return np.tanh(body + wet * 0.7) * 0.7


def coin():
    out = np.zeros(idx(0.3))
    for k, m in enumerate([88, 95]):
        c = chip(m, 0.12 if k else 0.06, 0.5)
        i = idx(k * 0.06)
        out[i:i + len(c)] += c[: len(out) - i]
    return out


# ------------------------------------------------------------------ harmonia: e-moll, i–VI–III–VII
CH = {
    'Em': [52, 55, 59, 64], 'C': [52, 55, 60, 64], 'G': [50, 55, 59, 62], 'D': [50, 54, 57, 62],
    'Am': [52, 57, 60, 64], 'B': [51, 54, 59, 63],
}
ROOT = {'Em': 28, 'C': 36, 'G': 31, 'D': 38, 'Am': 33, 'B': 35}
PROG = ['Em', 'C', 'G', 'D']
BARS = [PROG[b % 4] for b in range(18)]
BARS[11] = 'Am'                                          # ranking (B44–B48): moll przed tablicą

kicks = []


def K(beat, big=False, gain=1.0):
    kick_bus.add(kick(big), tb(beat), gain)
    kicks.append((tb(beat), 0.85 if big else 0.7))


# te same stopy co w src/director.js
KICKS = [b for b in range(4, 52) if b not in (31, 43, 47) and not (44 <= b < 47 and b % 2)]
KICKS += list(range(52, 62, 2)) + list(range(64, 70))
BIG = {4, 12, 24, 32, 36, 40, 48, 52, 64}
for b in KICKS:
    K(b, big=b in BIG, gain=1.0 if b not in BIG else 0.95)

# ---------------------------------------------------------------- groove (B4–B44, B48–B52, B64–B70)
def groove_bar(bar, hats=True, bass=True, clap_=True, arp=0.0, bright=1.0):
    ch = BARS[bar]
    b0 = bar * 4
    if clap_:
        for k in (1, 3):
            send(drum_bus, clap(), tb(b0 + k), 0.45, 0.0, rev=0.22)
    if hats:
        for s in range(16):
            accent = 1.0 if s % 4 == 2 else (0.55 if s % 2 else 0.35)
            send(drum_bus, hat(bright=1.0 if s % 4 else 0.85), tb(b0) + s * S16, 0.15 * accent, -0.3 + 0.6 * (s % 2))
        for k in range(4):
            send(drum_bus, hat(True), tb(b0 + k + 0.5), 0.11, 0.25)
    if bass:
        r = ROOT[ch]
        for k in range(4):
            for s, (off, vel) in enumerate(((12, 0.0), (0, 0.9), (12, 0.65), (0, 0.8))):
                if vel:
                    send(bass_bus, bass_note(r + off, S16 * 0.8, cut=900 + 500 * bright), tb(b0 + k) + s * S16, 0.46 * vel)
    if arp:
        tones = CH[ch]
        for s in range(16):
            m = tones[[0, 2, 1, 3][s % 4]] + 24
            send(music_bus, chip(m, S16 * 0.85, 0.125 if s % 8 < 4 else 0.25), tb(b0) + s * S16, 0.085 * arp, 0.35 if s % 2 else -0.35, dly=0.2)


for bar in range(1, 11):              # B4–B44
    groove_bar(bar, arp=1.0 if bar in (1, 2, 8, 9, 10) else 0.55, bright=1.0 if bar != 10 else 0.4)
for bar in (12,):                     # B48–B52: tablica wyników
    groove_bar(bar, arp=1.0)
for bar in (16,):                     # B64–B68: finał
    groove_bar(bar, arp=1.0)
groove_bar(17, hats=True, bass=False, clap_=False, arp=0.0)

# ---------------------------------------------------------------- B0–B4: druk logo, naklejki, krople, ULT
for k, (b, m) in enumerate([(0, 0), (0.5, 3), (1.0, 7)]):
    send(fx_bus, stamp(0.9 + k * 0.2), tb(b), 0.55, -0.3 + 0.3 * k, rev=0.2)
    send(music_bus, supersaw([n + m for n in CH['Em']] + [64 + m], 0.3, 6500, 0.14), tb(b), 0.5, rev=0.35)
send(fx_bus, crash(1.8), tb(0), 0.16, rev=0.3)
send(fx_bus, sub_drop(1.0), tb(0), 0.3)
send(music_bus, pad(CH['Em'] + [40], tb(3), cutoff=900, attack=0.4), tb(0.5), 0.35, rev=0.5)
for b in (2.0, 2.5):
    send(fx_bus, stamp(0.7), tb(b), 0.6, 0.0, rev=0.15)
    send(fx_bus, kick(False), tb(b), 0.35)
for k in range(12):
    send(fx_bus, whistle(0.45 + rng.uniform(0, 0.2), 2200 + rng.uniform(-300, 300), 500), tb(2.75) + k * S16 * 0.8, 0.1, rng.uniform(-0.7, 0.7))
for k in range(10):
    send(fx_bus, splat(), tb(3.3) + k * S16 * 0.7, 0.18, rng.uniform(-0.6, 0.6))
send(fx_bus, riser(tb(1.2)), tb(2.8), 0.3, rev=0.2)
send(fx_bus, boom(1.4), tb(4), 0.75, rev=0.35)
send(fx_bus, crash(2.4), tb(4), 0.26, rev=0.3)
send(fx_bus, sub_drop(1.6), tb(4), 0.5)
send(music_bus, supersaw(CH['Em'] + [64, 71], 0.8, 7000, 0.35), tb(4), 0.65, rev=0.4)

# B4–B12: naklejki, odjazd kamery, licznik fal
for b in (4.5, 6.0):
    send(fx_bus, stamp(0.8), tb(b), 0.45, 0.2, rev=0.15)
send(fx_bus, whoosh(tb(1), 300, 6000, 0.85), tb(7.2), 0.25, rev=0.2)
send(fx_bus, crash(1.6), tb(8), 0.18, rev=0.3)
send(music_bus, supersaw(CH['G'] + [67], 0.4, 6500, 0.18), tb(8), 0.5, rev=0.3)
for k in range(8):
    send(fx_bus, chip(72 + k * 2, 0.08, 0.25), tb(8 + k * 0.5), 0.3, 0.2 * ((k % 2) * 2 - 1), rev=0.2)
send(fx_bus, stamp(1.1), tb(10), 0.4, rev=0.15)
send(fx_bus, rev_crash(0.9), tb(12) - 0.9, 0.2)

# ---------------------------------------------------------------- B12–B24: dwanaście broni, każda na swój beat
W_SFX = [
    lambda: sum_at([(zap(3600, 700, 0.06), 0), (zap(3600, 700, 0.06), 0.09), (zap(3600, 700, 0.06), 0.18)]),   # rapidograf
    lambda: blast(0.25),                                                                                     # rozpylacz
    lambda: sum_at([(zap(2600, 900, 0.035, 0.5), k * 0.045) for k in range(8)]),                            # rotograf
    lambda: laser(5200, 300, 0.25),                                                                          # gilotyna
    lambda: sum_at([(whoosh(0.18, 800, 4000, 0.9), 0), (boom(0.5), 0.17)]),                                  # tuba
    lambda: buzz(0.4, 80, 12),                                                                               # wałki
    lambda: sum_at([(chip(84, 0.05, 0.25), k * 0.07) for k in range(5)]),                                    # dron
    lambda: buzz(0.42, 220, 45) * 1.2,                                                                       # promień
    lambda: sum_at([(stamp(0.6), 0), (blast(0.2, 150, 1500), 0.0)]),                                         # stempel
    lambda: sum_at([(whoosh(0.2, 600, 5000, 0.5), 0), (whoosh(0.2, 5000, 600, 0.5), 0.2)]),                  # linijka
    lambda: hiss(0.42),                                                                                      # aerograf
    lambda: sum_at([(tick(2400), 0), (tick(2400), 0.08), (blast(0.3, 200, 3000), 0.2)]),                     # pinezki
]


def sum_at(parts):
    n = max(idx(o) + len(p) for p, o in parts)
    out = np.zeros(n)
    for p, o in parts:
        i = idx(o)
        out[i:i + len(p)] += p
    return out


for i, f in enumerate(W_SFX):
    send(fx_bus, f(), tb(12 + i) + 0.005, 0.42, -0.35 if i % 2 else 0.35, rev=0.12)
    send(fx_bus, ui_click(2400, 0.04), tb(12 + i), 0.12, 0.0)
send(fx_bus, crash(1.4), tb(12), 0.18, rev=0.3)
send(music_bus, supersaw(CH['Em'] + [64], 0.5, 6500, 0.2), tb(12), 0.5, rev=0.3)
send(fx_bus, crash(1.2), tb(20), 0.12, rev=0.3)

# ---------------------------------------------------------------- B24–B31: tusze
send(fx_bus, crash(1.8), tb(24), 0.18, rev=0.3)
for k, (b, m) in enumerate([(24, 76), (24.5, 79), (25, 83)]):
    send(fx_bus, pluck(m, 0.4, 6000), tb(b), 0.25, -0.5 + 0.5 * k, rev=0.35, dly=0.3)
    send(fx_bus, splat(), tb(b), 0.25, -0.5 + 0.5 * k)
send(fx_bus, whoosh(tb(1), 400, 5000, 0.8), tb(26.6), 0.25, rev=0.2)
for k, (b, ch) in enumerate([(27.5, 'Em'), (28, 'C'), (28.5, 'D')]):
    send(music_bus, supersaw(CH[ch] + [CH[ch][0] + 12], 0.3, 7000, 0.14), tb(b), 0.5, 0.3 * (k - 1), rev=0.3)
send(fx_bus, stamp(0.6), tb(29), 0.6, rev=0.2)
send(fx_bus, sub_drop(1.0, 70, 30), tb(29), 0.35)
roll = [29.5 + k * 0.25 for k in range(4)] + [30.5 + k * 0.125 for k in range(3)]
for k, b in enumerate(roll):
    send(drum_bus, snare(), tb(b), 0.2 + k * 0.04, 0.15 if k % 2 else -0.15, rev=0.3)
send(fx_bus, riser(tb(1.4)), tb(29.5), 0.35, rev=0.3)
send(fx_bus, whoosh(tb(1.3), 200, 9000, 0.95), tb(29.6), 0.25, rev=0.2)
# B31: ULT
send(fx_bus, kick(True), tb(31), 0.9)
send(fx_bus, boom(1.2), tb(31), 0.8, rev=0.35)
send(fx_bus, sub_drop(1.4), tb(31), 0.5)
send(music_bus, supersaw([40, 52, 59, 64, 67, 71], 0.4, 7500, 0.2), tb(31), 0.55, rev=0.4)
send(fx_bus, rev_crash(0.45), tb(32) - 0.45, 0.2)

# ---------------------------------------------------------------- B32–B40: bossowie
for k, b in enumerate((32, 33, 34, 35)):
    st = supersaw([n - 12 for n in CH[['Em', 'C', 'G', 'D'][k]]], 0.34, 3200, 0.2)
    send(music_bus, np.tanh(st * 3.2) * 0.4, tb(b), 0.7, rev=0.3)
    send(fx_bus, sub_drop(0.8, 60, 32), tb(b), 0.4)
    send(fx_bus, stamp(0.5), tb(b), 0.45, rev=0.2)
send(fx_bus, crash(2.0), tb(32), 0.22, rev=0.3)
send(fx_bus, crash(2.2), tb(36), 0.22, rev=0.3)
send(fx_bus, boom(1.0), tb(36), 0.5, rev=0.3)
for b in (37, 38, 38.5, 39):                               # KRAJARKA: cięcia
    send(fx_bus, laser(6000, 400, 0.3), tb(b), 0.3, 0.4 if b % 1 else -0.4, rev=0.2)
    send(fx_bus, whoosh(0.25, 3000, 400, 0.2), tb(b), 0.2)
LEAD = [(0, 76, 2), (2, 79, 2), (4, 83, 3), (7, 81, 1), (8, 79, 2), (10, 76, 2), (12, 74, 2), (14, 76, 2)]
prev = None
for s, m, ln in LEAD:
    send(music_bus, lead_note(m, ln * S16 * 0.92, prev if prev and abs(prev - m) <= 5 else None), tb(36) + s * S16, 0.38, rev=0.3, dly=0.25)
    prev = m
send(fx_bus, rev_crash(0.9), tb(40) - 0.9, 0.2)

# ---------------------------------------------------------------- B40–B44: karty i sklep
send(fx_bus, power_up(), tb(40), 0.35, rev=0.3)
for b in (40.15, 40.4, 40.65):
    send(fx_bus, ui_click(1800, 0.05), tb(b), 0.28, rng.uniform(-0.4, 0.4), rev=0.1)
    send(fx_bus, whoosh(0.15, 1500, 6000, 0.6), tb(b) - 0.05, 0.1)
send(fx_bus, ui_click(2600, 0.05), tb(41.5), 0.35, rev=0.2)
send(fx_bus, power_up(), tb(41.55), 0.4, rev=0.3)
for k in range(4):
    send(fx_bus, ui_click(1500 + k * 200, 0.04), tb(42.15 + k * 0.18), 0.2, 0.3, rev=0.1)
send(fx_bus, coin(), tb(43.25), 0.5, rev=0.25)

# ---------------------------------------------------------------- B44–B52: koniec, wynik, nick, ranking
send(fx_bus, whoosh(1.2, 6000, 200, 0.1), tb(44), 0.25, rev=0.4)
send(music_bus, pad(CH['Am'] + [45], tb(2), cutoff=1100), tb(44), 0.45, rev=0.5)
send(music_bus, pad(CH['B'] + [47], tb(2), cutoff=1400), tb(46), 0.45, rev=0.5)
for s in range(int(1.6 * 4 * 2)):                        # nabijanie wyniku
    send(fx_bus, tick(2600 + s * 60), tb(44.4) + s * S16 / 2, 0.18, 0.3 if s % 2 else -0.3)
send(fx_bus, stamp(1.2), tb(46), 0.45, rev=0.2)
for k in range(9):                                       # pisanie nicku
    send(fx_bus, ui_click(2800 + rng.uniform(-300, 300), 0.03) * 0.8, tb(46.1 + k * 1.15 / 9), 0.25, rng.uniform(-0.4, 0.4))
send(fx_bus, ui_click(2000, 0.06), tb(47.5), 0.4, rev=0.2)
send(fx_bus, riser(tb(0.5)), tb(47.5), 0.3, rev=0.2)
send(fx_bus, crash(2.2), tb(48), 0.26, rev=0.3)
send(fx_bus, sub_drop(1.2), tb(48), 0.4)
send(music_bus, supersaw(CH['Em'] + [64, 71], 0.6, 7000, 0.25), tb(48), 0.6, rev=0.35)
for k in range(6):
    send(fx_bus, pluck(83 - k * 2, 0.08, 6000), tb(48.1 + k * 0.07), 0.12, -0.5 + k * 0.2)
send(fx_bus, power_up(), tb(48.85), 0.45, rev=0.3)
for b in (49.5,):
    send(fx_bus, stamp(0.9), tb(b), 0.45, rev=0.15)
send(fx_bus, whoosh(tb(1), 300, 8000, 0.9), tb(51), 0.22, rev=0.2)

# ---------------------------------------------------------------- B52–B64: strona portfolio (spokojniej, pad + pluck)
for bar in range(13, 16):
    ch = BARS[bar]
    b0 = bar * 4
    send(music_bus, pad(CH[ch] + [CH[ch][0] - 12], BAR * 0.98, cutoff=1500 + (bar - 13) * 500), tb(b0), 0.4, rev=0.5)
    tones = CH[ch]
    for s in range(16):
        m = tones[[0, 1, 2, 3, 2, 1, 3, 2][s % 8]] + 12
        send(music_bus, pluck(m, 0.2, 2500 + (bar - 13) * 1200), tb(b0) + s * S16, 0.1, -0.45 + 0.9 * (s % 2), rev=0.25, dly=0.35)
    for s in range(16):
        if s % 2:
            send(drum_bus, hat(bright=1.1), tb(b0) + s * S16, 0.08, 0.3)
    for k in (1, 3):
        send(drum_bus, clap(), tb(b0 + k), 0.3, 0.0, rev=0.35)
    r = ROOT[ch]
    for k in range(4):
        send(bass_bus, bass_note(r, BEAT * 0.45, cut=500, env_amt=900), tb(b0 + k), 0.4)
send(fx_bus, crash(2.0), tb(52), 0.2, rev=0.4)
send(fx_bus, whoosh(tb(1), 300, 7000, 0.6), tb(53.4), 0.28, 0.3, rev=0.2)
send(fx_bus, whoosh(tb(1.1), 300, 7000, 0.6), tb(55.4), 0.25, -0.3, rev=0.2)
for b in (57.3, 59.5, 61.6):
    send(fx_bus, ui_click(2200, 0.05), tb(b + 0.1), 0.4, 0.0, rev=0.15)
for b in (57.8, 60.0):
    send(fx_bus, whoosh(0.3, 1200, 6000, 0.4), tb(b), 0.22, 0.5, rev=0.15)
for k, m in enumerate([72, 76, 79, 84]):                  # GRAJ
    send(fx_bus, chip(m, 0.07, 0.25), tb(61.7) + k * S16, 0.3, rev=0.2)
roll = [62 + k * 0.5 for k in range(2)] + [63 + k * 0.25 for k in range(2)] + [63.5 + k * 0.125 for k in range(4)]
for k, b in enumerate(roll):
    send(drum_bus, snare(), tb(b), 0.2 + k * 0.03, 0.15 if k % 2 else -0.15, rev=0.3)
send(fx_bus, riser(tb(2)), tb(62), 0.35, rev=0.3)
send(fx_bus, whoosh(tb(2), 200, 12000, 0.97), tb(62), 0.25, rev=0.2)

# ---------------------------------------------------------------- B64–B72: finał
send(fx_bus, boom(1.3), tb(64), 0.6, rev=0.35)
send(fx_bus, crash(2.6), tb(64), 0.28, rev=0.4)
send(fx_bus, sub_drop(1.8), tb(64), 0.5)
for k, b in enumerate((64.05, 64.25, 64.45)):
    send(fx_bus, stamp(0.9 + k * 0.2), tb(b), 0.5, -0.3 + 0.3 * k, rev=0.2)
send(music_bus, supersaw([40, 52, 59, 64, 67, 71, 76], 1.2, 7000, 0.45, spread=0.22), tb(64), 0.8, rev=0.5)
for b in (65, 65.5):
    send(fx_bus, stamp(0.75), tb(b), 0.5, rev=0.15)
    send(music_bus, supersaw(CH['C' if b == 65 else 'G'] + [64], 0.3, 6500, 0.14), tb(b), 0.4, rev=0.3)
send(fx_bus, power_up(), tb(66.5), 0.35, rev=0.3)
send(fx_bus, ui_click(2200, 0.06), tb(68), 0.45, rev=0.2)
send(fx_bus, coin(), tb(68.05), 0.35, rev=0.3)
LEAD2 = [(0, 83, 2), (2, 79, 2), (4, 76, 2), (6, 79, 2), (8, 81, 3), (11, 79, 1), (12, 78, 4)]
prev = None
for s, m, ln in LEAD2:
    send(music_bus, lead_note(m, ln * S16 * 0.92, prev if prev and abs(prev - m) <= 5 else None), tb(66) + s * S16, 0.34, rev=0.35, dly=0.3)
    prev = m
send(fx_bus, kick(True), tb(70), 0.8)
send(fx_bus, crash(3.0), tb(70), 0.24, rev=0.5)
send(music_bus, supersaw([40, 47, 52, 55, 59, 64, 66, 71], 2.6, 5200, 1.2, spread=0.24, release=0.8), tb(70), 0.7, rev=0.7)
send(music_bus, pad([40, 52, 59, 64, 67], 2.4, cutoff=2400, attack=0.05, release=1.0), tb(70), 0.45, rev=0.6)
for k, m in enumerate([83, 86, 88, 95]):
    send(fx_bus, pluck(m, 0.4, 7000), tb(70) + k * S16, 0.12, -0.5 + k * 0.33, rev=0.4, dly=0.5)

# ---------------------------------------------------------------- miks
t_axis = np.arange(N) / SR
duck = np.ones(N)
for tk, depth in kicks:
    i = idx(tk)
    n = min(N - i, idx(0.42))
    tt = np.arange(n) / SR
    g = 1 - depth * np.where(tt < 0.004, tt / 0.004, np.exp(-(tt - 0.004) / 0.075))
    duck[i:i + n] = np.minimum(duck[i:i + n], g)

# pogłos (IR z szumu, stereo, predelay)
ir_n = idx(2.4)
tt = np.arange(ir_n) / SR
irs = []
for ch_ in range(2):
    ir = rng.standard_normal(ir_n) * np.exp(-tt / 0.55)
    ir = filt(ir, 'lowpass', 7000)
    ir[: idx(0.018)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    irs.append(ir)
wet_l = fftconvolve(filt(rev_send.l, 'highpass', 250), irs[0])[:N] * 0.85
wet_r = fftconvolve(filt(rev_send.r, 'highpass', 250), irs[1])[:N] * 0.85
dl_l, dl_r = pingpong(dly_send.l, dly_send.r, idx(BEAT * 0.75), 0.38, 0.35)

L = kick_bus.l + drum_bus.l * (0.6 + 0.4 * duck) + (bass_bus.l + music_bus.l + wet_l + dl_l * 0.6) * duck + fx_bus.l
R = kick_bus.r + drum_bus.r * (0.6 + 0.4 * duck) + (bass_bus.r + music_bus.r + wet_r + dl_r * 0.6) * duck + fx_bus.r

# cisza przed ULT (B30.875–B31) i przed tablicą wyników (B47.75–B48)
gate = np.ones(N)
ramp = idx(0.004)
for g0b, g1b in ((30.875, 31), (47.75, 48)):
    g0, g1 = idx(tb(g0b)), idx(tb(g1b))
    gate[g0:g1] = 0.0
    gate[g0 - ramp:g0] = np.linspace(1, 0, ramp)
L *= gate
R *= gate

# przycięcie do 30 s + wyciszenie końcówki
L = L[: idx(DUR)]
R = R[: idx(DUR)]
fn = idx(0.6)
fade = np.ones(len(L))
fade[-fn:] = np.linspace(1, 0, fn) ** 2
L *= fade
R *= fade
fi = idx(0.003)
L[:fi] *= np.linspace(0, 1, fi)
R[:fi] *= np.linspace(0, 1, fi)

# filtr DC + lekka saturacja + limiter z lookaheadem
L = filt(L, 'highpass', 25)
R = filt(R, 'highpass', 25)


def limit(l, r, ceiling=0.80, look=idx(0.004), rel=0.08):
    # limiter "true peak": obwiednia szczytów liczona z sygnału nadpróbkowanego 4×
    from scipy.signal import resample_poly
    n = len(l)
    upl = np.abs(resample_poly(l, 4, 1))[: n * 4].reshape(n, 4).max(1)
    upr = np.abs(resample_poly(r, 4, 1))[: n * 4].reshape(n, 4).max(1)
    peak = np.maximum(upl, upr)
    from scipy.ndimage import maximum_filter1d
    pk = maximum_filter1d(peak, size=look * 2 + 1)
    g = np.minimum(1.0, ceiling / np.maximum(pk, 1e-9))
    # wygładzenie: natychmiastowy atak, wykładniczy release
    gs = smooth_gain(g, np.exp(-1.0 / (rel * SR)))
    return l * gs, r * gs


def process(l, r, drive):
    l = np.tanh(l * drive) / np.tanh(drive)
    r = np.tanh(r * drive) / np.tanh(drive)
    return limit(l, r)


pk = max(np.abs(L).max(), np.abs(R).max())
L /= pk
R /= pk
L = filt(L, 'lowpass', 18500, 4)
R = filt(R, 'lowpass', 18500, 4)
L, R = process(L * 1.6, R * 1.6, 1.15)
st = np.stack([L, R], 1)
wavfile.write('music.wav', SR, (np.clip(st, -1, 1) * 32767).astype(np.int16))
print('ok', len(L) / SR, 's')
