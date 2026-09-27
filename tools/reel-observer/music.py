"""Ścieżka do reelsa OBSERVER 01: 23 s, 120 BPM (46 beatów), A-dur (I–V–vi–IV), elektronika + mechanika oka.

Siatka wspólna z animacją (src/director.js): beat = 0,5 s.
  B0–B4     składanie oka: tykanie, wir, części lądują (klik-klank) — rangi o B2, B2.5, pancerz na 32-kach od B3
  B4        włączenie: przysłona "migawka", akord A, błysk
  B4–B10.5  lekki groove połówkowy; "mowa" oka (sylaby na słowa dymków), serwa przy zwrotach
  B10.5     cisza → B11 "…i trochę Ciebie": ciężkie D z małą sekundą, najazd; B12.5 mrugnięcia, chichot
  B13–B14   werbel + riser; B14 drop: wybuch oka (brzęk rozsypanych części), pełny groove
  B14.5/B15 nagłówek CREATIVE / DESIGNER; B15.25–B16 składanie kaskadą
  B22–B30   karuzela prac: obrót o kartę na stopę, skan; B30 wybuch, płyty cennika jak stemple (B30.5–B32)
  B38       wybuch, logo MJ. (B38.5, B39, kropka B39.5), przycisk m-jaro.pl (B40.5 / B42), B44 akord końcowy, B44.5 oczko
Uruchom:  python music.py   → music.wav
"""

import numpy as np
import numba as nb
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
BPM = 120
BEAT = 60 / BPM
S16 = BEAT / 4
BEATS = 46                        # 23 s, jak DUR w src/core.js
DUR = BEATS * BEAT
N = int(SR * (DUR + 3))           # zapas na ogony, przycinane na końcu
rng = np.random.default_rng(2014)


def tb(beat):                     # beat → sekundy
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


kick_bus, drum_bus, bass_bus, music_bus, fx_bus, ui_bus = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
rev_send = Bus()


def send(bus, sig, t, gain, pan=0.0, rev=0.0):
    bus.add(sig, t, gain, pan)
    if rev:
        rev_send.add(sig, t, gain * rev, pan)


# ------------------------------------------------------------------ narzędzia
def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def filt(x, kind, f, order=2):
    wn = np.array(f) / (SR / 2) if isinstance(f, (list, tuple)) else f / (SR / 2)
    return sosfilt(butter(order, wn, btype=kind, output='sos'), x)


def noise(n):
    return rng.standard_normal(n)


def const(n, v):
    return np.full(n, float(v))


# ------------------------------------------------------------------ perkusja
def kick(n_s=0.34):
    """Twarda stopa: krótki "punch" + klik, bez długiego ogona (bas robi 808)."""
    n = idx(n_s)
    t = np.arange(n) / SR
    f = 52 + 190 * np.exp(-t / 0.024) + 110 * np.exp(-t / 0.0035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2) * np.minimum(1, t / 0.0012)
    click = filt(noise(n), 'bandpass', (2500, 9000)) * env_exp(n, 0.003) * 0.7
    return np.tanh((body * 1.3 + click) * 1.6) * 0.9


def boom(dur=1.0, f_end=41.2):
    """Uderzenie z długim podbiciem sub (E1)."""
    n = idx(dur)
    t = np.arange(n) / SR
    f = f_end + 150 * np.exp(-t / 0.045) + 90 * np.exp(-t / 0.006)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (dur * 0.42)) * np.minimum(1, t / 0.0015)
    click = filt(noise(n), 'bandpass', (1800, 8000)) * env_exp(n, 0.004)
    return np.tanh((body * 1.5 + click * 0.8) * 1.5) * 0.95


def plate(pitch=1.0, dur=1.3, rattle=True):
    """Talerz sztangi uderzający o podłogę: głuchy "łup" gumy + metaliczny dzwon (niewspółmierne mody)."""
    n = idx(dur)
    t = np.arange(n) / SR
    thud = np.sin(2 * np.pi * np.cumsum(58 * pitch + 140 * np.exp(-t / 0.018)) / SR) * env_exp(n, 0.09)
    thud += filt(noise(n), 'lowpass', 420) * env_exp(n, 0.035) * 0.9
    l = np.zeros(n)
    r = np.zeros(n)
    f0 = 196 * pitch
    for k, (ratio, amp, tau) in enumerate([(1.0, 1.0, 0.55), (1.593, 0.8, 0.42), (2.136, 0.65, 0.33), (2.653, 0.55, 0.26),
                                             (3.156, 0.42, 0.2), (4.06, 0.3, 0.14), (5.12, 0.22, 0.1), (6.73, 0.16, 0.07)]):
        fr = f0 * ratio * (1 + 0.0035 * np.sin(2 * np.pi * (1.7 + k * 0.6) * t))   # dudnienie
        s = np.sin(2 * np.pi * np.cumsum(fr) / SR + rng.uniform(0, 6)) * amp * env_exp(n, tau * dur / 1.3)
        p = rng.uniform(-0.7, 0.7)
        l += s * (1 - p) / 2
        r += s * (1 + p) / 2
    clank = filt(noise(n), 'bandpass', (1800, 7500)) * env_exp(n, 0.012) * 1.3
    ring = np.stack([l, r]) * 0.33 * np.minimum(1, t / 0.0008)
    if rattle:   # drugie, słabsze odbicie talerza
        j = idx(0.085)
        ring[:, j:] += ring[:, :n - j] * 0.28
    return np.stack([thud * 0.9 + clank * 0.5 + ring[0], thud * 0.9 + clank * 0.5 + ring[1]])


def clap(big=False):
    n = idx(0.6 if big else 0.4)
    nz = filt(noise(n), 'bandpass', (900, 6000))
    e = np.zeros(n)
    for d in (0.0, 0.008, 0.017, 0.026):
        j = idx(d)
        e[j:] += env_exp(n - j, 0.004 if d < 0.026 else (0.16 if big else 0.1))
    body = np.sin(2 * np.pi * 190 * np.arange(n) / SR) * env_exp(n, 0.035) * 0.35
    return np.tanh((nz * e * 0.9 + body) * 1.3)


def snare(bright=1.0):
    n = idx(0.24)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * (190 + 70 * np.exp(-t / 0.012)) * t) * env_exp(n, 0.05)
    nz = filt(noise(n), 'bandpass', (1500 * bright, 9500)) * env_exp(n, 0.07)
    return np.tanh(tone * 0.8 + nz)


def hat(open_=False, bright=1.0):
    n = idx(0.3 if open_ else 0.06)
    t = np.arange(n) / SR
    metal = np.zeros(n)
    for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0):
        metal += np.sign(np.sin(2 * np.pi * f * 3.1 * t))
    x = filt(metal * 0.15 + noise(n) * 0.9, 'highpass', 7200 * bright)
    return x * env_exp(n, 0.08 if open_ else 0.014) * 0.9


def crash(dur=2.0, bright=1.0):
    n = idx(dur)
    t = np.arange(n) / SR
    metal = np.zeros(n)
    for f in (431, 587, 739, 1023, 1277, 1543, 1789):
        metal += np.sin(2 * np.pi * f * t * (1 + 0.002 * np.sin(2 * np.pi * 3 * t)) + rng.uniform(0, 6))
    x = filt(noise(n) + metal * 0.05, 'highpass', 3800 * bright)
    return x * env_exp(n, dur * 0.3) * np.minimum(1, t / 0.002)


def rev_crash(dur=1.0):
    c = crash(dur)
    return c[::-1] * np.linspace(0, 1, len(c)) ** 2


def sub_drop(dur=1.4, f0=82.4, f1=41.2):
    n = idx(dur)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.3)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, dur * 0.45) * np.minimum(1, t / 0.004)


# ------------------------------------------------------------------ instrumenty
def bass808(m, dur, glide_from=None, drive=2.2):
    """Bas 808: sinus z przesterem (słychać go też na telefonie), opcjonalny glide."""
    n = idx(dur + 0.06)
    t = np.arange(n) / SR
    f0 = midi(m)
    f = const(n, f0)
    if glide_from is not None:
        f = f0 + (midi(glide_from) - f0) * np.exp(-t / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * 0.8 + np.sin(2 * ph) * 0.35          # druga harmoniczna — bas słychać na telefonie
    e = np.minimum(1, t / 0.003) * np.where(t > dur, np.exp(-(t - dur) / 0.02), 1) * (0.75 + 0.25 * np.exp(-t / 0.15))
    y = np.tanh(s * e * drive) / np.tanh(drive)
    return filt(y, 'lowpass', 1100) * 0.8


def growl(m, dur, cut=900):
    """Środek basu na ósemkach: piła przez filtr z obwiednią."""
    n = idx(dur + 0.02)
    t = np.arange(n) / SR
    f = const(n, midi(m))
    s = osc_saw(f, 0.0) * 0.6 + osc_saw(f * 1.006, 0.37) * 0.6
    fc = cut + 1800 * np.exp(-t / 0.05)
    e = np.minimum(1, t / 0.002) * np.where(t > dur, np.exp(-(t - dur) / 0.01), 1)
    return np.tanh(svf(s, fc, 0.35, 0) * e * 1.4) * 0.5


def brass(notes, dur, bright=1.0, release=0.12):
    """Hybrydowy "brass" stab: piły z lekkim podciągnięciem stroju na ataku, filtr z obwiednią, przester."""
    n = idx(dur + release * 4)
    t = np.arange(n) / SR
    l = np.zeros(n)
    r = np.zeros(n)
    bend = 1 - 0.018 * np.exp(-t / 0.035)
    for m in notes:
        for v in range(3):
            det = (v - 1) * 0.08
            s = osc_saw(const(n, midi(m + det)) * bend, rng.uniform())
            p = (v - 1) * 0.6
            l += s * (1 - p) / 2
            r += s * (1 + p) / 2
    fc = (700 + 3800 * bright * np.exp(-t / 0.09) + 900 * bright) * np.minimum(1, t / 0.012 + 0.35)
    e = np.minimum(1, t / 0.006) * np.where(t > dur, np.exp(-(t - dur) / release), 1) * (0.7 + 0.3 * np.exp(-t / 0.12))
    g = 2.2 / (len(notes) * 3)
    out = np.stack([svf(l, fc, 0.18, 0), svf(r, fc, 0.18, 0)]) * e * g
    return np.tanh(out * 1.8) * 0.8


def pad(notes, dur, cutoff=1800, attack=0.25, release=0.7):
    n = idx(dur + release * 3)
    t = np.arange(n) / SR
    l = np.zeros(n)
    r = np.zeros(n)
    for m in notes:
        for v in range(6):
            det = (v - 2.5) / 2.5 * 0.1
            s = osc_saw(const(n, midi(m + det)), rng.uniform())
            p = v / 5 * 2 - 1
            l += s * (1 - p) / 2
            r += s * (1 + p) / 2
    fc = cutoff * (1 + 0.3 * np.sin(2 * np.pi * 0.7 * t))
    e = np.minimum(1, t / attack) * np.where(t > dur, np.exp(-(t - dur) / release), 1)
    g = 1.5 / (len(notes) * 6)
    return np.stack([svf(l, fc, 0.2, 0) * e * g, svf(r, fc, 0.2, 0) * e * g])


def bell(m, dur=1.2, index=3.2, ratio=3.5):
    """Dzwonek FM ("złoty" błysk)."""
    n = idx(dur)
    t = np.arange(n) / SR
    fc = midi(m)
    ie = index * np.exp(-t / (dur * 0.18))
    mod = np.sin(2 * np.pi * fc * ratio * t) * ie
    return np.sin(2 * np.pi * fc * t + mod) * env_exp(n, dur * 0.3) * np.minimum(1, t / 0.0015) * 0.5


def shimmer(dur=0.9, seed=0, lo=84, notes=(0, 4, 7, 11, 14, 16, 19)):
    """Chmura wysokich dzwonków — błysk światła po złotym elemencie."""
    r_ = np.random.default_rng(seed)
    n = idx(dur + 1.0)
    out = np.zeros((2, n))
    for k in range(9):
        m = lo + notes[r_.integers(len(notes))]
        b = bell(m, 0.8, 2.0, 2.0 + r_.uniform(0, 2))
        j = idx(k * dur / 12 + r_.uniform(0, 0.02))
        p = r_.uniform(-0.8, 0.8)
        L = min(len(b), n - j)
        out[0, j:j + L] += b[:L] * (1 - p) / 2 * (1 - k / 11)
        out[1, j:j + L] += b[:L] * (1 + p) / 2 * (1 - k / 11)
    return out


def whoosh(dur, f0, f1, peak_at=0.8, q=0.55):
    n = idx(dur)
    t = np.arange(n) / SR
    fc = f0 * (f1 / f0) ** (t / dur)
    x = svf(noise(n), fc, q, 1)
    u = t / dur
    e = np.where(u < peak_at, (u / peak_at) ** 2, np.maximum(0, 1 - (u - peak_at) / (1 - peak_at)) ** 1.5)
    return x * e


def riser(dur, f0=160, f1=1600):
    n = idx(dur)
    t = np.arange(n) / SR
    u = t / dur
    f = f0 * (f1 / f0) ** (u ** 1.5)
    s = osc_saw(f, 0.0) * 0.5 + osc_saw(f * 1.01, 0.3) * 0.5
    nz = svf(noise(n), 400 * (30 ** u), 0.4, 1)
    x = svf(s, 300 + 6000 * u ** 2, 0.3, 0) * 0.45 + nz * 0.7
    return x * u ** 2


# ------------------------------------------------------------------ dźwięki interfejsu
def tap():
    """Tapnięcie w ekran: miękki "tok" + klik."""
    n = idx(0.09)
    t = np.arange(n) / SR
    tok = np.sin(2 * np.pi * (230 + 380 * np.exp(-t / 0.006)) * t) * env_exp(n, 0.022)
    clk = filt(noise(n), 'highpass', 5000) * env_exp(n, 0.0018) * 0.5
    return np.tanh((tok + clk) * 1.4) * 0.7


def press():
    """Wciśnięcie dużego przycisku "wyślij": głębszy, satysfakcjonujący "thock"."""
    n = idx(0.22)
    t = np.arange(n) / SR
    tok = np.sin(2 * np.pi * np.cumsum(120 + 420 * np.exp(-t / 0.008)) / SR) * env_exp(n, 0.055)
    clk = filt(noise(n), 'bandpass', (2500, 9000)) * env_exp(n, 0.0025) * 0.7
    return np.tanh((tok * 1.2 + clk) * 1.5) * 0.8


def key(f=2800):
    """Klawisz przy pisaniu."""
    n = idx(0.035)
    t = np.arange(n) / SR
    x = filt(noise(n), 'bandpass', (f * 0.7, f * 2.2)) * env_exp(n, 0.004)
    x += np.sin(2 * np.pi * f * 0.5 * t) * env_exp(n, 0.006) * 0.3
    return x * 0.6


def check_tick():
    n = idx(0.25)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 2350 * t) * env_exp(n, 0.03) + np.sin(2 * np.pi * 3520 * t) * env_exp(n, 0.05) * 0.5
    return s * np.minimum(1, t / 0.001) * 0.45


def swish(dur=0.09, f0=900, f1=6000):
    """Szybki "ślizg" karty."""
    return whoosh(dur, f0, f1, 0.35, 0.7) * 1.2


def spinner(dur):
    """Kręcący się loader: wznoszący się ton z tremolo na 32-kach."""
    n = idx(dur)
    t = np.arange(n) / SR
    u = t / dur
    f = midi(76) * 2 ** (u * 1.0)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR + 1.2 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR))
    trem = 0.55 + 0.45 * np.sin(2 * np.pi * (8 / BEAT) * t) ** 2
    return s * trem * (0.2 + 0.8 * u) * 0.3




# ------------------------------------------------------------------ dźwięki oka (mechanika)
def clank(pitch=1.0, dur=0.35, weight=1.0):
    """Część oka "wskakuje" na miejsce: magnetyczny klik + metaliczny dźwięk (niewspółmierne mody) + głuchy dół."""
    n = idx(dur)
    t = np.arange(n) / SR
    f0 = 620 * pitch
    ring = np.zeros(n)
    for k, (ratio, amp, tau) in enumerate([(1.0, 1.0, 0.11), (2.76, 0.7, 0.07), (5.40, 0.45, 0.045), (8.93, 0.3, 0.03), (13.3, 0.18, 0.02)]):
        ring += np.sin(2 * np.pi * f0 * ratio * t + rng.uniform(0, 6)) * amp * env_exp(n, tau * dur / 0.35)
    click = filt(noise(n), 'bandpass', (3000, 11000)) * env_exp(n, 0.0015)
    thud = np.sin(2 * np.pi * np.cumsum(90 * pitch + 160 * np.exp(-t / 0.01)) / SR) * env_exp(n, 0.04) * weight
    return np.tanh((ring * 0.35 + click * 0.9 + thud * 0.8) * 1.3) * 0.8


def servo(dur=0.22, f0=140, f1=230):
    """Serwo obracające oko: brzęczenie piły przez pasmo + "ząbki" przekładni."""
    n = idx(dur)
    t = np.arange(n) / SR
    u = t / dur
    f = f0 + (f1 - f0) * np.sin(u * np.pi / 2)
    s = osc_saw(f, 0.0)
    teeth = 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * np.cumsum(f * 0.5) / SR))
    x = svf(s * teeth, const(n, 1500), 0.45, 1)
    e = np.sin(np.pi * np.minimum(1, u)) ** 0.7
    return x * e * 0.6


def shutter(open_=True):
    """Przysłona: dwa kliki listków + krótki szelest."""
    n = idx(0.12)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d, a in ((0.0, 1.0), (0.028 if open_ else 0.02, 0.7)):
        j = idx(d)
        out[j:] += filt(noise(n - j), 'bandpass', (2500, 9000)) * env_exp(n - j, 0.0025) * a
    out += filt(noise(n), 'bandpass', (1400, 5000)) * env_exp(n, 0.02) * 0.35
    out += np.sin(2 * np.pi * 1850 * t) * env_exp(n, 0.012) * 0.25
    return out * 0.8


def chirp(m, dur=0.1, up=True, bright=1.0):
    """Sylaba "głosu" oka: krótki ton FM z poślizgiem wysokości (jak mały robot)."""
    n = idx(dur + 0.03)
    t = np.arange(n) / SR
    u = np.minimum(1, t / dur)
    f = midi(m) * 2 ** (((u - 0.5) * (0.35 if up else -0.35)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    mod = np.sin(2 * ph) * (1.4 * bright) * np.exp(-t / 0.05)
    s = np.sin(ph + mod)
    e = np.minimum(1, t / 0.004) * np.where(t > dur, np.exp(-(t - dur) / 0.012), 1)
    return s * e * 0.5


def stamp(m):
    """Płyta cennika uderza jak stempel prasy drukarskiej: głuche uderzenie + klak + ton farby."""
    n = idx(0.6)
    t = np.arange(n) / SR
    thud = np.sin(2 * np.pi * np.cumsum(62 + 180 * np.exp(-t / 0.012)) / SR) * env_exp(n, 0.11)
    clack = filt(noise(n), 'bandpass', (900, 3800)) * env_exp(n, 0.018)
    tone = np.sin(2 * np.pi * midi(m) * t + 2.2 * np.sin(2 * np.pi * midi(m) * 3 * t) * np.exp(-t / 0.06)) * env_exp(n, 0.22)
    return np.tanh((thud * 1.2 + clack * 0.8 + tone * 0.35) * 1.4) * 0.8


def debris(dur=0.45, count=16, seed=0, pitch=1.0):
    """Wybuch oka: rozsypujące się części — seria drobnych metalicznych brzęków (stereo)."""
    r_ = np.random.default_rng(seed)
    n = idx(dur + 0.4)
    out = np.zeros((2, n))
    for k in range(count):
        c = clank(pitch * r_.uniform(0.8, 2.4), r_.uniform(0.15, 0.35), 0.3)
        j = idx((k / count) ** 1.6 * dur + r_.uniform(0, 0.02))
        p = r_.uniform(-0.9, 0.9)
        g = (1 - k / count) ** 1.2 * 0.5
        L_ = min(len(c), n - j)
        out[0, j:j + L_] += c[:L_] * g * (1 - p) / 2
        out[1, j:j + L_] += c[:L_] * g * (1 + p) / 2
    return out


def powerup(dur=0.5, f0=180, f1=1760):
    """Włączenie oka: wznoszący się ton + szum."""
    n = idx(dur)
    t = np.arange(n) / SR
    u = t / dur
    f = f0 * (f1 / f0) ** (u ** 2)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return s * u ** 2 * 0.4


def glitch(dur=0.18, seed=0):
    """Glitch nagłówka: pocięty szum i ton w 32-kach."""
    r_ = np.random.default_rng(seed)
    n = idx(dur)
    t = np.arange(n) / SR
    x = filt(noise(n), 'bandpass', (600, 6000)) * 0.5 + np.sign(np.sin(2 * np.pi * r_.uniform(300, 900) * t)) * 0.3
    gate = (np.floor(t / (S16 / 4)) % 2 == 0).astype(float)
    return x * gate * env_exp(n, dur * 0.6) * 0.6


def pluck(m, dur=0.16, bright=1.0):
    """Pluck do arpeggio (kwadrat przez filtr z obwiednią)."""
    n = idx(dur + 0.15)
    t = np.arange(n) / SR
    f = const(n, midi(m))
    s = osc_saw(f, 0.0) - osc_saw(f, 0.5)              # prostokąt z dwóch pił
    fc = 600 + 5200 * bright * np.exp(-t / 0.045)
    e = np.minimum(1, t / 0.002) * env_exp(n, 0.13)
    return svf(s, fc, 0.3, 0) * e * 0.35


def supersaw(notes, dur, cutoff=3200, attack=0.01, release=0.25):
    """Szerokie akordy (future bass): piły rozstrojone, filtr otwarty."""
    n = idx(dur + release * 4)
    t = np.arange(n) / SR
    l = np.zeros(n)
    r = np.zeros(n)
    for m in notes:
        for v in range(5):
            det = (v - 2) / 2 * 0.14
            s = osc_saw(const(n, midi(m + det)), rng.uniform())
            p = (v - 2) / 2 * 0.9
            l += s * (1 - p) / 2
            r += s * (1 + p) / 2
    fc = cutoff * (0.6 + 0.4 * np.exp(-t / 0.3))
    e = np.minimum(1, t / attack) * np.where(t > dur, np.exp(-(t - dur) / release), 1)
    g = 1.6 / (len(notes) * 5)
    return np.stack([svf(l, fc, 0.15, 0) * e * g, svf(r, fc, 0.15, 0) * e * g])


# ------------------------------------------------------------------ harmonia: A-dur, I–V–vi–IV
CH = {'A': [57, 61, 64, 69], 'E': [56, 59, 64, 68], 'F#m': [57, 61, 66, 69], 'D': [57, 62, 66, 69], 'Bm': [59, 62, 66, 71]}
ROOT = {'A': 33, 'E': 28, 'F#m': 30, 'D': 38, 'Bm': 35}
ARP = {'A': [69, 73, 76, 81], 'E': [68, 71, 76, 80], 'F#m': [69, 73, 78, 81], 'D': [69, 74, 78, 81], 'Bm': [71, 74, 78, 83]}
PENTA = [69, 71, 73, 76, 78, 81, 83, 85]
# (od beatu, do beatu, akord)
HARM = [(4, 6, 'A'), (6, 8, 'E'), (8, 10, 'F#m'), (10, 14, 'D'),
        (14, 18, 'A'), (18, 22, 'E'), (22, 26, 'F#m'), (26, 30, 'D'),
        (30, 34, 'A'), (34, 38, 'E'), (38, 42, 'F#m'), (42, 44, 'D'), (44, 46, 'A')]


def chord_at(b):
    for b0, b1, ch in HARM:
        if b0 <= b < b1:
            return ch
    return 'A'


kicks = []   # czasy stóp → sidechain


def K(beat, gain=1.0, depth=0.7):
    kick_bus.add(kick(), tb(beat), gain)
    kicks.append((tb(beat), depth))


def BOOM(beat, gain=1.0, depth=0.9, f_end=41.2):
    kick_bus.add(boom(1.0, f_end), tb(beat), gain)
    kicks.append((tb(beat), depth))


# ------------------------------------------------------------------ zdarzenia z src/director.js (te same beaty)
# słowa dymków (co 16-tkę) — "mowa" oka
CAPS = [
    (5.0, 4), (8.75, 3), (11.0, 3), (16.5, 8), (23.25, 8), (33.5, 8), (40.25, 6),
]
# lądowania części: rangi 0–4, ranga 2 (6 płyt pancerza) co 32-kę / 64-kę
LANDS = [
    (2.0, 2.5, (3.0, 0.125), 3.75, 3.875),
    (15.25, 15.375, (15.5, 0.0625), 15.875, 16.0),
    (32.5, 32.625, (32.75, 0.0625), 32.9375, 33.0),
    (39.0, 39.125, (39.25, 0.0625), 39.4375, 39.5),
]
EXPLODE = [14, 30, 38]
BLINKS = [7.0, 12.5, 12.8, 19.5, 26.5, 36.0]
LOOKS = [4.5, 5.0, 5.5, 8.5, 10.5, 16.25, 18.0, 19.0, 20.0, 33.0, 33.5, 34.0, 34.5, 36.5, 40.75, 42.25, 43.25]


def lands(ev, final_gain=1.0):
    r0, r1, (a0, da), r3, r4 = ev
    send(fx_bus, clank(0.55, 0.5, 1.4), tb(r0), 0.55, -0.15, rev=0.2)
    send(fx_bus, clank(0.8, 0.4, 1.0), tb(r1), 0.45, 0.2, rev=0.2)
    for k in range(6):
        send(fx_bus, clank(1.0 + k * 0.12, 0.3, 0.6), tb(a0 + k * da), 0.3 + k * 0.03, -0.7 + k * 0.28, rev=0.15)
    send(fx_bus, clank(1.3, 0.35, 0.9), tb(r3), 0.45, 0.0, rev=0.2)
    send(fx_bus, clank(1.7, 0.45, 1.2), tb(r4), 0.55 * final_gain, 0.0, rev=0.3)
    send(fx_bus, shutter(True), tb(r4) + 0.03, 0.5, 0.0, rev=0.2)


# ================================================================ aranżacja
# ---------------------------------------------------------------- B0–B4: składanie oka
send(music_bus, pad([54, 57, 61, 66], tb(4) - 0.1, cutoff=900, attack=1.2, release=0.4), 0.0, 0.5, rev=0.5)   # F#m, ciemno
send(bass_bus, bass808(30, tb(4) - 0.2, drive=1.4), 0.0, 0.25)
for s_ in range(16):                                  # tykanie na 16-kach, narasta
    send(drum_bus, hat(bright=1.2), tb(s_ / 4 + 0) if s_ < 4 else tb(s_ / 4), 0.03 + 0.07 * s_ / 16, 0.3 - 0.6 * (s_ % 2))
for s_ in range(8):
    send(drum_bus, hat(bright=1.1), tb(2 + s_ / 4), 0.05 + 0.05 * s_ / 8, -0.3 + 0.6 * (s_ % 2))
send(fx_bus, whoosh(tb(2.0), 200, 3000, 0.95), 0.0, 0.25, rev=0.3)            # części wirują do środka
send(fx_bus, rev_crash(1.2), tb(4) - 1.2, 0.25)
send(fx_bus, powerup(tb(0.5)), tb(3.5), 0.35, rev=0.3)
lands(LANDS[0])
# B4: włączenie oka
BOOM(4, 1.0)
send(fx_bus, crash(2.2, 1.1), tb(4), 0.22, rev=0.3)
send(drum_bus, clap(True), tb(4), 0.4, rev=0.35)
send(fx_bus, shutter(True), tb(4), 0.9, 0.0, rev=0.3)
send(music_bus, supersaw(CH['A'] + [45, 76], 0.5, 4200, release=0.4), tb(4), 0.75, rev=0.45)
send(fx_bus, shimmer(0.7, seed=4, lo=81, notes=(0, 4, 7, 9, 12, 16)), tb(4.05), 0.2, rev=0.5)
send(fx_bus, sub_drop(1.2, 110, 55), tb(4), 0.2)

# ---------------------------------------------------------------- B4–B10.5: lekki groove (połówkowy)
for b in (6, 8, 10):
    K(b, 0.7, 0.55)
for b in (5, 7, 9):
    send(drum_bus, clap(), tb(b), 0.32, rev=0.25)
for s_ in range(int((10.5 - 4.5) * 2)):
    send(drum_bus, hat(bright=1.05), tb(4.5 + s_ / 2), 0.09, 0.35 - 0.7 * (s_ % 2))
for b0, b1, ch in HARM:
    if b0 < 10:
        send(bass_bus, bass808(ROOT[ch], tb(b1 - b0) - 0.03, glide_from=ROOT[ch] + 12 if b0 == 4 else None), tb(b0), 0.45)
        send(music_bus, supersaw(CH[ch], tb(b1 - b0) - 0.05, 1600, attack=0.03, release=0.2), tb(b0), 0.28, rev=0.35)
# arpeggio (16-tki) — lekkie, "zaciekawione"
for s_ in range(int((10.5 - 4.25) * 4)):
    b = 4.25 + s_ / 4
    ch = chord_at(b)
    m = ARP[ch][[0, 2, 1, 3, 2, 1, 3, 0][s_ % 8]] + 12
    send(music_bus, pluck(m, 0.1, 0.8), tb(b), 0.12 + 0.04 * (s_ % 4 == 0), 0.4 if s_ % 2 else -0.4, rev=0.3)

# ---------------------------------------------------------------- B10.5–B14: "…i trochę Ciebie" i napięcie
send(fx_bus, rev_crash(0.5), tb(11) - 0.5, 0.2)
BOOM(11, 0.9, 0.9, f_end=36.7)                                        # D1 — ciężko
send(music_bus, supersaw([50, 57, 62, 63], 1.2, 1400, release=0.6), tb(11), 0.4, rev=0.5)   # D z małą sekundą — "podejrzliwie"
send(fx_bus, whoosh(tb(0.7), 3000, 150, 0.2, 0.5), tb(11), 0.3, rev=0.3)          # najazd kamery
send(bass_bus, bass808(26, tb(1.4), drive=2.6), tb(11), 0.5)
send(fx_bus, powerup(0.25, 2000, 600), tb(11.1), 0.12)                              # źrenica się zwęża
for b in (12.5, 12.8):                                                               # mrugnięcia
    send(ui_bus, shutter(False), tb(b), 0.6, 0.1)
for k, m in enumerate([81, 78, 81, 78, 76]):                                         # chichot "he-he-he"
    send(ui_bus, chirp(m, 0.07, up=False), tb(12.9 + k * 0.18), 0.28, -0.3 + k * 0.15, rev=0.2)
roll = [13 + k * 0.25 for k in range(2)] + [13.5 + k * 0.125 for k in range(2)] + [13.75 + k * 0.0625 for k in range(4)]
for k, b in enumerate(roll):
    send(drum_bus, snare(1.1 + k * 0.03), tb(b), 0.1 + k * 0.035, 0.2 if k % 2 else -0.2, rev=0.25)
send(fx_bus, riser(tb(1.0), 250, 2600), tb(13), 0.28, rev=0.25)
send(fx_bus, rev_crash(0.5), tb(14) - 0.5, 0.25)
send(music_bus, pad(CH['D'], tb(3.2), cutoff=1300, attack=0.3, release=0.3), tb(11), 0.35, rev=0.5)

# ---------------------------------------------------------------- B14–B30: drop, pełny groove
for ev in EXPLODE:
    BOOM(ev, 1.0)
    send(fx_bus, debris(0.5, 18, seed=ev, pitch=1.0), tb(ev), 0.8, rev=0.25)
    send(fx_bus, crash(2.0, 1.0), tb(ev), 0.22, rev=0.25)
    send(drum_bus, clap(True), tb(ev), 0.4, rev=0.35)
    send(fx_bus, sub_drop(1.2), tb(ev), 0.18)
    send(fx_bus, whoosh(tb(0.8), 400, 9000, 0.1, 0.5), tb(ev), 0.3, rev=0.2)
for b in range(14, 44):
    if b not in EXPLODE:
        K(b, 0.85)
for b in range(15, 44, 2):
    send(drum_bus, clap(), tb(b), 0.4, rev=0.22)
    send(drum_bus, snare(), tb(b), 0.14, rev=0.15)
for s_ in range(int((44 - 14) * 4)):
    acc = 1.0 if s_ % 4 == 2 else (0.5 if s_ % 2 else 0.28)
    send(drum_bus, hat(bright=1.0 if s_ % 4 else 0.9), tb(14) + s_ * S16, 0.12 * acc, -0.35 + 0.7 * (s_ % 2))
for b in range(14, 44):
    send(drum_bus, hat(True), tb(b + 0.5), 0.07, 0.3)
for b0, b1, ch in HARM:
    if 14 <= b0 < 44:
        send(bass_bus, bass808(ROOT[ch], tb(b1 - b0) - 0.03, glide_from=ROOT[ch] + 12 if b0 in (14, 30) else None), tb(b0), 0.5)
        e = b0
        while e < b1 - 0.01:
            send(bass_bus, growl(ROOT[ch] + 24, S16 * 1.5, 900), tb(e + 0.5), 0.18)
            e += 1
        # akordy: pchnięcie na "raz" i synkopa na 2+ (future bass)
        for off, ln, g in ((0, 1.25, 0.34), (1.5, 0.4, 0.22), (2.5, 1.0, 0.26)):
            if b0 + off < b1:
                send(music_bus, supersaw(CH[ch], tb(ln), 3000, release=0.15), tb(b0 + off), g, rev=0.3)
# arpeggio w drugiej połowie (B22–B30 i B34–B44): skanowanie
for lo, hi in ((22, 30), (34, 44)):
    for s_ in range(int((hi - lo) * 4)):
        b = lo + s_ / 4
        ch = chord_at(b)
        m = ARP[ch][[0, 1, 2, 3, 2, 1, 3, 2][s_ % 8]] + 12
        send(music_bus, pluck(m, 0.09, 1.0), tb(b), 0.09 + 0.04 * (s_ % 4 == 0), 0.45 if s_ % 2 else -0.45, rev=0.3)

# nagłówek: CREATIVE (B14.5) / DESIGNER (B15) — staby; glitche nagłówka
for b, top in ((14.5, 76), (15, 81)):
    send(music_bus, brass(CH['A'] + [top], 0.3, 1.0), tb(b), 0.5, rev=0.35)
    send(drum_bus, clap(), tb(b), 0.25, rev=0.3)
for b, sd in ((17, 1), (17.75, 2), (19.5, 3), (20.25, 4)):
    send(fx_bus, glitch(0.16, sd), tb(b), 0.25, 0.3 if sd % 2 else -0.3)
lands(LANDS[1])
send(fx_bus, shimmer(0.5, seed=16, lo=86, notes=(0, 3, 7, 10, 12)), tb(16.05), 0.12, rev=0.5)
# przewinięcie strony (B21.5–B22.15) i piruet oka (B21.8–B22.8)
send(fx_bus, whoosh(tb(0.65), 300, 9000, 0.9), tb(21.5), 0.35, rev=0.2)
send(fx_bus, servo(tb(1.0), 120, 420), tb(21.8), 0.3, 0.2)
# karuzela prac: druk rastrem (B22.1), obrót o kartę na każdą stopę (B23–B29) + skan
for k in range(16):
    send(ui_bus, key(3000 + k * 180), tb(22.1) + k * tb(1) / 16, 0.16, -0.6 + k * 0.08)
for b in range(23, 30):
    send(fx_bus, swish(0.11, 800, 7000), tb(b) - 0.04, 0.3, 0.4 if b % 2 else -0.4)
    send(ui_bus, tap(), tb(b), 0.18, 0.0)
    send(ui_bus, chirp(PENTA[(b * 3) % 8] + 12, 0.05, up=True, bright=0.4), tb(b) + 0.05, 0.06, 0.2)
lands(LANDS[2])
# cennik: płyty C, M, Y, K jak stemple (B30.5–B32), dźwięk farby rośnie
for b, m in ((30.5, 69), (31, 73), (31.5, 76), (32, 81)):
    send(fx_bus, stamp(m), tb(b), 0.75, 0.3 if b % 1 else -0.3, rev=0.25)
    kicks.append((tb(b), 0.5))
send(fx_bus, shimmer(0.5, seed=33, lo=86, notes=(0, 4, 7, 9, 12)), tb(33.05), 0.12, rev=0.5)
# oko "kiwa" nad płytami (B33–B34.5)
for k, b in enumerate((33.0, 33.5, 34.0, 34.5)):
    send(ui_bus, chirp(PENTA[k + 2] + 12, 0.05, up=True, bright=0.5), tb(b) + 0.04, 0.07, 0.3)
# logo: M (B38.5), J (B39), kropka (B39.5)
for b, m, g in ((38.5, 57, 0.8), (39.0, 64, 0.8)):
    send(fx_bus, stamp(m + 12), tb(b), g, 0.0, rev=0.3)
lands(LANDS[3], 1.2)
send(fx_bus, bell(93, 1.2, 2.2), tb(39.5), 0.18, 0.0, rev=0.5)
# przycisk m-jaro.pl (B40.5) i wypełnienie (B42) + e-mail
send(ui_bus, tap(), tb(40.5), 0.4, 0.0, rev=0.2)
send(ui_bus, tap(), tb(42), 0.45, 0.0, rev=0.3)
send(fx_bus, bell(88, 1.0, 2.0), tb(42), 0.14, 0.2, rev=0.5)
send(fx_bus, shimmer(0.6, seed=42, lo=88, notes=(0, 4, 7, 11, 12)), tb(42.05), 0.14, rev=0.5)

# wdech przed wybuchami (B13.25, B29.25, B37.25)
for ev in EXPLODE:
    send(fx_bus, rev_crash(tb(0.75)), tb(ev - 0.75), 0.2)
    send(fx_bus, powerup(tb(0.75), 300, 1400), tb(ev - 0.75), 0.12)

# ---------------------------------------------------------------- B44–B46: akord końcowy i "oczko"
BOOM(44, 0.85)
send(music_bus, supersaw(CH['A'] + [45, 76, 80], tb(2) - 0.1, 3600, release=0.6), tb(44), 0.55, rev=0.55)
send(music_bus, pad(CH['A'] + [45, 71, 76], tb(2), cutoff=2400, attack=0.02, release=0.8), tb(44), 0.35, rev=0.6)
send(bass_bus, bass808(33, tb(2) - 0.1, drive=1.8), tb(44), 0.45)
send(fx_bus, crash(2.5, 1.0), tb(44), 0.18, rev=0.4)
send(ui_bus, shutter(False), tb(44.5), 0.6, 0.0)
for k, m in enumerate([81, 85, 88]):                                   # "bip-bip-bop!" na koniec
    send(ui_bus, chirp(m, 0.06 if k < 2 else 0.11, up=True), tb(44.85) + k * 0.1, 0.24, -0.2 + k * 0.2, rev=0.3)
for k in range(4):
    send(drum_bus, hat(bright=1.2), tb(44.5 + k / 2), 0.05 * (1 - k / 4), 0.3 - 0.6 * (k % 2))

# ---------------------------------------------------------------- mowa oka i ruchy
for b0, nw in CAPS:
    ch = chord_at(b0)
    for k in range(nw):
        b = b0 + k * 0.25
        m = PENTA[int(rng.integers(0, 6))] + 12 * int(rng.integers(0, 2))
        send(ui_bus, chirp(m, 0.07 + 0.03 * rng.uniform(), up=bool(rng.integers(0, 2))), tb(b), 0.16, rng.uniform(-0.3, 0.3), rev=0.2)
for b in BLINKS:
    if b not in (12.5, 12.8):
        send(ui_bus, shutter(False), tb(b), 0.4, 0.15)
for b in LOOKS:
    send(fx_bus, servo(0.16, 150 + rng.uniform(-20, 40), 240 + rng.uniform(-20, 60)), tb(b), 0.14, rng.uniform(-0.4, 0.4))

# ================================================================ miks
duck = np.ones(N)
for tk, depth in kicks:
    i = idx(tk)
    n = min(N - i, idx(0.4))
    tt = np.arange(n) / SR
    g = 1 - depth * np.where(tt < 0.004, tt / 0.004, np.exp(-(tt - 0.004) / 0.07))
    duck[i:i + n] = np.minimum(duck[i:i + n], g)

ir_n = idx(2.2)
tt = np.arange(ir_n) / SR
irs = []
for ch_ in range(2):
    ir = rng.standard_normal(ir_n) * np.exp(-tt / 0.5)
    ir = filt(ir, 'lowpass', 6500)
    ir[: idx(0.02)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    irs.append(ir)
wet_l = fftconvolve(filt(rev_send.l, 'highpass', 280), irs[0])[:N] * 0.8
wet_r = fftconvolve(filt(rev_send.r, 'highpass', 280), irs[1])[:N] * 0.8

for bus, gain in ((kick_bus, 0.8), (bass_bus, 0.55), (music_bus, 1.4), (drum_bus, 1.2), (ui_bus, 1.2)):
    bus.l *= gain
    bus.r *= gain
grooveL = kick_bus.l + drum_bus.l * (0.65 + 0.35 * duck) + (bass_bus.l + music_bus.l + wet_l) * duck
grooveR = kick_bus.r + drum_bus.r * (0.65 + 0.35 * duck) + (bass_bus.r + music_bus.r + wet_r) * duck
L = grooveL + fx_bus.l + ui_bus.l
R = grooveR + fx_bus.r + ui_bus.r

# cisza przed "…i trochę Ciebie" (B10.5–B11) i ostatnia 32-ka przed dropem (B13.94–B14): tylko groove
gate = np.ones(N)
for a, b in ((10.5, 11.0), (13.94, 14.0), (29.94, 30.0), (37.94, 38.0)):
    g0, g1 = idx(tb(a)), idx(tb(b))
    ramp = idx(0.006)
    gate[g0:g1] = 0.0
    gate[g0 - ramp:g0] = np.linspace(1, 0, ramp)
L = L - grooveL * (1 - gate)
R = R - grooveR * (1 - gate)

L = L[: idx(DUR)]
R = R[: idx(DUR)]
fn = idx(0.6)
fade = np.ones(len(L))
fade[-fn:] = np.linspace(1, 0, fn) ** 2
L *= fade
R *= fade
fi = idx(0.002)
L[:fi] *= np.linspace(0, 1, fi)
R[:fi] *= np.linspace(0, 1, fi)
L = filt(L, 'highpass', 30, 4)
R = filt(R, 'highpass', 30, 4)


def biquad(x, kind, f, gain_db, q=0.707):
    # filtry półkowe / dzwonowe z "Audio EQ Cookbook" (RBJ)
    from scipy.signal import lfilter
    A = 10 ** (gain_db / 40)
    w = 2 * np.pi * f / SR
    cw, sw = np.cos(w), np.sin(w)
    al = sw / (2 * q)
    if kind == 'low':
        sa = 2 * np.sqrt(A) * al
        b_ = [A * ((A + 1) - (A - 1) * cw + sa), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sa)]
        a_ = [(A + 1) + (A - 1) * cw + sa, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sa]
    elif kind == 'high':
        sa = 2 * np.sqrt(A) * al
        b_ = [A * ((A + 1) + (A - 1) * cw + sa), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sa)]
        a_ = [(A + 1) - (A - 1) * cw + sa, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sa]
    else:
        b_ = [1 + al * A, -2 * cw, 1 - al * A]
        a_ = [1 + al / A, -2 * cw, 1 - al / A]
    return lfilter(np.array(b_) / a_[0], np.array(a_) / a_[0], x)


# mniej sub (telefon go nie odtworzy, a zjada zapas limitera), więcej środka — to gra na głośniku telefonu
EQ = [('low', 70, -7.0, 0.7), ('bell', 900, 3.5, 0.6), ('high', 8000, -2.0, 0.7)]
for kind, f, gdb, q in EQ:
    L = biquad(L, kind, f, gdb, q)
    R = biquad(R, kind, f, gdb, q)


def limit(l, r, ceiling=0.80, look=idx(0.004), rel=0.08):
    # limiter "true peak": obwiednia szczytów z sygnału nadpróbkowanego 4× (AAC na Instagramie nie przesteruje)
    from scipy.signal import resample_poly
    from scipy.ndimage import maximum_filter1d
    n = len(l)
    upl = np.abs(resample_poly(l, 4, 1))[: n * 4].reshape(n, 4).max(1)
    upr = np.abs(resample_poly(r, 4, 1))[: n * 4].reshape(n, 4).max(1)
    pk = maximum_filter1d(np.maximum(upl, upr), size=look * 2 + 1)
    g = np.minimum(1.0, ceiling / np.maximum(pk, 1e-9))
    gs = smooth_gain(g, np.exp(-1.0 / (rel * SR)))
    return l * gs, r * gs


pk = max(np.abs(L).max(), np.abs(R).max())
L /= pk
R /= pk
L = filt(L, 'lowpass', 18500, 4)
R = filt(R, 'lowpass', 18500, 4)
drive = 1.2
L = np.tanh(L * 1.7 * drive) / np.tanh(drive)
R = np.tanh(R * 1.7 * drive) / np.tanh(drive)
L, R = limit(L, R)
st = np.stack([L, R], 1)
wavfile.write('music.wav', SR, (np.clip(st, -1, 1) * 32767).astype(np.int16))
print('ok', len(L) / SR, 's')
