"""Ścieżka do reelsa Body Creator: 14,5 s, 120 BPM (29 beatów), e-moll → E-dur na finał.

Siatka wspólna z animacją (src/core.js): beat = 0,5 s; opis w beatach sceny (przed przytrzymaniami, patrz HOLDS).
  B0        uderzenie: talerz sztangi o podłogę, "TWOJE MIEJSCE" + litery "TRENINGU" na 32-kach (B0.375–B1.25)
  B1.25–B2  napięcie: werbel, riser, błysk światła (B1.3), odjazd kamery do telefonu
  B2        drop: telefon ze stroną; groove (stopa na ćwierćnutach, klaśnięcie na 2 i 4, bas 808)
  B3 B4.5 B6  stab na każdy element wyskakujący ze strony (oferta · zespół · opinie)
  B7.25     tapnięcie w "Darmowa konsultacja", nurkowanie w ekran, cisza przed formularzem
  B8–B11    formularz: pisanie na 32-kach, "tik" checkboxa (B10), tapnięcie "wyślij" (B11)
  B11–B12   spinner, werbel, riser; B12 "GOTOWE!" — akord E-dur, dzwonki
  B13       logo: dwie połówki uderzają o siebie jak talerze; ogon do 8,0 s
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
# przytrzymania z src/core.js (HOLDS): czas sceny zwalnia, żeby napisy dało się przeczytać — muzyka leci równo,
# akcenty (tb) trafiają w przeliczone momenty obrazu, a groove (tn) gra na rzeczywistej siatce beatów
HOLDS = [(1.26, 1.3, 2), (3.62, 3.85, 2), (5.2, 5.3, 2), (6.52, 6.6, 2), (7.1, 7.2, 1), (12.42, 12.6, 2), (15.3, 15.5, 2)]
DUR = (16 + sum(h[2] for h in HOLDS)) * BEAT
N = int(SR * (DUR + 3))          # zapas na ogony, przycinane na końcu
rng = np.random.default_rng(1205)


def rb(b):
    """beat sceny → beat rzeczywisty"""
    add = 0.0
    for a, c, x in HOLDS:
        if b >= c:
            add += x
        elif b > a:
            add += x * (b - a) / (c - a)
    return b + add


def tb(beat):                     # beat sceny → sekundy (akcenty zgrane z obrazem)
    return rb(beat) * BEAT


def tn(beat):                     # beat rzeczywisty → sekundy (groove na siatce)
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


# ------------------------------------------------------------------ harmonia
E1, E2 = 28, 40
CH = {
    'Em': [52, 55, 59, 64], 'C': [52, 55, 60, 64], 'D': [54, 57, 62, 66], 'B': [51, 54, 59, 63], 'E': [52, 56, 59, 64],
}
ROOT = {'Em': 28, 'C': 36, 'D': 38, 'B': 35, 'E': 28}
# (od beatu, do beatu, akord)
HARM = [(2, 4, 'Em'), (4, 6, 'C'), (6, 7.5, 'D'), (8, 10, 'Em'), (10, 11, 'C'), (11, 12, 'B'), (12, 13, 'E')]

kicks = []   # czasy stóp → sidechain


def K(beat, gain=1.0, depth=0.7, real=False):
    tt = tn(beat) if real else tb(beat)
    kick_bus.add(kick(), tt, gain)
    kicks.append((tt, depth))


def BOOM(beat, gain=1.0, depth=0.9):
    kick_bus.add(boom(), tb(beat), gain)
    kicks.append((tb(beat), depth))


# ================================================================ aranżacja
# ---------------------------------------------------------------- B0: uderzenie
BOOM(0, 1.0)
send(fx_bus, plate(1.0, 1.6), tb(0), 0.85, rev=0.35)
send(drum_bus, clap(True), tb(0), 0.55, rev=0.4)
send(drum_bus, snare(), tb(0), 0.35, rev=0.3)
send(fx_bus, crash(2.0), tb(0), 0.2, rev=0.2)
send(music_bus, brass(CH['Em'] + [40, 47], 0.42, 1.0, 0.25), tb(0), 0.85, rev=0.45)
send(bass_bus, bass808(E1, 0.9, glide_from=E2), tb(0), 0.6)

# "TRENINGU": 8 liter ląduje na 32-kach (B0.375–B1.25), każda z "tok" rosnącym w górę
for k in range(8):
    tt = tb(0.375 + k / 8)
    send(ui_bus, tap(), tt, 0.32 + k * 0.02, -0.5 + k / 7, rev=0.1)
    send(ui_bus, key(2200 + k * 260), tt, 0.35, -0.5 + k / 7)
send(fx_bus, plate(1.9, 0.7, rattle=False), tb(1.25), 0.26, 0.3, rev=0.3)   # słowo kompletne

# B1.25–B2: werbel ósemki → szesnastki, riser, błysk światła na napisie (B1.3), odjazd kamery
roll = [1.25, 1.5] + [1.625 + k * 0.125 for k in range(3)]
for k, b in enumerate(roll):
    send(drum_bus, snare(1.1), tb(b), 0.1 + k * 0.04, 0.2 if k % 2 else -0.2, rev=0.25)
for s in range(6):
    send(drum_bus, hat(bright=1.1), tb(1.25) + s * S16, 0.05 + s * 0.014, 0.3)
send(fx_bus, riser(tn(4) - tb(1.1), 180, 1500), tb(1.1), 0.3, rev=0.3)
# przytrzymanie napisu (rzeczywiste B1.3–B3.5): ciche "serce" stopy, ósemki hi-hatu narastają, bas trzyma E
for b in (2, 3):
    K(b, 0.45, 0.5, real=True)
for s_ in range(int((4 - 1.5) * 2)):
    send(drum_bus, hat(bright=1.1), tn(1.5 + s_ / 2), 0.04 + s_ * 0.012, 0.3 - 0.6 * (s_ % 2))
send(bass_bus, bass808(E1, tn(2.4)), tn(1.5), 0.3)
send(fx_bus, shimmer(0.45, seed=3), tb(1.3), 0.2, rev=0.4)
send(fx_bus, whoosh(tb(0.6), 300, 9000, 0.9), tb(1.4), 0.28, rev=0.2)

# ---------------------------------------------------------------- B2–B7.5 (sceny): groove na siatce rzeczywistej
G1, G1E = rb(2), rb(7.5)
for b in range(int(G1), int(G1E) + 1):
    K(b, 0.95 if b == G1 else 0.85, real=True)
for b in range(int(G1) + 1, int(G1E) + 1, 2):
    send(drum_bus, clap(), tn(b), 0.42, 0.0, rev=0.22)
    send(drum_bus, snare(), tn(b), 0.18, 0.0, rev=0.15)
for s_ in range(int((G1E - G1) * 4)):
    acc = 1.0 if s_ % 4 == 2 else (0.5 if s_ % 2 else 0.3)
    send(drum_bus, hat(bright=1.0 if s_ % 4 else 0.9), tn(G1) + s_ * S16, 0.14 * acc, -0.35 + 0.7 * (s_ % 2))
for b in range(int(G1), int(G1E)):
    send(drum_bus, hat(True), tn(b + 0.5), 0.1, 0.3)
send(fx_bus, crash(1.6), tb(2), 0.2, rev=0.2)
send(fx_bus, plate(0.84, 1.3), tb(2), 0.5, -0.1, rev=0.3)
send(fx_bus, sub_drop(1.0), tb(2), 0.18)


def bassline(b0, b1, ch, gain=0.55, glide=None, cut=900, ggain=0.22):
    # 808 na rdzeniu akordu + "growl" na ósemkach po beacie (beaty rzeczywiste)
    r = ROOT[ch]
    send(bass_bus, bass808(r, tn(b1 - b0) - 0.02, glide_from=glide), tn(b0), gain)
    e = b0
    while e < b1 - 0.01:
        send(bass_bus, growl(r + 12, S16 * 1.6, cut), tn(e + 0.5), ggain)
        e += 1


for b0, b1, ch in HARM:
    if b0 < 8:
        bassline(rb(b0), rb(b1), ch, glide=ROOT[ch] + 12 if b0 == 2 else None)

# stab na każdy wyskakujący element (B3 oferta, B4.5 zespół, B6 opinie)
for b, ch, top in ((3, 'Em', 71), (4.5, 'C', 72), (6, 'D', 74)):
    send(music_bus, brass(CH[ch] + [top], 0.3, 0.9), tb(b), 0.55, rev=0.35)
    send(fx_bus, swish(0.14, 700, 7000), tb(b) - 0.06, 0.4, 0.4 if b != 4.5 else -0.4)
    send(fx_bus, bell(top + 12, 0.9, 2.5), tb(b), 0.1, 0.3, rev=0.4)
# oferta: dwie karty boczne wysuwają się zza głównej (32-ki)
for k in range(2):
    send(fx_bus, swish(0.07, 1200 + k * 400, 7000), tb(3.125 + k / 8), 0.18, -0.5 + k)
# zespół: 4 karty trenerów wyskakują na 32-kach
for k in range(4):
    send(fx_bus, swish(0.08, 900, 6500), tb(4.5 + k / 8), 0.22, -0.6 + k * 0.4)
    send(ui_bus, tap(), tb(4.5 + k / 8) + 0.04, 0.12, -0.6 + k * 0.4)
# opinie: 5 gwiazdek zapala się na 16-kach — pentatonika w górę
for k, m in enumerate([83, 86, 88, 91, 95]):
    send(fx_bus, bell(m, 0.7, 2.2, 2.0), tb(6 + k / 8), 0.13 + k * 0.012, -0.5 + k * 0.25, rev=0.35)

# ---------------------------------------------------------------- B7–B8: tapnięcie i nurkowanie
send(ui_bus, tap(), tb(7.25), 0.7, 0.1, rev=0.15)
send(ui_bus, check_tick(), tb(7.25), 0.12, 0.1)
send(fx_bus, whoosh(tb(0.75), 200, 12000, 0.95), tb(7.25), 0.36, rev=0.25)
send(fx_bus, rev_crash(0.5), tb(8) - 0.5, 0.22)
send(fx_bus, riser(tb(0.75), 300, 2400), tb(7.25), 0.18)

# ---------------------------------------------------------------- B8–B11: formularz
BOOM(8, 0.8, 0.85)
send(fx_bus, crash(1.4), tb(8), 0.16, rev=0.2)
send(music_bus, brass(CH['Em'] + [71], 0.36, 1.0), tb(8), 0.5, rev=0.35)
F0, F1 = rb(8), rb(11)
for b in range(int(F0) + 1, int(F1)):
    K(b, 0.8, real=True)
for b in range(int(F0) + 1, int(F1) + 1, 2):
    send(drum_bus, clap(), tn(b), 0.36, rev=0.2)
for s_ in range(int((F1 - F0) * 4)):
    acc = 1.0 if s_ % 4 == 2 else (0.45 if s_ % 2 else 0.28)
    send(drum_bus, hat(bright=1.05), tn(F0) + s_ * S16, 0.1 * acc, 0.35 - 0.7 * (s_ % 2))
for b0, b1, ch in HARM:
    if 8 <= b0 < 11:
        bassline(rb(b0), rb(b1), ch, gain=0.5, cut=700, ggain=0.18)

# pisanie: "Ania" (B8.5), "600 123 456" (B9), "ania@gmail.com" (B9.5) — klawisze na 32-kach
TYPE = [(8.5, 4), (9.0, 11), (9.5, 14)]
for b, nch in TYPE:
    send(ui_bus, tap(), tb(b), 0.36, 0.0)
    span = 0.42 if nch > 5 else 0.28
    for k in range(nch):
        send(ui_bus, key(2400 + rng.uniform(-500, 700)), tb(b + 0.06) + k * tb(span) / nch, 0.3, rng.uniform(-0.4, 0.4))
send(ui_bus, tap(), tb(10.0), 0.4, 0.0)
send(ui_bus, check_tick(), tb(10.0), 0.4, 0.0, rev=0.2)
send(fx_bus, bell(88, 0.8, 1.8), tb(10.0), 0.1, rev=0.3)

# B11: "wyślij" — wciśnięcie, spinner, werbel, riser → B12
send(ui_bus, press(), tb(11), 0.9, 0.0, rev=0.2)
send(music_bus, brass(CH['B'] + [71], 0.26, 1.0), tb(11), 0.5, rev=0.3)
K(11, 0.9)
send(fx_bus, spinner(tb(0.95)), tb(11.05), 0.5, rev=0.2)
roll = [11.25 + k * 0.125 for k in range(4)] + [11.75 + k * 0.0625 for k in range(3)]
for k, b in enumerate(roll):
    send(drum_bus, snare(1.1 + k * 0.03), tb(b), 0.14 + k * 0.035, 0.2 if k % 2 else -0.2, rev=0.25)
send(fx_bus, riser(tb(0.9), 250, 2600), tb(11.05), 0.3, rev=0.25)
send(fx_bus, rev_crash(0.45), tb(12) - 0.45, 0.25)

# ---------------------------------------------------------------- B12: "GOTOWE!" — E-dur
BOOM(12, 1.0)
send(fx_bus, crash(2.4, 1.1), tb(12), 0.26, rev=0.3)
send(drum_bus, clap(True), tb(12), 0.5, rev=0.4)
send(fx_bus, sub_drop(1.3), tb(12), 0.2)
send(music_bus, brass(CH['E'] + [40, 47, 68], 0.9, 1.1, 0.35), tb(12), 0.9, rev=0.5)
for k, m in enumerate([76, 80, 83, 88, 92]):   # akord w dzwonkach, arpeggio 32-kami
    send(fx_bus, bell(m, 1.4, 2.6), tb(12) + k * S16 / 2, 0.14, -0.6 + k * 0.3, rev=0.45)
send(fx_bus, shimmer(0.8, seed=11, lo=88, notes=(0, 4, 7, 11, 12, 16)), tb(12.1), 0.2, rev=0.5)
S0_, S1_ = rb(12), rb(13)
send(bass_bus, bass808(E1, tn(S1_ - S0_) - 0.02, glide_from=E1 + 7), tn(S0_), 0.6)
for b in range(int(S0_) + 1, int(S1_)):
    K(b, 0.6, real=True)
for s_ in range(int((S1_ - S0_) * 2) - 1):
    send(drum_bus, hat(bright=1.1), tn(S0_ + (s_ + 1) / 2), 0.08, 0.3 - 0.6 * (s_ % 2))
send(fx_bus, whoosh(tn(0.5), 400, 8000, 0.9), tn(S1_ - 0.5), 0.2)

# ---------------------------------------------------------------- B13: logo — połówki uderzają o siebie
BOOM(13, 0.95)
send(fx_bus, plate(0.9, 1.6), tb(13), 0.75, -0.25, rev=0.4)
send(fx_bus, plate(1.12, 1.4), tb(13) + 0.012, 0.55, 0.25, rev=0.4)
send(fx_bus, crash(3.0, 0.9), tb(13), 0.18, rev=0.4)
send(fx_bus, sub_drop(1.8, 70, 41.2), tb(13), 0.18)
send(music_bus, pad(CH['E'] + [40, 66, 71], DUR - tb(13) - 0.6, cutoff=2200, attack=0.02, release=1.0), tb(13), 0.55, rev=0.6)
send(music_bus, brass(CH['E'] + [40, 47], 0.5, 0.8, 0.5), tb(13), 0.5, rev=0.5)
send(bass_bus, bass808(E1, 2.0, drive=1.8), tb(13), 0.5)
# CTA (B14) i adres (B14.25): miękkie "pop" + dzwonki, błysk po logo (B14.4)
send(ui_bus, tap(), tb(14), 0.35, 0.0, rev=0.3)
send(fx_bus, bell(88, 1.4, 2.0), tb(14), 0.12, 0.2, rev=0.5)
send(fx_bus, bell(95, 1.2, 1.8), tb(14.25), 0.09, -0.2, rev=0.5)
send(fx_bus, shimmer(0.7, seed=21, lo=91, notes=(0, 4, 7, 11)), tb(14.4), 0.12, rev=0.6)
E0 = rb(13)
n_ = int((DUR / BEAT - E0 - 0.5) * 2)
for k in range(n_):   # delikatny puls do końca
    send(drum_bus, hat(bright=1.2), tn(E0 + 0.5 + k / 2), 0.06 * (1 - k / n_), 0.3 - 0.6 * (k % 2))
for b in (E0 + 2, E0 + 4):
    K(b, 0.4, 0.4, real=True)

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

# poziomy szyn (bas i sub oszczędnie — na telefonie i tak ich nie słychać, a zjadają zapas limitera)
for bus, gain in ((kick_bus, 0.8), (bass_bus, 0.55), (music_bus, 1.6), (drum_bus, 1.25)):
    bus.l *= gain
    bus.r *= gain
L = kick_bus.l + drum_bus.l * (0.65 + 0.35 * duck) + (bass_bus.l + music_bus.l + wet_l) * duck + fx_bus.l + ui_bus.l
R = kick_bus.r + drum_bus.r * (0.65 + 0.35 * duck) + (bass_bus.r + music_bus.r + wet_r) * duck + fx_bus.r + ui_bus.r

# cisza tuż przed formularzem (B7.75–B8) i przed "GOTOWE!" (ostatnia 32-ka przed B12)
gate = np.ones(N)
for a, b in ((7.8, 8.0), (11.94, 12.0)):
    g0, g1 = idx(tb(a)), idx(tb(b))       # (poza przytrzymaniami — przeliczenie jest liniowe)
    ramp = idx(0.004)
    gate[g0:g1] = 0.0
    gate[g0 - ramp:g0] = np.linspace(1, 0, ramp)
# szumowe efekty przejścia (whoosh/rev crash) zostają w ciszy — bramkujemy tylko groove
grooveL = kick_bus.l + drum_bus.l * (0.65 + 0.35 * duck) + (bass_bus.l + music_bus.l + wet_l) * duck
grooveR = kick_bus.r + drum_bus.r * (0.65 + 0.35 * duck) + (bass_bus.r + music_bus.r + wet_r) * duck
L = L - grooveL * (1 - gate)
R = R - grooveR * (1 - gate)

L = L[: idx(DUR)]
R = R[: idx(DUR)]
fn = idx(0.5)
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
EQ = [('low', 70, -7.0, 0.7), ('bell', 900, 4.0, 0.6), ('high', 8000, -3.0, 0.7)]
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
