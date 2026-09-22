---
name: reklama-google-diagnostyka
description: Diagnostyka kampanii Google Ads, która nie wyświetla się, nie wydaje budżetu albo nie dowozi kliknięć, oraz pułapki interfejsu Google Ads i Google Ads Editor. Użyj, gdy użytkownik mówi, że reklamy nie działają, nie widzi swojej reklamy w wyszukiwarce, ma zielone statusy i zero wyświetleń, podejrzewa nieudany import albo nie ufa liczbom w panelu.
---

# Diagnostyka Google Ads

Każda pozycja w tym pliku **realnie kosztowała dni emisji**. To nie jest lista
teoretyczna — to katalog rzeczy, które w panelu Google wyglądają poprawnie
i mimo to nie działają.

Ustawienia i decyzje (co włączyć, jakie budżety, jakie frazy) są w
`reklama-google-ads`. Ten skill odpowiada wyłącznie na pytanie
**„dlaczego to nie działa i gdzie patrzeć"**.

## Zasada zerowa: zanim zaczniesz diagnozować, policz, ile danych ma prawo być

Połowa zgłoszeń „nic nie działa" to niecierpliwość, nie usterka.

| Fakt | Konsekwencja |
|---|---|
| 13 zł/dzień w usługach lokalnych ≈ 50 wyświetleń dziennie | przy oknie harmonogramu 14 h to **~3,5 wyświetlenia na godzinę** |
| Plan 1200 zł/mc ≈ 270–320 kliknięć miesięcznie | to **~10 kliknięć dziennie**, nie 100 |
| Raporty nie są w czasie rzeczywistym | wyświetlenia i kliknięcia schodzą nawet **3 godziny** |
| Zakres „Ostatnie 7 dni" **kończy się wczoraj** | do sprawdzania startu ustaw **„Dzisiaj"** |
| Harmonogram to nie doba | kampania włączona o 18:00 przy oknie 6:00–20:00 emituje 2 godziny, nie 14 |

**Po 4 godzinach emisji zero kliknięć na koncie jest normą, nie awarią.**

## Ścieżka diagnostyczna: „reklamy się nie wyświetlają"

Kolejność od najczęstszej i najtańszej w sprawdzeniu. **Nie przeskakuj punktów** —
wzięło się z: przeszliśmy całą listę od dołu, zanim ktoś spojrzał na punkt 1,
i to punkt 1 był przyczyną.

| # | Sprawdź | Gdzie | Sygnał, że to jest to |
|---|---|---|---|
| 1 | **Czy mapa rysuje okrąg** | Ustawienia kampanii → Lokalizacje | Brak niebieskiego koła = **puste kierowanie** |
| 2 | **Budżet dzienny vs CPC** | Ustawienia kampanii → Budżet | Budżet poniżej ~10 zł (albo poniżej 3 × CPC) = zero emisji przy zielonych statusach |
| 3 | Czy jest wiersz na „teraz" | Listy odbiorców, słowa kluczowe i treść → Harmonogram reklam | Brak wiersza na dziś/tę godzinę |
| 4 | Stan reklam z powodem | Kampanie → Reklamy → kolumna **Stan** | „Grupa reklam wstrzymana", „Kampania jest wstrzymana" |
| 5 | Liczba słów kluczowych | Kampanie → Słowa kluczowe → licznik na dole | Mniej, niż powinno być po imporcie |
| 6 | Wykluczające | Narzędzia → Zasoby wspólne → Listy wykluczających | Fraza blokująca własne zapytania |
| 7 | Płatności | Płatności → Podsumowanie | Czerwony pasek, odrzucone obciążenie, zerowe saldo przy przedpłacie |
| 8 | Ograniczenia konta | Narzędzia → Rozwiązywanie problemów → Menedżer zasad | Weryfikacja reklamodawcy, zawieszenie |
| 9 | Limit CPC vs realny CPC | Ustawienia kampanii + historia CPC | Limit poniżej realnego CPC z historii = kampania poza aukcją |

**Ostateczny dowód**, gdy wszystko wygląda dobrze: wyszukaj frazę w google.pl
z lokalizacji objętej kierowaniem. Google **nie ma** funkcji „podgląd reklamy
dla autora" — reklama widoczna w zwykłych wynikach jest zawsze prawdziwą emisją.

Ale **jedno wyszukanie, nie dziesięć**: każde to wyświetlenie bez kliknięcia,
a przy kilkudziesięciu wyświetleniach dziennie kilkanaście własnych zapytań
realnie zaniża CTR.

## 🔴 Promień zakotwiczony w Profilu Firmy = puste kierowanie

**Najdroższy błąd z całej dokumentacji.** Kosztował cały start miesięczny:
kampanie ustawione 26.08 nie dowiozły **ani jednego wyświetlenia** do 1.09.

Firma usługowa z dojazdem **nie ma stałego adresu w Profilu Firmy**. Wpis
„W promieniu 60 km od tego miejsca **(Business Profile w: <miasto>)**" nie
rozwiązuje się wtedy do żadnego obszaru — kampania celuje w zbiór pusty.

Dlaczego to jest podstępne:

- **wszystkie statusy świecą na zielono**, reklamy mają „Odpowiednia",
- raport `Lokalizacje` pokazuje normalnie uzupełnione wiersze,
- **nie ma żadnego komunikatu o błędzie** na żadnym poziomie,
- panel diagnostyczny odpowiada „żadne słowa kluczowe na koncie nie są zgodne
  z zapytaniem", co kieruje podejrzenia na słowa kluczowe zamiast na lokalizację.

**Kontrola trwa sekundę i jest wizualna:**

> Ustawienia kampanii → Lokalizacje. **Jeśli mapa nie rysuje niebieskiego
> okręgu — kierowanie jest puste.** Po wpisaniu zwykłej nazwy miasta okrąg
> pojawia się natychmiast.

**Zasada:** kotwicą promienia ma być **nazwa miasta albo współrzędne, nigdy
Profil Firmy.** Przy podmianie trzeba **usunąć** stary wpis, nie dołożyć obok —
dwie kotwice nie naprawiają problemu. Po zmianie sprawdź `Opcje lokalizacji`:
ma być **„Obecność"**, nie „Obecność lub zainteresowanie" (zmiana lokalizacji
potrafi zresetować to do wartości domyślnej).

## 🔴 Poniżej ~10 zł dziennie kampania nie wyświetla się wcale

Nie „mniej wyświetleń" — **zero**. Kampanie z budżetem dziennym poniżej
ok. 9–10 zł nie dowoziły emisji w ogóle, przy zielonych statusach i wydatku 0 zł.

Dlaczego tak się dzieje — arytmetyka, nie usterka:

- CPC w usługach lokalnych to **2,50–7 zł**. Budżet 3 zł dziennie nie starcza
  nawet na **jedno** kliknięcie, 7,50 zł starcza na jedno–dwa.
- Google nie wydaje takiego budżetu „powoli przez cały dzień" — przy budżecie
  rzędu jednego kliknięcia system **ogranicza udział w aukcjach do zera**,
  zamiast rozłożyć emisję. Efekt jest nie do odróżnienia od kampanii wstrzymanej.
- Nakłada się na to harmonogram (14 h zamiast doby) i wąski promień —
  im węższe kierowanie, tym rzadsza aukcja i tym mocniej próg boli.

**Zasada:** minimalny sensowny budżet dzienny kampanii = **3 × spodziewany CPC,
ale nie mniej niż 10 zł.** Kampanii, której nie stać na próg, **nie uruchamiamy
z głodowym budżetem** — albo dostaje pełną kwotę, albo czeka wyłączona.
Lepiej trzy kampanie po 13 zł niż sześć po 6,50 zł.

## Komunikaty panelu, które kłamią lub mylą

### „Podsumowanie kampanii" i kolumna Stan na liście kampanii są nieaktualne

Diagnostyka na poziomie kampanii jest **przeliczana okresowo** i po każdej
zmianie statusu przez jakiś czas pokazuje nieprawdę — np. „Nieodpowiednia →
Wszystkie reklamy są wstrzymane", podczas gdy komplet reklam jest włączony.

**Wiarygodny widok:** `Kampanie → Reklamy` z kolumną **Stan** — podaje stan
efektywny wraz z powodem.

### Pusta tabela to najpierw filtr, dopiero potem brak danych

Zapisany chip **„Widok (2 filtry)"** plus filtry stanu potrafią schować
wszystkie frazy w grupie i wyglądać identycznie jak nieudany import.
Zanim uznasz, że coś nie weszło: **„Wyczyść filtry" i zdejmij zapisany widok.**

### „Podgląd i diagnostyka reklam" — trzy pułapki naraz

1. **Startuje z podpowiedzianą lokalizacją, nie z lokalizacją kampanii.**
   Potrafi wstawić inne miasto. Test na złej lokalizacji zawsze zwróci
   „reklama się nie wyświetla" — i będzie to poprawna odpowiedź na złe pytanie.
2. **Czytaj zakładkę „Wyniki", nie „Podgląd".** „Wyniki" dają powód tekstowy;
   „Podgląd" tylko rysuje SERP i bywa zepsuty przez przeglądarkę.
3. **Nagłówek „Twoja reklama się nie wyświetla" pojawia się nad każdą
   odpowiedzią**, także zdrową. Liczy się treść kolumny **„Przyczyna"**:
   - *„żadne słowa kluczowe na koncie nie są zgodne z zapytaniem"* — **nie jest
     dowodem na brak frazy.** Pojawia się też przy pustym kierowaniu;
   - *„najprawdopodobniej czasami się wyświetla, ale nie została wyświetlona
     w czasie obejmującym dane z tej diagnostyki"* — **stan zdrowy**, pusta
     próbka. Przy kilku wyświetleniach na godzinę bywa pusta także dla „Dzisiaj".

### Bloker reklam w przeglądarce psuje diagnostykę i ukrywa własne reklamy

Wbudowany bloker (Opera) i rozszerzenia w innych przeglądarkach blokują
`consent.google.com`, przez co ramka podglądu zwraca `ERR_BLOCKED_BY_RESPONSE`,
a narzędzie działa w trybie kalekim. **Ta sama blokada wycina bloki reklamowe
z wyników wyszukiwania** — we własnej przeglądarce nigdy nie zobaczysz własnej
reklamy, choćby kampania działała idealnie.

**Diagnostykę i weryfikację robić w czystej przeglądarce albo na telefonie.**

### Kosztu nie sprawdzaj w „podsumowaniach skuteczności"

Dedykowane pulpity i podsumowania bywają oparte o własne, sztywne okno czasowe
i pokazują zera mimo realnego wydatku. Źródłem prawdy o koszcie jest sekcja
**Płatności/Rozliczenia** — ale i ona ma ok. dobę opóźnienia, więc saldo jest
zawsze wyższe niż suma zaksięgowanych transakcji. To nie błąd.

## Pułapki importu z Google Ads Editor

| Pułapka | Co się dzieje |
|---|---|
| **Stan jest niezależny na trzech poziomach** | Kampania → grupa reklam → reklama (i osobno słowo kluczowe). Włączenie kampanii **nie odwiesza** niczego pod spodem |
| **Editor nadpisuje reklamy zamiast dokładać** | Dopasowuje po grupie, `Final URL` i **identycznej ścieżce wyświetlanej**. Skutek: reklama z CTR 9,26% została zastąpiona, a nowa liczy statystyki **od zera**. Chcesz rotacji dwóch reklam — zmień ścieżkę wyświetlaną |
| **Harmonogram nie importuje się** | Wpisy dodaje się ręcznie w `Listy odbiorców, słowa kluczowe i treść → Harmonogram reklam`. W ustawieniach kampanii i w Editorze go nie ma |
| **Lokalizacje wchodzą jako cała Polska** | Trzeba **podmienić**, nie dołożyć — i nie kotwiczyć w Profilu Firmy (wyżej) |
| **Wykluczające nie wchodzą przez Editor** | Wkleja się je ręcznie do listy na poziomie konta w interfejsie webowym |
| **Reklamy polityczne w UE** | Bez deklaracji Editor blokuje całą wysyłkę bez czytelnego błędu |
| **Sieć reklamowa i partnerzy** | Domyślnie **zaznaczone**. Odznaczyć w każdej kampanii |
| **Kodowanie plików CSV** | Musi być UTF-8 z BOM, inaczej psują się diakrytyki i reklama leci do moderacji z błędem |

## Statusy, których się nie naprawia

**„Mała liczba wyszukiwań"** — Google wstrzymuje frazy o zbyt małym wolumenie
globalnym, ale **monitoruje je dalej i włącza automatycznie**, gdy ruch się
pojawi. Nie kosztuje, nie znika. Przy dopasowaniu ścisłym z nazwą miasta to
stan spodziewany, nie usterka. Zabezpieczenie: obok fraz ścisłych trzymać
w każdej grupie 3–4 frazy w dopasowaniu do wyrażenia.

**„Odpowiednia (ograniczona) — Rzadko wyświetlane (niski wynik jakości)"** —
tego **nie ignoruj**, ale też nie naprawiaj natychmiast. Wynik jakości liczy
się z wyświetleń, więc tuż po starcie opisuje okres, w którym konto stało.
Wróć do tego po dwóch tygodniach realnego ruchu. Częsta przyczyna: nadpisana
reklama liczy historię od zera, a oczekiwany CTR jest składnikiem wyniku jakości.

**Ocena jakości reklamy „Słaba"** — Google karze wskaźnikiem za brak
różnorodności nagłówków. Jeśli teksty są poprawne i faktograficznie ugruntowane,
można to zignorować.

## Gdy przyczyną nie jest konto

Zanim zaczniesz przepisywać teksty reklam, wyklucz trzy rzeczy poza panelem:

1. **Pomiar.** „Dużo kliknięć, zero konwersji" przy pierwszej kampanii na nowym
   koncie **znacznie częściej** oznacza rozpięty tag niż nietrafioną reklamę.
   Kliknij numer telefonu na własnym telefonie i sprawdź, czy konwersja się
   zarejestrowała → `reklama-pomiar`.
2. **Odbieranie telefonu.** Reklama poza godzinami obsługi generuje nieodebrane
   połączenia: stracony lead i zapłacone kliknięcie. Nieodebrany telefon kosztuje
   **dokładnie tyle samo** co odebrany.
3. **Strona docelowa.** Ruch z kategorii innej niż dominująca ląduje na treści
   zaczynającej się od czegoś innego i musi sam szukać swojej sekcji — obniża to
   jednocześnie Wynik Jakości (wyższy CPC) i konwersję.

## Powiązane skille

- `reklama-google-ads` — ustawienia, struktura, frazy, teksty, checklista startu
- `reklama-pomiar` — GTM, GA4, Consent Mode, weryfikacja konwersji
- `reklama-strategia` — budżet, wybór kanału, progi decyzyjne, KPI
