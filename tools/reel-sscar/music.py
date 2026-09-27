"""Ścieżka do reelsa SSCAR.PL: 38 s, 120 BPM (76 beatów), e-moll (i–VI–III–VII), "nocna jazda" + warsztat.

Siatka wspólna z animacją (src/director.js i zdarzenia w src/scenes/*.js): beat = 0,5 s.
  B0–B4     czerwona linia (blip + sub), migawka (świst), zegar na 16-kach, silnik R6 wkręca się na obroty
  B4        uderzenie: odjazd kamery, logo SSCAR, zawór upustowy turbo; B4.9–B6 skręt koła (serwo)
  B6–B10    spis treści: groove się rozkręca, bas szesnastkowy wchodzi przez filtr, blipy wierszy, tapnięcie
  B10–B26   01 rezerwacja: pełny groove; tapnięcia, klawisze, "thock" przycisku, dzwonki potwierdzenia, blok ląduje w grafiku
  B26–B46   02 laboratorium: arpeggio; zapadki klucza na krokach suwaka, serwa przy zwrotach kamery i skręcie koła
  B46–B58   03 VIN/DAM: klapki tablicy (17 zatrzasków na 32-kach), BMW M3 wkręca się na obroty przy wyniku
  B58–B64   04 klimatyzacja: połówki, syk czynnika, chłodne dzwonki
  B64–B76   outro: uderzenie, przycisk, B72 akord końcowy Em9, silnik na pożegnanie
Przejścia rozdziałów: filtr w dół, 8-ka ciszy, whip pan z kluczem udarowym kończącym się na "raz".
Uruchom:  python music.py [plik.wav]   → music.wav
"""

import numpy as np
import numba as nb
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
BPM = 120
BEAT = 60 / BPM
S16 = BEAT / 4
BEATS = 76                        # 38 s, jak DUR w src/core.js
DUR = BEATS * BEAT
N = int(SR * (DUR + 3))           # zapas na ogony, przycinane na końcu
rng = np.random.default_rng(82)


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


def stamp(m):
    """Płyta cennika uderza jak stempel prasy drukarskiej: głuche uderzenie + klak + ton farby."""
    n = idx(0.6)
    t = np.arange(n) / SR
    thud = np.sin(2 * np.pi * np.cumsum(62 + 180 * np.exp(-t / 0.012)) / SR) * env_exp(n, 0.11)
    clack = filt(noise(n), 'bandpass', (900, 3800)) * env_exp(n, 0.018)
    tone = np.sin(2 * np.pi * midi(m) * t + 2.2 * np.sin(2 * np.pi * midi(m) * 3 * t) * np.exp(-t / 0.06)) * env_exp(n, 0.22)
    return np.tanh((thud * 1.2 + clack * 0.8 + tone * 0.35) * 1.4) * 0.8


def pluck(m, dur=0.16, bright=1.0):
    """Pluck do arpeggio (kwadrat przez filtr z obwiednią)."""
    n = idx(dur + 0.15)
    t = np.arange(n) / SR
    f = const(n, midi(m))
    s = osc_saw(f, 0.0) - osc_saw(f, 0.5)              # prostokąt z dwóch pił
    fc = 600 + 5200 * bright * np.exp(-t / 0.045)
    e = np.minimum(1, t / 0.002) * env_exp(n, 0.13)
    return svf(s, fc, 0.3, 0) * e * 0.35


# ------------------------------------------------------------------ instrumenty SSCAR: bas "jazdy", warsztat, silnik
def roll_bass(m, dur, cut=700, env=2400, drive=1.7):
    """Bas szesnastkowy (piła + kwadrat przez filtr z obwiednią): puls jazdy nocą."""
    n = idx(dur + 0.03)
    t = np.arange(n) / SR
    f = const(n, midi(m))
    s = osc_saw(f, 0.0) * 0.7 + (osc_saw(f, 0.0) - osc_saw(f, 0.5)) * 0.35 + osc_saw(f * 1.004, 0.3) * 0.3
    fc = cut + env * np.exp(-t / 0.032)
    e = np.minimum(1, t / 0.0015) * np.where(t > dur, np.exp(-(t - dur) / 0.008), 1)
    return np.tanh(svf(s, fc, 0.32, 0) * e * drive) * 0.5


def engine(rpm, cyl=6, seed=0, drive=2.4):
    """Silnik R6 (S55 z BMW M3): impulsy spalania z częstotliwością zapłonów, rezonans wydechu, szum dolotu.
    rpm: tablica obrotów (tyle próbek, ile ma mieć dźwięk)."""
    r_ = np.random.default_rng(seed)
    n = len(rpm)
    ff = rpm / 60 * cyl / 2                                   # zapłony na sekundę (4 suwy)
    ph = np.cumsum(ff) / SR
    frac = ph % 1.0
    k = np.floor(ph).astype(int)
    jit = r_.uniform(0.7, 1.3, k.max() + 2)[k]
    pulse = np.exp(-frac * 9.0) * jit
    crank = np.sin(2 * np.pi * ph / (cyl / 2))
    x = pulse - 0.11 + 0.3 * crank
    x = x + filt(noise(n), 'bandpass', (300, 3000)) * pulse * 0.4
    fc = 360 + rpm * 0.2
    y = svf(x, fc, 0.55, 0) + svf(x, fc * 2.4, 0.45, 1) * 0.55
    y = np.tanh(y * drive)
    y += svf(noise(n), 1600 + rpm * 0.45, 0.6, 1) * np.clip((rpm - 3000) / 4000, 0, 1) * 0.14
    return y * 0.6


def rev(dur, r0=1100, peak=7200, t_up=0.3, t_down=0.9, seed=1, crackle=6):
    """Wkręcenie na obroty i powrót (z "pyrkaniem" wydechu przy zdejmowaniu gazu)."""
    n = idx(dur)
    t = np.arange(n) / SR
    up = np.clip(t / t_up, 0, 1)
    rpm = r0 + (peak - r0) * (1 - (1 - up) ** 2.2)
    down = np.clip((t - t_up) / t_down, 0, 1)
    rpm = np.where(t > t_up, peak - (peak - 1500) * (1 - (1 - down) ** 2.5), rpm)
    x = engine(rpm, seed=seed)
    e = np.minimum(1, t / 0.02) * np.where(t > dur - 0.25, np.clip((dur - t) / 0.25, 0, 1), 1)
    x *= e
    r_ = np.random.default_rng(seed + 7)
    for _ in range(crackle):                                  # strzały z wydechu na odpuszczeniu
        tc = t_up + r_.uniform(0.05, t_down * 0.9)
        j = idx(tc)
        m = min(n - j, idx(0.03))
        tk = np.arange(m) / SR
        pop = filt(noise(m), 'bandpass', (400, 4000)) * np.exp(-tk / 0.006) * r_.uniform(0.5, 1.0)
        x[j:j + m] += pop * 0.9
    return x


def blowoff(dur=0.5):
    """Zawór upustowy turbo: opadające "psssh" z trzepotaniem."""
    n = idx(dur)
    t = np.arange(n) / SR
    u = t / dur
    x = svf(noise(n), 5200 * (0.3 ** u), 0.5, 1)
    flutter = 0.65 + 0.35 * np.sign(np.sin(2 * np.pi * (42 - 20 * u) * t))
    e = np.minimum(1, t / 0.004) * (1 - u) ** 1.6
    return x * e * flutter * 0.8


def wrench(dur=0.3, rate=26, seed=0):
    """Klucz udarowy: seria uderzeń młoteczka (~26/s) + wycie silniczka pneumatycznego."""
    n = idx(dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    r_ = np.random.default_rng(seed)
    tt = 0.0
    while tt < dur - 0.012:
        j = idx(tt)
        m = min(n - j, idx(0.03))
        tk = np.arange(m) / SR
        hit = (np.sin(2 * np.pi * 2350 * tk) * 0.6 + np.sin(2 * np.pi * 3710 * tk + 1) * 0.4 + np.sin(2 * np.pi * 5230 * tk) * 0.3) * np.exp(-tk / 0.006)
        hit += filt(noise(m), 'bandpass', (1500, 7000)) * np.exp(-tk / 0.002) * 0.9
        hit += np.sin(2 * np.pi * 180 * tk) * np.exp(-tk / 0.01) * 0.5
        out[j:j + m] += hit * r_.uniform(0.7, 1.0)
        tt += 1 / rate * r_.uniform(0.92, 1.08)
    whine = svf(osc_saw(620 + 420 * np.minimum(1, t / 0.08), 0.0), const(n, 2600), 0.5, 1) * 0.18
    air = filt(noise(n), 'highpass', 3000) * 0.12
    e = np.minimum(1, t / 0.008) * np.where(t > dur - 0.05, np.exp(-(t - (dur - 0.05)) / 0.02), 1)
    return np.tanh((out + whine + air) * e * 1.4) * 0.7


def ratchet(clicks=3, gap=0.024, pitch=1.0):
    """Grzechotka klucza: kilka zapadek (krok suwaka)."""
    n = idx(clicks * gap + 0.06)
    out = np.zeros(n)
    for c in range(clicks):
        j = idx(c * gap)
        m = min(n - j, idx(0.03))
        tk = np.arange(m) / SR
        s = (np.sin(2 * np.pi * 3100 * pitch * tk) * 0.5 + np.sin(2 * np.pi * 4700 * pitch * tk) * 0.3) * np.exp(-tk / 0.004)
        s += filt(noise(m), 'bandpass', (2000, 9000)) * np.exp(-tk / 0.0015) * 0.8
        out[j:j + m] += s * (0.6 + 0.4 * (c == clicks - 1))
    return out * 0.6


def flap(pitch=1.0, loud=1.0):
    """Klapka tablicy (przeskok znaku): dwa szybkie kliknięcia."""
    n = idx(0.05)
    t = np.arange(n) / SR
    x = filt(noise(n), 'bandpass', (1800 * pitch, 7000)) * (np.exp(-t / 0.0025) + 0.55 * np.exp(-np.maximum(0, t - 0.009) / 0.002) * (t > 0.009))
    x += np.sin(2 * np.pi * 1400 * pitch * t) * np.exp(-t / 0.006) * 0.3
    return x * 0.7 * loud


def rattle(dur, rate=46, seed=0):
    """Przewijające się klapki (ciche, gęste)."""
    r_ = np.random.default_rng(seed)
    n = idx(dur + 0.06)
    out = np.zeros(n)
    tt = 0.0
    while tt < dur:
        f_ = flap(r_.uniform(0.8, 1.3), r_.uniform(0.25, 0.5))
        j = idx(tt)
        L_ = min(len(f_), n - j)
        out[j:j + L_] += f_[:L_]
        tt += 1 / rate * r_.uniform(0.7, 1.3)
    return out


def hiss(dur=0.9):
    """Syk czynnika chłodniczego (klimatyzacja)."""
    n = idx(dur)
    t = np.arange(n) / SR
    u = t / dur
    x = svf(noise(n), 6500 + 1500 * np.sin(np.pi * u), 0.35, 1)
    e = np.minimum(1, t / 0.03) * (1 - u) ** 1.3
    return x * e * 0.7


def thock(pitch=1.0):
    """Blok terminu ląduje w grafiku: głuche "tok" + klik."""
    n = idx(0.3)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum(140 * pitch + 260 * np.exp(-t / 0.01)) / SR) * env_exp(n, 0.07)
    clk = filt(noise(n), 'bandpass', (2000, 8000)) * env_exp(n, 0.002)
    return np.tanh((body * 1.2 + clk * 0.7) * 1.3) * 0.8


def blip(m, dur=0.07):
    """Krótki sinusowy "blip" interfejsu."""
    n = idx(dur + 0.03)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * midi(m) * t) + 0.25 * np.sin(4 * np.pi * midi(m) * t)
    return s * np.minimum(1, t / 0.002) * env_exp(n, dur * 0.45) * 0.4


# ------------------------------------------------------------------ harmonia: e-moll (i–VI–III–VII)
CH = {'Em': [52, 55, 59, 64], 'C': [52, 55, 60, 64], 'G': [50, 55, 59, 62], 'D': [50, 54, 57, 62], 'Em9': [52, 55, 59, 62, 66]}
ROOT = {'Em': 40, 'C': 36, 'G': 43, 'D': 38, 'Em9': 40}
ARP = {'Em': [64, 67, 71, 76], 'C': [64, 67, 72, 76], 'G': [62, 67, 71, 74], 'D': [62, 66, 69, 74], 'Em9': [64, 67, 71, 78]}
# (od beatu, do beatu, akord)
HARM = [(0, 6, 'Em'), (6, 8, 'C'), (8, 10, 'D'),
        (10, 14, 'Em'), (14, 18, 'C'), (18, 22, 'G'), (22, 26, 'D'),
        (26, 30, 'Em'), (30, 34, 'C'), (34, 38, 'G'), (38, 42, 'D'), (42, 44, 'C'), (44, 46, 'D'),
        (46, 50, 'Em'), (50, 54, 'G'), (54, 56, 'C'), (56, 58, 'D'),
        (58, 60, 'Em'), (60, 62, 'C'), (62, 64, 'D'),
        (64, 68, 'Em'), (68, 70, 'C'), (70, 72, 'D'), (72, 76, 'Em9')]


def chord_at(b):
    for b0, b1, ch in HARM:
        if b0 <= b < b1:
            return ch
    return 'Em'


kicks = []   # czasy stóp → sidechain


def K(beat, gain=1.0, depth=0.7):
    kick_bus.add(kick(), tb(beat), gain)
    kicks.append((tb(beat), depth))


def BOOM(beat, gain=1.0, depth=0.9, f_end=41.2):
    kick_bus.add(boom(1.0, f_end), tb(beat), gain)
    kicks.append((tb(beat), depth))


def HIT(beat, ch='Em', big=1.0):
    BOOM(beat, big)
    send(fx_bus, crash(2.2, 1.0), tb(beat), 0.2 * big, rev=0.3)
    send(drum_bus, clap(True), tb(beat), 0.36 * big, rev=0.35)
    send(music_bus, brass(CH[ch] + [CH[ch][0] + 24], 0.45, 1.0, release=0.3), tb(beat), 0.55 * big, rev=0.4)
    send(fx_bus, sub_drop(1.2, 82.4, 41.2), tb(beat), 0.16 * big)


def WHIP(beat, gain=0.3):
    """Whip pan między rozdziałami: szybki świst + klucz udarowy kończący się na "raz"."""
    send(fx_bus, whoosh(0.34, 500, 9000, 0.75, 0.5), tb(beat) - 0.24, gain, 0.0, rev=0.15)
    send(fx_bus, wrench(0.26, 27, seed=int(beat)), tb(beat) - 0.27, 0.34, -0.25, rev=0.12)


# ================================================================ zdarzenia (te same beaty co w src/scenes/*.js)
E = dict(tapTile=11.25, subs=11.5, tapSub=12.75, close1=13.25, open2=13.5, days=13.6, tapDay=14.25, slots=14.5, tapSlot=15.5,
         close2=16.0, open3=16.25, fill=[16.75, 17.0, 17.25, 17.5], consent=18.0, summary=18.5, press=19.5, done=20.0,
         fly=21.0, land=22.0, claim=22.5)                                                        # booking.js
LE = dict(camView=27.0, camber=[28, 28.5, 29, 29.5, 30], wear1=30.25, camberBack=31.5, toeView=31.75, toe=[32.5, 33, 33.5, 34],
          wear2=34.25, toeBack=35.5, casterView=35.75, caster=[36.5, 37, 37.5], steerView=37.9, steer=[38.25, 38.75, 39.25, 39.75],
          reset=40.0, life=40.5, stand=42.5)                                                     # lab.js
VE = dict(flap=46.5, press=48.75, decode=49.25, br=[49.25, 49.75, 50.25], card=50.75, spec=51.0, damSwap=53.75, damFlap=54.25,
          damPress=55.0, damRes=55.25)                                                           # vin.js
KE = dict(sel=[58.5, 59.0, 59.5], title=60.0, rows=[60.25, 60.5, 60.75], price=61.0)            # klima.js
OE = dict(logo=64, photo=64.25, url=65.0, button=66.0, press=67.0, addr=67.5, hours=68.0, final=72)   # outro.js

# ================================================================ aranżacja
# ---------------------------------------------------------------- B0–B4: intro — linia, migawka, zbliżenie na koło, obroty
send(music_bus, pad([40, 52, 55, 59, 64], tb(4) + 0.2, cutoff=700, attack=1.5, release=0.5), 0.0, 0.5, rev=0.5)
send(bass_bus, bass808(28, tb(4) - 0.1, drive=1.3), 0.0, 0.2)
send(fx_bus, blip(88, 0.05), tb(0.05), 0.35, 0.0, rev=0.4)                  # czerwona linia
send(fx_bus, sub_drop(0.9, 70, 38), tb(0.05), 0.14)
send(fx_bus, whoosh(tb(0.75), 150, 5000, 0.85, 0.5), tb(1.0) - 0.05, 0.28, rev=0.3)   # migawka się otwiera
for s_ in range(12):                                                           # zegar na 16-kach, narasta
    send(drum_bus, hat(bright=1.25), tb(1 + s_ / 4), 0.025 + 0.06 * s_ / 12, 0.3 - 0.6 * (s_ % 2))
for b in (1, 2, 3):                                                            # "puls serca" suba
    send(kick_bus, filt(kick(0.4), 'lowpass', 180), tb(b), 0.45)
send(fx_bus, shimmer(1.2, seed=3, lo=76, notes=(0, 3, 7, 10, 12, 15)), tb(1.6), 0.07, rev=0.6)   # przejazd światła po feldze
send(fx_bus, riser(tb(1.6), 200, 2400), tb(2.4), 0.18, rev=0.25)
send(fx_bus, rev_crash(1.0), tb(4) - 1.0, 0.22)
rpm_up = np.concatenate([np.full(idx(0.05), 1000.0), 1000 + 6600 * np.linspace(0, 1, idx(tb(0.85))) ** 1.8])
send(fx_bus, engine(rpm_up, seed=4) * np.minimum(1, np.arange(len(rpm_up)) / idx(0.15)), tb(3.15), 0.42, -0.1)
# B4: uderzenie — odjazd kamery, logo
HIT(4, 'Em', 1.0)
send(fx_bus, blowoff(0.55), tb(4.05), 0.32, 0.25, rev=0.2)
send(fx_bus, shimmer(0.8, seed=4, lo=83, notes=(0, 3, 7, 10, 12)), tb(4.35), 0.12, rev=0.5)  # połysk logo
send(music_bus, pad(CH['Em'] + [40], tb(2), cutoff=1600, attack=0.05, release=0.6), tb(4), 0.32, rev=0.5)
send(fx_bus, servo(tb(0.45), 130, 260), tb(4.9), 0.22, 0.2)                   # skręt koła
send(fx_bus, servo(tb(0.6), 260, 140), tb(5.35), 0.2, 0.2)
for s_ in range(8):
    send(drum_bus, hat(bright=1.1), tb(4.5 + s_ / 2), 0.05, 0.3 - 0.6 * (s_ % 2))

# ---------------------------------------------------------------- B6–B10: spis treści — groove się rozkręca
WHIP(6, 0.26)
for b in range(6, 10):
    K(b, 0.72, 0.5)
for b in (7, 9):
    send(drum_bus, clap(), tb(b), 0.3, rev=0.25)
for s_ in range(8):
    send(drum_bus, hat(bright=1.0), tb(6.5 + s_ / 2), 0.08, 0.35)
for k, m in enumerate([64, 67, 71, 76]):                                        # wiersze spisu
    send(ui_bus, blip(m + 12, 0.06), tb(6.5 + k * 0.5), 0.2, -0.3 + 0.2 * k, rev=0.35)
    send(ui_bus, swish(0.07, 1200, 7000), tb(6.5 + k * 0.5) - 0.02, 0.12, 0.3)
send(ui_bus, tap(), tb(9.5), 0.4, 0.2, rev=0.2)
roll = [9.5, 9.625, 9.75, 9.8125, 9.875, 9.9375]
for k, b in enumerate(roll):
    send(drum_bus, snare(1.1 + k * 0.03), tb(b), 0.08 + k * 0.03, 0.2 if k % 2 else -0.2, rev=0.2)
send(fx_bus, riser(tb(1.0), 250, 3000), tb(9), 0.2, rev=0.25)

# ---------------------------------------------------------------- groove rozdziałów (B10–B58) + outro (B64–B72)
KICK_BEATS = [b for b in range(10, 58) if b not in (25, 45, 57)] + [b for b in range(64, 72)]
for b in KICK_BEATS:
    if b in (10, 26, 46, 64):
        continue
    K(b, 0.85)
for b in list(range(11, 58, 2)) + list(range(65, 72, 2)):
    if b in (25, 45, 57):
        continue
    send(drum_bus, clap(), tb(b), 0.36, rev=0.22)
    send(drum_bus, snare(), tb(b), 0.12, rev=0.15)
for lo, hi in ((10, 25.5), (26, 45.5), (46, 57.5), (64, 72)):
    for s_ in range(int((hi - lo) * 4)):
        acc = 1.0 if s_ % 4 == 2 else (0.5 if s_ % 2 else 0.28)
        send(drum_bus, hat(bright=1.0 if s_ % 4 else 0.9), tb(lo) + s_ * S16, 0.1 * acc, -0.35 + 0.7 * (s_ % 2))
    for b in range(int(lo), int(hi)):
        if lo >= 26:
            send(drum_bus, hat(True), tb(b + 0.5), 0.06, 0.3)
# bas szesnastkowy (oktawy), filtr otwiera się w rozdziałach; w B6–B10 wchodzi stopniowo
for lo, hi, cut0, cut1 in ((6, 10, 250, 700), (10, 25.5, 650, 900), (26, 45.5, 800, 1100), (46, 57.5, 750, 1000), (64, 72, 800, 1150)):
    for s_ in range(int((hi - lo) * 4)):
        b = lo + s_ / 4
        ch = chord_at(b)
        m = ROOT[ch] + (12 if s_ % 4 == 2 else 0) + (7 if s_ % 8 == 7 else 0)
        cut = cut0 + (cut1 - cut0) * (b - lo) / (hi - lo)
        send(bass_bus, roll_bass(m, S16 * 0.8, cut), tb(b), 0.34 + 0.08 * (s_ % 4 == 0))
    for b0, b1, ch in HARM:
        if lo <= b0 < hi:
            send(bass_bus, bass808(ROOT[ch] - 12, tb(min(b1, hi) - b0) - 0.03, drive=1.5), tb(b0), 0.28)
# akordy: pad pod spodem + krótkie staby na "raz" i "2+"
for b0, b1, ch in HARM:
    if b0 < 10 or b0 >= 76:
        continue
    if 58 <= b0 < 64:
        continue
    send(music_bus, pad(CH[ch], tb(b1 - b0) - 0.05, cutoff=1300 if b0 < 26 else 1800, attack=0.08, release=0.3), tb(b0), 0.24, rev=0.4)
    if b0 < 72:
        for off, ln, g in ((0, 0.4, 0.3), (1.5, 0.3, 0.2)):
            if b0 + off < b1 and not (b0 + off) in (25.5, 45.5, 57.5):
                send(music_bus, brass(CH[ch], tb(ln), 0.7), tb(b0 + off), g, rev=0.3)
# arpeggio (16-tki) w laboratorium i w outro
for lo, hi in ((27, 45.5), (64.5, 72)):
    for s_ in range(int((hi - lo) * 4)):
        b = lo + s_ / 4
        ch = chord_at(b)
        m = ARP[ch][[0, 1, 2, 3, 2, 1, 3, 2][s_ % 8]] + 12
        send(music_bus, pluck(m, 0.09, 1.0), tb(b), 0.08 + 0.035 * (s_ % 4 == 0), 0.45 if s_ % 2 else -0.45, rev=0.3)

# przejścia rozdziałów: filtr w dół, riser, cisza na 8-kę i whip z kluczem udarowym
for b in (26, 46):
    HIT(b, chord_at(b), 0.9)
    send(fx_bus, riser(tb(1.5), 250, 3200), tb(b - 1.5), 0.2, rev=0.25)
    send(fx_bus, rev_crash(0.6), tb(b) - 0.6, 0.2)
    WHIP(b, 0.3)
for b in (10, 58):
    WHIP(b, 0.28)
    send(fx_bus, crash(1.6, 1.1), tb(b), 0.14, rev=0.3)
BOOM(10, 0.9)
send(music_bus, brass(CH['Em'] + [76], 0.4, 1.0, release=0.25), tb(10), 0.45, rev=0.35)

# ---------------------------------------------------------------- 01 rezerwacja (dźwięki interfejsu)
send(fx_bus, whoosh(tb(0.8), 300, 6000, 0.3, 0.6), tb(10) - 0.05, 0.16, 0.3, rev=0.2)     # widżet wjeżdża
for b in (E['tapTile'], E['tapSub'], E['tapDay'], E['tapSlot']):
    send(ui_bus, tap(), tb(b), 0.42, 0.1, rev=0.15)
for k in range(4):
    send(ui_bus, blip(76 + [0, 3, 7, 10][k], 0.05), tb(E['subs'] + 0.1 + k * 0.125), 0.1, -0.3 + 0.2 * k, rev=0.3)
for b, pn in ((E['close1'], -0.2), (E['close2'], 0.2)):
    send(ui_bus, swish(0.1, 3000, 800), tb(b), 0.2, pn)
    send(ui_bus, check_tick(), tb(b + 0.1), 0.28, pn, rev=0.3)
for b in (E['open2'], E['open3']):
    send(ui_bus, swish(0.1, 800, 4000), tb(b), 0.18, 0.0)
for k in range(7):
    send(ui_bus, key(2600 + k * 150), tb(E['days'] + k * 0.0625), 0.12, -0.6 + 0.2 * k)
for k in range(8):
    send(ui_bus, key(3000 + k * 120), tb(E['slots'] + k * 0.0625), 0.1, -0.5 + 0.14 * k)
for b in E['fill']:                                                       # autouzupełnianie pól
    for k in range(5):
        send(ui_bus, key(2400 + 400 * rng.uniform()), tb(b) + k * 0.022, 0.13, rng.uniform(-0.3, 0.3))
send(ui_bus, tap(), tb(E['consent']), 0.35, -0.3)
send(ui_bus, check_tick(), tb(E['consent'] + 0.05), 0.22, -0.3, rev=0.3)
send(ui_bus, whoosh(tb(0.6), 250, 3500, 0.35, 0.5), tb(E['summary']), 0.22, 0.0, rev=0.2)
send(ui_bus, press(), tb(E['press']), 0.6, 0.0, rev=0.2)
kicks.append((tb(E['press']), 0.3))
for k, m in enumerate([76, 79, 83, 86, 90]):                              # potwierdzenie: dzwonki Em9
    send(fx_bus, bell(m, 1.0, 2.0), tb(E['done'] + k * 0.0625), 0.12, -0.4 + 0.2 * k, rev=0.5)
send(ui_bus, check_tick(), tb(E['done'] + 0.05), 0.35, 0.0, rev=0.4)
send(ui_bus, swish(0.2, 6000, 900), tb(E['fly']), 0.22, -0.2)
send(ui_bus, whoosh(tb(0.8), 400, 3000, 0.7, 0.5), tb(E['fly'] + 0.15), 0.18, 0.2, rev=0.2)
send(ui_bus, thock(1.0), tb(E['land']), 0.55, -0.2, rev=0.25)
send(fx_bus, shimmer(0.6, seed=22, lo=83, notes=(0, 3, 7, 10, 12)), tb(E['land'] + 0.05), 0.08, rev=0.5)

# ---------------------------------------------------------------- 02 laboratorium geometrii
for b in (LE['camView'], LE['toeView'], LE['casterView'], LE['steerView']):
    send(fx_bus, whoosh(tb(0.6), 200, 2400, 0.5, 0.55), tb(b), 0.2, 0.2, rev=0.25)
    send(fx_bus, servo(tb(0.5), 110, 190), tb(b), 0.1, -0.2)
for k, b in enumerate(LE['camber']):
    send(ui_bus, ratchet(3, 0.022, 1.0 + k * 0.06), tb(b), 0.34, 0.25)
for k, b in enumerate(LE['toe']):
    send(ui_bus, ratchet(3, 0.022, 1.05 + k * 0.06), tb(b), 0.34, 0.25)
for k, b in enumerate(LE['caster']):
    send(ui_bus, ratchet(3, 0.022, 1.1 + k * 0.06), tb(b), 0.34, 0.25)
for b in (LE['camberBack'], LE['toeBack']):
    send(ui_bus, ratchet(7, 0.014, 0.9), tb(b), 0.28, 0.25)
    send(fx_bus, servo(tb(0.4), 220, 120), tb(b), 0.12, 0.2)
for b, pn in ((LE['wear1'], -0.4), (LE['wear2'], -0.4)):                  # zdjęcie zużytej opony
    send(fx_bus, stamp(64), tb(b), 0.45, pn, rev=0.25)
    send(fx_bus, whoosh(tb(0.4), 300, 3000, 0.6, 0.5), tb(b) - 0.1, 0.16, pn)
for a, b_, f0, f1 in ((38.25, 38.75, 140, 260), (38.75, 39.25, 260, 150), (39.25, 39.75, 150, 240)):
    send(fx_bus, servo(tb(b_ - a), f0, f1), tb(a), 0.24, 0.1)
send(ui_bus, tap(), tb(39.45), 0.15, 0.3)
send(ui_bus, press(), tb(LE['reset']), 0.5, 0.2, rev=0.2)
send(ui_bus, ratchet(10, 0.012, 1.2), tb(LE['reset']) + 0.05, 0.25, 0.2)
send(fx_bus, whoosh(tb(0.7), 3000, 250, 0.2, 0.5), tb(LE['reset']), 0.16, 0.0, rev=0.3)
for k in range(12):                                                       # licznik przebiegu
    tk = tb(LE['life']) + tb(1.2) * (1 - (1 - k / 12) ** 2)
    send(ui_bus, key(3200 + k * 60), tk, 0.1, 0.3)
send(ui_bus, check_tick(), tb(LE['life'] + 0.85), 0.3, -0.2, rev=0.35)
for k, m in enumerate([71, 76, 79, 83]):
    send(fx_bus, bell(m, 0.9, 1.8), tb(LE['life'] + 0.85 + k * 0.0625), 0.1, -0.3 + 0.2 * k, rev=0.5)
send(fx_bus, whoosh(tb(0.8), 250, 4000, 0.4, 0.5), tb(LE['stand']), 0.22, 0.0, rev=0.25)
send(fx_bus, stamp(59), tb(LE['stand'] + 0.3), 0.35, 0.0, rev=0.3)
send(fx_bus, wrench(0.22, 24, seed=43), tb(43.5), 0.24, -0.4, rev=0.25)     # w hali: klucz udarowy
roll = [44 + k * 0.5 for k in range(2)] + [45 + k * 0.125 for k in range(4)]
for k, b in enumerate(roll):
    send(drum_bus, snare(1.1 + k * 0.03), tb(b), 0.08 + k * 0.03, 0.2 if k % 2 else -0.2, rev=0.2)

# ---------------------------------------------------------------- 03 dekoder VIN / DAM
send(ui_bus, rattle(tb(2.3), seed=46), tb(46.25), 0.25, 0.0)
for i in range(17):
    send(ui_bus, flap(1.0 + i * 0.02, 1.0), tb(VE['flap'] + i * 0.125), 0.3, -0.7 + i * 0.085)
send(ui_bus, press(), tb(VE['press']), 0.5, 0.2, rev=0.2)
send(ui_bus, spinner(tb(0.5)), tb(VE['press'] + 0.1), 0.25, 0.0)
for k, b in enumerate(VE['br']):
    send(ui_bus, blip([76, 79, 83][k], 0.06), tb(b), 0.22, -0.4 + 0.4 * k, rev=0.35)
    send(ui_bus, swish(0.08, 1000, 6000), tb(b), 0.1, -0.4 + 0.4 * k)
send(fx_bus, rev(1.6, seed=5), tb(VE['card']) - 0.05, 0.5, -0.15, rev=0.12)   # M3: S55 wkręca się na obroty
send(fx_bus, whoosh(tb(0.7), 250, 5000, 0.5, 0.5), tb(VE['card']), 0.2, 0.0, rev=0.2)
for k in range(5):
    send(ui_bus, key(3400 - k * 150), tb(VE['spec'] + k * 0.25), 0.14, 0.4)
send(ui_bus, swish(0.12, 5000, 700), tb(VE['damSwap']), 0.22, 0.0)
send(ui_bus, rattle(tb(0.9), seed=54), tb(54.0), 0.22, 0.0)
for i in range(5):
    send(ui_bus, flap(1.1 + i * 0.04, 1.0), tb(VE['damFlap'] + i * 0.125), 0.32, -0.3 + i * 0.15)
send(ui_bus, press(), tb(VE['damPress']), 0.5, 0.2, rev=0.2)
send(fx_bus, stamp(52), tb(VE['damRes']), 0.6, 0.0, rev=0.3)
kicks.append((tb(VE['damRes']), 0.5))
send(fx_bus, bell(83, 1.0, 2.2), tb(VE['damRes'] + 0.05), 0.12, 0.2, rev=0.5)
roll = [56 + k * 0.5 for k in range(2)] + [57 + k * 0.125 for k in range(4)]
for k, b in enumerate(roll):
    send(drum_bus, snare(1.1 + k * 0.03), tb(b), 0.07 + k * 0.03, 0.2 if k % 2 else -0.2, rev=0.2)
send(fx_bus, riser(tb(1.5), 250, 2800), tb(56.5), 0.18, rev=0.25)

# ---------------------------------------------------------------- 04 klimatyzacja: lżej, w połówkach, chłodno
for b in (58, 60, 62):
    K(b, 0.8, 0.6)
for b in (59, 61, 63):
    send(drum_bus, snare(1.2), tb(b), 0.2, rev=0.4)
    send(drum_bus, clap(), tb(b), 0.22, rev=0.35)
for s_ in range(int(5.5 * 4)):
    send(drum_bus, hat(bright=1.3), tb(58) + s_ * S16, 0.05 * (1.0 if s_ % 2 else 0.5), -0.3 + 0.6 * (s_ % 2))
for b0, b1, ch in HARM:
    if 58 <= b0 < 64:
        send(bass_bus, bass808(ROOT[ch] - 12, tb(b1 - b0) - 0.03, drive=1.6), tb(b0), 0.36)
        send(music_bus, pad(CH[ch] + [CH[ch][2] + 12], tb(b1 - b0) - 0.05, cutoff=2600, attack=0.05, release=0.35), tb(b0), 0.26, rev=0.5)
send(fx_bus, hiss(1.1), tb(58) + 0.02, 0.3, 0.3, rev=0.3)                    # syk czynnika
send(fx_bus, shimmer(1.0, seed=58, lo=88, notes=(0, 2, 3, 7, 10, 14)), tb(58.1), 0.12, rev=0.6)
for k, b in enumerate(KE['sel']):
    send(ui_bus, tap(), tb(b), 0.38, 0.3, rev=0.15)
    for j in range(3):
        send(ui_bus, key(3600 - j * 250), tb(b) + 0.03 + j * 0.05, 0.08, 0.3)
send(ui_bus, swish(0.12, 900, 5000), tb(KE['title']), 0.16, 0.0)
for k, b in enumerate(KE['rows']):
    send(ui_bus, blip([79, 83, 86][k], 0.05), tb(b), 0.18, -0.3 + 0.3 * k, rev=0.35)
send(fx_bus, bell(88, 1.2, 2.4), tb(KE['price']), 0.14, 0.2, rev=0.5)
send(fx_bus, stamp(64), tb(KE['price']), 0.35, 0.0, rev=0.3)
send(fx_bus, riser(tb(1.0), 300, 3500), tb(63), 0.22, rev=0.25)
send(fx_bus, rev_crash(0.5), tb(64) - 0.5, 0.22)

# ---------------------------------------------------------------- outro: B64 uderzenie, przycisk, B72 akord końcowy, silnik na koniec
WHIP(64, 0.3)
HIT(64, 'Em', 1.05)
send(fx_bus, shimmer(0.8, seed=64, lo=83, notes=(0, 3, 7, 10, 12)), tb(64.35), 0.12, rev=0.5)
send(fx_bus, whoosh(tb(0.8), 250, 4000, 0.45, 0.5), tb(OE['photo']), 0.18, 0.0, rev=0.25)
for k in range(4):
    send(ui_bus, blip(76 + [0, 3, 7, 12][k], 0.05), tb(OE['url'] + k * 0.125), 0.12, -0.3 + 0.2 * k, rev=0.4)
send(fx_bus, bell(83, 1.0, 2.0), tb(OE['button']), 0.14, 0.0, rev=0.5)
send(ui_bus, swish(0.1, 800, 5000), tb(OE['button']), 0.18, 0.0)
send(ui_bus, press(), tb(OE['press']), 0.55, 0.15, rev=0.25)
for k, m in enumerate([76, 79, 83, 86]):
    send(fx_bus, bell(m, 1.0, 2.0), tb(OE['press'] + 0.05 + k * 0.0625), 0.1, -0.3 + 0.2 * k, rev=0.5)
send(ui_bus, key(3000), tb(OE['addr']), 0.1, 0.2)
send(ui_bus, key(3300), tb(OE['hours']), 0.1, -0.2)
roll = [70 + k * 0.5 for k in range(2)] + [71 + k * 0.125 for k in range(8)]
for k, b in enumerate(roll):
    send(drum_bus, snare(1.1 + k * 0.03), tb(b), 0.07 + k * 0.025, 0.2 if k % 2 else -0.2, rev=0.2)
send(fx_bus, riser(tb(2), 250, 3000), tb(70), 0.2, rev=0.25)
send(fx_bus, rev_crash(1.0), tb(72) - 1.0, 0.22)
BOOM(72, 1.0)
send(fx_bus, crash(3.0, 1.0), tb(72), 0.22, rev=0.4)
send(drum_bus, clap(True), tb(72), 0.36, rev=0.4)
send(music_bus, brass(CH['Em9'] + [76], 0.9, 1.0, release=0.8), tb(72), 0.5, rev=0.5)
send(music_bus, pad(CH['Em9'] + [40, 71, 78], tb(4) - 0.3, cutoff=2400, attack=0.02, release=0.9), tb(72), 0.42, rev=0.6)
send(bass_bus, bass808(28, tb(3.5), drive=1.6), tb(72), 0.4)
send(fx_bus, shimmer(1.4, seed=72, lo=83, notes=(0, 3, 7, 10, 14, 15)), tb(72.1), 0.14, rev=0.6)
send(fx_bus, rev(1.9, r0=1000, peak=6400, t_up=0.22, t_down=1.2, seed=9, crackle=9), tb(73.0), 0.34, 0.2, rev=0.15)   # na pożegnanie

# ================================================================ miks
duck = np.ones(N)
for tk, depth in kicks:
    i = idx(tk)
    n = min(N - i, idx(0.4))
    tt = np.arange(n) / SR
    g = 1 - depth * np.where(tt < 0.004, tt / 0.004, np.exp(-(tt - 0.004) / 0.07))
    duck[i:i + n] = np.minimum(duck[i:i + n], g)

ir_n = idx(2.4)
tt = np.arange(ir_n) / SR
irs = []
for ch_ in range(2):
    ir = rng.standard_normal(ir_n) * np.exp(-tt / 0.55)
    ir = filt(ir, 'lowpass', 6000)
    ir[: idx(0.02)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    irs.append(ir)
wet_l = fftconvolve(filt(rev_send.l, 'highpass', 280), irs[0])[:N] * 0.8
wet_r = fftconvolve(filt(rev_send.r, 'highpass', 280), irs[1])[:N] * 0.8


def lp_sweep(x, a, b, f0=9000, f1=500):
    """Filtr "w dół" przed przejściem: muzyka ciemnieje, potem cisza na 8-kę."""
    i0, i1 = idx(tb(a)), idx(tb(b))
    fc = f0 * (f1 / f0) ** (np.linspace(0, 1, i1 - i0) ** 1.5)
    x[i0:i1] = svf(x[i0:i1].copy(), fc, 0.35, 0)
    return x


for bus in (music_bus, bass_bus):
    for a, b in ((24.0, 25.5), (44.0, 45.5), (56.0, 57.5)):
        bus.l = lp_sweep(bus.l, a, b)
        bus.r = lp_sweep(bus.r, a, b)

for bus, gain in ((kick_bus, 0.8), (bass_bus, 0.62), (music_bus, 1.3), (drum_bus, 1.15), (ui_bus, 1.25)):
    bus.l *= gain
    bus.r *= gain
grooveL = kick_bus.l + drum_bus.l * (0.65 + 0.35 * duck) + (bass_bus.l + music_bus.l + wet_l) * duck
grooveR = kick_bus.r + drum_bus.r * (0.65 + 0.35 * duck) + (bass_bus.r + music_bus.r + wet_r) * duck
L = grooveL + fx_bus.l + ui_bus.l
R = grooveR + fx_bus.r + ui_bus.r

# cisza groove'u na ostatnią 8-kę przed rozdziałami i przed outro (zostają whipy i efekty)
gate = np.ones(N)
for a, b in ((25.5, 26.0), (45.5, 46.0), (57.5, 58.0), (63.5, 64.0)):
    g0, g1 = idx(tb(a)), idx(tb(b))
    ramp = idx(0.008)
    gate[g0:g1] = 0.0
    gate[g0 - ramp:g0] = np.linspace(1, 0, ramp)
L = L - grooveL * (1 - gate)
R = R - grooveR * (1 - gate)

L = L[: idx(DUR)]
R = R[: idx(DUR)]
fn = idx(1.2)
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
EQ = [('low', 70, -6.0, 0.7), ('bell', 900, 3.0, 0.6), ('bell', 3200, 1.5, 0.8), ('high', 9000, -1.5, 0.7)]
for kind, f, gdb, q in EQ:
    L = biquad(L, kind, f, gdb, q)
    R = biquad(R, kind, f, gdb, q)


def limit(l, r, ceiling=0.80, look=idx(0.004), rel=0.08):
    # limiter "true peak": obwiednia szczytów z sygnału nadpróbkowanego 4× (AAC na Facebooku nie przesteruje)
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
import sys
OUT = sys.argv[1] if len(sys.argv) > 1 else 'music.wav'
wavfile.write(OUT, SR, (np.clip(st, -1, 1) * 32767).astype(np.int16))
print('ok', len(L) / SR, 's')
