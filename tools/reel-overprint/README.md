# Reels OVERPRINT — 33,75 s, 1080×1920 (Instagram / Facebook)

Reklama darmowej gry [OVERPRINT](https://m-jaro.pl/shooter.html) i strony portfolio. Gameplay nie jest nagraniem ekranu:
reels ładuje prawdziwy silnik gry (`shooter/render.js`, `shooter/game.js`, `shooter/data.js` ze strony, bez zmian)
i steruje nim czasem filmu. Każde ujęcie to scenariusz (fala, bronie z tuszami, wrogowie, ruch gracza, ULT, kamera),
a `Math.random` ma ziarno, więc render jest deterministyczny i zgrany z muzyką co do klatki (128 BPM, 72 beaty).

| scena | beaty | treść |
|---|---|---|
| druk logo | 0–4 | Arkusz papieru, logo OVERPRINT drukuje się płytami C, M, Y na ósemkach, naklejki „DARMOWA GRA / W PRZEGLĄDARCE”, arkusz staje się areną, krople spadają, ULT na B4 |
| fale | 4–12 | „KLEKSY SPADAJĄ / BEZ KOŃCA.”, na B8 kamera odjeżdża nad tłum, licznik fal 01 → 99+ |
| bronie | 12–24 | 12 broni na 5. poziomie (z ewolucją), po jednej na beat; karta broni w stylu UI gry z ikoną pikselową |
| tusze | 24–32 | Trzy soczewki z grą (C chłód, M ogień, Y pioruny) zlewają się w farbę, mieszanki próżnia / wybuch / toksyna, K w środku, czerń zalewa kadr, ULT na B31 |
| bossowie | 32–40 | RAKLA, PRASA, ROZMAZ, KSERO po beacie, KRAJARKA cztery beaty; pas z nazwą jak plansza przed walką |
| ulepszenia | 40–44 | Wachlarz trzech kart poziomu (zrzuty z gry), wybór, sklep 2 × 2, „KUPIONE” |
| ranking | 44–52 | Koniec nakładu, wynik się nabija, nick się wpisuje, ZAPISZ, cisza, tablica wyników z nowym #1; w tle odbitka areny z otwarcia |
| strona | 52–64 | Telefon z m-jaro.pl (prawdziwe zrzuty): hero → Wybrane prace → karta OVERPRINT → „Zagraj za darmo” → gry.html → menu gry → GRAJ → najazd w ekran, gra na cały kadr |
| finał | 64–72 | Arkusz z logo, „ZAGRAJ ZA DARMO”, PC · telefon · bez instalacji, przycisk m-jaro.pl/shooter.html, MJ. |

Muzyka (`music.py`, synteza w numpy/numba, e-moll): groove z chiptune'owym arpeggio, stemple przy płytach druku,
świsty spadających kropel, osobny dźwięk każdej broni na jej beacie, ciężkie staby bossów, kliknięcia kart i nicku,
nabijanie wyniku, cisza przed ULT i przed tablicą wyników, spokojniejszy pad na stronie i werbel do finału.

## Użycie

```bash
npm install
node capture.js                 # zrzuty strony (m-jaro.pl) i ekranów gry → assets/cap/*.png
python pack.py                  # → assets/img/*.webp (w repo)
python music.py                 # music.wav
node serve.js                   # podgląd na żywo: http://127.0.0.1:8141/tools/reel-overprint/reel.html
node record.js stills 5.3 14.4  # pojedyncze klatki do stills/  (python sheet.py arkusz.png 5.3 14.4 — arkusz)
node record.js draft            # szybki podgląd 30 fps bez motion blur → draft.mp4
node record.js video 60 6 reel.mp4   # finał: 60 fps, 6 subklatek motion blur
```

Wersja do wrzucenia i okładki — z mastera:

```bash
ffmpeg -i reel.mp4 -c:v libx264 -preset slow -crf 16 -maxrate 30M -bufsize 60M -profile:v high -level:v 4.2 \
  -pix_fmt yuv420p -g 120 -r 60 -c:a copy -movflags +faststart reel_instagram.mp4
ffmpeg -i reel.mp4 -vf "select='eq(n\,75)'" -frames:v 1 -q:v 2 cover_logo.jpg       # logo na arkuszu + DARMOWA GRA
ffmpeg -i reel.mp4 -vf "select='eq(n\,1950)'" -frames:v 1 -q:v 2 cover_final.jpg     # finał z adresem
```

Wyniki (`*.mp4`, `*.jpg`, `music.wav`) i surowe zrzuty (`assets/cap/`) są w `.gitignore`.

## Budowa

- `src/rig.js` — silnik gry sterowany czasem: `View` z własnym kadrem niskiej rozdzielczości (4 px wyjścia na piksel gry,
  margines 3 px, żeby kamera przesuwała się płynnie pod piksel), `Game` z atrapami wejścia, dźwięku i UI. Gracz nie obrywa,
  poziomy i sklep rozwiązują się same, wstrząs gry trafia do kamery reelsa. Klocki: `kite` (bot), `ring`, `arm`, `endless`, `boss`.
- `src/shots.js` — scenariusze ujęć (otwarcie, 12 broni, trzy tusze, ULT, pięciu bossów, tło kart, finał).
- `src/gfx.js` — pipeline: warstwy 2D (back → game → mid → front → add) → kamera, rozmycie kierunkowe, przesunięcie płyt C/M/Y
  → bloom → HUD, błysk → akumulacja subklatek (motion blur) → ziarno.
- `src/common.js` — arkusz papieru jak w grze, logo z trzech płyt (multiply na papierze, screen na czerni), ikony pikselowe
  z `shooter/data.js`, naklejki, panele i przyciski w stylu gry i strony.
- `src/director.js` — rozdziały, stopy i mocne uderzenia (te same beaty są w `music.py`).
- `src/scenes/*.js` — po jednym pliku na scenę; `world.js` rysuje się na końcu (puls kamery, cięcia, wstrząs).
- Strefy bezpieczne Reels: ważny tekst w pasie ok. 250–1500 px w pionie.

Fonty: Space Grotesk (SIL OFL) z `fonts/` strony. Zrzuty: m-jaro.pl (hero, Wybrane prace, gry.html) i lokalna gra.
