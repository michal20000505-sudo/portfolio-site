# OBSERVER 01 — osobny projekt oka

## Podgląd

Otwórz `oko-lab.html` przez lokalny serwer HTTP, np. Live Server lub
`python -m http.server 8000`, a następnie `http://localhost:8000/oko-lab.html`.
Moduły ES nie są przeznaczone do otwierania przez `file://`.

OBSERVER 01 jest teraz jedynym okiem w portfolio. Zastąpił `eye-native.js`
na stronie głównej oraz `eye.js` na `gra.html`, `grafika.html` i `oko.html`.
Stare pliki zostały w repozytorium, ale żadna strona ich już nie ładuje
(poza `eye-test.html`, który służy do porównań starej wersji).

## Pliki i źródło wzorca

- `eye-observer-model.js` — proceduralna geometria, materiały, tekstury, ruchome części.
- `eye-observer.js` — niezależny renderer, kamera, stany i obsługa zdarzeń.
- `eye-observer-mount.js` — montaż oka na stronach: lot po ekranie, snop światła i łuna
  na najechanym elemencie, dwuklik prowadzi na `oko.html`.
- `oko-lab.html`, `oko-lab.css`, `oko-lab.js` — laboratorium i testy interakcji.
  Interfejs korzysta z systemu ze strony głównej (Space Grotesk, czerń #050505, triada CMYK,
  poświaty, gwiazdy, własny kursor).
- `models/observer-reference.png` — niezmieniona kopia obrazu przekazanego przez użytkownika
  (`attachments/6abcdec6-6b56-4108-87b7-b5d5e526393d/image-1.png`). Plik został w repozytorium
  jako źródło wzorca; strona go już nie wyświetla.
- `tools/test-eye-observer.cjs` — test przeglądarkowy; raport i zrzuty zapisuje w nowym katalogu systemowym TEMP.

Zdjęcie nie jest nakładane na model ani używane jako nieruchoma imitacja 3D.
Geometria odwzorowuje widoczne cechy wzorca: jasny wygięty pancerz, odkryte
przekładnie, boczne osłony, koronę, dolny moduł, przewody, ciemne metalowe pierścienie
oraz turkusową optykę. Tył i niewidoczne na zdjęciu połączenia są autorską interpretacją.
To rekonstrukcja proceduralna, nie skan ani identyczny model źródłowy ze zdjęcia.

## Mechanika i reakcje

- Soczewka: zagłębiona światłowodowa tęczówka, wypukła źrenica, szkło z odbiciami studia.
- Przysłona: 12 zachodzących na siebie listków, wspólny otwór zmieniany promieniowo,
  pełne domknięcie do zera. Mechanizm znajduje się wewnątrz pierścienia obiektywu.
- Ruch: płynne śledzenie, lewitacja, obrót przekładni, boczne serwa, automatyczne mruganie.
  Faza napędów jest całkowana, więc zmiana stanu nie przestawia nagle kół zębatych.
  Oko nie rzuca cienia ani łuny pod sobą, bo unosi się w pustce, bez podłogi.
- Na stronach oko startuje w ujęciu na wprost i wyraźnie odwraca się za kursorem
  (do ok. 46° w poziomie i 30° w pionie). Ujęcie ¾ pozostaje w laboratorium, pod przyciskiem kamery.
- Kursor / dotyk / klawiatura: kontakt i pobudka. Przeciąganie: ręczny obrót.
- Najechanie lub fokus na kontrolce: skupienie i mniejsza źrenica.
- Pisanie: czytanie. Wysłanie lokalnego formularza: powitanie. Brak danych: zaciekawienie.
- Szybkie ruchy myszy: odruch zaskoczenia z ograniczeniem częstotliwości.
- Przewijanie: odruch orientacji. Powrót do karty: powitanie.
- 8 sekund bezczynności: rozglądanie. 28 sekund: sen. Bezczynność działa także po wcześniejszej interakcji.
- Przyciski pozwalają wymusić skan, mrugnięcie, radość, zaskoczenie, ciekawość i sen.

Laboratorium zawiera także rozłożenie części, regulację światła i zbliżenia,
widoki ¾/przód/bok/tył, automatyczny obrót, wyłączniki autonomii, pauzę,
reset, zapis przezroczystego PNG, dziennik stanów oraz pomniejszony podgląd podczas testów niżej na stronie.
Formularz nie wysyła danych i nie zapisuje imienia w pamięci trwałej.

## API przyszłej integracji

Strony portfolio ładują gotowy moduł montujący:

```html
<script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" } }</script>
<div id="mech-eye" aria-hidden="true"></div>
<script type="module" src="eye-observer-mount.js"></script>
```

`data-noflight` zostawia oko w układzie strony (bez lotu, reflektora i intra),
`data-nolink` wyłącza przejście na `oko.html` po dwukliku.

### Intro (złożenie z rozproszonych części)

Na stronach z aktywnym lotem (`index.html`, `gra.html`, `grafika.html`) `eye-observer-mount.js`
odtwarza przy wejściu i odświeżeniu krótkie intro: części modelu rozlatują się po całym
viewport, po czym magnetycznie zbiegają w złożone oko dokładnie w miejscu, gdzie mały,
latający canvas normalnie by się znajdował — bez skoku przy zamianie. Po złożeniu pojawia
się dymek: „Cześć, jestem obserwatorem tego portfolio, ale będę też obserwował Ciebie.”,
po ok. 4,5 s zmienia treść na „Kliknij mnie dwa razy, jeśli Ty chcesz poobserwować mnie.”,
a po kolejnych ok. 6 s znika (albo natychmiast po dwukliku oka).

- Kiedy: przy każdym wejściu z zewnątrz i każdym odświeżeniu (`performance` navigation type
  `reload`); pomijane przy przejściu linkiem między podstronami portfolio i przy powrocie wstecz.
- Wymuszenie: parametr URL `?intro`, np. `index.html?intro`.
- `prefers-reduced-motion` całkowicie wyłącza lot i intro (bez zmian względem dotychczasowego zachowania).

API w `eye-observer.js`, używane przez mount:
- `eye.setFraming({ x, y, size } | null)` — przełącza kamerę między normalnym kadrem
  a renderowaniem pełnoekranowego hosta tak, jakby patrzył przez mały kwadrat oka
  o boku `size` w punkcie `(x, y)` (px hosta), przez `camera.setViewOffset(...)`.
- `eye.playAssembly({ duration = 2.6, pxPerUnit })` — zwraca `Promise`, rozwiązywany
  po wylądowaniu wszystkich rozproszonych części (natychmiast przy reduced motion).
  Podczas animacji tymczasowo wyłącza śledzenie kursora i reakcje, na koniec wywołuje
  `trigger('greeting', 2)`.

Bezpośrednie użycie renderera:

```js
import { ObserverEye } from './eye-observer.js';
const observer = new ObserverEye(document.querySelector('.my-eye-container'), { lookRadius: 420, lookYaw: .8, lookPitch: .52 });
observer.trigger('happy', 2.5);
observer.setOptions({ tracking: true, spread: 0.4 });
observer.setView('reference');
// Przy demontażu komponentu:
observer.dispose();
```

Kontener musi mieć szerokość i wysokość. W dokumencie potrzebna jest mapa importów
`three` taka jak w `oko-lab.html` (wersja przypięta do 0.160.0).
Renderer nie korzysta z `#mech-eye`, stylów strony głównej ani globalnego uchwytu laboratorium.
Na stronie pokazowej `window.observerLab.snapshot()` pozwala sprawdzić stan i liczbę zasobów.
Zdarzenia `observerstate`, `observertelemetry` i `observererror` są wysyłane na kontenerze.

## Dostępność, zasoby i ograniczenia

- Klawiatura: strzałki obracają model, Home przywraca kadr, Enter / spacja wywołują reakcję.
- `prefers-reduced-motion` wyłącza samoczynne obroty, lewitację, mruganie i dynamiczne gesty;
  nadal dostępne są statyczne reakcje, rozłożenie i obsługa kontrolek.
- Pauza, ukrycie karty i wyjście podglądu poza ekran zatrzymują pętlę renderowania.
- Rozmiar renderera dostosowuje się do kontenera. DPR jest ograniczony, szczególnie na urządzeniach dotykowych.
- Powtarzalne zęby przekładni, śruby i oplot przewodów korzystają z instancjonowania.
- `dispose()` usuwa klatki animacji, zdarzenia, obserwatory, geometrie, materiały, tekstury i canvas.
- Three.js wymaga dostępu do CDN. Błąd pobrania lub WebGL daje widoczny komunikat i możliwość odświeżenia.
- PNG zapisuje model z przezroczystym tłem, bez interfejsu i tła CSS.
- Wierność oceniano względem jednego widoku referencyjnego; nie ma danych o oryginalnej topologii ani animacjach.

## Uruchomienie testu

Z zainstalowanym Playwright i Chromium:

```powershell
node tools/test-eye-observer.cjs
```

Jeśli Playwright jest zainstalowany w innym miejscu:

```powershell
$env:EYE_PLAYWRIGHT_MODULE = 'C:/path/to/node_modules/playwright'
node tools/test-eye-observer.cjs
```

Test obsługuje pliki lokalnie w przeglądarce, nie wdraża niczego i nie modyfikuje strony głównej.
`EYE_VISUAL_ONLY=1` uruchamia tylko render i zapis zrzutów.
`EYE_VIEWS_ONLY=1` sprawdza dodatkowo przód/bok/tył, sterowanie kamerą podczas pauzy,
ciągłość ruchu przekładni i wygląd częściowo zamkniętej przysłony.
Testy obejmują stany, domknięcie i pobudkę, rozłożenie, pauzę, kierunek śledzenia,
formularz, pływający podgląd, reset, PNG, ponowną bezczynność, telefon, ograniczenie ruchu,
zwalnianie zasobów i błąd CDN. Walidacja zrzutów jest dodatkowa względem asercji liczbowych.
