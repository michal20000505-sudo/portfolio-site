# Import CSV / Google Ads Editor — workflow

Import daje strukturę kampanii w kilka minut zamiast wyklikiwania każdego
elementu ręcznie. Kolejność ma znaczenie — grupa reklam nie powstanie bez
kampanii, reklama nie powstanie bez grupy.

## Kolejność importu

Editor: **Konto → Import → Z pliku…**, potem podgląd zmian → **Zastosuj**.

| # | Plik | Co tworzy |
|---|---|---|
| 1 | `01-kampanie.csv` | Kampanie: budżet, strategia stawek, język |
| 2 | `02-grupy-reklam.csv` | Grupy reklam ze stawkami CPC |
| 3 | `03-slowa-kluczowe.csv` | Słowa kluczowe (ścisłe + do wyrażenia) |
| 4 | `05-reklamy-rsa.csv` | Reklamy RSA (nagłówki + opisy) |
| 5 | plik usuwający | Sprzątanie starych fraz/elementów po poprzedniej strukturze, jeśli dotyczy |
| 6 | rozszerzenia na poziomie konta | Linki do podstron, objaśnienia, fragmenty rozszerzone — kolumny Campaign/Ad Group **puste** = poziom konta |

Jeśli Editor odmówi importu rozszerzeń na poziomie konta, trzeba wpisać
nazwy wszystkich kampanii ręcznie w kolumnie `Campaign` (N wierszy zamiast
jednego) albo dodać je ręcznie w interfejsie.

Kampanie importują się jako **wstrzymane (Paused)** celowo — dopiero po
ustawieniu rzeczy spoza CSV (niżej) i przejściu checklisty startu
(`SKILL.md`) następuje włączenie.

Aktualizacja kampanii o tej samej nazwie **nie duplikuje** — podmienia
budżet i dokłada nowe grupy, zachowując historię konta (statystyki,
Wynik Jakości).

## Co CSV NIE przenosi — pełna lista

Każdy z poniższych punktów potrafi zepsuć kampanię, jeśli zostanie
pominięty po imporcie.

1. **Reklamy polityczne w UE** — pole w panelu edycji kampanii musi być
   ustawione na „Nie zawiera reklam politycznych", inaczej Editor
   **blokuje całą wysyłkę bez czytelnego błędu**. Sprawdzać to jako
   pierwsze, gdy import się nie kończy sukcesem bez wyjaśnienia.
2. **Sieci** (partnerzy wyszukiwania, sieć reklamowa) — CSV ich nie
   ustawia, domyślnie zaznaczone. Odznaczyć ręcznie w każdej kampanii.
3. **Lokalizacje** — CSV wpuszcza kampanie z kierowaniem na całą Polskę.
   Trzeba **podmienić** (nie dołożyć) na miasto + promień, i ustawić
   opcję lokalizacji na „Obecność" (nie „Obecność lub zainteresowanie").
4. **Limit CPC strategii** — Editor przenosi stawki grup, ale limit CPC
   przy Maksymalizacji kliknięć trzeba ustawić osobno na poziomie
   kampanii.
5. **Rozszerzenie połączeń** — dodaje się osobno, bo wymaga weryfikacji
   numeru telefonu. Numer identyczny z wizytówką i stroną, godziny
   identyczne jak harmonogram kampanii.
6. **Przypięcie nagłówka** (jeśli w ogóle stosowane) — ustawiane ręcznie
   po imporcie. Domyślna zasada: nie przypinać nic.
7. **Harmonogram reklam** — nie da się zaimportować przez CSV, sprawdzone
   wielokrotnie. Zobacz sekcję osobną niżej.
8. **Wykluczające słowa kluczowe** — nie wchodzą przez Editor, tylko przez
   interfejs webowy. Zobacz sekcję osobną niżej.

## Harmonogram — dlaczego nie da się zaimportować

Próba przepchnięcia harmonogramu przez kolumnę `Bid modifier` mapuje się
na „Mobile Bid Modifier", gdzie `0%` jest niedozwolone i Editor odrzuca
wiersze z błędem; bez tej kolumny odrzuca je po cichu jako „Kampania" bez
zmian — czyli import wygląda na udany, a harmonogram po prostu nie wszedł.

Plik z harmonogramem zostaje jako **zapis ustaleń**, wpisy dodaje się
ręcznie: 2 wiersze na kampanię (pon.–sob. i niedziela osobno, niedziela
zawsze osobnym wierszem — inaczej kopiuje godziny reszty tygodnia), bez
korekt stawek.

Lokalizacja pola w panelu bywa przenoszona przez Google między wersjami
interfejsu (np. z ustawień kampanii do osobnej sekcji „Listy odbiorców,
słowa kluczowe i treść → Harmonogram reklam") — sprawdzać aktualne
miejsce, zamiast polegać na starej instrukcji.

## Wykluczające — tylko przez web

Wykluczające słowa kluczowe **nie wchodzą przez Editor**. Wklejane
ręcznie do listy na poziomie konta w interfejsie webowym:

**Google Ads → Narzędzia → Zasoby wspólne → Listy wykluczających słów
kluczowych → wklej → Zapisz → Zastosuj do wszystkich kampanii.**

- Cudzysłowy w pliku źródłowym **zostawić** — ustawiają dopasowanie do
  wyrażenia.
- Linie z komentarzem (np. zaczynające się od `#`) **nie wklejać** —
  Google zrobi z nich realne frazy wykluczające, nie zignoruje ich jako
  komentarz. Trzymać osobną wersję pliku bez komentarzy, gotową do
  zaznaczenia i wklejenia w całości.
- Nowe kampanie nie dziedziczą listy konta automatycznie — po każdym
  dodaniu kampanii zastosować listę jawnie.

## Pułapki techniczne

- **UTF-8 z BOM obowiązkowo.** Zapis w złym kodowaniu (np. zwykłym
  Notatnikiem bez BOM) psuje znaki diakrytyczne — reklama z krzakami w
  tekście idzie do moderacji z błędem.
- **Ścieżki wyświetlane (Path 1/Path 2) mogą być fikcyjne**, dopóki nie
  istnieją realne podstrony usług — po ich powstaniu podmienić Final URL
  i ścieżki na prawdziwe.
- **Ta sama fraza w dopasowaniu ścisłym i do wyrażenia w jednej grupie
  jest celowa, nie duplikatem** — nie usuwać jej przy porządkowaniu.
- **Editor dopasowuje nowe reklamy RSA do istniejących po grupie + Final
  URL + identycznej ścieżce wyświetlanej.** Jeśli te trzy się zgadzają,
  nowy import **nadpisuje (Aktualizuj)** starą reklamę zamiast dodać
  drugą wersję do rotacji — statystyki dobrze działającej reklamy (np.
  wysoki CTR) startują od zera. Żeby uzyskać realną rotację dwóch
  reklam w tej samej grupie, dodać drugi tekst ręcznie **ze zmienioną
  ścieżką wyświetlaną**.
- **Pusty widok wyników w Editorze/panelu może być filtrem, nie brakiem
  danych** — sprawdzić zapisane widoki i wyczyścić filtry stanu przed
  wnioskiem o nieudanym imporcie.
- **Nie ufać kafelkowi „Podsumowanie kampanii" po włączeniu** — bywa
  przeliczany okresowo i po zmianie statusu przez chwilę pokazuje
  nieaktualny stan (np. „wszystkie reklamy wstrzymane" mimo że są
  włączone). Wiarygodny widok: `Kampanie → Reklamy` z kolumną **Stan**,
  pokazującą stan efektywny z powodem („Grupa reklam wstrzymana",
  „Kampania jest wstrzymana").
- **Stan jest niezależny na 3 poziomach** (kampania → grupa → reklama) —
  włączenie kampanii **nie odwiesza automatycznie** grup/reklam pod
  spodem. Sprawdzić wszystkie trzy poziomy po włączeniu.
- Po każdym imporcie zweryfikować sumę budżetów dziennych względem
  zamierzonej — pomyłka w jednym polu to realnie kilkadziesiąt zł/mies.
