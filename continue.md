# Kontynuacja: Liquid Glass dla napisu FEEDBACK

Data handoffu: 2026-07-30  
Projekt: `przyklad_2`  
Główna przeglądarka użytkownika: Opera GX 133  

## Cel

Napis `FEEDBACK` na głównej sekcji ma wyglądać jak rzeczywiste szkło:

- wyraźnie załamywać obraz buta znajdujący się pod literami,
- mieć refrakcję i subtelną dyspersję RGB,
- zachować normalny, nieodwrócony kształt liter,
- nie być tylko półprzezroczystym wypełnieniem lub obrysem.

Użytkownik wyraźnie poprosił, aby **nie używać skilla `impeccable`**. Inspiracją jest:

- <https://github.com/nikdelvin/liquid-glass>
- film przekazany wcześniej przez użytkownika: <https://www.youtube.com/watch?v=Cv8zFvM8fEk>

## Uruchomienie na drugim komputerze

```powershell
cd przyklad_2
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1 --port 5174
```

Adresy:

- główna strona: <http://127.0.0.1:5174/>
- izolowany test: <http://127.0.0.1:5174/liquid-glass-test.html>

Na Windows trzeba używać `npm.cmd`, ponieważ zwykłe `npm` może zostać zablokowane przez PowerShell Execution Policy.

Kontrola:

```powershell
npm.cmd run build
```

Ostatni build przeszedł bez błędów na:

- Node `v24.13.1`
- npm `11.8.0`
- Vite `8.1.5`

## Najważniejszy wynik dotychczasowych testów

Statyczny test **działa w Operze GX**.

Na zrzucie przekazanym przez użytkownika widać, że:

1. Niemaskowany zaokrąglony prostokąt w planszy A mocno deformuje but.
2. Napis `FEEDBACK` w planszy A, wykorzystujący `backdrop-filter + mask-image`, również pokazuje zdeformowane fragmenty buta.
3. Bezpośrednia kopia obrazu filtrowana przez SVG w planszy B również działa.
4. `CSS.supports` zwraca `YES`.
5. Computed style obu warstw zawiera `url("#backdrop-displacement")`.

To obala wcześniejsze hipotezy:

- Opera potrafi renderować `backdrop-filter: url(#filter)`.
- Opera potrafi łączyć ten filtr z `mask-image`.
- Sam SVG displacement działa.
- Problem nie wynika ogólnie z użycia Vite/React zamiast statycznego HTML.
- Problem nie wynika ze starego bundla; Vite serwował aktualne moduły i odpowiadał `200`.
- Z-index jest poprawny: `FEEDBACK` jest nad butem.

Mimo przeniesienia lokalnego filtra SVG do komponentu, użytkownik potwierdził:

> na głównej stronie nadal nie działa

## Kluczowa różnica między działającym testem i niedziałającą stroną

### Działający test statyczny

Plik:

`przyklad_2/public/liquid-glass-test.html`

Używa:

- globalnej, niewidocznej definicji SVG będącej bezpośrednim dzieckiem `body`,
- stałego ID `#backdrop-displacement`,
- `feTurbulence`,
- `feGaussianBlur`,
- `feDisplacementMap`,
- lokalnego `backdrop-filter: url("#backdrop-displacement")`,
- statycznej maski SVG zapisanej jako `data:image/svg+xml`.

### Niedziałający komponent aplikacji

Plik:

`przyklad_2/src/components/LiquidGlassText.tsx`

Aktualnie używa:

- definicji `<svg><filter>` zagnieżdżonej **wewnątrz** `.liquid-glass-text`,
- dynamicznego ID utworzonego przez `useId`,
- `feImage` z dynamicznym PNG `activeMaps.displacementUrl`,
- trzech `feDisplacementMap` dla kanałów RGB,
- maski liter generowanej przez canvas jako PNG,
- lokalnego `backdrop-filter: url("#liquid-glass-…")`.

Wcześniej komponent używał zewnętrznego:

```css
backdrop-filter: url("data:image/svg+xml;utf8,…#displace")
```

To również nie działało.

## Najbardziej prawdopodobne pozostałe przyczyny

W kolejności prawdopodobieństwa:

1. **Położenie definicji filtra.**  
   Działający filtr jest globalny. Niedziałający filtr jest zagnieżdżony w tym samym komponencie i stacking context, który później korzysta z filtra. Opera może rozwiązywać ID, ale nie tworzyć poprawnego obrazu backdropu w takiej konfiguracji.

2. **`feImage` z dynamicznym PNG.**  
   Działający test używa `feTurbulence`. Aplikacja używa `feImage href="data:image/png;base64,…"`. Opera może ignorować `feImage` jako wejście mapy podczas renderowania filtra użytego przez `backdrop-filter`.

3. **`isolation: isolate` bezpośrednio na `.liquid-glass-text`.**  
   W statycznym teście `isolation` znajduje się na całej scenie, a nie na samym elemencie szkła. Może to ograniczać obraz dostępny jako backdrop.

4. **Transformacja GSAP na `.hero-word .word`.**  
   Napis w aplikacji jest wewnątrz transformowanego elementu. Statyczny test nie ma takiego transformowanego przodka.

5. **Dynamiczna maska PNG lub jej wymiary.**  
   Maska liter jest widoczna, więc sama maska działa, ale mapa displacementu może mieć niewłaściwą skalę albo prawie neutralne kanały R/G.

## Plan testów na jutro

Należy zmieniać tylko jedną rzecz naraz.

### Krok 1 — przenieść dokładnie działający filtr do głównej strony

Najpierw nie używać dynamicznego `feImage`.

1. Umieścić globalny, niewidoczny `<svg>` jako dziecko `App`, `Hero` albo przez portal bezpośrednio w `document.body`.
2. Definicja nie może znajdować się wewnątrz `.liquid-glass-text`.
3. Użyć stałego ID, np. `#feedback-glass-baseline`.
4. Skopiować dokładnie prymitywy z `liquid-glass-test.html`:

```tsx
<filter
  id="feedback-glass-baseline"
  x="-25%"
  y="-25%"
  width="150%"
  height="150%"
  colorInterpolationFilters="sRGB"
>
  <feTurbulence
    type="fractalNoise"
    baseFrequency="0.007 0.026"
    numOctaves={2}
    seed={17}
    result="noise"
  />
  <feGaussianBlur in="noise" stdDeviation={1.2} result="soft-noise" />
  <feDisplacementMap
    in="SourceGraphic"
    in2="soft-noise"
    scale={105}
    xChannelSelector="R"
    yChannelSelector="G"
  />
</filter>
```

Warstwa napisu:

```css
backdrop-filter:
  url("#feedback-glass-baseline")
  saturate(1.7)
  brightness(1.08);
```

Zostawić obecną maskę liter PNG. Tym testem jednocześnie usuwamy dwie niepewne rzeczy: zagnieżdżoną definicję i `feImage`.

Oczekiwany wynik:

- jeśli napis zacznie deformować but, renderer i stacking są dobre;
- problem pozostaje w położeniu filtra lub `feImage`;
- dopiero później rozdzielić te dwie zmienne.

### Krok 2 — rozdzielić położenie filtra od `feImage`

Jeśli krok 1 działa:

1. Pozostawić filtr globalnie.
2. Zastąpić `feTurbulence` aktualnym:

```tsx
<feImage
  href={activeMaps.displacementUrl}
  preserveAspectRatio="none"
  result="displacementMap"
/>
```

3. Pozostawić pojedynczy `feDisplacementMap`.

Wyniki:

- po dodaniu `feImage` przestaje działać — winne jest `feImage`/PNG;
- nadal działa — winne było zagnieżdżenie definicji SVG;
- działa, ale bardzo słabo — winna jest zawartość lub skala mapy.

Jeżeli globalny filtr potrzebuje dynamicznego `activeMaps`, można:

- renderować go przez `createPortal(..., document.body)`, albo
- umieścić host filtrów wysoko w drzewie i przekazywać mapę przez context/props.

### Krok 3 — pokazać wygenerowane mapy

Dodać tymczasowy panel debug nad stroną:

```tsx
<img src={activeMaps.maskUrl} alt="mask debug" />
<img src={activeMaps.displacementUrl} alt="displacement debug" />
<img src={activeMaps.edgeUrl} alt="edge debug" />
```

Mapa displacementu powinna:

- mieć neutralne tło około `rgb(128, 128, 0)`,
- mieć wyraźnie zmieniające się kanały czerwony i zielony na krawędziach liter,
- nie być jednolitym prostokątem,
- mieć proporcje zgodne z napisem.

Jeżeli mapa wygląda dobrze, ale `feImage` jej nie używa, należy przejść na proceduralną mapę z `feTurbulence` albo inną technikę bez `feImage`.

### Krok 4 — jeśli globalny filtr z `feTurbulence` nadal nie działa

Dodać w `Hero` niemaskowany prostokąt kontrolny wykorzystujący dokładnie ten sam filtr i znajdujący się nad butem.

Interpretacja:

- prostokąt działa, napis nie — problem w aktualnej masce PNG lub warstwie napisu;
- prostokąt też nie działa — problem w stacking/backdrop root głównego hero.

Następnie tymczasowo:

1. usunąć `isolation: isolate` z `.liquid-glass-text`,
2. wymusić `transform: none !important` na `.hero-word .word`,
3. wyłączyć logikę `data-glass-active="false"` i IntersectionObserver,
4. sprawdzić, czy `.liquid-glass-text__lens--refracted` faktycznie istnieje.

Pomocna komenda w konsoli:

```js
const root = document.querySelector(".liquid-glass-text");
const lens = root?.querySelector(
  ".liquid-glass-text__lens--refracted",
);

({
  mode: root?.dataset.glassMode,
  active: root?.dataset.glassActive,
  filter: lens ? getComputedStyle(lens).backdropFilter : "missing lens",
  mask: lens ? getComputedStyle(lens).maskImage : "missing lens",
  rootRect: root?.getBoundingClientRect(),
  lensRect: lens?.getBoundingClientRect(),
});
```

Prawidłowy stan:

- `mode: "refracted"`,
- `active: "true"`,
- `filter` zawiera lokalne `url("#…")`,
- lens ma niezerową szerokość i wysokość.

## Kryterium wizualnego sukcesu

Nie oceniać tylko przezroczystości lub koloru.

Efekt działa dopiero wtedy, gdy linia podeszwy albo krawędź buta:

- zmienia położenie wewnątrz liter względem obrazu obok,
- jest zakrzywiona lub przesunięta przy krawędziach glifów,
- wraca do normalnego położenia poza literami.

Najłatwiej porównywać efekt na literach przecinających żółtą podeszwę.

Po potwierdzeniu działania można zmniejszyć testową skalę `105` do około `25–55` i dopracować:

- edge highlight,
- saturację,
- dyspersję RGB,
- przezroczystość powierzchni,
- siłę refrakcji zależną od odległości od krawędzi liter.

## Istotne pliki

- `przyklad_2/public/liquid-glass-test.html`  
  Działający test referencyjny.

- `przyklad_2/src/components/LiquidGlassText.tsx`  
  Aktualny komponent. Zawiera zagnieżdżony inline SVG z `feImage`.

- `przyklad_2/src/lib/createGlassTextMaps.ts`  
  Generuje PNG maski liter, mapy displacementu i mapy krawędzi.

- `przyklad_2/src/lib/createGlassBackdropFilter.ts`  
  Stary generator zewnętrznego `data:image/svg+xml`. Po ostatniej zmianie nie jest importowany przez komponent.

- `przyklad_2/src/styles.css`  
  Style `.liquid-glass-text*`, maski, fallback i warstwy hero.

- `przyklad_2/src/components/Hero.tsx`  
  Miejsce użycia `LiquidGlassText`.

## Aktualny stan Git

W momencie tworzenia handoffu:

```text
 M przyklad_2/src/components/LiquidGlassText.tsx
 M przyklad_2/src/styles.css
```

`public/liquid-glass-test.html` jest już śledzony przez Git.

Ostatni widoczny commit:

```text
0c0d36a 1
```

Nie wykonano nowego commita ani pusha z ostatnią zmianą komponentu. Przed pracą na drugim komputerze trzeba zsynchronizować te zmiany przez commit/push albo przenieść working tree inną metodą. Sam plik `continue.md` również trzeba uwzględnić przy synchronizacji.

## Czego nie robić na początku

- Nie wracać do strojenia samej wartości `refractionStrength`; wartości `30` i `100` wcześniej wyglądały identycznie.
- Nie zakładać ponownie, że Opera nie wspiera efektu — statyczny test wizualnie udowodnił, że wspiera działający wariant.
- Nie przepisywać całej strony na statyczny HTML.
- Nie zmieniać wielu zmiennych naraz.
- Nie używać `impeccable`.

