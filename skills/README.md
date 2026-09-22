# Skille reklamowe

Wiedza wyciągnięta z realnej kampanii reklamowej prowadzonej dla lokalnej firmy
usługowej (Google Ads + Meta Ads, sierpień–wrzesień 2026). Każda reguła, która
wzięła się z błędu kosztującego dni emisji, jest w tekście oznaczona
„wzięło się z:".

| Skill | Kiedy |
|---|---|
| [`reklama-strategia`](reklama-strategia/SKILL.md) | **Zacznij tutaj.** Budżet, wybór kanału, pytania blokujące, KPI, progi decyzyjne, plan miesięczny |
| [`reklama-google-ads`](reklama-google-ads/SKILL.md) | Budowa i prowadzenie kampanii w wyszukiwarce: konto, struktura, frazy, RSA, checklista startu |
| [`reklama-google-diagnostyka`](reklama-google-diagnostyka/SKILL.md) | Kampania nie wyświetla się, panel pokazuje dziwne rzeczy, import wygląda na nieudany |
| [`reklama-meta-ads`](reklama-meta-ads/SKILL.md) | Facebook/Instagram: kiedy w ogóle wchodzić, struktura, kreacje, fanpage |
| [`reklama-pomiar`](reklama-pomiar/SKILL.md) | GTM, GA4, Consent Mode v2, piksel, konwersje w Ads, rejestr leadów |

Materiały pomocnicze: `reklama-google-ads/references/wykluczajace.md` (szablon
listy wykluczających) i `reklama-google-ads/references/import-csv.md` (workflow
Google Ads Editor).

## Trzy reguły, które kosztowały najwięcej

1. **Kotwicą promienia geograficznego jest nazwa miasta albo współrzędne, nigdy
   Profil Firmy.** Firma bez stałego adresu → kierowanie w zbiór pusty, zero
   wyświetleń, zero komunikatów o błędzie, wszystkie statusy zielone.
2. **Minimalny budżet dzienny kampanii = 3 × spodziewany CPC, nie mniej niż
   10 zł.** Poniżej progu kampania nie wyświetla się w ogóle. Lepiej trzy
   kampanie po 13 zł niż sześć po 6,50 zł.
3. **Pomiar działa, zanim ruszy pierwsza złotówka.** „Dużo kliknięć, zero
   konwersji" na nowym koncie znacznie częściej oznacza rozpięty tag niż złą
   reklamę.

## Uwaga o lokalizacji

Claude Code automatycznie wczytuje skille z `.claude/skills/`, nie z tego
katalogu. Żeby były wywoływalne przez `/reklama-strategia`, trzeba je
przenieść albo skopiować do `.claude/skills/`.
