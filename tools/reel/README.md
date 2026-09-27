# Reels — 30 s, 1080×1920

Reklama portfolio w pionie, zrobiona w HTML/WebGL. Wszystko jest funkcją czasu `t`, więc render jest
deterministyczny, a obraz jest zgrany z muzyką co do klatki (128 BPM, 16 taktów = dokładnie 30 s).

| scena | beaty | czas | treść |
|---|---|---|---|
| S0 hook | 0–8 | 0,00–3,75 | wir z wielokątów, „PROJEKTUJĘ / RZECZY, / NA KTÓRE / CHCE SIĘ / PATRZEĆ.”, mechaniczne oko, nurkowanie w źrenicę |
| S1 www | 8–16 | 3,75–7,50 | telefon 3D z prawdziwymi stronami (SSCAR, Body Creator, HandyBruk, R-MAX), helisa zrzutów |
| S2 branding | 16–24 | 7,50–11,25 | druk plakatów płytami C→M→Y→K na 16tkach, „MARKI, KTÓRE KRZYCZĄ Z EKRANU”, wizytówki |
| S3 design 3D | 24–32 | 11,25–15,00 | zestaw Body Creator → kontroler; skan siatka→bryła, żyroskop, PRESS START |
| S4 gra | 32–40 | 15,00–18,75 | warp, boss i spirale pocisków, gameplay, slam logo SPACEFIGHTER |
| S5 systemy | 40–48 | 18,75–22,50 | breakdown: kalendarz rezerwacji, lista funkcji, build, cisza |
| S6 klienci | 48–56 | 22,50–26,25 | drop: kalejdoskop z prac, „ZAUFALI MI” + klienci |
| S7 outro | 56–64 | 26,25–30,00 | morfing kształtów w „MJ.”, CTA m-jaro.pl + e-mail |

## Użycie

```bash
npm install
python music.py                 # music.wav (synteza w numpy/numba)
node serve.js                   # podgląd na żywo: http://127.0.0.1:8137/tools/reel/reel.html
node record.js stills 2.5 12.4  # pojedyncze klatki do stills/
node record.js video 60 4 reel.mp4   # finał: 60 fps, 4 subklatki motion blur (~10 min)
```

Wersja do wrzucenia na Instagram (60 fps, ok. 30 Mb/s) i okładki — z mastera:

```bash
ffmpeg -i reel.mp4 -c:v libx264 -preset slow -crf 16 -maxrate 30M -bufsize 60M -profile:v high -level:v 4.2 \
  -pix_fmt yuv420p -g 120 -r 60 -c:a copy -movflags +faststart reel_instagram.mp4
ffmpeg -i reel.mp4 -vf "select='eq(n\,152)'" -frames:v 1 -q:v 2 cover_oko.jpg
ffmpeg -i reel.mp4 -vf "select='eq(n\,1745)'" -frames:v 1 -q:v 2 cover_logo.jpg
```

Wyniki (`*.mp4`, `*.jpg`, `music.wav`) są w `.gitignore` — zawsze można je odtworzyć powyższymi poleceniami.

`capture_sites.js` + `stitch.py` odświeżają mobilne zrzuty stron klientów (`assets/mobile/`).
`glyphs.py` wyciąga kontury „MJ.” z fontu Space Grotesk (morfing logo w outro).

## Budowa

- `src/gfx.js` — pipeline: tło z shaderów (8 wzorów) → warstwa 2D → three.js → 2D → kamera, fala,
  glitch, aberracja CMY → bloom z wagami warstw → akumulacja subklatek (motion blur) → ziarno.
- `src/scenes/*.js` — po jednym pliku na scenę; `src/common.js` — materiał obrazów z symulacją druku CMYK,
  nagłówki sekcji, HUD, efekty.
- Strefy bezpieczne Reels: ważny tekst trzymany w pasie ok. 230–1500 px w pionie.
