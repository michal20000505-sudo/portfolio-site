# Lista wykluczających słów kluczowych — szablon

Wgrywana jako **lista na poziomie konta** (Narzędzia → Zasoby wspólne →
Listy wykluczających słów kluczowych), w **dopasowaniu do wyrażenia**
(ścisłe wykluczające nie łapią odmian fleksyjnych). Wgrywać **przed**
włączeniem kampanii i stosować jawnie do każdej nowej kampanii — nowe
kampanie nie dziedziczą listy automatycznie.

Poniższe kategorie i frazy to szablon wielokrotnego użytku — podmień
nazwy usług/branży na własne, zachowaj logikę intencji.

## 1. Praca i szkolenia

Intencja: osoba szuka zatrudnienia albo kursu, nie usługi do zlecenia.

- `"praca"`
- `"zatrudnię"`
- `"zatrudnienie"`
- `"oferty pracy"`
- `"praca dodatkowa"`
- `"kurs"`
- `"szkolenie"`
- `"szkolenia zawodowe"`
- `"ile zarabia"`
- `"stawka za m2"`
- `"stawka godzinowa"`
- `"jak zostać"`
- `"zawód"`

## 2. Materiały, nie usługa

Intencja: szuka produktu do kupienia/sprzedania, nie wykonawcy usługi.

- `"sprzedam"`
- `"kupię"`
- `"hurtownia"`
- `"cennik kostki"`
- `"cena za m2 materiał"`
- `"castorama"`
- `"leroy merlin"`
- `"obi"`
- `"libet"`
- `"polbruk"`
- `"bruk-bet"`
- `"olx"`
- `"allegro"`
- `"sklep budowlany"`

## 3. Zrób to sam (DIY)

Intencja: chce zrobić samodzielnie, nie zlecić.

- `"jak ułożyć"`
- `"jak zrobić"`
- `"samodzielnie"`
- `"własnymi rękami"`
- `"poradnik"`
- `"instrukcja"`
- `"krok po kroku"`
- `"diy"`
- `"forum"`
- `"film instruktażowy"`
- `"ile kosztuje materiał"`

## 4. Sprzęt

Intencja: szuka wynajmu lub zakupu narzędzia/maszyny, nie usługi wykonania.

- `"wypożyczalnia"`
- `"wynajem sprzętu"`
- `"zagęszczarka"`
- `"myjka ciśnieniowa"`
- `"karcher"`
- `"sprzęt"`
- `"maszyna do"`
- `"narzędzia"`
- `"kompresor"`
- `"agregat"`

## 5. Poza obszarem działania

Intencja: miasta/regiony poza realnym zasięgiem — mimo poprawnego
geotargetowania ktoś lokalnie może szukać usługi dla rodziny w innym
mieście. Wpisać konkretne nazwy miast spoza zasięgu, np.:

- `"warszawa"`
- `"kraków"`
- `"poznań"`
- `"gdańsk"`
- `"katowice"`
- `"łódź"`
- `"szczecin"`
- `"lublin"`
- `"bydgoszcz"`
- `"rzeszów"`

## 6. Chemia i produkty (branżowo specyficzne)

Intencja: przykład dla kategorii typu czyszczenie/pielęgnacja — szuka
środka do kupienia, nie usługi. Dostosować pod własną branżę.

- `"środek"`
- `"preparat"`
- `"jaki impregnat"`
- `"środek do czyszczenia"`
- `"chemia budowlana"`
- `"gdzie kupić środek"`

## 7. B2B i zamówienia publiczne

Intencja: nieobsługiwalne bez rejestracji działalności i faktur VAT,
a bywają drogie w kliknięciu. Utrzymać tylko dopóki firma nie jest
zarejestrowana — potem usunąć całą kategorię (patrz Pułapki niżej).

- `"faktura vat"`
- `"przetarg"`
- `"zamówienie publiczne"`
- `"wspólnota mieszkaniowa"`
- `"zarządca nieruchomości"`
- `"podwykonawca"`
- `"współpraca b2b"`
- `"generalny wykonawca"`

## Zasady utrzymania listy

- Raport wyszukiwanych haseł sprawdzać **codziennie przez pierwszy
  tydzień** kampanii, potem co 2–3 dni przez resztę testu — to jedyna
  czynność, która w pierwszym tygodniu realnie obniża koszt leada.
- Każde hasło bez intencji zakupowej → dopisać do listy na **poziomie
  konta**, nie kampanii.
- Hasła, które konwertują, a nie ma ich jako frazy → dodać jako osobne
  słowo kluczowe w dopasowaniu ścisłym.
- Nowe kampanie **nie dziedziczą automatycznie** listy konta — po
  dodaniu kampanii trzeba jawnie zastosować do niej listę.
- Jedno niewykluczone hasło potrafi zjeść dzienny budżet w godzinę —
  traktować lukę w liście jak realny koszt, nie kosmetykę.

## Pułapki

- **Nie wykluczać samych słów typu „darmowa"/„za darmo"/„gratis"**,
  jeśli usługa faktycznie ma darmowy element (np. bezpłatna wycena) —
  to może być jedno z najlepszych zapytań. Wykluczać tylko konkretne
  kolokacje o darmowym **materiale** (np. „kostka za darmo", „gruz za
  darmo").
- **Marki producentów materiału** w branży generują ruch osób
  szukających materiału, nie wykonawcy — jedno z najdroższych
  nieporozumień branżowych. Wymaga wykluczenia każdej znanej marki
  osobno, nie jednej ogólnej frazy.
- **Nazwa popularnego sprzętu** (np. marka myjki ciśnieniowej) jest
  obowiązkowym wykluczeniem przy kampanii typu „czyszczenie/usługa
  wykonywana sprzętem" — spora część wyszukiwań to ludzie szukający
  sprzętu do kupienia/wypożyczenia, nie usługi.
- **Rozszerzenie promienia dojazdu wymaga przeglądu listy miast.** Gdy
  klient potwierdzi szerszy promień niż wcześniej zakładany, trzeba
  usunąć z listy wykluczających miasta, które teraz mieszczą się w
  zasięgu — inaczej sam sobie blokujesz właściwy ruch.
- **Segment B2B wykluczyć tylko tymczasowo.** Po rejestracji
  działalności usunąć sekcję 7 z listy — bywa najbardziej dochodowym
  segmentem branży, a zostaje zablokowana tylko dlatego, że nikt nie
  wrócił do listy po formalnościach.
- **Usługi regulowane prawnie bez potwierdzonych uprawnień** trzeba
  wykluczyć też w innych, pokrewnych kampaniach, nie tylko w tej, gdzie
  dana grupa jest wstrzymana — inaczej ruch wpada tam bokiem przez
  pokrewne frazy.
