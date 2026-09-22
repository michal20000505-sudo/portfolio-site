# Teksty RSA — `MJ | Search | Strony WWW`

Wszystkie długości policzone programowo (Node.js, liczenie po punktach
kodowych Unicode — polskie znaki diakrytyczne to jeden znak). Skrypt
liczący: `Array.from(tekst).length`. Zero numeru telefonu i e-maila,
zero wersalików, zero wykrzykników w nagłówkach, brak przypinania.

Dozwolone fakty użyte: aktywność od 2014 roku, praca jednoosobowa
(bezpośredni kontakt z wykonawcą), zakres web / branding / grafika,
projekt autorski zamiast szablonu. Nieużyte celowo: cena, terminy,
gwarancje, liczba projektów, „bezpłatna wycena", opinie, superlatywy,
obietnice efektu biznesowego.

## Nagłówki (limit 30 znaków, do 15 sztuk)

| # | Nagłówek | Znaki | Temat |
|---|---|---|---|
| 1 | Strony Internetowe dla Firm | 27 | usługa + odbiorca |
| 2 | Strona WWW na Zamówienie | 24 | usługa |
| 3 | Strona dla Małej Firmy | 22 | usługa + odbiorca |
| 4 | Projektowanie Stron WWW | 23 | usługa |
| 5 | Web Design i Branding | 21 | zakres |
| 6 | Web, Logo i Grafika w Jednym | 28 | zakres |
| 7 | Bezpośredni Kontakt z Autorem | 29 | przewaga (jedna osoba) |
| 8 | Jedna Osoba, Cały Projekt | 25 | przewaga (jedna osoba) |
| 9 | Autorska Strona Internetowa | 27 | przewaga (bez szablonu) |
| 10 | Indywidualny Projekt Strony | 27 | przewaga (bez szablonu) |
| 11 | Projekt Strony bez Szablonu | 27 | przewaga (bez szablonu) |
| 12 | Bez Gotowych Szablonów | 22 | przewaga (bez szablonu) |
| 13 | Praca Twórcza od 2014 Roku | 26 | fakt (staż) |
| 14 | Napisz o Swojej Stronie | 23 | CTA |
| 15 | Sprawdź Portfolio Stron WWW | 27 | CTA |

Najdłuższy nagłówek: **29 znaków** („Bezpośredni Kontakt z Autorem") —
mieści się w limicie 30.

## Opisy (limit 90 znaków, do 4 sztuk)

| # | Opis | Znaki |
|---|---|---|
| 1 | Projektowanie i wykonanie stron internetowych. Kontakt bezpośrednio z autorem projektu. | 87 |
| 2 | Autorski projekt zamiast szablonu. Web design, branding i grafika w jednym miejscu. | 83 |
| 3 | Jednoosobowa pracownia: strony internetowe, branding i grafika od 2014 roku. | 76 |
| 4 | Strona internetowa dopasowana do Twojej firmy. Napisz i porozmawiajmy o projekcie. | 82 |

Najdłuższy opis: **87 znaków** (opis 1) — mieści się w limicie 90.

## Przypisanie nagłówków do grup (patrz `import/04-reklamy-rsa.csv`)

Pula 15 nagłówków jest wspólna dla obu grup — różni się tylko kolejność
pierwszych trzech pozycji, żeby każda reklama otwierała się frazą
najbliższą intencji swojej grupy. Opisy identyczne w obu reklamach.

- **Strona dla firmy** — H1–H3: „Strony Internetowe dla Firm", „Strona
  WWW na Zamówienie", „Strona dla Małej Firmy".
- **Projekt indywidualny** — H1–H3: „Indywidualny Projekt Strony",
  „Autorska Strona Internetowa", „Projekt Strony bez Szablonu".

---

## Rozszerzenia

### Objaśnienia (limit 25 znaków) — z PLAN.md

| Tekst | Znaki |
|---|---|
| Projekt Indywidualny | 20 |
| Bez Szablonów | 13 |
| Kontakt z Wykonawcą | 19 |
| Web, Logo i Grafika | 19 |
| Praca od 2014 Roku | 18 |

### Linki do podstron (tekst ≤25 zn., 2 linijki opisu ≤35 zn. każda)

Kotwice (`#anchor`) strony głównej — tymczasowe, do podmiany na
dedykowane podstrony (patrz PLAN.md, sekcja „Strona docelowa").

**Realizacje Web** (14 zn.)
- Wybrane projekty stron WWW (26 zn.)
- Web design i wdrożenia (22 zn.)

**Grafika i Branding** (18 zn.)
- Identyfikacja wizualna, DTP (27 zn.)
- Projekty graficzne i logo (25 zn.)

**Kontakt** (7 zn.)
- Napisz w sprawie projektu (25 zn.)
- Rozmowa bezpośrednio z autorem (30 zn.)

**Projekt Gry** (11 zn.)
- Przykład projektu gry (21 zn.)
- Portfolio prac z gamedev (24 zn.)

Najdłuższy tekst linku: **18 znaków** („Grafika i Branding"). Najdłuższa
linijka opisu: **30 znaków** („Rozmowa bezpośrednio z autorem"). Oba w
limicie.

### Fragmenty rozszerzone, typ „Usługi" — z PLAN.md

Strony internetowe · Web design · Branding · Identyfikacja wizualna ·
Projekty graficzne · DTP
