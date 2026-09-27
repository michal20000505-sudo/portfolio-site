# Reels OBSERVER 01 — 23 s, 1080×1920

Krótka wersja portfolio opowiedziana przez oko OBSERVER 01. Oko to ten sam model co na stronie
(`eye-observer-model.js` z katalogu głównego, te same światła i środowisko studyjne co `eye-observer.js`,
tone mapping ACES z ekspozycją 1.08). Reszta jest zrobiona pod reels: oko rozpada się na części i składa
z powrotem na beatach, mruga przysłoną, "mówi" źrenicą w rytm słów w dymkach, kręci się, kiwa i namierza widza.
Wszystko jest funkcją czasu `t`, więc render jest deterministyczny, a obraz zgrany z muzyką co do klatki
(120 BPM, 46 beatów = 23 s). Wspólne zdarzenia (stopy, rozpady, lądowania części, słowa) są w `src/director.js`,
a `music.py` ma te same beaty.

| scena | beaty | treść |
|---|---|---|
| składanie | 0–4 | części oka wirują do środka i lądują kaskadą (obudowa, mechanizm, 6 płyt pancerza na 32-kach, osłony, optyka), celownik z licznikiem części; B4 przysłona otwiera się jak migawka |
| powitanie | 4–14 | „Cześć! Jestem OBSERVER 01.” → „Pilnuję portfolio Michała… …i trochę Ciebie.” — najazd na widza, wizjer namierza „CEL: TY”, mrugnięcia i chichot |
| nagłówek | 14–22 | drop: oko wybucha, w rozsypce leci pod nagłówek; CREATIVE / DESIGNER z glitchem CMY; snop światła na nagłówek; „Projektuje strony, marki i grafiki. Od 2014 roku.” |
| prace | 22–30 | piruet i przewinięcie; karuzela 8 prac drukuje się rastrem CMY i obraca o kartę na każdą stopę, oko skanuje przednią kartę; „Strony, gra na Steam, eksperymenty. Tu mrugam najrzadziej.” |
| cennik | 30–38 | wybuch; płyty C, M, Y, K (ceny z cennik.html) spadają jak stemple, pancerz oka łapie kolor farby; „Ceny od razu na stronie. Bez mrużenia oka.” |
| kontakt | 38–46 | wybuch i złożenie na środku, logo MJ. (kropka pojawia się razem z okiem), przycisk m-jaro.pl, e-mail w farbach jak na stronie, „oczko” na koniec |

Muzyka (`music.py`, synteza w numpy/numba): A-dur, I–V–vi–IV, future-bassowe akordy, pluck-arpeggio;
mechanika oka jako instrumenty — kliki magnetyczne lądujących części, serwa przy zwrotach, migawka przysłony,
sylaby „głosu” oka na słowach dymków (pentatonika A), stemple płyt cennika, brzęk rozsypanych części przy wybuchach.

## Użycie

```bash
npm install
python music.py                 # music.wav
node serve.js                   # podgląd na żywo: http://127.0.0.1:8139/tools/reel-observer/reel.html
node record.js stills 2.1 8.4   # pojedyncze klatki do stills/  (python sheet.py arkusz.png 2.1 8.4 — arkusz)
node record.js draft            # szybki podgląd 30 fps bez motion blur → draft.mp4
python strip.py draft.mp4 stills/pasek.png 6.8 8.3 12   # 12 klatek z odcinka filmu w jednym pasku
node record.js video 60 6 reel.mp4   # finał: 60 fps, 6 subklatek motion blur
```

Wersja do wrzucenia na Instagram i okładki — z mastera:

```bash
ffmpeg -i reel.mp4 -c:v libx264 -preset slow -crf 16 -maxrate 30M -bufsize 60M -profile:v high -level:v 4.2 \
  -pix_fmt yuv420p -g 120 -r 60 -c:a copy -movflags +faststart reel_instagram.mp4
ffmpeg -i reel.mp4 -vf "select='eq(n\,195)'" -frames:v 1 -q:v 2 cover_oko.jpg      # oko + „Cześć! Jestem OBSERVER 01.”
ffmpeg -i reel.mp4 -vf "select='eq(n\,1290)'" -frames:v 1 -q:v 2 cover_logo.jpg    # MJ. + oko + kontakt
```

Wyniki (`*.mp4`, `*.jpg`, `music.wav`) są w `.gitignore`.

## Budowa

- `src/eye.js` — oko: model ze strony, kadrowanie jak `setFraming` (kwadrat oka w dowolnym miejscu kadru,
  zawsze widziany na wprost), rozpad na ~100 części (płyty pancerza i osłony w całości, kabel z oplotem razem)
  z wirem, obrotem wokół środka każdej części i magnetycznym dobiciem przy lądowaniu.
- `src/director.js` — reżyseria oka: pozycja, zwroty na sprężynach, mrugnięcia, „mowa”, wdech przed wybuchem,
  zdarzenia rozpadu i lądowań, dymki.
- `src/gfx.js` — pipeline: tło z poświatami CMY → 2D → 3D kart → 2D (snop światła) → oko (ACES jak na stronie)
  → 2D → kamera, fala, glitch, aberracja w farbach CMY → bloom → akumulacja subklatek (motion blur) → ziarno.
- `src/common.js` — materiał kart z drukiem rastrowym C/M/Y (kropki pod kątami jak w druku; na czarnym tle
  farby są światłem, więc C+M+Y = biel), gwiazdy jak `#starfield` strony, fale, iskry, snop światła.
- `src/scenes/*.js` — świat (gwiazdy, poświaty, wizjer REC), nagłówek, prace, cennik, zakończenie, oko z dymkami.
- Strefy bezpieczne Reels: ważny tekst w pasie ok. 250–1450 px w pionie.
