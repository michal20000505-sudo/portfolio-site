# Kampania Google Ads — portfolio Michał Jarosiński

> Plan fazy testowej. Reguły, z których wynikają te liczby, są w
> [`../skills/reklama-strategia`](../skills/reklama-strategia/SKILL.md)
> i [`../skills/reklama-google-ads`](../skills/reklama-google-ads/SKILL.md).

## Decyzje wejściowe (potwierdzone 2026-09-22)

| Parametr | Wartość |
|---|---|
| Budżet miesięczny | 300–600 zł → **przyjęte 450 zł/mc** |
| Zasięg | **cała Polska** |
| Usługa | **strony internetowe** (pierwsza i jedyna kategoria w tej fazie) |
| Pomiar | **brak** — świadome ustępstwo klienta, nie decyzja optymalizacyjna |

## Arytmetyka budżetu

- 450 zł / 30 dni = **15 zł/dzień**. Limit miesięczny rozliczany przez Google:
  15 × 30,4 = **456 zł**.
- Spodziewany CPC w kategorii „strony internetowe", cała Polska: **3–8 zł**
  (kategoria z jedną z najdroższych aukcji w polskim B2B — licytują się agencje
  z budżetami o rząd wielkości większymi).
- Próg z `reklama-strategia`: minimum 3 × CPC i nie mniej niż 10 zł/dzień.
  Przy CPC ~5 zł próg wynosi 15 zł. **Budżet starcza dokładnie na jedną
  kampanię.** Rozbicie na dwie po 7,50 zł oznaczałoby dwie kampanie, które nie
  wyświetlą się wcale.
- Limit CPC na start: **4,50 zł**. Do korekty po 3 dniach wg udziału
  w wyświetleniach (< ~20% → podnosimy CPC, nie budżet).
- Spodziewany wolumen: **~60–100 kliknięć miesięcznie**, czyli 2–3 dziennie.
  Nie 100 dziennie. Po czterech godzinach emisji zero kliknięć to norma.

## Czym jest sukces tej fazy

**Nie CPL.** Wartość jednego zlecenia na stronę internetową to kilka tysięcy
złotych, więc **jedno zamówienie spłaca kilka–kilkanaście miesięcy budżetu**.
Właściwe pytanie po miesiącu brzmi: ile realnych zapytań przyszło i czy były
z segmentu, który stać na indywidualny projekt — nie „ile kosztowało kliknięcie".

Ponieważ nie ma pomiaru, jedynym rejestrem jest **ręczna notatka przy każdym
mailu i telefonie**: data, skąd trafił („szukałem w Google?"), czego dotyczy,
czy wszedł w wycenę. Bez tego po miesiącu zostaną same liczby o kliknięciach.

## Pozycjonowanie kampanii — dlaczego nie head terms

`tworzenie stron internetowych` i `strony internetowe` to najdroższe frazy
w tej kategorii. Przy 15 zł/dzień jedno kliknięcie na takiej frazie potrafi
zabrać jedną trzecią dnia, a intencja jest tam najbardziej rozstrzelona
(od „chcę stronę za 500 zł" po korporacyjny przetarg).

Kampania celuje **obok head terms**, w trzy przewagi, które da się potwierdzić
faktami z `PRODUCT.md`:

1. **Jedna osoba zamiast agencji** — rozmowa bezpośrednio z wykonawcą.
2. **Projekt autorski, nie szablon** — realna różnica wobec ofert z kreatorów.
3. **Projekt graficzny i kod w jednym miejscu** — web + branding + DTP.

Fakty, których **nie wolno** użyć, dopóki ich nie potwierdzisz: cena i widełki,
terminy realizacji, gwarancje, liczba zrealizowanych projektów, „bezpłatna
wycena", opinie klientów.
Fakty potwierdzone i dopuszczone do tekstów: **aktywność od 2014 roku**,
**praca jednoosobowa**, **zakres: web / branding / grafika / gamedev**.

## Struktura

Kampania: **`MJ | Search | Strony WWW`**
Sieć: tylko wyszukiwarka. Partnerzy i sieć reklamowa **odznaczone**.
Strategia: maksymalizacja kliknięć + limit CPC 4,50 zł.

| Grupa reklam | Rola | Stawka | Intencja |
|---|---|---|---|
| `Strona dla firmy` | trzon budżetu | 4,50 zł | firma szuka wykonawcy strony |
| `Projekt indywidualny` | przewaga konkurencyjna | 4,00 zł | ktoś świadomie odrzuca szablony i kreatory |

Dwie grupy, nie pięć — przy 60–100 kliknięciach miesięcznie trzecia grupa
zabiera dane pozostałym, zamiast dokładać własne.

Dopasowania: **wyłącznie ścisłe i do wyrażenia. Zero broad.**

## Geo i harmonogram

- Lokalizacja: **Polska**, opcja lokalizacji **„Obecność"** (nie „Obecność lub
  zainteresowanie" — to domyślna wartość Google i najczęstszy błąd).
- Przy kierowaniu na cały kraj nie ma kotwicy promienia, więc pułapka
  z Profilem Firmy nie występuje. Gdyby kiedyś doszło zawężenie do miasta —
  kotwiczyć w nazwie miasta i sprawdzić niebieski okrąg na mapie.
- Harmonogram: **brak ograniczeń — 7 dni w tygodniu, całą dobę.**
  Reguła „harmonogram = godziny odbierania telefonu" pochodzi z kampanii,
  w której konwersją był telefon: nieodebrane połączenie to stracony lead
  i zapłacone kliknięcie. **Tutaj konwersją jest mail, czyli kanał
  asynchroniczny** — ktoś szukający wykonawcy o 23:00 spokojnie napisze
  i poczeka na odpowiedź rano. Obcinanie godzin byłoby wyrzuceniem części
  i tak niewielkiego wolumenu.
- Warunek, na którym to stoi: **odpisujesz następnego dnia roboczego.**
  Zapytanie z nocy, na które odpowiedź przychodzi po trzech dniach, jest
  stracone tak samo jak nieodebrany telefon.
- Konsekwencja dla rozszerzenia połączeń: numer w reklamie widoczny o 3:00
  zaprasza do telefonu o 3:00. **Rozszerzenie połączeń ma własny harmonogram**
  — ustaw w nim pon.–sob. 8:00–20:00, żeby reklama emitowała się non stop,
  ale klikalny numer pokazywał się tylko w godzinach, w których odbierasz.

## Strona docelowa

`https://<domena>/` — sekcja z realizacjami web jako kotwica.
**To kompromis, nie cel.** Ruch z fraz o stronach internetowych ląduje na
portfolio obejmującym też grafikę i gamedev i musi sam znaleźć swoją sekcję.
Obniża to jednocześnie Wynik Jakości (wyższy CPC) i konwersję.
Najtańsza dostępna optymalizacja tej kampanii to **dedykowana podstrona
o usłudze „strony internetowe"** — do zrobienia zaraz po starcie.

## Teksty reklam (RSA)

Limity: nagłówek ≤30 znaków (do 15 sztuk), opis ≤90 znaków (do 4 sztuk).
**Żadnego przypinania nagłówków. Zero numeru telefonu i e-maila w tekście** —
kontakt należy wyłącznie do rozszerzenia połączeń.

Komplet tekstów z przeliczonymi znakami: [`teksty-rsa.md`](teksty-rsa.md).

## Rozszerzenia

- **Objaśnienia**: Projekt Indywidualny · Bez Szablonów · Kontakt z Wykonawcą ·
  Web, Logo i Grafika · Praca od 2014 Roku
- **Linki do podstron**: kotwice strony głównej (realizacje web, grafika,
  kontakt, gra) — z osobnym tekstem i opisem per link.
- **Fragmenty rozszerzone**, typ „Usługi": Strony internetowe · Web design ·
  Branding · Identyfikacja wizualna · Projekty graficzne · DTP
- **Rozszerzenie połączeń**: numer ze strony, **własny harmonogram
  pon.–sob. 8:00–20:00** (kampania emituje non stop, ale numer pokazuje się
  tylko wtedy, gdy odbierasz). Dodawane ręcznie, wymaga weryfikacji numeru.
- **Ceny/Promocje**: nie dodajemy — cennik nie jest publiczny.

## Checklista przed włączeniem

- [ ] Sieć reklamowa i partnerzy wyszukiwania **odznaczeni**
- [ ] Opcja lokalizacji ustawiona na **„Obecność"**
- [ ] Harmonogram **pusty** — kampania emituje 7 dni w tygodniu, całą dobę
- [ ] Rozszerzenie połączeń ma własny harmonogram pon.–sob. 8:00–20:00
- [ ] Limit CPC 4,50 zł ustawiony na poziomie kampanii
- [ ] Budżet 15 zł — sprawdzone, że **dzienny**, nie miesięczny
- [ ] Lista wykluczających wgrana **na poziomie konta**, przed startem
- [ ] Wszystkie frazy w dopasowaniu ścisłym lub do wyrażenia, **żadnego broad**
- [ ] Automatyczne stosowanie rekomendacji **wyłączone**
- [ ] „Zasoby automatyczne" **wyłączone**
- [ ] Reklamy polityczne w UE: „nie zawiera"
- [ ] Rozszerzenie połączeń przetestowane na własnym telefonie
- [ ] Strona docelowa otwiera się i przewija do sekcji realizacji
- [ ] Notatnik na zapytania przygotowany (data / skąd / czego dotyczy / wycena)

## Pierwszy tydzień

Wolno **dokładnie dwie rzeczy**: codziennie czyścić raport wyszukiwanych haseł
i gasić pożary (odrzucona reklama, budżet wyczerpany o 10:00).

**Nie wolno**: zmieniać tekstów, dodawać fraz, przełączać strategii stawek,
wyłączać „słabych" fraz po dwóch dniach. Każda zmiana resetuje fazę uczenia się,
a przy 15 zł/dzień ledwo starcza danych na jedną taką fazę.

## Największe ryzyko tego planu

**Kategoria jest za droga na ten budżet.** Przy CPC 8 zł zamiast 5 zł kampania
dowiezie ~55 kliknięć miesięcznie i miesiąc skończy się bez rozstrzygnięcia —
tak jak test 10 kliknięć w dokumentacji źródłowej, który nie dał odpowiedzi
„nie działa", tylko „nie było na czym sprawdzić".

Reakcja, jeśli tak się stanie: **nie dokładać budżetu odruchowo.** Najpierw
zawęzić zasięg do jednego–dwóch dużych miast (niższy CPC, ta sama intencja),
a dopiero potem rozważać wyższą kwotę.
