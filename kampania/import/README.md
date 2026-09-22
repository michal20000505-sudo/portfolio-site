# Import do Google Ads Editor

Pliki w tym katalogu są w kodowaniu **UTF-8 z BOM**. Import przez
**Google Ads Editor → Konto → Import → Z pliku…**, potem podgląd zmian
→ **Zastosuj**.

`Final URL` we wszystkich plikach to **placeholder**
`https://TWOJA-DOMENA.pl/` — podmienić na realny adres przed importem.
`Path 1`/`Path 2` (`strony-www` / `dla-firm` / `indywidualny`) to
ścieżki wyświetlane, tymczasowe do czasu powstania dedykowanej podstrony
o usłudze „strony internetowe" (patrz `../PLAN.md`, sekcja „Strona
docelowa") — po jej powstaniu podmienić razem z Final URL.

## Kolejność importu

| # | Plik | Co tworzy |
|---|---|---|
| 1 | `01-kampania.csv` | Kampania: budżet dzienny, strategia stawek, język, status |
| 2 | `02-grupy-reklam.csv` | Grupy reklam ze stawkami Max CPC |
| 3 | `03-slowa-kluczowe.csv` | Słowa kluczowe (ścisłe + do wyrażenia) |
| 4 | `04-reklamy-rsa.csv` | Reklamy RSA (nagłówki + opisy) po jednej na grupę |

Kampania importuje się jako **wstrzymana (Paused)** celowo — dopiero po
ustawieniu rzeczy spoza CSV (niżej) i przejściu checklisty startu z
`../PLAN.md` następuje włączenie.

## Czego te CSV NIE przenoszą

Skopiowane z `../../skills/reklama-google-ads/references/import-csv.md`
— każdy z poniższych punktów potrafi zepsuć kampanię, jeśli zostanie
pominięty po imporcie.

1. **Reklamy polityczne w UE** — pole w panelu edycji kampanii musi być
   ustawione na „Nie zawiera reklam politycznych", inaczej Editor
   blokuje całą wysyłkę bez czytelnego błędu. Sprawdzać to jako
   pierwsze, gdy import się nie kończy sukcesem bez wyjaśnienia.
2. **Sieci** (partnerzy wyszukiwania, sieć reklamowa) — CSV ich nie
   ustawia, domyślnie zaznaczone. Odznaczyć ręcznie — kampania ma
   działać tylko w wyszukiwarce.
3. **Lokalizacje** — CSV wpuszcza kampanię z domyślnym kierowaniem.
   Ustawić ręcznie na **Polska**, z opcją lokalizacji **„Obecność"**
   (nie „Obecność lub zainteresowanie" — domyślna wartość Google i
   najczęstszy błąd).
4. **Limit CPC strategii** — Editor przenosi stawki grup (Max CPC z
   pliku 2), ale limit CPC przy Maksymalizacji kliknięć (4,50 zł wg
   `../PLAN.md`) trzeba ustawić osobno na poziomie kampanii.
5. **Rozszerzenie połączeń** — dodaje się osobno, wymaga weryfikacji
   numeru telefonu. Numer identyczny z wizytówką i stroną. Godziny:
   **pon.–sob. 8:00–20:00 ustawione w samym rozszerzeniu**, nie w kampanii.
6. **Przypięcie nagłówka** — nie dotyczy tej kampanii z założenia
   (zasada: nie przypinać nic), ale gdyby kiedyś było potrzebne,
   ustawia się ręcznie po imporcie.
7. **Harmonogram reklam** — nie da się zaimportować przez CSV, ale ta
   kampania **żadnego harmonogramu nie ma**: emituje 7 dni w tygodniu,
   całą dobę (konwersją jest mail, nie telefon — patrz `../PLAN.md`).
   Nic tu nie wpisujesz. Godziny ogranicza się wyłącznie **wewnątrz
   rozszerzenia połączeń** (pon.–sob. 8:00–20:00), nie na poziomie kampanii.
   Gdyby kiedyś doszedł harmonogram kampanii: niedziela zawsze osobnym
   wierszem, inaczej kopiuje godziny reszty tygodnia.
8. **Wykluczające słowa kluczowe** — nie wchodzą przez Editor, tylko
   przez interfejs webowy: **Google Ads → Narzędzia → Zasoby wspólne →
   Listy wykluczających słów kluczowych → wklej → Zapisz → Zastosuj do
   wszystkich kampanii.** Użyć `../wykluczajace.txt` (bez komentarzy),
   wgrać **na poziomie konta, przed** włączeniem kampanii.

## Pułapki techniczne

- **UTF-8 z BOM obowiązkowe** — już zastosowane w tych plikach. Zapis w
  złym kodowaniu psuje polskie znaki diakrytyczne i reklama idzie do
  moderacji z błędem.
- **Ta sama fraza w dopasowaniu ścisłym i do wyrażenia w jednej grupie
  jest celowa, nie duplikatem** (plik 3) — nie usuwać przy
  porządkowaniu.
- **Editor dopasowuje nowe reklamy RSA do istniejących po grupie +
  Final URL + identycznej ścieżce wyświetlanej.** Przy kolejnym imporcie
  z tymi samymi trzema wartościami Editor **nadpisze** istniejącą
  reklamę zamiast dodać drugą do rotacji.
- Po imporcie zweryfikować sumę budżetów dziennych względem zamierzonych
  15 zł/dzień — pomyłka w jednym polu to realnie kilkadziesiąt zł/mies.
- Stan jest niezależny na 3 poziomach (kampania → grupa → reklama) —
  włączenie kampanii nie odwiesza automatycznie grup/reklam pod spodem.
  Sprawdzić wszystkie trzy poziomy po włączeniu.
