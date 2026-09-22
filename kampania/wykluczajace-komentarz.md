# Lista wykluczających — wersja z komentarzem

To ten sam materiał co `wykluczajace.txt` (56 fraz), z podziałem na
kategorie i uzasadnieniem. Do wklejenia używać wyłącznie
`wykluczajace.txt` — ten plik ma komentarze, które Google potraktowałby
jako realne frazy wykluczające.

Lista wgrywana **na poziomie konta** (Narzędzia → Zasoby wspólne →
Listy wykluczających słów kluczowych), w dopasowaniu do wyrażenia, przed
włączeniem kampanii. Nowe kampanie nie dziedziczą jej automatycznie —
trzeba zastosować jawnie.

## Uwaga krytyczna

Żadna z poniższych fraz nie blokuje dobrego ruchu. W szczególności
**celowo NIE ma na liście**: `zlecę stronę`, `szukam kogoś do zrobienia
strony`, `ile kosztuje strona`, `cennik stron internetowych`,
`freelancer`, `web design`, `wordpress` (bez dopisku) — to zapytania,
które mogą prowadzić do klienta tej kampanii, nie do wykluczenia.

## 1. Praca i rekrutacja

Intencja: osoba szuka zatrudnienia lub zlecenia dla siebie jako
wykonawcy pracującego dla kogoś innego, nie klienta zlecającego stronę.

`praca` · `zatrudnię` · `zatrudnienie` · `oferty pracy` · `praca zdalna`
· `praca dla webmastera` · `rekrutacja` · `cv`

## 2. Kursy, nauka, studia

Intencja: chce się nauczyć zawodu/umiejętności, nie zlecić usługę.

`kurs tworzenia stron` · `kurs html` · `kurs programowania` · `nauka
programowania` · `nauka html` · `szkolenie z tworzenia stron` · `studia
informatyczne` · `uczelnia informatyka`

## 3. Darmowe, kreatory, szablony

Intencja: szuka gotowego rozwiązania do samodzielnego postawienia
strony (Wix, WordPress za darmo, szablon), nie projektu na zamówienie.
Frazy są celowo skonkretyzowane do kolokacji („darmowa strona
internetowa", „gotowy szablon strony"), a nie pojedynczych słów typu
„darmowa"/„za darmo" — te same słowa mogą występować w dobrych
zapytaniach (np. o bezpłatną wycenę), więc bare tokeny zostały pominięte.

`darmowa strona internetowa` · `strona internetowa za darmo` · `darmowy
kreator stron` · `kreator stron internetowych` · `kreator www` · `wix`
· `wordpress za darmo` · `szablon strony internetowej` · `gotowy
szablon strony` · `template strony internetowej` · `darmowe szablony
stron`

## 4. DIY i tutoriale

Intencja: chce zrobić stronę samodzielnie, szuka instrukcji, nie
wykonawcy.

`jak zrobić stronę internetową` · `jak zrobić stronę` · `jak stworzyć
stronę internetową` · `html tutorial` · `tutorial html` · `poradnik
tworzenie stron` · `strona internetowa krok po kroku` · `jak samemu
zrobić stronę`

## 5. Usługi pokrewne — DO REWIZJI

Intencja: szuka usługi sąsiedniej, nie „strony internetowej" jako
projektu graficzno-programistycznego. Wykluczone **wyłącznie dlatego,
że nie potwierdzono w PRODUCT.md ani PLAN.md**, czy reklamodawca te
usługi świadczy w ramach tej kampanii — nie dlatego, że na pewno ich nie
robi.

`hosting` · `hosting stron internetowych` · `tani hosting` · `domena
internetowa` · `rejestracja domeny` · `pozycjonowanie stron` · `seo` ·
`agencja seo` · `sklep internetowy` · `sklep online` · `aplikacja
mobilna` · `tworzenie aplikacji mobilnych`

**Jeśli reklamodawca potwierdzi, że wykonuje którąkolwiek z tych
usług** (np. stawia hosting klientom, robi sklepy internetowe na
Shopify/WooCommerce, robi SEO) — usunąć odpowiednie frazy z listy, bo
inaczej kampania sama sobie blokuje płatny ruch.

## 6. Oprogramowanie i narzędzia

Intencja: szuka konkretnego narzędzia/programu do kupienia lub pobrania,
nie usługi wykonania strony.

`figma` · `photoshop` · `canva` · `elementor` · `wordpress plugin` ·
`wtyczka wordpress`

## 7. B2B / przetargi

Intencja: zamówienia publiczne i przetargi wymagają formalnej rejestracji
i dokumentacji przetargowej wykraczającej poza zakres jednoosobowej
działalności reklamowanej w tej kampanii, a bywają drogie w kliknięciu.

`przetarg` · `zamówienie publiczne` · `zapytanie ofertowe przetarg`

## Co świadomie NIE trafiło na listę

- **Nazwy miast** — kampania celuje w całą Polskę (patrz PLAN.md), więc
  szablonowa sekcja „poza obszarem działania" z `references/wykluczajace.md`
  tu nie ma zastosowania.
- **Frazy o cenie** (`ile kosztuje strona`, `cennik`) — to jest
  dopuszczona intencja zakupowa, częściowo zaadresowana wprost w
  `slowa-kluczowe.md` (grupa „Strona dla firmy").
- **`zlecę`** w żadnej formie — to jest nasz klient, nie osoba szukająca
  pracy dla siebie.
