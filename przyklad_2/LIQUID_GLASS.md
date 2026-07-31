# Liquid Glass dla napisów konturowych

Data potwierdzenia: 2026-07-31  
Przeglądarka: Opera GX 133  
Status: efekt na `FEEDBACK` został wizualnie potwierdzony. Ta sama implementacja jest używana także przez `BLIND` i `CITY`.

## Najważniejszy wniosek

Filtrowany element musi być bezpośrednim dzieckiem warstwy swojej sceny (`.hero`, `.movement-stage` albo `.terrain-stage`) i sam musi otrzymać:

- `backdrop-filter`,
- maskę napisu,
- półprzezroczystą powierzchnię szkła.

Nie wolno umieszczać właściwej warstwy z `backdrop-filter` jako potomka osobnego `.hero-word` lub innego lokalnego stacking contextu. Opera poprawnie rozpoznawała filtr i maskę, ale taki zagnieżdżony element nie pobierał obrazu buta jako backdropu. Computed style wyglądał prawidłowo, mimo że wizualnie nie było refrakcji.

## Działająca struktura

W `src/components/Hero.tsx` komponent jest bezpośrednim dzieckiem sekcji hero:

```tsx
<LiquidGlassText
  className="hero-word hero-word--bottom word liquid-glass-shell liquid-glass-shell--feedback"
>
  FEEDBACK
</LiquidGlassText>
```

Nie dodawać ponownie zewnętrznego wrappera:

```tsx
<div className="hero-word hero-word--bottom">
  <LiquidGlassText>FEEDBACK</LiquidGlassText>
</div>
```

Ten drugi wariant był przyczyną płaskiego efektu.

## Globalne filtry SVG

Każda instancja `LiquidGlassText` tworzy własne ID przez `useId()`, a definicję filtra umieszcza portalem bezpośrednio w `document.body`. Jest to konieczne, ponieważ `FEEDBACK`, `BLIND` i `CITY` mają różne wymiary oraz własne mapy krawędzi.

```tsx
const filterId = `liquid-glass-edge-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

createPortal(<svg>{/* filtr o ID filterId */}</svg>, document.body);
```

Nie umieszczać definicji SVG wewnątrz filtrowanego elementu. Statyczny `#feedback-glass-baseline` w `index.html` jest tylko pozostałością testu referencyjnego i nie steruje aktualnym efektem napisów.

## Maska i filtr na elemencie głównym

`src/components/LiquidGlassText.tsx` generuje maskę liter przez canvas. Po jej utworzeniu `maskImage` oraz filtr są przypisywane bezpośrednio do głównego elementu komponentu:

```tsx
const rootStyle = {
  ...cssVariables,
  ...(activeMaps && pipelineSupported && backdropFilter
    ? {
        ...maskStyle,
        WebkitBackdropFilter: backdropFilter,
        backdropFilter,
      }
    : {}),
};
```

Nie nakładać filtra na wewnętrzny element typu `.liquid-glass-text__lens--refracted`. Taka soczewka miała prawidłowe wymiary, maskę oraz computed style, ale pozostawała płaska.

## Istotne reguły CSS

- Główny `.liquid-glass-text` nie może mieć `isolation: isolate`.
- W trybie `refracted` element główny ma półprzezroczysty gradient powierzchni.
- Dynamiczna maska PNG pozostaje na elemencie głównym.
- `.liquid-glass-text__edge` może pozostać wewnętrzną warstwą, ponieważ nie pobiera backdropu.
- Każdy bezpośredni element musi mieć rzeczywisty rozmiar napisu: `FEEDBACK` ma stałe wymiary, a `BLIND` i `CITY` używają `width: max-content` oraz wysokości wyrażonej w `em`.
- Obecny selektor animacji GSAP `.hero-word .word` nie obejmuje elementu mającego obie klasy jednocześnie. Jest to celowe: transformacja nie jest nakładana bezpośrednio na filtrowany napis.

## Co zostało wykluczone

Testy wykazały, że problemem nie były:

- brak obsługi `backdrop-filter: url(#filter)` w Operze,
- globalny filtr z `feTurbulence`,
- `mask-image` jako funkcja przeglądarki,
- dynamiczna maska PNG,
- samo `isolation: isolate` na poprzednim komponencie,
- transformacja GSAP na poprzednim wrapperze,
- brak półprzezroczystego tła soczewki.

Rozstrzygający test wyglądał następująco:

1. Niemaskowany prostokąt jako bezpośrednie dziecko `.hero` falował.
2. Bezpośredni, maskowany napis jako dziecko `.hero` również falował.
3. Ta sama maska i filtr na elemencie zagnieżdżonym pozostawały płaskie.

## Szybka diagnostyka na przyszłość

Jeśli efekt ponownie stanie się płaski:

1. Sprawdzić, czy filtrowany element nadal jest bezpośrednim dzieckiem warstwy swojej sceny.
2. Sprawdzić, czy filtr jest na głównym elemencie, a nie na potomku.
3. Sprawdzić, czy w `body` istnieje filtr z unikalnym ID `liquid-glass-edge-*` dla danej instancji.
4. W konsoli odczytać `getComputedStyle(element).backdropFilter` i `maskImage`.
5. Dodać tymczasowy niemaskowany prostokąt nad butem z tym samym filtrem.
6. Oceniać przesunięcie realnych detali buta wewnątrz liter, nie tylko jasność tekstu.

## Uruchomienie i kontrola

```powershell
cd przyklad_2
npm.cmd run dev -- --host 127.0.0.1 --port 5174
npm.cmd run build
```

Test referencyjny pozostaje dostępny pod:

`http://127.0.0.1:5174/liquid-glass-test.html`

## Strojenie efektu

Aktualna siła bazowej proceduralnej fali to `scale={96}` w `LiquidGlassText.tsx`. Mocniejsza refrakcja przy krawędziach jest liczona jako `refractionStrength * 1.15`, więc opcja `refractionStrength` steruje mapą krawędzi. Żółto-zielone zabarwienie szkła i rozświetlenie krawędzi są wspólne dla wszystkich instancji w `styles.css`.

Po zmianach zawsze sprawdzić efekt w normalnym oknie Opery GX. Headless Chromium może zwracać poprawny computed style, ale jego zrzuty nie są wiarygodnym testem renderowania `backdrop-filter` z filtrem SVG.
