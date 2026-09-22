---
name: reklama-pomiar
description: Pomiar konwersji dla kampanii reklamowych — GTM, GA4, Consent Mode v2, piksel Meta, konwersje w Google Ads i rejestr leadów. Użyj, gdy użytkownik wdraża lub weryfikuje śledzenie konwersji, konfiguruje GTM lub GA4, sprawdza dlaczego konwersje się nie rejestrują albo chce policzyć realną opłacalność kampanii.
---

# Pomiar konwersji dla kampanii reklamowych

## 1. Zasada nadrzędna

Pomiar działa **zanim** ruszy pierwsza złotówka budżetu reklamowego. Bez
działających konwersji nie da się świadomie wybrać strategii stawek (np.
maksymalizacja konwersji, tCPA) — algorytm optymalizowałby pod sygnał,
którego jeszcze nie ma, albo pod sygnał fałszywy. Kolejność jest sztywna:
najpierw pomiar, potem pierwsza kampania, nigdy odwrotnie.

## 2. Kolejność wdrożenia

**Kontener → strona → tagi → publikacja → weryfikacja.**

1. Utworzyć kontener GTM (konto + kontener typu „Sieć").
2. Wgrać identyfikator kontenera na żywą stronę (zmienna środowiskowa /
   build) i zdeployować.
3. Dopiero teraz konfigurować tagi, zmienne i wyzwalacze wewnątrz GTM —
   **podgląd GTM nie działa, dopóki kontener nie jest na żywej stronie**.
4. Opublikować kontener (nie tylko zapisać podgląd — patrz pułapki,
   sekcja 8).
5. Zweryfikować działanie w realtime GA4 i Testerze zdarzeń, osobno na
   telefonie i desktopie.

Fragment instalacyjny GTM pokazywany przy tworzeniu kontenera oraz okno
„Konfigurowanie tagu Google" (`gtag.js`) przy zakładaniu GA4 — **ignorować
oba**, jeśli kod ładowania kontenera i Consent Mode jest już zaszyty
w aplikacji. Wklejenie ich drugi raz daje podwójne zliczanie każdej
odsłony.

## 3. Zdarzenia konwersji dla biznesu lokalnego

Kluczowe zdarzenia: klik w numer telefonu (`tel:`) i wysłanie formularza
kontaktowego.

**Klik w telefon to konwersja równorzędna z formularzem, nie „miękkie
zdarzenie".** Przy usługach lokalnych telefon bywa dominującą ścieżką
kontaktu — zdegradowanie go do zdarzenia pomocniczego wyłącza z
optymalizacji to, co faktycznie generuje kontakty.

**GA4 „Pomiar zaawansowany" (enhanced measurement) NIE łapie kliknięć
`tel:`.** Powód: linki telefoniczne nie są kliknięciami wychodzącymi (nie
mają protokołu `http`), więc automatyczny mechanizm ich nie widzi.
Potrzebne jest własne zdarzenie niestandardowe (np. `klik_telefon`) z
**delegowanym nasłuchem obejmującym wszystkie miejsca występowania numeru
na stronie**: nagłówek, hero, przyklejony pasek mobilny, sekcja kontaktu,
FAQ, stopka. Pominięcie jednego miejsca = cicha dziura w danych, bo akurat
tamto miejsce generuje kontakty, o których nikt się nie dowie.

Przekazywać dodatkowy parametr typu **„miejsce"** ze zdarzeniem — pozwala
ustalić, które umiejscowienie CTA faktycznie generuje kontakty (np. czy
przyklejony pasek mobilny „zarabia" na miejsce na ekranie, czy jest tylko
kosmetyką).

Nazwy zdarzeń muszą być **identyczne co do znaku** między kodem (warstwa
danych / data layer) i konfiguracją w GTM — literówka oznacza, że
zdarzenie w ogóle się nie odpala, bez żadnego błędu widocznego w
konsoli.

## 4. Konwersje w Google Ads

**Wpinać własnym tagiem przez GTM, nie importem z GA4.** Powód: import
dokłada opóźnienie i warstwę modelowania danych; przy małej liczbie
konwersji miesięcznie (rząd kilkunastu) każde zniekształcenie jest widoczne
w wyniku i psuje ocenę testu.

Ustawienia konwersji telefonicznej i formularzowej:

| Parametr | Wartość | Dlaczego |
|---|---|---|
| Liczenie | **Jedna** (nie „Każda") | ten sam człowiek klika numer kilka razy, zanim zadzwoni; liczenie każdego kliknięcia zawyża wynik o kilkadziesiąt procent i algorytm goni ducha |
| Okno konwersji | **30 dni** | usługi lokalne mają dłuższy namysł niż e-commerce, ale nie miesiącami |
| Status | **Konwersja główna** | klik w `tel:` jest ścieżką dominującą — zdegradowanie do dodatkowej wyłącza go z optymalizacji stawek |
| Wartość | jednakowa, symboliczna (np. 1 zł), dopóki brak realnych danych | prawdziwe wartości wpisać dopiero, gdy klient poda średnią wartość zlecenia per kategoria |

Linkera konwersji (Google Ads → GTM) nie pomijać: bez niego `gclid` nie
trafia do ciasteczka i konwersja przychodzi bez informacji, z którego
kliknięcia pochodzi.

Konta reklamowe potrafią same dokładać działania konwersji (np. „Połączenia
z reklam" z przycisku w reklamie) jako główne z liczeniem „Każda" —
sprawdzić to ręcznie po pierwszym tygodniu i przestawić na dodatkowe/Jedna,
jeśli faktycznie nic jeszcze nie mierzą, żeby nie weszły do optymalizacji
w środku testu.

## 5. Consent Mode v2

- Domyślny stan zgód ustawiać na `denied` **synchronicznie, przed**
  załadowaniem GTM — w `<head>`, zanim GTM w ogóle wystartuje.
- **Nie blokować tagów warunkiem zgody.** Odruch mówi „zablokuj, dopóki nie
  ma zgody" — to psuje mechanizm. Consent Mode działa inaczej: tag ma się
  uruchamiać **zawsze**, a przy braku zgody sam wysyła bezciasteczkowy ping
  bez identyfikatora użytkownika. Zablokowany tag nie wyśle nawet tego —
  traci się nawet anonimową informację, że ktoś na stronie był.
- **Jeden CMP, nie dwa.** Nie włączać banera zgód (CMP) z poziomu GTM ani
  z wtyczki, jeśli baner zgód jest już częścią własnego kodu strony — dwa
  mechanizmy nadpiszą się nawzajem i popsują stany zgód.

## 6. Piksel Meta

- Wdrażać przez GTM, nie wklejać kodu piksela bezpośrednio do strony.
- Skonfigurować **Advanced Matching (AEM)** — wymaga zweryfikowanej domeny;
  bez tego priorytety zdarzeń są niedostępne i konwersje z iOS nie liczą
  się poprawnie.
- **Weryfikować domenę bez `www`** — obejmuje subdomeny, więc wersja
  kanoniczna z `www` jest automatycznie pokryta.
- Piksel musi respektować banner zgód — odpalać się dopiero po zgodzie
  marketingowej, tym samym mechanizmem Consent Mode co GA4.

## 7. Weryfikacja, że to działa

1. **Realtime GA4 najpierw.** Wejść na stronę, kliknąć numer telefonu — w
   ciągu kilkudziesięciu sekund zdarzenie powinno pojawić się w raporcie
   **czasu rzeczywistego**. Standardowe raporty („Zaangażowanie" →
   „Zdarzenia") zapełniają się z opóźnieniem **do 24 godzin** — pustka tam
   pierwszego dnia nie oznacza awarii.
2. **Tester zdarzeń Meta** — osobno dla piksela, tą samą logiką: sprawdzić,
   czy zdarzenie faktycznie dotarło, nie tylko czy formularz/klik zadziałał
   wizualnie.
3. **Telefon i desktop osobno.** Nasłuch na `tel:` bywa spięty inaczej
   z elementami mobilnymi (pasek przyklejony) niż desktopowymi — jedno
   środowisko może działać, drugie milczeć.
4. **Sieć komórkowa, gdy jest filtr IP.** Jeśli wykluczono własny ruch
   (adres IP) z raportów GA4, testować z sieci komórkowej, nie z tego
   samego Wi-Fi/IP, które filtr wyklucza — inaczej własny test też zniknie
   z raportów i wygląda jak brak działania.
5. **Opublikować, potem testować ponownie.** Podgląd i publikacja to dwa
   różne stany — patrz pułapki, punkt niżej.

## 8. Pułapki

- **Podgląd (preview) w GTM to nie publikacja.** Dopóki nie kliknięto
  „Opublikuj", zmiany widzi tylko autor w trybie podglądu. To najczęstsza
  przyczyna „skonfigurowałem wszystko, a analytics nic nie pokazuje".
- **Filtr ruchu wewnętrznego trzeba przełączyć z „Testowanie" na
  „Aktywny".** Sama definicja reguły IP niczego nie odfiltrowuje, dopóki
  filtr jest w trybie testowym — dane nadal trafiają do raportów. To krok,
  który najczęściej jest pomijany, bo wygląda na już zrobiony.
- **Retencja danych GA4: zmienić z 2 na 14 miesięcy od razu.** Domyślne
  ustawienie działa tylko w przód, a skasowanych danych nie da się
  odzyskać — w styczniu bez tej zmiany nie porównasz się z sierpniem.
- **„Sygnały Google" (dane demograficzne) — nie włączać przedwcześnie.**
  Przy małym ruchu i tak większość raportów zostanie zablokowana progami
  prywatności, a włączenie dokłada obowiązek informacyjny w polityce
  prywatności. Nie włączać, dopóki nie ma ruchu i dokumentu.
- **Nie polegać na dedykowanych „podsumowaniach skuteczności" w panelu
  reklamowym.** Mogą mieć własne, sztywne okno czasowe i pokazywać zera
  mimo realnego wydatku. Źródłem prawdy o koszcie jest sekcja
  rozliczeń/płatności — ale i ta ma zwykle ok. dobę opóźnienia względem
  salda, więc saldo jest zawsze wyższe niż suma zaksięgowanych transakcji
  (to nie błąd, to opóźnienie księgowania).
- **Zmiana identyfikatora kontenera/zmiennej środowiskowej na stronie
  statycznej (eksport/SSG) wymaga pełnego rebuildu i redeploya.** Wartość
  jest „wpalona" w build, nie odczytywana w runtime — sama zmiana w panelu
  Google niczego na żywej stronie nie zmienia.
- **Scal vs Zastąp przy imporcie kontenera GTM.** Przy pierwszym imporcie
  do pustego obszaru roboczego opcja „Zastąp" jest bezpieczna. Przy
  kolejnych importach, gdy w kontenerze są już inne tagi (np. Google Ads,
  Meta), używać wyłącznie „Scal" — „Zastąp" skasuje je jednym kliknięciem.
- **Literówki w nazwach zdarzeń.** Nazwa w data layer i nazwa wyzwalacza
  w GTM muszą być identyczne co do znaku. Rozjazd nie daje błędu — zdarzenie
  po prostu nigdy się nie odpala, cicho.

## 9. Rejestr leadów

Google Ads/Meta liczą konwersje: kliknięcie w numer, wysłany formularz.
Nie wiedzą, czy ktoś odebrał telefon, czy rozmowa skończyła się zleceniem
i za ile. Bez tej wiedzy po miesiącu są dane o kliknięciach i zero danych
o pieniądzach — zwłaszcza gdy telefon jest główną konwersją i tylko klient
wie, co się z nim faktycznie stało.

Rejestr wypełnia **klient**, po każdym telefonie/zgłoszeniu — nie po dniu,
nie po tygodniu (wieczorem nikt nie pamięta, skąd dzwonił trzeci klient).

### Kolumny arkusza

| Kolumna | Wartości |
|---|---|
| Kanał | Telefon / Formularz / SMS |
| Skąd trafił | Google Ads / Google (bezpłatnie) / Facebook / Polecenie / Nie wiem |
| Usługa | kategoria z oferty firmy |
| Status | Nowy → Wycena umówiona → Wycena zrobiona → Zlecenie / Odpadł |
| Wartość zlecenia | tylko przy statusie „Zlecenie", kwota faktycznie umówiona |
| Powód odpadnięcia | Za drogo / Wybrał kogoś innego / Nie odebrał / Poza obszarem / Nie ta usługa |

Kolumna „Skąd trafił" jest tu najważniejsza — to jedyny sposób, żeby
oddzielić ruch z reklam od kontaktów, które i tak by się pojawiły. Skrypt
pytania na koniec rozmowy:

> „Jeszcze jedno — skąd Pan/Pani do nas trafił?"

Gdy padnie „z internetu", dopytać: „z reklamy na górze czy z wyników
niżej?". Odpowiedź „Nie wiem" też wpisywać — to uczciwsza dana niż
zgadnięty kanał.

### Co z tego liczymy po teście

| Wskaźnik | Wzór |
|---|---|
| Koszt leada z kanału | wydatek na kanał ÷ liczba wierszy z tym kanałem |
| Koszt zlecenia | wydatek na kanał ÷ liczba wierszy tego kanału ze statusem „Zlecenie" |
| Zwrot z testu | suma „Wartość zlecenia" dla kanału vs. wydany budżet |
| Odsetek nieodebranych | udział „Nie odebrał" wśród powodów odpadnięcia |

Ostatni wiersz bywa najbardziej dochodowym wnioskiem z całego testu:
nieodebrany telefon kosztuje dokładnie tyle samo, co odebrany.

## 10. Powiązane skille

- `reklama-google-ads` — struktura kampanii Search, słowa kluczowe, budżety
  dzienne, do których podpinają się konwersje z sekcji 4.
- `reklama-meta-ads` — piksel i AEM z sekcji 6 w kontekście struktury
  kampanii i kreacji.
- `reklama-strategia` — KPI fazy testowej i pytania blokujące do klienta,
  które decydują, jakie zdarzenia w ogóle da się wdrożyć (np. formularz
  wymaga polityki prywatności).
