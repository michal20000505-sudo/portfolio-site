---
name: reklama-strategia
description: Strategia kampanii reklamowej małego budżetu — decyzja o kanale i budżecie, pytania blokujące do klienta przed startem, progi decyzyjne, KPI, struktura planu miesięcznego i rejestr leadów. Użyj jako punktu wyjścia, gdy użytkownik zaczyna kampanię reklamową, dzieli budżet między Google i Meta, ustala co jest sukcesem, planuje kolejny miesiąc emisji albo ocenia, czy dotychczasowa kampania się opłaca.
---

# Strategia kampanii reklamowej — mały budżet

Ten skill jest **punktem wejścia**. Decyzje, które tu zapadają (ile pieniędzy,
w jakim kanale, co mierzymy), determinują całą resztę. Wykonanie jest w:

| Potrzeba | Skill |
|---|---|
| Zbudować i uruchomić kampanię w wyszukiwarce | `reklama-google-ads` |
| Kampania nie wyświetla się / panel pokazuje dziwne rzeczy | `reklama-google-diagnostyka` |
| Facebook / Instagram | `reklama-meta-ads` |
| GTM, GA4, konwersje, rejestr leadów | `reklama-pomiar` |

## Zasady nadrzędne

1. **W reklamie nie zgadujemy niczego.** Reklama dociera do odbiorców szybciej
   i szerzej niż własna strona, więc błąd faktograficzny kosztuje więcej.
   Każdy fakt w tekście (cena, termin, gwarancja, „bezpłatna wycena", lata
   doświadczenia, opinie) musi być **jawnie potwierdzony**, nie wywnioskowany
   z kontekstu.
2. **Obietnica działa w dwie strony.** Coś napisane w reklamie i zaprzeczone
   w rozmowie z klientem to podstawa do skargi i realne ryzyko wstrzymania
   konta reklamowego. Osoba odbierająca telefon musi wiedzieć, co obiecuje reklama.
3. **Pomiar przed pierwszą złotówką.** Bez działających konwersji nie da się
   wybrać strategii stawek ani ocenić, czy kampania działa.
4. **Minimalny budżet dzienny kampanii = 3 × spodziewany CPC, nie mniej niż
   10 zł.** Poniżej tego progu kampania praktycznie się nie wyświetla — nie
   „mniej", tylko zero, przy zielonych statusach.
   *Wzięło się z: cztery z sześciu kampanii wystartowały pod progiem i nie
   dowiozły ani jednego wyświetlenia.*
5. **Przy stałej puli: mniej kampanii z pełnym budżetem, nie więcej z głodowym.**
   Trzy kampanie po 13 zł biją sześć po 6,50 zł. Sześć po 6,50 zł to sześć
   kampanii, które nie wydadzą nic i **nie nauczą niczego**.
6. **Domyślne ustawienia systemów reklamowych są pod ich przychód, nie twój
   wynik.** Każde domyślne ustawienie traktuj jako punkt do zmiany, nie do
   akceptacji.
7. **Cel małego budżetu testowego to nie zysk, tylko odpowiedź.**

## Pytania blokujące — zadaj je ZANIM zaczniesz cokolwiek budować

Każda z tych odpowiedzi blokuje konkretny element kampanii. Brak odpowiedzi
nie jest powodem do zgadywania — jest powodem do zatrzymania tego elementu.

| Pytanie | Co blokuje brak odpowiedzi |
|---|---|
| Forma prawna, NIP, adres, imię i nazwisko właściciela | politykę prywatności → formularze Lead Ads i część konwersji |
| Realny promień / zasięg geograficzny działania | kierowanie geograficzne, listę wykluczających miast |
| Godziny odbierania telefonu | harmonogram emisji reklam |
| Czy wycena i dojazd są bezpłatne | wolno/nie wolno użyć tego w nagłówkach |
| Czy obsługuje klientów B2B i instytucjonalnych | całe kategorie fraz i kampanii |
| Uprawnienia / licencje na usługi regulowane | możliwość reklamowania danej usługi w ogóle — **to ryzyko prawne, nie marketingowe** |
| Zdjęcia z wykonanych realizacji | wszystkie kreacje Meta i materiały graficzne |
| Średnia wartość zlecenia per kategoria | możliwość policzenia opłacalności |

## Wybór kanału przy małym budżecie

**Cały budżet testowy idzie w kanał z gotową intencją zakupową** (wyszukiwarka),
a nie dzieli się między systemy.

Arytmetyka: budżet testowy 500 zł / 20 dni = 25 zł/dzień. Podzielone na dwa
systemy to po 12,50 zł/dzień — **poniżej progu**, przy którym którykolwiek
zbierze rozstrzygające dane. **Lepiej jeden rozstrzygający test niż dwa
połowiczne.**

| | Search (Google) | Social (Meta) |
|---|---|---|
| Co sprzedaje | dopasowanie do zapytania | **obraz / kreacja** |
| Rola tekstu | główna | podpis do obrazu |
| Konwersja | szybka, ta sama wizyta | rozłożona w czasie, po kilku kontaktach |
| Kiedy wchodzi | od pierwszej złotówki | przy budżecie **1000–1500 zł/mc**, udział Meta **300–500 zł/mc** |

Meta wymaga „przypomnienia" potrzeby — użytkownik nie szuka aktywnie. To
droższa i wolniejsza droga, nie nadaje się na pierwszy, najmniejszy test.

**Nic nie kopiuj między kanałami 1:1.** Nagłówek napisany pod frazę wyszukiwania
jest w feedzie niewidzialny.

Jeśli klient mimo wszystko nalega na dwa kanały przy za małym budżecie: zapisz
to jako **ustępstwo polityczne, nie decyzję optymalizacyjną**, z jasnym
zastrzeżeniem, że żaden test nie będzie rozstrzygający.

## Faza testowa

**Trzy pytania, na które ma odpowiedzieć test:**

1. Która kategoria usług dowozi zapytania po rozsądnej cenie?
2. Ile realnie kosztuje lead w tej branży i lokalizacji?
3. Czy klient w ogóle odbiera telefony i zamienia zapytania w zlecenia?

**Pytanie 3 jest warunkiem sensowności pytań 1–2.** Bez informacji zwrotnej
o konwersji lead→zlecenie dane o kliknięciach i CPL są bezwartościowe.

**Reguły fazy testowej:**

- Strategia stawek: **maksymalizacja kliknięć z limitem CPC**, nie strategie
  oparte o cel konwersji — za mało danych na algorytmiczną optymalizację.
- Nie wchodzić w **broad match** ani w zautomatyzowane formaty szerokiego
  zasięgu (Performance Max) — próg wejścia to rząd **~30 konwersji miesięcznie**.
- **Nie rozdrabniaj kategorii.** Zacznij od kategorii z najwyższą wartością
  zlecenia i najwyraźniejszą intencją; kolejne dokładaj etapami.
- Orientacyjnie: 500 zł / 20 dni przy CPC 3–6 zł → ok. 100–150 kliknięć →
  przy konwersji 5–8% → **6–12 zapytań**. To wystarcza na sygnał kierunkowy,
  nie na optymalizację algorytmu.

## KPI — czym mierzyć sukces

- **CPL (koszt leada) nie jest właściwym KPI sam w sobie.** Różne kategorie mają
  różną wartość zlecenia — ten sam CPL bywa świetny w jednej i katastrofalny
  w drugiej.
- Właściwy KPI: **koszt pozyskanego zlecenia w relacji do jego wartości.**
  Wymaga od klienta dwóch liczb: średniej wartości zlecenia per kategoria
  i współczynnika zamiany zapytań na zlecenia.
- Do czasu zebrania tych liczb jedyny uczciwy KPI fazy testowej to **liczba
  zapytań i ich rozkład na kategorie**.
- **Nie oceniaj kampanii po CTR ani po Wyniku Jakości.** Oceniasz po liczbie
  i jakości zapytań.
- **Rejestr leadów jest obowiązkowy** — bez niego drugi miesiąc z rzędu kończy
  się liczbami o kliknięciach i zerem danych o pieniądzach. Szczegóły w
  `reklama-pomiar`.

**Benchmark z realnego testu** (usługi lokalne, PL, sierpień 2026, 14 dni):
84 kliknięcia, 978 wyświetleń, CTR 8,59%, CPC 4,44 zł, 372,57 zł wydane
z 500 zł, 2 konwersje, ~186 zł/konwersję. CTR powyżej 8% w usługach lokalnych
oznacza, że teksty i frazy działają — problemem bywa wtedy wolumen albo to,
co dzieje się **po** kliknięciu.

## Progi decyzyjne

| Decyzja | Warunek |
|---|---|
| Podnieść limit CPC | udział w wyświetleniach < ~20% po 3 dniach, albo średni CPC dobija do limitu — **najpierw CPC, potem budżet** |
| Podnieść budżet | limit CPC jest osiągany, a kampania kończy budżet przed końcem dnia |
| Przełączyć na maksymalizację konwersji | **15–30 konwersji** na koncie, nie wcześniej |
| Uruchomić Performance Max | **≥ 30 konwersji miesięcznie**, nie wcześniej |
| Wejść w Meta Ads | budżet ≥ 1000 zł/mc, piksel z historią ruchu, **prawdziwe zdjęcia z realizacji** |
| Uruchomić remarketing | grupa odbiorców **> ~1000 osób** |
| Rozszerzyć promień geograficzny | raport Lokalizacje po rzędu **kilkuset kliknięciach**, nie deklaracja klienta |
| Obciąć / wstrzymać kategorię | zero konwersji po ustalonym okresie (np. 2 tygodnie) — tnij najsłabszą, nie flagową |
| Zbudować podstrony usług | **zawsze** — to najtańsza dostępna optymalizacja |

**Uwaga o wolumenie:** 10 kliknięć to nie jest test kategorii. Przy takiej
próbce nie masz odpowiedzi „nie działa", masz „nie było na czym sprawdzić".
Kategoria z nierozstrzygniętym testem zostaje z małym budżetem, a nie znika.

**Odróżnianie braku popytu od braku pieniędzy:** jeśli kampania **nie wykorzystuje**
swojego budżetu, brakuje popytu, nie pieniędzy. Dokładanie budżetu niczego
tam nie naprawi.

## Pierwszy tydzień: obserwacja, nie majsterkowanie

Najtrudniejsza reguła w całym zestawie: **przez pierwsze 7 dni nie ruszaj
stawek, budżetów ani strategii.** Każda zmiana resetuje fazę uczenia się,
a przy małym budżecie ledwo starcza danych na jedną taką fazę. Dłubanie
codziennie w stawkach to najczęstszy sposób, w jaki agencje zabijają małe konta.

Wolno robić **dokładnie dwie rzeczy**:

1. **Raport wyszukiwanych haseł — codziennie.** Wykluczaj wszystko bez intencji
   zakupowej. To jedyna czynność, która w tym tygodniu realnie obniża koszt leada.
2. **Gaszenie pożarów** — reklama odrzucona przez moderację, konwersja, która
   przestała się rejestrować, budżet wyczerpany o 10:00.

Czego **nie** robić: zmieniać tekstów, dodawać słów kluczowych, przełączać
strategii stawek, dokładać kampanii, wyłączać „słabych" fraz po dwóch dniach.

## Struktura planu miesięcznego

Plan na kolejny miesiąc emisji zawiera, w tej kolejności:

1. **Całkowity budżet** i podział między kanały.
2. **Budżet dzienny** = miesięczny / 30, zaokrąglony lekko w dół (system rozlicza
   limit jako budżet dzienny × 30,4). Pojedyncze dni mogą przekroczyć budżet
   dzienny nawet **2×** — to normalne i wyrównuje się w skali miesiąca.
3. **Rozpiska per kampania**: budżet dzienny, ~miesięczny, udział % i
   **uzasadnienie liczby** („jedyna kategoria z konwersjami", „sezonowy szczyt",
   „dogrywka po nierozstrzygniętym teście").
4. **Sekcja „Co się nie zmienia"** — ustawienia przeniesione bez modyfikacji
   z poprzedniej fazy. Pilnuje spójności między iteracjami.
5. **Jawna decyzja o rekomendacjach systemu** — które przyjmujemy, które
   odrzucamy, z uzasadnieniem per rekomendacja. Rekomendacja z procentowym
   wzrostem „wyniku optymalizacji" (np. +4,1%) to **inna liczba** niż przewidywany
   wzrost realnych wyników.
6. **Największe ryzyko tego planu** — nazwane wprost przed startem, nie odkryte
   po fakcie.
7. **Zadania poza importem** — rzeczy blokujące skuteczność planu: rejestr
   leadów, brakujące potwierdzenia, materiały zdjęciowe, terminy przeglądów.

## Czego nie robić przez cały test

- **Nie włączaj zautomatyzowanych formatów szerokiego zasięgu** (PMax) przy
  braku danych — rozsypią budżet po miejscach, których nie zaudytujesz.
- **Nie zgadzaj się na „optymalizację" proponowaną przez konsultanta przez
  telefon.** Standardowo proponują broad match, PMax i podniesienie budżetu —
  trzy rzeczy, które przy kilkudziesięciu złotych dziennie są dokładnie
  przeciwskuteczne.
- **Nie puszczaj płatnego ruchu na pustą stronę docelową ani pusty profil.**
  Pusty fanpage, na który trafia ktoś z reklamy, obniża zaufanie szybciej,
  niż reklama je buduje.
- **Nie wyłączaj słów kluczowych ani kreacji po 2–3 kliknięciach/dniach.**
  Przy takim budżecie to szum, nie dane.
- **Nie licz kosztu z „podsumowań skuteczności"** w panelu — mają własne,
  sztywne okna czasowe. Źródłem prawdy jest sekcja rozliczeń.

## Konwencje prowadzenia projektu reklamowego

- Dokumentacja jako **router + szczegóły**: jeden krótki plik nawigacyjny
  z tabelą „zadanie → który plik przeczytać", reszta rozbita tematycznie.
- **Osobny plik na historię decyzji** („dlaczego tak") — oddziela uzasadnienia
  od aktualnego stanu, żeby dokumenty operacyjne nie puchły.
- **Osobny plik na pułapki i diagnostykę** danego panelu — inaczej te same
  mylące zachowania UI wracają jako te same pytania w kolejnych sesjach.
- **Dokumentacja aktualizowana w tym samym zadaniu**, w którym zaszła istotna
  zmiana, zanim zaraportujesz zakończenie pracy.
- **Import / plik konfiguracyjny zamiast ręcznego klikania w UI**, gdy narzędzie
  to wspiera (CSV do edytora kampanii, JSON do GTM) — szybciej i mniej błędów.
  Ręcznie tylko tam, gdzie import jest niemożliwy.
