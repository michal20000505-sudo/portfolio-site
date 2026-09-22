---
name: reklama-meta-ads
description: Kampanie Meta Ads (Facebook/Instagram) dla małej firmy usługowej — konfiguracja Business Managera i piksela, struktura kampanii i budżety, kreacje i teksty, rozruch fanpage'a. Użyj, gdy użytkownik planuje lub prowadzi reklamy na Facebooku/Instagramie, przygotowuje kreacje do feedu lub Reels albo pyta, czy już warto wejść w Meta obok Google Ads.
---

# Meta Ads dla małej firmy usługowej

## 1. Kiedy w ogóle wchodzić w Meta

Przy małym budżecie testowym cały budżet idzie w kanał z gotową intencją
zakupową (np. Google Search), a nie rozdziela się między systemy.

**Arytmetyka:** budżet testowy 500 zł / 20 dni = 25 zł/dzień. Podzielone na
dwa systemy dałoby po 12,50 zł/dzień — poniżej progu, przy którym
którykolwiek system zbierze rozstrzygające dane. Jeden rozstrzygający test
bije dwa połowiczne.

Meta wymaga „przypomnienia" potrzeby (użytkownik nie szuka aktywnie) — to
droższa i wolniejsza droga niż search. Nie nadaje się na pierwszy,
najmniejszy budżet testowy.

**Warunki wejścia w Meta (wszystkie razem):**

| Warunek | Próg |
|---|---|
| Budżet miesięczny całości reklamy | 1000–1500 zł/mc |
| Udział samej Meta | 300–500 zł/mc |
| Proporcja jako punkt wyjścia | ok. 60–70% search / 30–40% Meta, do korekty |
| Materiał | minimum 10 par prawdziwych zdjęć „przed/po" |
| Piksel | zainstalowany z historią ruchu, nie od zera |

**Reguła twarda:** nie dzielić małego budżetu testowego między dwa systemy.
Jeśli klient mimo wszystko nalega na test na obu kanałach jednocześnie przy
za małym budżecie — zapisać to jako ustępstwo polityczne, nie decyzję
optymalizacyjną, z jasnym zastrzeżeniem, że żaden z dwóch testów nie będzie
rozstrzygający.

**Nie startuj Meta, dopóki nie ma prawdziwych zdjęć/wideo z realizacji.**
Materiał generatywny/poglądowy ze strony nie wolno używać w płatnych
materiałach — reklama pokazująca coś, czego firma faktycznie nie zrobiła,
wprowadza w błąd, i pierwszy kontakt kończy się tłumaczeniem rozbieżności.

## 2. Search vs Social

| | Search (Google) | Social (Meta) |
|---|---|---|
| Co sprzedaje | fraza / dopasowanie do zapytania | obraz/kreacja |
| Rola tekstu | główna | podpis do obrazu |
| Konwersja | szybka, ta sama wizyta | rozłożona w czasie, po kilku kontaktach |
| Transfer treści między kanałami | — | nic nie kopiować 1:1 |

**Zakaz przenoszenia tekstów 1:1.** Nagłówek pod frazę wyszukiwania jest
niewidzialny w feedzie społecznościowym — działa tylko wtedy, gdy ktoś już
tę frazę wpisał. Na Meta nikt niczego nie wpisał, więc ten sam nagłówek nie
ma kontekstu, do którego by pasował.

## 3. Konfiguracja

### Business Manager
- Konto firmowe na business.facebook.com, nigdy z profilu prywatnego.
- Waluta i strefa czasowa konta reklamowego **nie do zmiany później** —
  ustawić poprawnie od razu (dla PL: PLN, Europe/Warsaw).
- Klient jako właściciel strony i konta reklamowego, agencja/wykonawca jako
  administrator — zasób ma zostać u klienta po zakończeniu współpracy.
- Włączyć 2FA od razu. Wzięło się z: Meta blokuje konta bez ostrzeżenia, a odzyskiwanie potrafi trwać tygodniami.
- Fanpage jest wymagany, żeby uruchomić jakąkolwiek reklamę — reklama zawsze wychodzi z jakiejś strony.
- CTA na fanpage'u przy usługach lokalnych: „Zadzwoń", nie „Wyślij
  wiadomość" — telefon konwertuje wyraźnie lepiej.
- Dane kontaktowe na fanpage'u identyczne z witryną i wizytówką Google.

### Weryfikacja domeny
- Bez zweryfikowanej domeny nie da się skonfigurować priorytetów zdarzeń (Aggregated Event Measurement) → nie policzysz konwersji z iOS (spora część ruchu mobilnego). Zrobić wcześnie, zanim jest to pilne.
- Metoda: meta tag w `<head>` (najprostsza przy własnym kodzie) lub plik HTML w katalogu publicznym.
- Weryfikuj domenę **bez `www`** — obejmuje subdomeny, więc wersja
  kanoniczna z `www` jest automatycznie pokryta.

### Piksel i zdarzenia
- Piksel na stronie od pierwszego dnia jakiegokolwiek ruchu płatnego (np.
  z Google Ads), żeby kolejna faza (leadowa/remarketing) zaczynała od
  gotowej bazy, a nie od zera.
- Wdrażać przez GTM, nie wklejać kodu piksela bezpośrednio do strony.
- Piksel musi respektować banner zgód — odpalać się dopiero po zgodzie
  marketingowej (Consent Mode).
- Priorytety zdarzeń w AEM (max 8 zdarzeń na domenę, tu użyto 3):

| Priorytet | Zdarzenie | Przykład |
|---|---|---|
| 1 | `Lead` | wysłanie formularza |
| 2 | `Contact` | klik w `tel:` |
| 3 | `PageView` | automatyczne |

- Testować zawsze Testerem zdarzeń, z telefonu i desktopu osobno.

### Conversions API (CAPI) — kiedy w ogóle
- Na statycznych/eksportowanych stronach bez API Routes standardowa
  serwerowa integracja CAPI odpada. Jeśli istnieje jakikolwiek serwerowy
  endpoint obsługujący formularz, to jedyne sensowne miejsce na wysyłkę
  zdarzenia `Lead` server-side.
- Klik w `tel:` jest zdarzeniem czysto przeglądarkowym — nie da się go
  wysłać przez CAPI tą drogą.
- **Reguła progu:** przy małej skali (kilkanaście–kilkadziesiąt
  konwersji/mc) sam piksel przeglądarkowy wystarczy. Nie inwestować w CAPI
  przed fazą ze zdecydowanie większym budżetem/wolumenem.

### Polityka prywatności — twardy bloker
- Musi istnieć przed uruchomieniem Lead Ads — URL polityki to pole
  obowiązkowe w formularzu natychmiastowym Meta.
- Bez formy prawnej, NIP-u i adresu firmy nie da się jej napisać. To bloker,
  nie zadanie do zrobienia „przy okazji".

## 4. Struktura kampanii i budżety

### Kampania 1 — zimne dotarcie
- Cel „Leady", budżet na poziomie kampanii (CBO).
- Lokalizacja: miasto + promień dojazdu, opcja „Osoby mieszkające w tej
  lokalizacji" (nie „ostatnio odwiedzające").
- Wiek szeroki (np. 30–65+), płeć wszyscy.
- Umiejscowienia automatyczne (Advantage+).
- **Bez zainteresowań jako targetowania.** Wzięło się z: przy małej grupie
  geograficznej i małym budżecie każda warstwa zawężenia podnosi
  częstotliwość — te same osoby widzą reklamę kilka razy w tydzień,
  kreacja wypala się w kilka dni. Algorytm przy szerokiej grupie sam
  znajdzie podobnych do konwertujących.

### Lead Ads vs ruch na stronę

| | Lead Ads (formularz w systemie) | Ruch na stronę + zdarzenie |
|---|---|---|
| Liczba leadów | więcej | mniej |
| Jakość leadów | niższa — klika się odruchowo | wyższa — lepiej dobrani |
| Wymóg | URL polityki prywatności | działający piksel |

**Rekomendacja przy jednoosobowej/małej firmie usługowej: ruch na stronę.**
Powód: właściciel nie odda rady oddzwaniać do wielu przypadkowych kliknięć
z formularza natychmiastowego.

Jeśli mimo to Lead Ads:
- wariant formularza „Wyższa jakość" (dodaje ekran potwierdzenia), nie
  „Większa liczba leadów",
- jedno pytanie kwalifikujące (kategoria usługi) + pytanie o
  lokalizację/dojazd,
- oddzwanianie w ciągu godziny — lead z social stygnie szybciej niż lead
  z search, bo osoba nie szukała świadomie.

### Kampania 2 — remarketing
- Najtańsze konwersje w systemie, ale wymaga zgromadzonego ruchu.
- Okno odbiorców: odwiedzający witrynę z ostatnich **90 dni**, z
  wykluczeniem osób, które już wykonały zdarzenie konwersji (Lead).
- Inny przekaz niż w kampanii zimnej — odbiorca już zna markę, nie
  przedstawiać jej drugi raz.
- **Próg uruchomienia: grupa odbiorców > ~1000 osób.** Poniżej tego Meta
  nie ma komu wyświetlać i budżet stoi w miejscu.

### Ile zestawów i kreacji
- **Nie mnożyć zestawów reklam** przy małym budżecie. Przy ~300 zł/mc:
  jeden zestaw na kampanię, z 3–4 kreacjami w środku.
- Wzięło się z: rozbicie na wiele małych zestawów oznacza, że żaden nie
  wyjdzie z fazy uczenia się — orientacyjnie Meta potrzebuje ~50
  konwersji/tydzień na zestaw, żeby uczyć się w pełni.

### Częstotliwość — metryka do stałego monitoringu
- Dodać kolumnę Częstotliwość do raportu.
- **Powyżej 2,5–3,0 koszt konwersji zaczyna rosnąć skokowo.**
- Przy ~2,0 zacząć przygotowywać kolejną partię kreacji — nie czekać, aż
  wzrośnie. Trzymać stale 2–3 nieużyte kreacje w zapasie.

## 5. Kreacje

### Wymagania wobec zdjęć
- Minimum **10 par „przed/po"** z prawdziwych realizacji jako punkt
  wyjścia.
- Zdjęcia z telefonu w zupełności wystarczą — autentyczność bije jakość
  techniczną. Wypolerowany render przewija się w feedzie jak reklama,
  zwykłe zdjęcie zatrzymuje wzrok.
- **„Przed" i „po" z tego samego miejsca i pod tym samym kątem** — to cała
  siła formatu i najczęstszy błąd wykonawczy. Instrukcja dla klienta:
  stanąć w jednym punkcie przed robotą, zrobić zdjęcie, po robocie wrócić
  dokładnie tam samo.
- Kadr poziomy i pionowy osobno — przycięcie poziomego do 9:16 wycina
  połowę kadru.
- Ujęcia ekipy przy pracy w odzieży ze znakiem firmowym; twarz nie musi być
  widoczna.
- Zgoda właściciela nieruchomości na publikację, jeśli widać dom/adres.

### Zasada: tylko prawdziwe zdjęcia w płatnych materiałach
W płatnych materiałach wolno używać **wyłącznie** prawdziwych zdjęć
z realizacji. Grafiki/wideo generatywne, nawet jeśli używane na stronie
jako materiał poglądowy, są zakazane w reklamach płatnych. To zasada
twarda, nie stylistyczna: promowanie materiału poglądowego za pieniądze
zamienia go w domniemaną obietnicę realizacji.

### Formaty i rozmiary

| Umiejscowienie | Rozmiar | Priorytet |
|---|---|---|
| Reels/Stories | 1080×1920 (9:16) | najwyższy — obecnie najtańsze zasięgi |
| Feed (kwadrat) | 1080×1080 (1:1) | wysoki |
| Feed poziomy | 1200×630 | niski |

- Napisy na grafice nakładać samodzielnie, nie generatorem obrazu AI —
  modele psują polskie znaki diakrytyczne (w PL najczęściej „Ł"). Z AI brać
  tylko samo zdjęcie/tło.
- Minimum tekstu na obrazie. Formalny limit 20% tekstu został przez Meta
  zniesiony, ale system nadal gorzej dostarcza kreacje „zapchane" napisami.
- Numer telefonu w stałym miejscu na każdej grafice, logo dyskretnie
  w rogu.

### Ile wariantów i czym się mają różnić
- **3–4 warianty na zestaw reklam.** Mniej — algorytm nie ma czego
  testować. Więcej — przy małym budżecie żaden wariant nie zbierze
  wystarczających danych.
- Warianty muszą różnić się **obrazem**, nie przecinkiem w tekście. Wzięło
  się z: cztery zdjęcia tej samej realizacji to jedna kreacja w czterech
  kopiach, nie cztery kreacje.
- Przykładowy zestaw: (A) przed/po jako jeden obraz z podziałem,
  (B) karuzela 3–4 par przed/po z różnych zleceń, (C) Reels 9:16 — krótki
  montaż przejścia przed→po, (D) pojedyncze mocne zdjęcie efektu
  końcowego.

## 6. Teksty

- Nagłówek: ok. **40 znaków** (dłuższy jest ucinany).
- Tekst główny: bez twardego limitu, ale po **~125 znakach** pojawia się
  „Zobacz więcej" — cały hak/haczyk musi zmieścić się przed tym punktem.
- **Język neutralny płciowo** w formach czasu przeszłego: unikać form typu
  „widziałeś/widziałaś" (wyklucza połowę odbiorców), używać czasu
  teraźniejszego i form bezosobowych.
- Najmocniejszy przekaz przy szerokim zakresie usług: „jedna firma ogarnia
  całość" — trafia też w odbiorców, którzy nie szukają akurat konkretnej
  pojedynczej usługi, więc działa szerzej niż komunikat o jednej usłudze.
- Remarketing wymaga innego przekazu niż kampania zimna — odbiorca już zna
  markę, nie przedstawiać jej od nowa.
- Sezonowość: dopasować usługę na pierwszym planie do miesiąca/pory roku.
  Kampanie o gwałtownym, krótkotrwałym popycie (np. odśnieżanie)
  przygotować z wyprzedzeniem i włączyć w dniu wyzwalającego zdarzenia —
  popyt eksploduje na ok. 48h, firmy reagujące po fakcie tracą cały szczyt.

**Czego nie wolno obiecywać** (dopóki fakt nie jest jawnie potwierdzony
przez właściciela biznesu):
- cen, widełek, „od X zł",
- nieuzgodnionych sformułowań typu „bezpłatna wycena",
- terminów realizacji i gwarancji,
- superlatywów bez pokrycia: „najlepsi", „nr 1", „X lat doświadczenia",
- opinii klientów bez potwierdzonej zgody,
- zdjęć generatywnych/stockowych podpisanych jako realizacje własne.

## 7. Fanpage — co musi być gotowe przed startem

- [ ] Fanpage założony, z kategorią zgodną z branżą.
- [ ] Zdjęcie profilowe i cover w prawidłowych proporcjach; cover wymaga
      szczególnej ostrożności — desktop i mobile przycinają go
      w przeciwne strony.
- [ ] Dane kontaktowe identyczne ze stroną www i wizytówką Google.
- [ ] CTA odpowiednie dla kanału konwersji (telefon przy usługach
      lokalnych).
- [ ] Kilka postów opublikowanych przed startem reklam. Wzięło się z: pusty
      fanpage, na który trafia ruch z reklamy, obniża zaufanie bardziej,
      niż reklama je buduje.
- [ ] Polityka prywatności opublikowana (wymagana przez formularze Lead
      Ads).

## 8. Kampania rozruchowa (zasięg, nie leady)

Osobna, mała kampania (np. 100 zł/mc) może celowo **nie** być kampanią
leadową, tylko wolną promocją postów — żeby profil nie był pusty, gdy
trafia na niego ruch z innego, płatnego kanału.

**To jedyny legalny wyjątek od reguły „nie klikaj Promuj post" z sekcji 9.**
Bo tu cel to zasięg/zaangażowanie, nie leady — więc podbicie posta jest
właściwym narzędziem, a nie sprzedażowym błędem.

### Sekwencja obowiązkowa
1. Zebrać materiał (zdjęcia/wideo z realizacji).
2. Zrobić z niego 3–5 postów.
3. Wypuścić organicznie na ok. tydzień, zebrać reakcje.
4. Dopiero teraz promować 1–2 posty, które poszły najlepiej.

Krok 3 nie jest formalnością — post z organicznym odzewem po podbiciu
radzi sobie wyraźnie lepiej.

### Jak wydawać
- Rozłożone w czasie (np. 3 zł/dzień przez 30 dni), nie w kilka dni —
  stała, powtarzalna obecność w lokalnym feedzie bije jednorazowy błysk.
- Promować 1–2 posty, które najlepiej poszły organicznie — płaci się za
  wzmocnienie czegoś, co już działa, zamiast testować kreację za
  pieniądze.
- Cel kampanii: zaangażowanie/wyświetlenia, **nie** „wiadomości" ani
  „leady".
- **Nie mierzyć takiej kampanii kosztem leada** — to nie jest jej KPI,
  nawet jeśli przypadkowo wygeneruje kontakt.

Zdjęcia/materiał, który zebrał reakcje w takiej mini-kampanii, nadaje się
potem na kreacje właściwej fazy leadowej — ma już przetestowany obraz.

## 9. Czego nie robić

- Nie klikać „Promuj post" ze strony fanpage'a jako narzędzia
  sprzedażowego — tworzy kampanię na zaangażowanie, optymalizowaną pod
  lajki (tanie i bezwartościowe zdarzenie). Wyjątek: sekcja 8.
- Nie ustawiać celu „Ruch" myśląc, że da tańsze wejścia — system dowiezie
  ruch od klikaczy wszystkiego, bez konwersji.
- Nie edytować aktywnego zestawu reklam (budżet, grupa, kreacja) — resetuje
  fazę uczenia się. Zamiast edycji: zduplikować i wyłączyć stary.
- Nie wyłączać kreacji po 2 dniach — system rozdziela wyświetlenia
  nierówno, pozornie martwa kreacja bywa po prostu niedostatecznie
  pokazana.
- Nie przenosić treści/nagłówków między kanałami o innej intencji (search
  vs social) — patrz sekcja 2.
- Nie startować Meta bez prawdziwych zdjęć/wideo z realizacji — patrz
  sekcja 1.
- Nie obiecywać w tekstach reklam faktów niepotwierdzonych przez
  właściciela biznesu — patrz sekcja 6.

## 10. Powiązane skille

- `reklama-strategia` — próg wejścia w kanał, KPI fazy testowej, rejestr
  leadów, pytania blokujące do klienta.
- `reklama-pomiar` — piksel przez GTM, weryfikacja zdarzeń, Consent Mode.
- `reklama-google-ads` — konfiguracja Search jako pierwszego, rozstrzygającego
  kanału testowego.
