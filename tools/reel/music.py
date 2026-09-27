"""Ścieżka do reelsa: 30 s, 128 BPM (16 taktów = dokładnie 30,0 s), a-moll.

Siatka jest wspólna z animacją (src/core.js): beat = 60/128 s, scena = 2 takty = 8 beatów.
  S0  B0–7    hook         Am | F     słowa na beatach, akord na każde słowo
  S1  B8–15   strony www   C  | G     kliknięcia UI przy przełączaniu stron
  S2  B16–23  branding     Am | F     "druk" CMYK: 4 uderzenia na 16tkach na plakat
  S3  B24–31  design 3D    C  | G     whoosh obrotu, glitch, "press start"
  S4  B32–39  gra          Am | F     chiptune + lasery na salwach pocisków
  S5  B40–47  systemy      Dm | E     breakdown, build, cisza przed dropem
  S6  B48–55  zaufali mi   Am | F     drop B z leadem
  S7  B56–63  outro        C  | C     impact z logo, finałowy akord, wyciszenie
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
DUR = 30.0
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


# ------------------------------------------------------------------ harmonia
CH = {
    'Am': [57, 60, 64, 69], 'F': [53, 57, 60, 65], 'C': [55, 60, 64, 67], 'G': [55, 59, 62, 67],
    'Dm': [57, 62, 65, 69], 'E': [56, 59, 64, 68],
}
ROOT = {'Am': 33, 'F': 29, 'C': 36, 'G': 31, 'Dm': 38, 'E': 28}
BARS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E', 'Am', 'F', 'C', 'C']

kicks = []  # czasy stóp → sidechain


def K(beat, big=False, gain=1.0):
    kick_bus.add(kick(big), tb(beat), gain)
    kicks.append((tb(beat), 0.85 if big else 0.7))


# ---------------------------------------------------------------- aranżacja
for bar in range(16):
    ch = BARS[bar]
    b0 = bar * 4
    breakdown = bar in (10, 11)
    outro_tail = bar == 15
    # --- stopa
    if not breakdown and not outro_tail:
        for k in range(4):
            K(b0 + k)
    # --- klaśnięcie na 2 i 4
    if not (bar == 10) and not outro_tail:
        for k in (1, 3):
            if bar == 11:
                continue
            send(drum_bus, clap(), tb(b0 + k), 0.5, 0.0, rev=0.25)
    # --- hi-haty
    if not outro_tail:
        for s in range(16):
            if breakdown and bar == 10 and s % 2:
                continue
            accent = 1.0 if s % 4 == 2 else (0.55 if s % 2 else 0.35)
            send(drum_bus, hat(bright=1.0 if s % 4 else 0.85), tb(b0) + s * S16, 0.16 * accent, -0.3 + 0.6 * (s % 2))
        if not breakdown:
            for k in range(4):
                send(drum_bus, hat(True), tb(b0 + k + 0.5), 0.13, 0.25)
    # --- bas: rolling 16tki (pauza na beacie, trzy nuty po)
    if not breakdown and bar not in (15,):
        r = ROOT[ch]
        for k in range(4):
            for s, (off, vel) in enumerate(((12, 0.0), (0, 0.9), (12, 0.65), (0, 0.8))):
                if vel == 0:
                    continue
                send(bass_bus, bass_note(r + off, S16 * 0.8), tb(b0 + k) + s * S16, 0.48 * vel)
    if bar == 11:   # powrót basu ósemkami w buildzie
        for e8 in range(8):
            send(bass_bus, bass_note(ROOT[ch], BEAT / 2 * 0.8, cut=300 + e8 * 250), tb(b0) + e8 * BEAT / 2, 0.3 + e8 * 0.03)
    # --- arpeggio (od S1 do S6)
    if 2 <= bar <= 13:
        tones = CH[ch]
        pat = [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2]
        for s in range(16):
            m = tones[pat[s]] + 12
            bright = 2500 + 3000 * (bar % 2) if not breakdown else (1200 if bar == 10 else 1200 + s * 300)
            send(music_bus, pluck(m, 0.2, bright), tb(b0) + s * S16, 0.12, -0.45 + 0.9 * (s % 2), rev=0.2, dly=0.35)
    # --- pad w breakdownie
    if breakdown:
        send(music_bus, pad(CH[ch] + [CH[ch][0] - 12], BAR * 0.98, cutoff=900 if bar == 10 else 1600), tb(b0), 0.55, rev=0.5)

# S0 hook: akord na każde słowo + crash
for k in range(5):
    ch = BARS[0] if k < 4 else BARS[1]
    notes = CH[ch] + [CH[ch][0] + 12]
    send(music_bus, supersaw(notes, 0.32 if k < 4 else 0.9, 6500, 0.14 if k < 4 else 0.4), tb(k), 0.55 if k < 4 else 0.8, rev=0.3)
send(fx_bus, crash(2.2), tb(0), 0.22, rev=0.2)
send(fx_bus, crash(1.8), tb(4), 0.2, rev=0.3)
send(fx_bus, sub_drop(1.2), tb(0), 0.35)
# nurkowanie w źrenicę (B6–B8)
send(fx_bus, whoosh(tb(2), 250, 9000, 0.92), tb(6), 0.3, rev=0.3)
send(fx_bus, rev_crash(1.2), tb(8) - 1.2, 0.22)

# S1 strony: kliknięcia przy przełączaniu, tapnięcia przy przewijaniu
for L in range(8):
    send(fx_bus, ui_click(2200 if L % 2 == 0 else 1600), tb(8 + L), 0.28 if L % 2 == 0 else 0.16, 0.2, rev=0.15)
for L in (2, 4, 6):
    send(fx_bus, whoosh(0.28, 900, 5000, 0.4), tb(8 + L) - 0.1, 0.18, -0.4)
send(music_bus, supersaw(CH['C'] + [72], 0.6, 5000, 0.25), tb(8), 0.6, rev=0.35)
send(fx_bus, crash(1.4), tb(8), 0.16, rev=0.2)
send(fx_bus, rev_crash(0.9), tb(16) - 0.9, 0.2)

# S2 druk CMYK: 4 plakaty × 4 płyty na 16tkach
for p in range(4):
    for s in range(4):
        send(fx_bus, stamp(1.0 + s * 0.18), tb(16 + p) + s * S16, 0.42, -0.3 + 0.2 * s, rev=0.12)
send(music_bus, supersaw(CH['Am'] + [69], 0.5, 5500, 0.2), tb(16), 0.55, rev=0.3)
# "KRZYCZĄ" — przesterowany stab
for k, g in ((20, 0.45), (21, 0.7), (22, 0.45)):
    st = supersaw(CH['F'] + [65, 72], 0.36, 7500, 0.16)
    send(music_bus, np.tanh(st * 3.5) * 0.35, tb(k), g, rev=0.3)
send(fx_bus, whoosh(tb(1), 400, 7000, 0.9), tb(23), 0.25, rev=0.2)

# S3 design 3D
send(fx_bus, sub_drop(1.3, 70, 30), tb(24), 0.4)
send(music_bus, supersaw(CH['C'] + [72], 0.9, 4200, 0.35), tb(24), 0.55, rev=0.45)
send(fx_bus, whoosh(tb(1), 200, 4000, 0.5, q=0.7), tb(26), 0.32, 0.3, rev=0.2)
for s in range(6):   # glitch plasterków
    send(fx_bus, stamp(2.2 + s * 0.1) * 0.6, tb(27) + s * S16 / 2, 0.25, -0.6 + 0.24 * s)
send(fx_bus, sub_drop(1.0, 80, 35), tb(28), 0.35)
send(fx_bus, crash(1.2), tb(28), 0.14, rev=0.2)
for s in range(6):
    send(fx_bus, stamp(2.2 + s * 0.1) * 0.6, tb(30) + s * S16 / 2, 0.25, 0.6 - 0.24 * s)
for k, m in enumerate([72, 76, 79, 84]):   # PRESS START
    send(fx_bus, chip(m, 0.07, 0.25), tb(31) + k * S16, 0.35, rev=0.2)

# S4 gra: chiptune arp, lasery na ósemkach, slam logo
for bar in (8, 9):
    tones = CH[BARS[bar]]
    for s in range(32):
        m = tones[[0, 2, 1, 3][s % 4]] + 24
        send(music_bus, chip(m, BEAT / 8 * 0.9, 0.125 if s % 8 < 4 else 0.25), tb(bar * 4) + s * BEAT / 8, 0.1, 0.35, dly=0.2)
for e8 in range(16):
    if 8 <= e8 <= 9:
        continue
    send(fx_bus, laser(2600 - (e8 % 4) * 300, 160, 0.1), tb(32) + e8 * BEAT / 2, 0.16, -0.5 if e8 % 2 else 0.5, rev=0.15)
send(fx_bus, rev_crash(0.8), tb(32) - 0.8, 0.2)
send(music_bus, supersaw(CH['Am'] + [69, 76], 0.5, 6000, 0.2), tb(32), 0.6, rev=0.3)
send(fx_bus, kick(True), tb(36), 0.7)
send(fx_bus, sub_drop(1.5), tb(36), 0.45)
send(fx_bus, crash(2.0), tb(36), 0.22, rev=0.3)
send(fx_bus, power_up(), tb(36), 0.5, rev=0.3)
send(music_bus, supersaw(CH['F'] + [65, 72], 1.0, 6500, 0.4), tb(36), 0.7, rev=0.4)

# S5 systemy: downlifter, tykanie, pisanie, build, cisza
send(fx_bus, whoosh(1.4, 6000, 200, 0.12), tb(40), 0.28, rev=0.4)
send(fx_bus, sub_drop(1.8, 55, 30), tb(40), 0.3)
for e8 in range(16):
    send(fx_bus, tick(3000 if e8 % 2 else 4200), tb(40) + e8 * BEAT / 2, 0.22, 0.4 if e8 % 2 else -0.4)
for L, n_ in ((2, 8), (3, 10), (4, 6), (5, 8), (6, 12)):   # pisanie linii listy
    for s in range(n_):
        send(fx_bus, ui_click(2600 + rng.uniform(-400, 400), 0.03) * 0.7, tb(40 + L) + s * BEAT / n_ * 0.9, 0.18, rng.uniform(-0.5, 0.5))
roll = [44 + k * 0.5 for k in range(4)] + [46 + k * 0.25 for k in range(4)] + [47 + k * 0.125 for k in range(4)]
for k, b in enumerate(roll):
    send(drum_bus, snare(), tb(b), 0.2 + k * 0.035, 0.15 if k % 2 else -0.15, rev=0.3)
send(fx_bus, riser(tb(3.5)), tb(44), 0.35, rev=0.3)
send(fx_bus, whoosh(tb(4), 300, 12000, 0.97), tb(44), 0.22, rev=0.3)

# S6 drop B: crash, lead, stab na każdą nazwę klienta
send(fx_bus, crash(2.4), tb(48), 0.26, rev=0.3)
send(fx_bus, sub_drop(1.4), tb(48), 0.45)
send(fx_bus, kick(True), tb(48), 0.5)
LEAD = [  # (16tka od B48, nuta, długość w 16tkach)
    (0, 81, 2), (2, 76, 2), (4, 81, 2), (6, 84, 1), (7, 83, 1), (8, 81, 2), (10, 76, 2), (12, 79, 2), (14, 81, 2),
    (16, 77, 2), (18, 84, 2), (20, 81, 2), (22, 79, 1), (23, 77, 1), (24, 76, 2), (26, 79, 2), (28, 81, 4),
]
prev = None
for s, m, ln in LEAD:
    send(music_bus, lead_note(m, ln * S16 * 0.92, prev if prev and abs(prev - m) <= 5 else None), tb(48) + s * S16, 0.42, rev=0.3, dly=0.25)
    prev = m
for k in range(8):
    ch = BARS[12 + k // 4]
    send(music_bus, supersaw(CH[ch], 0.18, 6000, 0.08), tb(48 + k), 0.35, rev=0.2)
send(fx_bus, rev_crash(1.2), tb(56) - 1.2, 0.25)
send(fx_bus, whoosh(tb(1), 500, 10000, 0.95), tb(55), 0.25)

# S7 outro: impact z logo, finałowy akord, ogon
send(fx_bus, kick(True), tb(56), 0.85)
send(fx_bus, sub_drop(1.8), tb(56), 0.5)
send(fx_bus, crash(2.6), tb(56), 0.28, rev=0.4)
send(music_bus, supersaw([48, 60, 64, 67, 72, 76], 1.6, 6500, 0.5, spread=0.22), tb(56), 0.9, rev=0.5)
for k in range(8):   # dekodowanie napisu
    send(fx_bus, pluck(96 + (k % 4) * 3, 0.06, 6000), tb(57) + k * S16 / 2, 0.08, -0.7 + k * 0.2, rev=0.2)
send(fx_bus, kick(True), tb(60), 0.7)
send(fx_bus, crash(3.0), tb(60), 0.22, rev=0.5)
send(music_bus, supersaw([48, 55, 60, 62, 64, 67, 72, 74, 79], 3.2, 5200, 1.2, spread=0.24, release=0.8), tb(60), 0.75, rev=0.7)
send(music_bus, pad([48, 60, 64, 67, 74], 3.0, cutoff=2400, attack=0.05, release=1.0), tb(60), 0.5, rev=0.6)
for k, m in enumerate([84, 88, 91, 96]):
    send(fx_bus, pluck(m, 0.4, 7000), tb(60) + k * S16, 0.12, -0.5 + k * 0.33, rev=0.4, dly=0.5)

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

# cisza przed dropem B (ostatnia ósemka B47.5–B48)
g0, g1 = idx(tb(47.5)), idx(tb(48))
gate = np.ones(N)
gate[g0:g1] = 0.0
ramp = idx(0.004)
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
