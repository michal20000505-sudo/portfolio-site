---
name: reklama-google-ads
description: Prowadzenie kampanii Google Ads Search dla małej firmy lub jednoosobowej działalności — zakładanie konta, struktura kampanii, słowa kluczowe, teksty RSA, checklista startu, optymalizacja tygodniami. Użyj, gdy użytkownik planuje, buduje, uruchamia lub optymalizuje kampanię Google Ads, dobiera budżety i stawki, pisze teksty reklam albo pyta, dlaczego kampania nie dowozi wyników.
---

# Reklama Google Ads

## Zasady nadrzędne

1. **Minimalny budżet dzienny na kampanię: 3× spodziewany CPC i nie mniej niż 10 zł/dzień.** Poniżej tego progu kampania praktycznie się nie wyświetla — nie chodzi o niski wynik, tylko o brak jakiegokolwiek udziału w aukcji. Wzięło się z: plan na 1200 zł/mies. rozbity na 6 kampanii (39,50 zł/dzień razem) dał 4 kampanie po 3–8,50 zł/dzień, które przez cały okres nie wyświetliły się ani razu.
2. **Domyślne ustawienia Google są pod jego przychód, nie pod twój wynik.** Każde domyślne ustawienie konta i kampanii trzeba świadomie sprawdzić i najczęściej zmienić — sieć reklamowa, partnerzy wyszukiwania, opcja lokalizacji, automatyczne rekomendacje, sugestia „rozszerz dopasowanie". Nic z tego nie jest ustawione pod małego reklamodawcę z ograniczonym budżetem.
3. **Konwersje muszą istnieć i rejestrować się, zanim wybierzesz strategię stawek.** Strategia inteligentna (Maks. konwersji, tCPA) na koncie bez danych nie ma na czym się uczyć i pierwsze tygodnie przepłaca losowo.
4. **Kotwicą promienia geograficznego musi być nazwa miasta lub współrzędne — nigdy Profil Firmy (Business Profile).** Firma usługowa bez stałego adresu ma profil, który nie rozwiązuje się do żadnego obszaru — promień zakotwiczony w nim celuje w zbiór pusty. Wszystkie statusy zielone, zero wyświetleń, żaden komunikat o błędzie. Kontrola zajmuje sekundę: w oknie lokalizacji promień musi rysować niebieski okrąg na mapie.
5. **Przez pierwszy tydzień nie ruszać stawek, budżetów ani strategii.** Każda zmiana resetuje fazę uczenia się. Wolno wyłącznie codziennie czyścić raport wyszukiwanych haseł i gasić realne pożary (odrzucona reklama, konwersja, która przestała się rejestrować, budżet wyczerpany rano).
6. **Broad match jest wykluczony na małym budżecie i bez danych konwersyjnych.** Bez historii dobrych leadów algorytm nie wie, co jest dobrym trafieniem dla tego konta, i rozjeżdża wydatek na wszystko, co uzna za pokrewne. Odrzucać sugestię Google „rozszerz dopasowanie".
7. **Zero numeru telefonu i adresu e-mail w nagłówkach i opisach reklam.** To naruszenie zasad Google — numer należy wyłącznie do rozszerzenia połączeń. Wzięło się z: w dniu startu jednej z kampanii Google ograniczył wyświetlanie wszystkich czterech ówczesnych reklam za numer telefonu wpisany w tekście.
8. **Nie oceniać kampanii po CTR ani po Wyniku Jakości — tylko po liczbie i jakości zapytań.** Bez rejestru leadów prowadzonego przez klienta koszt/konwersję jest liczbą bez kontekstu: nie wiadomo, czy zamieniła się w zlecenie.

## Kolejność prac

Każdy krok blokuje następny — nie da się przeskoczyć.

1. **Pomiar (GTM/GA4) na stronie.** Zanim cokolwiek ruszy w Ads, tag konwersji musi być wpięty i przetestowany. Bez tego dalsze kroki budują na niczym.
2. **Konto Google Ads: płatność, weryfikacja reklamodawcy, konwersje.** Weryfikację uruchomić od razu pierwszego dnia — trwa do kilku dni roboczych, a bez niej Google może zawiesić wyświetlanie w trakcie kampanii. Konwersje tworzyć i testować, zanim padnie decyzja o strategii stawek (zasada nadrzędna 3).
3. **Budowa struktury kampanii — bez włączania.** Kampanie, grupy, słowa kluczowe, teksty, rozszerzenia, lista wykluczających. Wszystko wchodzi jako wstrzymane (Paused).
4. **Ustawienia spoza importu/kreatora.** Sieci, opcja lokalizacji, harmonogram, limit CPC, rozszerzenie połączeń, reklamy polityczne w UE — żadne z nich nie przenosi się automatycznie (patrz `references/import-csv.md`).
5. **Checklista startu w całości, w dniu włączenia.** Nie w trakcie budowania — checklista łapie błędy, które budowanie zostawia po drodze.
6. **Włączenie kampanii.** Dopiero po zaliczeniu checklisty. Od tego momentu obowiązuje reżim „pierwsze trzy tygodnie" (sekcja 8).

## Konfiguracja konta

### Zakładanie konta
- [ ] Konto zakłada się na e-mail klienta/firmowy, nie prywatny wykonawcy — ma zostać u klienta po zakończeniu współpracy.
- [ ] Na pierwszym ekranie szukać linku „Przełącz na tryb eksperta" i pominąć kreator „inteligentnej kampanii" (Smart Campaign) — ze Smart Campaign nie ma prostego wyjścia do pełnego interfejsu.
- [ ] Waluta i strefa czasowa ustawiane raz — **nie da się ich zmienić później**. Literówka tutaj oznacza zakładanie konta od nowa.
- [ ] Automatyczne płatności włączone, próg na starcie niski.
- [ ] Weryfikacja reklamodawcy uruchomiona pierwszego dnia. Dla działalności nierejestrowanej: ścieżka „osoba fizyczna" (dowód osobisty), nie „organizacja". Po rejestracji firmy weryfikację trzeba przejść ponownie jako organizacja — planować na przerwę między fazami kampanii.

### Konwersje
- [ ] Tworzone jako działania konwersji w Google Ads, wpinane przez GTM jako osobny tag — nie przez opcję kreatora „Użyj tagu Google znalezionego w Twojej witrynie" (nadpisuje istniejący tag GA4).
- [ ] Nie importować konwersji z GA4 — dokłada opóźnienie i warstwę modelowania; przy kilkunastu konwersjach miesięcznie każde zniekształcenie boli.
- [ ] Liczenie: **„Jedna", nie „Każda"** — ten sam człowiek klika numer telefonu kilka razy; liczenie każdego kliknięcia zawyża wynik o kilkadziesiąt procent i algorytm optymalizuje pod złą bazę.
- [ ] Okno konwersji: 30 dni dla usług o dłuższym namyśle (nie e-commerce, ale i nie miesiącami).
- [ ] Wartość: placeholder jednakowy dla wszystkich działań (np. 1 zł), dopóki klient nie poda średniej wartości zlecenia — interfejs Google nie ma już opcji „bez wartości".
- [ ] Wszystkie kluczowe działania (telefon, formularz) jako **konwersje główne** — dla usług lokalnych klik w `tel:` jest ścieżką dominującą; zdegradowanie do „dodatkowej" wyłącza ją z optymalizacji stawek.
- [ ] Linker konwersji (Ads) obowiązkowy na wszystkich stronach — bez niego `gclid` nie trafia do ciasteczka.
- [ ] Import kontenera GTM opcją „Scal", nigdy „Zastąp" — „Zastąp" kasuje konfigurację GA4.
- [ ] Działanie „Połączenia z reklam", które Google tworzy automatycznie (rozmowy >60s), zmienić z domyślnych „główne + Każda" na **dodatkowe + Jedna**, dopóki nie ma rozszerzenia połączeń — inaczej wejdzie do optymalizacji w środku testu i zmieni bazę porównania.

### Test przed startem
- [ ] Podgląd GTM + klik w numer z każdego miejsca na stronie (desktop i mobile, w tym przyklejony pasek mobilny).
- [ ] Test formularza — event ma lecieć **po** odpowiedzi backendu, nie na sam klik przycisku.
- [ ] Status obu konwersji w Google Ads zmienia się z „Brak ostatnich konwersji" na „Rejestruje konwersje".

### Ustawienia zmieniane ręcznie zaraz po założeniu
- [ ] Wyłączyć automatyczne stosowanie rekomendacji (Rekomendacje → „Automatyczne stosowanie" → odznacz wszystko) — domyślnie Google może samo poszerzyć dopasowanie słów kluczowych i podnieść budżet.
- [ ] Wyłączyć sieć partnerów wyszukiwania i sieć reklamową na poziomie każdej kampanii Search.
- [ ] Sprawdzić, że autotagowanie jest włączone (domyślnie tak) — bez `gclid` nie połączysz kliknięcia z konwersją.
- [ ] Wyłączyć „Zasoby automatyczne" (Ustawienia konta) — inaczej Google samo dociąga generatywne lub dowolne obrazy ze strony do reklam bez pytania.
- [ ] Powiązać Ads ↔ GA4 (raport ścieżek, lista remarketingowa) i Ads ↔ Google Business Profile (Komponenty → Menedżer lokalizacji).

### Google Business Profile — dostęp
- [ ] Zakładka „Osoby i dostęp" pojawia się dopiero po weryfikacji wizytówki — dostępy rozdaje się na końcu.
- [ ] Rola **Menedżer** dla konta prowadzącego kampanie, nie Właściciel główny. Zaproszenie trzeba przyjąć z e-maila, inaczej wygasa.
- [ ] Przekazanie roli Właściciela głównego jest nieodwracalne i Google blokuje je dla użytkownika dodanego w ciągu ostatnich ~7 dni.
- [ ] Nigdy nie zakładać drugiej wizytówki na „właściwym" koncie — duplikat NAP (nazwa/adres/telefon) grozi zawieszeniem obu i utratą weryfikacji. Unikać edycji nazwy/telefonu/adresu przez kilka dni po weryfikacji.

### Strategia stawek i limity CPC
- Startowa strategia: **Maksymalizacja liczby kliknięć + limit CPC** — przewidywalny koszt, szybko zbiera dane. Wzięło się z: konto z zerem konwersji nie ma na czym uczyć strategii inteligentnej.
- Przełączyć na Maksymalizację konwersji dopiero po **15–30 konwersjach** na koncie.
- Limit CPC nie jest ostateczny: jeśli po 3 dniach udział w wyświetleniach jest poniżej ~20%, podnieś **limit CPC**, nie budżet.
- Sygnał do podniesienia limitu: średni CPC ląduje blisko/na suficie limitu (przykład: limit 4 zł, średni CPC 4,10 zł → limit do 5 zł; limit 3 zł, faktyczny CPC 6,93 zł → limit do 3,50 zł).

## Struktura kampanii i budżety

### Nazewnictwo
Wzorzec: `<Skrót Firmy> | Search | <Kategoria usługi>`, np. `XY | Search | Brukarstwo`. Grupy reklam nazwane wg podkategorii/motywu (np. `Kostka brukowa`, `Podjazd i taras`, `Prace ziemne`).

### Zasada podziału: jedna kampania = jedna kategoria usługi
Różne kategorie usług mają różną intencję, wartość zlecenia i CPC. W jednej kampanii kategoria z wysokim CPC zjada budżet reszty i nie da się porównać, która kategoria dowozi. Osobne kampanie = osobne budżety = kontrola i porównywalność.

### Arytmetyka progu budżetowego
- **Reguła: minimum 3× spodziewany CPC i nie mniej niż 10 zł/dzień na kampanię.**
- Faza testowa: nie rozdrabniać budżetu na wszystkie kategorie naraz. Przy 25 zł/dzień rozbicie na 6 kampanii dałoby ~4 zł/kampanię = jedno kliknięcie dziennie = zero wniosków. Test ruszył z 2 z 6 kategorii.
- Przy puli 1200 zł/mies. (39,50 zł/dzień łącznie) reguła daje realnie **3, maks. 4 kampanie naraz**, nie 6.
- Kolejność wprowadzania kategorii: najpierw kategoria z najwyższą wartością zlecenia i wyraźną intencją (trzon budżetu), kolejne dokładać etapami („Faza 2" od ustalonego progu miesięcznego budżetu, np. ~1000 zł/mies.).
- Budżet dzienny × 30,4 = limit miesięczny rozliczany przez Google (np. 39,50 zł/dzień × 30,4 ≈ 1200,80 zł, realny wydatek ok. 1185 zł/30 dni). Pojedyncze dni mogą przekroczyć budżet dzienny nawet 2× — to normalne, wyrównuje się w skali miesiąca.
- Uzasadnienia wysokości budżetu per kategoria: najwyższy budżet dla kategorii z potwierdzonymi konwersjami (trzon); podwyższony budżet dla kategorii z wysokim CPC, żeby w ogóle wejść do aukcji; niski budżet („dogrywka") dla kategorii z nierozstrzygniętym testem.
- Kampanię sezonową poza sezonem trzymać jako **Paused z gotowym budżetem/grupami**, żeby w sezonie wystarczyło włączyć, nie budować od zera.
- Kampanię/grupę wymagającą potwierdzenia prawnego (uprawnienia, licencje) wgrywać od razu jako **Paused** z osobnymi wykluczeniami blokującymi ruch do niej, dopóki nie ma potwierdzenia — to ryzyko prawne, nie marketingowe.

### Ile grup reklam na kampanię
- Faza testowa: 2 grupy/kampanię. Plan miesięczny: 2–3 grupy/kampanię (przykład ze zweryfikowanego planu: 13 grup na 6 kampanii, ~9 fraz/grupę średnio).
- Wydzielaj nową grupę, gdy frazy mają wyraźnie inny temat/nagłówek niż reszta grupy — osobna grupa z dopasowanym tekstem podnosi Wynik Jakości i obniża CPC (przykład: grupa `Podjazd i taras` wydzielona z `Kostka brukowa`, bo ludzie szukają efektu, nie kategorii materiału).
- Grupę z minimalnym ruchem (np. 3 wyświetlenia przez cały test) likwidować i przenosić jej frazy do grupy pokrewnej, gdzie mają czym oddychać.
- Różnicować max CPC per grupa wg wolumenu/wartości — grupa z niskim wolumenem (np. 52 wyświetlenia w dwa tygodnie) dostaje niższą stawkę niż grupa flagowa.

### Harmonogram

**Zasada: harmonogram dopasowuje się do dostępności KANAŁU KONWERSJI, nie automatycznie do godzin pracy.** Najpierw ustal, co jest konwersją, i dopiero z tego wynika harmonogram.

| Konwersja | Harmonogram | Dlaczego |
|---|---|---|
| **Telefon** (kanał synchroniczny) | godziny, w których klient realnie odbiera | nieodebrane połączenie = stracony lead **i** zapłacone kliknięcie |
| **Mail / formularz** (kanał asynchroniczny) | **bez ograniczeń, 24/7** | ktoś szukający o 23:00 spokojnie napisze i poczeka na odpowiedź rano; obcinanie godzin wyrzuca część i tak małego wolumenu |
| **Oba** | kampania non stop, godziny **wewnątrz rozszerzenia połączeń** | rozszerzenie połączeń ma własny harmonogram — numer znika poza godzinami, reklama zostaje |

- Warunek przy kanale asynchronicznym: **odpowiedź następnego dnia roboczego.** Zapytanie z nocy, na które odpowiedź idzie trzy dni, jest stracone tak samo jak nieodebrany telefon.
- Wzorzec dla usług lokalnych z telefonem: pon.–sob. 6:00–20:00, niedz. 11:00–16:00. Niedziela **osobnym wierszem** — inaczej kopiuje godziny reszty tygodnia.
- Spójność godzin: ustawienia kampanii, rozszerzenie połączeń i wizytówka Google mają mówić to samo.
- Reklama poza godzinami obsługi telefonicznej generuje nieodebrane telefony. Kampania działa tylko wtedy, gdy telefon jest odbierany — to najczęstsza przyczyna „reklamy nie działają", i trzeba to wprost powiedzieć klientowi.
- Weekend bywa najlepszym czasem na zapytania przy usługach dla domu — jeśli konkurencja w weekend nie odbiera telefonu, warto to zakomunikować w reklamie jako przewagę.

### Kierowanie geograficzne
- **Opcja lokalizacji: „Obecność" (osoby w tej lokalizacji/regularnie przebywające), nigdy „Obecność lub zainteresowanie".** To domyślne ustawienie Google i najczęstszy błąd w kampaniach lokalnych — bez zmiany reklamę zobaczy ktoś z innego miasta, który tylko wyszukał hasło związane z tym miastem. Ta sama reguła dla wykluczeń geograficznych.
- Promień dobierać wg wartości zlecenia kategorii: wyższa wartość zlecenia znosi koszt dojazdu → większy promień; niska wartość zlecenia → mniejszy promień.
- Nie kupować od razu pełnego zasięgu deklarowanego przez klienta — w małym budżecie każdy dodatkowy km rozcieńcza wydatek po terenie bez rozpoznawalności/opinii. Rozszerzać promień na podstawie danych (raport Lokalizacje po nazbieraniu ruchu, orientacyjnie kilkaset kliknięć), nie deklaracji.
- **Kotwica promienia: nazwa miasta lub współrzędne, nigdy Profil Firmy** (zasada nadrzędna 4). Kontrola: w oknie lokalizacji promień musi rysować niebieski okrąg na mapie — jeśli nie rysuje, kierowanie jest puste, mimo że raport Lokalizacje wygląda normalnie.
- CSV importu nie ustawia lokalizacji — kampanie wchodzą z kierowaniem na całą Polskę; trzeba je **podmienić**, nie dołożyć, po każdym imporcie.

### Strona docelowa
- Kierowanie wszystkich kampanii na stronę główną zamiast dedykowanych podstron usług obniża Wynik Jakości i podnosi CPC — świadomy kompromis tymczasowy, nie cel docelowy.
- Priorytet po teście / najtańsza dostępna optymalizacja: dedykowane podstrony per usługa z unikalną treścią i CTA.
- Nie dopisywać ręcznie parametrów UTM do URL-a docelowego w samych reklamach — autotagowanie (`gclid`) załatwia sprawę, a ręczne UTM-y mogą się z nim gryźć.
- Ryzyko przy wielu kategoriach na jednej stronie głównej: ruch z kategorii niedominującej trafia na treść zaczynającą się od innej usługi i musi sam szukać swojej — obniża to jednocześnie Wynik Jakości i konwersję.

## Słowa kluczowe

### Typy dopasowań
| Dopasowanie | Rola |
|---|---|
| Ścisłe `[fraza]` | Trzon, tu idzie większość budżetu |
| Do wyrażenia `"fraza"` | Kilka najszerszych intencji |
| Przybliżone (broad) | Wykluczone na małym budżecie i bez danych konwersyjnych (zasada nadrzędna 6) |

- Ta sama fraza celowo w dopasowaniu ścisłym **i** do wyrażenia jednocześnie w jednej grupie: ścisłe wygrywa aukcję, do wyrażenia łapie odmiany fleksyjne — Google nie zgłasza tego jako duplikatu.
- Nie zgadywać liczb wyszukiwań i CPC bez sprawdzenia w Planerze słów kluczowych zawężonym do lokalizacji.

### Ile fraz na grupę
Typowo 4–11 fraz na grupę. Orientacyjny plan miesięczny: ~9 fraz/grupę.

### Wzorce fraz
- `[usługa + miasto]` — np. `[kostka brukowa wrocław]`, `[brukarz wrocław]`.
- `[usługa ogólna]` bez miasta jako wariant ścisły — np. `[mycie kostki brukowej]`.
- `[konkretny element/zastosowanie]` — np. `[podjazd z kostki brukowej]`, `[przygotowanie terenu pod kostkę]`.
- `"fraza szeroka w wyrażeniu"` — np. `"firma brukarska"`, `"usługi brukarskie"`.
- Warianty z miastem i bez miasta łączyć w tej samej grupie tematycznej.

### Wykluczające
Lista wgrywana na **poziomie konta** (nie kampanii), w dopasowaniu do wyrażenia, **przed** włączeniem kampanii. Raport wyszukiwanych haseł sprawdzać codziennie przez pierwszy tydzień, potem co 2–3 dni. Pełna lista kategorii, przykłady fraz i pułapki utrzymania: `references/wykluczajace.md`.

## Teksty RSA i rozszerzenia

### Limity znaków
| Element | Limit | Ile sztuk |
|---|---|---|
| Nagłówek | ≤30 znaków | do 15 na reklamę |
| Opis | ≤90 znaków | do 4 na reklamę |
| Tekst linku do podstrony | ≤25 znaków | — |
| Linijka opisu linku do podstrony | ≤35 znaków | do 2 linijek |
| Ścieżka wyświetlana (Path 1 / Path 2) | ≤15 znaków | 2 pola |

Limity są sprawdzane maszynowo tylko przy generowaniu CSV — przy ręcznej edycji tekstu trzeba przeliczyć znaki samemu. Google Ads Editor odrzuca przekroczenie dopiero przy wysyłce i nie wskazuje, który wiersz.

### Zasady pisania
- **Zero numeru telefonu i adresu e-mail** w nagłówkach/opisach (zasada nadrzędna 7) — kontakt należy wyłącznie do rozszerzenia połączeń.
- **Nie przypinać nagłówków bez potrzeby.** Przypięcie ogranicza liczbę kombinacji, które Google może testować — domyślnie nie przypinać żadnego.
- **Zero wersalików** (cała fraza CAPS LOCK) — moderacja odrzuci; Title Case jest w porządku.
- **Zero wykrzykników w nagłówkach** (jeden dopuszczalny w opisie, ale lepiej dopasować do tonu marki).
- Każdy fakt w tekście musi być potwierdzony (np. „bezpłatna wycena i dojazd") — obietnica, z której firma się nie wywiąże, kończy się skargą do Google i wstrzymaniem reklam.
- Frazę o przewadze konkurencyjnej (np. dostępność w niedzielę) używać tylko dopóki jest prawdziwa — jeśli przewaga zniknie, tekst trzeba zdjąć.
- Ocena jakości reklamy „Słaba" sama w sobie nie jest problemem — Google karze wskaźnikiem za brak różnorodności nagłówków, nie za treść; jeśli teksty są poprawne i faktograficznie ugruntowane, można ją zignorować.
- Dla grup pobocznych/nowych na starcie budżetu testowego: użyć tych samych tekstów co grupa nadrzędna, podmieniając pierwsze 2–3 nagłówki na frazę danej grupy — przy małym budżecie nie ma sensu pisać kompletu tekstów, które nie zbiorą wystarczających danych.

### Wzorce, które funkcjonują
Kombinacja: usługa + miasto (`Kostka Brukowa Wrocław`), usługa + zakres (`Podjazdy, Tarasy, Chodniki`), przewaga (`Bezpłatna Wycena i Dojazd`, `Dojazd do Klienta`), CTA (`Zadzwoń po Bezpłatną Wycenę`), dostępność (`Odbieramy 7 Dni w Tygodniu`, `Zadzwoń Także w Niedzielę`), cross-sell (`Bruk, Ogród, Porządki`, `Jedna Firma, Cała Posesja`). Opisy łączą zakres usługi + geografia + CTA w jednym zdaniu, np. „Układanie kostki brukowej we Wrocławiu i okolicach. Podjazdy, chodniki, tarasy." (79 znaków).

### Rozszerzenia
Uzupełnić wszystkie dostępne — nie kosztują nic, powiększają reklamę, podnoszą CTR. Przy usługach lokalnych rozszerzenie połączeń bywa ważniejsze niż sam tekst reklamy.

| Rozszerzenie | Uwaga |
|---|---|
| Objaśnienia (callouts) | Krótkie hasła przewag: bezpłatna wycena, bezpłatny dojazd, dostępność 7 dni w tygodniu, obszar działania, kompleksowość |
| Linki do podstron | Na czas braku dedykowanych stron — kotwice (`#anchor`) tej samej strony głównej, osobny tekst/opis per link |
| Fragmenty rozszerzone | Typ „Usługi" wymieniający wszystkie kategorie usług firmy |
| Rozszerzenie połączeń | Numer identyczny z wizytówką i stroną (spójność NAP), ma **własny harmonogram** — przy kampanii emitującej 24/7 to w nim ogranicza się godziny, nie w kampanii. Dodaje się osobno od CSV, wymaga weryfikacji numeru |
| Rozszerzenie lokalizacji | Wymaga powiązanej i kwalifikującej się wizytówki; firma bez stałego adresu może go nie zobaczyć mimo poprawnej konfiguracji |
| Formularz kontaktowy | Wymaga opublikowanej polityki prywatności (pole obowiązkowe) |
| Ceny/Promocje | Nie dodawać, dopóki cennik nie jest ostateczny/publiczny |

Rozszerzenia na poziomie konta (linki, objaśnienia, fragmenty) obejmują automatycznie nowe kampanie — nie importować/dodawać ich ponownie przy nowych kampaniach, bo robi to duplikaty.

### Wzmacnianie wizytówki (pośrednio)
Nie istnieje produkt „wypromuj wizytówkę" w Google Ads — nie da się ustawić linku do wizytówki (maps.google.com/…) jako URL-a docelowego reklamy, taka reklama zostanie odrzucona jako niezgodność miejsca docelowego. Wizytówkę wzmacnia się czterema mechanizmami pośrednimi:

1. **Powiązanie Ads ↔ Profil Firmy** (Komponenty → Menedżer lokalizacji), wymaga roli Menedżer na wizytówce. Dla firmy bez stałego adresu obsługi klienta (adres ukryty, „obszar działania") komponent lokalizacji najprawdopodobniej się nie wyświetli — format zakłada punkt, który klient może odwiedzić. Po powiązaniu Google sam pokazuje status kwalifikowalności — sprawdzić, nie zgadywać.
2. **Komponent połączeń z numerem identycznym jak w wizytówce/na stronie** (spójność NAP).
3. **UTM w polu „Witryna" wizytówki** — bez tego ruch z wizytówki wpada w analitykę do jednego worka z organikiem.
4. **Kampania na własną markę/nazwę firmy** — mechanizm okrężny: reklama usługowa → zapamiętanie nazwy → wyszukanie marki → panel wiedzy z wizytówką → kontakt/opinia. CPC na frazie marki jest groszowy, wystarczy 2–3 zł/dzień. Wdrażać dopiero w fazie 2, gdy przez konto przewinął się ruch, który zapamiętał nazwę — przy zerowej rozpoznawalności marki trzecia kampania zabiera budżet z testu, zamiast go uzupełniać.

Local Services Ads (LSA) jest formatem bliższym oczekiwaniom klienta lokalnego (profil firmy zamiast strony, płatność za kontakt, plakietka Gwarancji Google), ale wymaga weryfikacji firmy z dokumentami (2–6 tygodni) i zarejestrowanej działalności — niedostępny dla działalności nierejestrowanej.

Co realnie podnosi wizytówkę w wynikach lokalnych i jest darmowe (silniejsze niż jakikolwiek budżet reklamowy): opinie proszone po każdym zleceniu, zdjęcia z prawdziwych realizacji (nie generatywne), pełna lista kategorii/usług, regularne posty.

## Checklista startu

Przejść całą listę **w dniu startu**, nie w trakcie budowania.

### Pomiar
- [ ] GTM ładuje się na produkcji, nie tylko w środowisku deweloperskim
- [ ] Kliknięcie `tel:` wysyła event z każdego miejsca na stronie, w tym z przyklejonego paska mobilnego
- [ ] Formularz wysyła event dopiero po odpowiedzi backendu, nie na klik przycisku
- [ ] Obie konwersje w Google Ads mają status „Rejestruje konwersje"
- [ ] Consent Mode v2 ustawia `denied` przed GTM
- [ ] Banner zgód działa, a odrzucenie zgód nie wywala strony

### Kampania
- [ ] Sieć reklamowa odznaczona (domyślnie zaznaczona)
- [ ] Partnerzy w sieci wyszukiwania odznaczeni
- [ ] Lokalizacja: „Obecność", nie „Obecność lub zainteresowanie"
- [ ] Promień zakotwiczony w mieście/współrzędnych, mapa rysuje niebieski okrąg
- [ ] Promień dojazdu zgodny z tym, co potwierdził klient — nie zgadywany
- [ ] Harmonogram dopasowany do kanału konwersji (telefon → godziny odbierania; mail/formularz → bez ograniczeń, 24/7)
- [ ] Budżety dzienne sprawdzone jako dzienne, nie miesięczne
- [ ] Limit CPC ustawiony, strategia = maks. kliknięć
- [ ] Lista wykluczających wgrana na poziomie konta i zastosowana do wszystkich kampanii
- [ ] Wszystkie słowa kluczowe w dopasowaniu ścisłym lub do wyrażenia, żadnego broad
- [ ] URL docelowy otwiera się i przewija do właściwej sekcji
- [ ] Rozszerzenie połączeń działa — kliknij je na własnym telefonie
- [ ] Reklamy polityczne w UE: „Nie zawiera reklam politycznych"
- [ ] Rekomendacje automatyczne wyłączone
- [ ] Suma budżetów dziennych zgodna z zamierzoną (pomyłka w jednym polu to realne kilkadziesiąt zł/mies.)

### Poza kontem
- [ ] Klient wie, że od dziś dzwonią ludzie z reklamy, i ma odbierać
- [ ] Klient ma arkusz rejestru leadów i wie, co w nim zapisywać
- [ ] Polityka prywatności jest opublikowana

## Pierwsze trzy tygodnie

### Tydzień 1 — obserwacja, nie majsterkowanie
Przez pierwsze 7 dni nie ruszać stawek, budżetów ani strategii (zasada nadrzędna 5). Każda zmiana resetuje fazę uczenia się, a przy małym budżecie dziennym ledwo starcza danych na jedną taką fazę.

Wolno robić dokładnie dwie rzeczy:
1. **Raport wyszukiwanych haseł — codziennie.** Wykluczać wszystko bez intencji zakupowej. To jedyna czynność, która w tym tygodniu realnie obniża koszt leada.
2. **Gaszenie pożarów** — reklama odrzucona przez moderację, konwersja, która przestała się rejestrować, wyczerpany budżet dnia w połowie dnia.

Czego nie robić: zmieniać tekstów, dodawać słów kluczowych, przełączać strategii stawek, dokładać kampanii, wyłączać „słabych" fraz po dwóch dniach.

| Sygnał | Znaczenie | Reakcja |
|---|---|---|
| Budżet wyczerpany przed południem | Stawki za wysokie albo frazy za szerokie | Poczekaj do 7. dnia, potem obniż limit CPC |
| Zero kliknięć przez 2 dni | Stawki za niskie lub geo za wąskie | Wyjątek — reaguj od razu, podnieś limit CPC |
| Dużo kliknięć, zero konwersji | Możliwy błąd pomiaru, nie słaba reklama | Najpierw sprawdź pomiar, dopiero potem winij reklamę |
| Kliknięcia z fraz o materiałach | Brakujące wykluczające | Dopisz tego samego dnia |

Przy pierwszej kampanii na nowym koncie „brak konwersji" znacznie częściej oznacza rozpięty tag niż nietrafioną reklamę. Zanim zaczniesz przepisywać teksty, kliknij numer telefonu na własnym telefonie i sprawdź, czy konwersja się zarejestrowała.

### Tydzień 2 — pierwsze decyzje
- [ ] Przejrzyj raport haseł i domknij listę wykluczających
- [ ] Porównaj kampanie/kategorie: która dowozi zapytania taniej?
- [ ] Przesuń budżet w stronę tej, która dowozi — ale nie wyłączaj pozostałych przed końcem testu, bo stracisz punkt odniesienia
- [ ] Sprawdź udział w wyświetleniach — poniżej ~20% oznacza brak widoczności, podnieś limit CPC zanim dołożysz budżet
- [ ] Sprawdź u klienta, ile z zapytań było sensownych — to jedyna metryka jakości, jakiej Google nie poda

### Tydzień 3 — podsumowanie testu
- [ ] Ile zapytań, z jakiej kampanii, po jakim koszcie
- [ ] Ile z nich klient zamienił w zlecenie (dane z rejestru leadów)
- [ ] Które frazy dały konwersję — to fundament budżetu fazy 2

### Progi decyzyjne
| Decyzja | Warunek |
|---|---|
| Przełączenie na Maksymalizację konwersji | ≥15–30 konwersji na koncie |
| Dołożenie nowej kategorii/kampanii | Budżet miesięczny przekracza ustalony próg fazy 2 |
| Zwiększenie budżetu kampanii | Limit CPC osiągany/przekraczany, a udział w wyświetleniach niski — najpierw podnieś CPC, dopiero potem budżet |
| Ubicie/zawężenie kategorii | Po ustalonym okresie (np. 2 tygodnie) zero konwersji — obetnij budżet najsłabszej kategorii, nie flagowej |
| Performance Max | ≥30 konwersji miesięcznie, nie wcześniej — przy braku danych rozsypie budżet po Display bez pokazania, gdzie poszedł |

### Czego nie robić przez cały test
- Nie włączać Performance Max przed progiem konwersji z tabeli wyżej.
- Nie zgadzać się na „optymalizację" proponowaną przez konsultanta Google przez telefon — standardowo proponują broad match, PMax i podniesienie budżetu, trzy rzeczy przeciwskuteczne przy małym budżecie dziennym.
- Nie oceniać kampanii po CTR ani Wyniku Jakości (zasada nadrzędna 8).
- Nie wyłączać słów kluczowych po 2–3 kliknięciach — przy małym budżecie to szum, nie dane.
- Nie zwiększać budżetu na podstawie samej rekomendacji Google bez sprawdzenia, czy sensownie zwiększy wynik — procentowy „wynik optymalizacji konta" (np. +4,1%) to inna liczba niż przewidywany wzrost realnych rezultatów.

## Benchmarki

Liczby z realnej kampanii usług brukarskich we Wrocławiu, test 11–25 sierpnia 2026, usługi lokalne w PL. Punkt odniesienia, nie norma uniwersalna dla innej branży czy rynku.

| Metryka | Wartość |
|---|---|
| CTR konta (sieć wyszukiwania) | 8,59% — wyraźnie powyżej przeciętnej dla usług lokalnych |
| Średni CPC konta | 4,44 zł |
| Koszt / konwersję | ~186 zł |
| Kampania dowożąca (budżet 15 zł/dzień, limit CPC 4 zł) | CTR 9,16%, śr. CPC 4,10 zł, wsp. konwersji 1,35% |
| Kampania niedowożąca (budżet 10 zł/dzień, limit CPC 3 zł) | CTR 5,88%, śr. CPC 6,93 zł (o 69% wyższy niż w kampanii dowożącej), 0 konwersji przy 10 kliknięciach |
| Wyświetlenia przy 15 zł/dzień | ~808 wyświetleń / 14 dni (~58/dzień) |
| Wyświetlenia przy 10 zł/dzień | ~170 wyświetleń / 14 dni (~12/dzień) |
| Próg „nie wyświetla się wcale" | kampanie 3–8,50 zł/dzień przy planie 39,50 zł/dzień łącznie (6 kampanii) nie wyświetliły się ani razu |

Wnioski z tych liczb: wysoki CTR przy niskim wolumenie oznacza problem z budżetem/zasięgiem, nie z tekstem reklamy. CPC wyraźnie powyżej limitu w kampanii bez konwersji sygnalizuje brak popytu w tej kategorii, nie brak pieniędzy — dokładanie budżetu tego nie naprawia. 10 kliknięć to za mało, żeby uznać kategorię za przetestowaną („nie mamy odpowiedzi »nie działa«, mamy »nie było na czym sprawdzić«").

### Dlaczego surowy koszt/konwersję nie wystarcza
Google Ads liczy tylko konwersje-zdarzenia (klik w numer, wysłany formularz) — nie wie, czy ktoś odebrał telefon, czy rozmowa skończyła się zleceniem i za ile. Koszt/konwersję bez rejestru leadów prowadzonego przez klienta (wypełnianego na bieżąco, po każdym kontakcie, nie wieczorem z pamięci) jest liczbą bez kontekstu — może oznaczać świetny wynik albo stratę, w zależności od wartości zlecenia.

| Wskaźnik | Formuła |
|---|---|
| Koszt leada z reklam | wydatek Ads ÷ liczba kontaktów oznaczonych jako „Google Ads" w rejestrze |
| Koszt zlecenia | wydatek ÷ liczba kontaktów ze statusem „Zlecenie" |
| Zwrot z testu | suma wartości zleceń z „Google Ads" vs. wydany budżet |
| Ile telefonów przepada | udział „Nie odebrał" wśród powodów odpadnięcia — nieodebrany telefon kosztuje dokładnie tyle samo co odebrany, bywa najbardziej dochodowym wnioskiem z całego testu |

## Powiązane skille

- `reklama-strategia` — decyzja o budżecie całkowitym i wyborze kanału (Google Ads vs. inne), zanim jeszcze padnie decyzja o strukturze kampanii.
- `reklama-google-diagnostyka` — kampania zbudowana poprawnie, ale nie wyświetla się wcale lub prawie wcale (statusy zielone, zero wyświetleń).
- `reklama-pomiar` — konfiguracja GTM/GA4 i konwersji od zera, zanim ruszy cokolwiek w Ads.
