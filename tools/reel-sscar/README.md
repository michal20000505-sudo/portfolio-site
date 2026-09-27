# Reels SSCAR.PL — 38 s, 1080×1920 (Facebook)

Film o funkcjach strony [sscar.pl](https://sscar.pl) dla stacji kontroli pojazdów SSCAR (Wrocław, Polanowicka 82).
Kolory, typografia (Barlow Condensed + Barlow), komponenty i ikony są jak na stronie. Model koła
z laboratorium geometrii jest przeniesiony 1:1 z `geometria-3d.html`: bryła, materiały, shader, kinematyka
i widoki kamery. Wszystko jest funkcją czasu `t`, więc render jest deterministyczny, a obraz jest zgrany
z muzyką co do klatki (120 BPM, 76 beatów = 38 s).

| scena | beaty | treść |
|---|---|---|
| intro | 0–6 | Czerwona linia otwiera kadr jak migawka i pokazuje zbliżenie na toczące się koło z laboratorium. W B4 kamera odjeżdża na cały zespół koła i pojawia się logo SSCAR z podpisem. W B5 koło skręca. |
| spis | 6–10 | „Twoja stacja online”: cztery wiersze w stylu `.nav-index-item` strony. Tapnięcie w rezerwację. |
| 01 rezerwacja | 10–26 | Widżet z `rezerwacja.html` ma trzy kroki (usługa, termin, dane). Pojawiają się warianty z ceną, pasek dni i wolne godziny. Potem karta „Twoja rezerwacja” i przycisk „Zarezerwuj termin”. Termin jako blok wpada do grafiku stacji. |
| 02 geometria 3D | 26–46 | Camber od tyłu, zbieżność z góry, caster z boku, a na koniec skręt koła, które podnosi nadwozie. Adnotacje kątów i odcisk opony działają jak na stronie. Licznik przebiegu opony reaguje na żywo, obok pojawiają się zdjęcia zużycia bieżnika ze strony. Potem „Ustawienia fabryczne” i zdjęcie stanowiska 3D z hali. |
| 03 dekoder VIN / DAM | 46–58 | VIN wpada jak na tablicy klapkowej i dzieli się na sekcje WMI, VDS i VIS. Pojawia się karta z BMW M3 F80 z hali SSCAR, opisana w stylu ich postów. Na koniec kod DAM 12468 i data 28 grudnia 2010. |
| 04 baza klimatyzacji | 58–64 | BMW, M3 (F80), 2014–. Wynik z bazy strony: R134a, 550 g, PAG ISO 46. Cena serwisu od 150 zł do 425 zł (formuła z `klima.html`). |
| outro | 64–76 | Logo, zdjęcie stacji z godzinami i telefonem, sscar.pl, przycisk „Zarezerwuj online” i adres. |

Przykładowy VIN `WBS3C9C56FP736918` ma poprawną cyfrę kontrolną. vPIC NHTSA, którego używa dekoder strony,
zwraca dla niego BMW M3 2015, sedan, 3.0 L, 6 cylindrów, 425 KM, Regensburg. Dane w bazie klimatyzacji
pochodzą z `sscar/tools/dane_klima.json`.

Muzyka (`music.py`, synteza w numpy/numba) jest w e-moll (i–VI–III–VII), ma szesnastkowy bas „nocnej jazdy”,
staby i arpeggio. Dźwięki z warsztatu są zgrane z obrazem:
- klucz udarowy na przejściach rozdziałów, kończący się na „raz”;
- zapadki grzechotki na krokach suwaka;
- serwa przy zwrotach kamery;
- klapki tablicy przy VIN;
- silnik R6 (S55) wkręcający się na obroty przy wyniku M3;
- zawór upustowy turbo w intro;
- syk czynnika przy klimatyzacji.

## Użycie

```bash
npm install
python music.py                 # music.wav
node serve.js                   # podgląd na żywo: http://127.0.0.1:8140/tools/reel-sscar/reel.html
node record.js stills 5.3 14.4  # pojedyncze klatki do stills/  (python sheet.py arkusz.png 5.3 14.4 — arkusz)
node record.js draft            # szybki podgląd 30 fps bez motion blur → draft.mp4
python strip.py draft.mp4 stills/pasek.png 12.8 13.6 12   # 12 klatek z odcinka filmu w jednym pasku
node record.js video 60 6 reel.mp4   # finał: 60 fps, 6 subklatek motion blur
```

Wersja do wrzucenia na Facebooka i okładki — z mastera:

```bash
ffmpeg -i reel.mp4 -c:v libx264 -preset slow -crf 16 -maxrate 30M -bufsize 60M -profile:v high -level:v 4.2 \
  -pix_fmt yuv420p -g 120 -r 60 -c:a copy -movflags +faststart reel_facebook.mp4
ffmpeg -i reel.mp4 -vf "select='eq(n\,150)'" -frames:v 1 -q:v 2 cover_logo.jpg       # koło + logo SSCAR
ffmpeg -i reel.mp4 -vf "select='eq(n\,1600)'" -frames:v 1 -q:v 2 cover_m3.jpg        # dekoder VIN + BMW M3
```

Wyniki (`*.mp4`, `*.jpg`, `music.wav`) są w `.gitignore`.

## Budowa

- `src/wheel.js` — laboratorium geometrii ze strony w three.js: bryła budowana kodem, shader, cień, kinematyka
  (`transform()` i `recompute()` strony) oraz kamera o rzucie identycznym z `proj()` strony. Dodane są toczenie
  koła, tekstury opony ×4, czerwone światło konturowe i wygaszanie ku górze kadru.
- `src/gfx.js` — pipeline:
  1. tło: czerń strony, siatka, czerwona poświata, tło laboratorium;
  2. 2D;
  3. panele 3D;
  4. 2D;
  5. koło;
  6. panele nad kołem;
  7. 2D;
  8. kamera i whip pan;
  9. bloom;
  10. akumulacja subklatek (motion blur);
  11. ziarno.
- `src/common.js` — komponenty w stylu strony (karty, przyciski, numery kroków, ptaszki, tapnięcia), ikony
  Font Awesome (`src/icons.js`, te same co na stronie) i panele: canvas jako tekstura na płaszczyźnie w 3D.
- `src/director.js` — rozdziały, stopy, uderzenia. Zdarzenia rozdziałów są na początku każdego pliku `src/scenes/*.js`
  (`E`, `LE`, `VE`, `KE`, `OE`), a `music.py` ma ich kopię.
- `src/scenes/*.js` — świat (tło, nagłówek rozdziału z licznikiem, przejścia), intro, spis, rezerwacja,
  laboratorium, VIN, klimatyzacja, outro.
- Strefy bezpieczne Facebook Reels: ważny tekst jest w pasie ok. 270–1250 px w pionie. Dół zasłania podpis
  i przyciski aplikacji.

Ikony: Font Awesome Free 6 (CC BY 4.0). `src/icons.js` generuje się z `node_modules/@fortawesome/fontawesome-free/svgs`.
Fonty: Barlow i Barlow Condensed (SIL OFL), pobrane z Google Fonts do `assets/fonts/`.
Zdjęcia pochodzą z repozytorium strony SSCAR (`img/`).
