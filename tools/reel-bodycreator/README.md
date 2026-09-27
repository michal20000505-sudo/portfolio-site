# Reels Body Creator — 14,5 s, 1080×1920

Krótki reels dla klienta (studio treningu personalnego Body Creator, bodycreator.com.pl): strona na telefonie
i to, jak łatwo umówić się na darmową konsultację. Zrobiony w HTML/WebGL w stylu strony — czerń + złoto
`#F5CA00` (jedyny akcent, „The Iron Sanctuary” z `DESIGN.md` strony), Inter 900 w capsach, pigułki-przyciski.
Wszystko jest funkcją czasu `t`, więc render jest deterministyczny, a obraz zgrany z muzyką co do klatki
(120 BPM, 29 beatów = 14,5 s). Choreografia jest opisana w beatach sceny (0–16); w `HOLDS` (src/core.js,
ta sama lista w music.py) czas sceny zwalnia, gdy napis jest już w całości na ekranie — każdy tekst stoi ok. 1,5 s,
przejścia zostają szybkie. Tabela niżej podaje beaty sceny.

| scena | beaty sceny | treść |
|---|---|---|
| S0 hook | 0–2 | zdjęcie studia odsłonięte ukośnym cięciem (kąt skrzydeł z logo), „TWOJE MIEJSCE / TRENINGU” — litery spadają jak talerze; kamera odjeżdża, kadr okazuje się ekranem telefonu, a napis ląduje dokładnie na nagłówku strony |
| S1 strona | 2–8 | telefon 3D ze stroną; z ekranu wyskakują prawdziwe elementy: oferta (B3), zespół (B4.5), opinie + 5 gwiazdek (B6); tapnięcie w „Darmowa konsultacja” (B7.25) i nurkowanie w złotą kartę |
| S2 formularz | 8–13 | „3 POLA.” → pisanie w polach na 32-kach → zgoda → „WYŚLIJ.” → przycisk zwija się w spinner → „GOTOWE!” z iskrami (B12) |
| S3 logo | 13–16 | połówki B i C uderzają o siebie jak talerze, BODY CREATOR, pigułka „DARMOWA KONSULTACJA”, bodycreator.com.pl |

Muzyka (`music.py`, synteza w numpy/numba): e-moll → E-dur na „GOTOWE!”, stopa + klaśnięcia + bas 808,
brass-staby na wyskakujących elementach; brzmienia z siłowni — talerz sztangi uderzający o podłogę (B0, B2, B13),
a dźwięki interfejsu (tapnięcia, klawisze, ptaszek, spinner) grają w rytmie.

## Użycie

```bash
npm install
node capture.js                 # zrzuty lokalnej kopii strony (domyślnie ../../../BodycreatorTEST) → assets/site/*.png + site.json
python pack.py                  # → webp, logo z Logo.psb rozcięte na części, zdjęcia, klatki klipu ze studia
python music.py                 # music.wav
node serve.js                   # podgląd na żywo: http://127.0.0.1:8138/tools/reel-bodycreator/reel.html
node record.js stills 1.0 6.1   # pojedyncze klatki do stills/
node record.js video 60 6 reel.mp4   # finał: 60 fps, 6 subklatek motion blur
```

Wersja do wrzucenia na Instagram i okładka — z mastera:

```bash
ffmpeg -i reel.mp4 -c:v libx264 -preset slow -crf 16 -maxrate 30M -bufsize 60M -profile:v high -level:v 4.2 \
  -pix_fmt yuv420p -g 120 -r 60 -c:a copy -movflags +faststart reel_instagram.mp4
ffmpeg -i reel.mp4 -vf "select='eq(n\,70)'" -frames:v 1 -q:v 2 cover_hook.jpg     # napis na zdjęciu studia
ffmpeg -i reel.mp4 -vf "select='eq(n\,800)'" -frames:v 1 -q:v 2 cover_logo.jpg    # logo + CTA
```

Wyniki (`*.mp4`, `*.jpg`, `music.wav`) i surowe zrzuty `assets/site/*.png` są w `.gitignore`.

## Budowa

- `src/gfx.js` — pipeline: tło (zdjęcie / klatka czarno-białego klipu ze studia + złota poświata) → 2D → three.js
  → 2D → kamera, fala, aberracja → bloom z wagami warstw → akumulacja subklatek (motion blur) → ziarno.
- `src/phone.js` — telefon 3D (bryła z fazowaniem, ekran składany co klatkę ze zrzutów sekcji), przewijanie
  i pozy jako czyste funkcje czasu — scena otwarcia liczy z nich, gdzie jest ekran.
- `src/scenes/*.js` — po jednym pliku na scenę; `src/common.js` — assety, materiał kart ze zrzutów,
  komponenty w stylu strony (złota etykieta, pigułka), wskaźnik dotyku, złoty pył, iskry.
- Model 3D ze strony (zestaw z eventu) celowo pominięty — ma zbyt niską rozdzielczość na zbliżenia.
  Przemiany (zdjęcia przed/po) też — Meta odrzuca takie zdjęcia w reklamach.
- Strefy bezpieczne Reels: ważny tekst w pasie ok. 250–1450 px w pionie.
