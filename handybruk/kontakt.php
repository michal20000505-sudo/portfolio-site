<?php
declare(strict_types=1);

/**
 * Endpoint formularza kontaktowego — handybruk.pl
 *
 * Leży w `public/`, więc `npm run build` kopiuje go do `out/` i trafia na
 * serwer razem z resztą strony. Wywoływany fetch-em z components/ContactForm.tsx.
 * Przyjmuje application/x-www-form-urlencoded, odpowiada JSON-em.
 *
 * DWIE RZECZY, O KTÓRYCH TRZEBA PAMIĘTAĆ PRZY ZMIANACH:
 *
 * 1. Ten plik powtarza KAŻDĄ regułę z funkcji validate() w ContactForm.tsx.
 *    Walidacja w przeglądarce jest wygodą dla użytkownika, nie zabezpieczeniem —
 *    przy zmianie reguł trzeba ruszyć oba pliki naraz.
 * 2. Nie działa w `npm run dev`. Serwer deweloperski Next.js odda ten plik
 *    jako tekst, zamiast go wykonać; PHP jest dopiero na vh.pl.
 */

// --- Konfiguracja -----------------------------------------------------------

/** Skrzynka odbiorcza. Potwierdzona w docs/firma.md — nie zmieniaj bez pytania. */
const MAILBOX = 'kontakt@handybruk.pl';

/**
 * Nadawca MUSI być adresem z własnej domeny. Wstawienie tu adresu wpisanego
 * przez klienta łamie SPF i wysyła wiadomość prosto do spamu — adres klienta
 * trafia do Reply-To, więc „Odpowiedz” w kliencie poczty i tak zadziała.
 */
const SENDER = 'kontakt@handybruk.pl';
const SENDER_NAME = 'Formularz handybruk.pl';

/** Limit: tyle wysłanych wiadomości z jednego adresu IP na RATE_WINDOW sekund. */
const RATE_LIMIT = 5;
const RATE_WINDOW = 3600;

/** Górne limity długości pól — te same liczby siedzą w maxLength w ContactForm.tsx. */
const LIMITS = [
    'name' => 80,
    'place' => 80,
    'phone' => 30,
    'email' => 120,
    'message' => 3000,
];

/**
 * Kategorie zlecenia. Klucze muszą się zgadzać ze slugami w content/services.ts
 * (plus „inne” — ostatnia pozycja listy w formularzu). Wartości są używane
 * wyłącznie w treści maila. To jedyne miejsce, w którym treść z `content/`
 * jest zduplikowana poza Next.js — przy dodaniu kategorii dopisz ją tutaj.
 */
const CATEGORIES = [
    'brukarstwo' => 'Brukarstwo i prace ziemne',
    'czyszczenie-nawierzchni' => 'Czyszczenie i pielęgnacja nawierzchni',
    'ogrod' => 'Ogród i tereny zielone',
    'porzadki-i-wywoz' => 'Porządki, opróżnianie i wywóz',
    'przeprowadzki' => 'Przeprowadzki i transport',
    'odsniezanie' => 'Odśnieżanie',
    'inne' => 'Coś innego / nie wiem',
];

// --- Narzędzia --------------------------------------------------------------

/** Kończy żądanie odpowiedzią JSON. */
function respond(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Odczyt pola z POST-a: odrzuca nie-tekst i niepoprawny UTF-8, normalizuje
 * końce linii, usuwa znaki sterujące (poza nową linią) i skrajne spacje.
 */
function read_field(string $key): string
{
    if (!isset($_POST[$key]) || !is_string($_POST[$key])) {
        return '';
    }

    $value = $_POST[$key];

    // preg_match z modyfikatorem /u zwraca 1 tylko dla poprawnego UTF-8.
    if (preg_match('//u', $value) !== 1) {
        return '';
    }

    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = preg_replace('/[^\P{C}\n]+/u', '', $value);

    return trim((string) $value);
}

/**
 * To samo, ale dla pól jednoliniowych: nowa linia leci precz. Bez tego imię
 * „Jan\nKategoria: Odśnieżanie” dorysowałoby sobie w treści maila linię,
 * której nikt nie wpisał w formularzu.
 */
function read_line(string $key): string
{
    return header_safe(read_field($key));
}

/** Długość w znakach, nie w bajtach — „Aś” ma dwa znaki, ale trzy bajty. */
function text_length(string $value): int
{
    if (function_exists('mb_strlen')) {
        return (int) mb_strlen($value, 'UTF-8');
    }

    return (int) preg_match_all('/./u', $value);
}

/** Wartość wchodząca do nagłówka maila — bez znaków łamiących nagłówek. */
function header_safe(string $value): string
{
    return trim(str_replace(["\r", "\n", "\0"], ' ', $value));
}

/**
 * Nagłówek z polskimi znakami wg RFC 2047. Czysty ASCII zostawiamy bez zmian;
 * resztę kodujemy base64 w kawałkach, bo pojedyncze słowo kodowane nie może
 * przekroczyć 75 znaków, a „Porządki, opróżnianie i wywóz” po zakodowaniu
 * ten limit przebija.
 */
function mime_header(string $text): string
{
    $text = header_safe($text);

    if (preg_match('/^[\x20-\x7E]*$/', $text) === 1) {
        return $text;
    }

    if (function_exists('mb_encode_mimeheader')) {
        return mb_encode_mimeheader($text, 'UTF-8', 'B', "\r\n");
    }

    $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
    $words = [];
    $chunk = '';

    foreach ($chars as $char) {
        // Dzielimy po znakach, nigdy po bajtach — inaczej „ż” rozpada się na pół.
        if ($chunk !== '' && strlen(base64_encode($chunk . $char)) > 60) {
            $words[] = '=?UTF-8?B?' . base64_encode($chunk) . '?=';
            $chunk = '';
        }
        $chunk .= $char;
    }

    if ($chunk !== '') {
        $words[] = '=?UTF-8?B?' . base64_encode($chunk) . '?=';
    }

    return implode("\r\n ", $words);
}

/**
 * Nazwa wyświetlana przed adresem w From/Reply-To. Musi być cytowana:
 * imię w rodzaju „Jan Bcc: ktos@example.com” bez cudzysłowów rozjeżdża
 * składnię adresu (RFC 5322 nie dopuszcza dwukropka w niecytowanej frazie).
 * Wersja kodowana base64 jest bezpieczna sama z siebie.
 */
function display_name(string $value): string
{
    $value = header_safe($value);

    if ($value === '') {
        return '';
    }

    if (preg_match('/^[\x20-\x7E]*$/', $value) === 1) {
        return '"' . addcslashes($value, '"\\') . '"';
    }

    return mime_header($value);
}

/** Adres IP nadawcy. X-Forwarded-For celowo pominięty — da się go podrobić. */
function client_ip(): string
{
    if (isset($_SERVER['REMOTE_ADDR']) && is_string($_SERVER['REMOTE_ADDR'])) {
        return $_SERVER['REMOTE_ADDR'];
    }

    return '';
}

function rate_file(string $ip): string
{
    $dir = sys_get_temp_dir();

    if ($dir === '' || !is_dir($dir) || !is_writable($dir)) {
        return '';
    }

    // sha1, nie samo IP — nazwa pliku nie musi być danymi osobowymi.
    return $dir . DIRECTORY_SEPARATOR . 'handybruk-form-' . sha1($ip) . '.txt';
}

/**
 * Limit chroni pulę wysyłkową hostingu przed zalaniem. Liczone są wyłącznie
 * wiadomości faktycznie wysłane — nieudana walidacja nie zużywa limitu,
 * żeby pomyłka użytkownika nie zamykała mu formularza na godzinę.
 * Gdy katalog tymczasowy jest niezapisywalny, limit odpuszczamy:
 * formularz ma działać, nawet jeśli nie da się liczyć.
 */
function rate_limit_reached(string $ip): bool
{
    $file = rate_file($ip);

    if ($ip === '' || $file === '') {
        return false;
    }

    $raw = @file_get_contents($file);

    if (!is_string($raw) || $raw === '') {
        return false;
    }

    $limit = time() - RATE_WINDOW;
    $recent = 0;

    foreach (explode(',', $raw) as $item) {
        if ((int) $item > $limit) {
            $recent++;
        }
    }

    return $recent >= RATE_LIMIT;
}

function rate_limit_record(string $ip): void
{
    $file = rate_file($ip);

    if ($ip === '' || $file === '') {
        return;
    }

    $now = time();
    $limit = $now - RATE_WINDOW;
    $stamps = [];
    $raw = @file_get_contents($file);

    if (is_string($raw) && $raw !== '') {
        foreach (explode(',', $raw) as $item) {
            $stamp = (int) $item;
            if ($stamp > $limit) {
                $stamps[] = $stamp;
            }
        }
    }

    $stamps[] = $now;
    @file_put_contents($file, implode(',', $stamps), LOCK_EX);
}

// --- Żądanie ----------------------------------------------------------------

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, [
        'ok' => false,
        'message' => 'Ten adres obsługuje wyłącznie formularz kontaktowy.',
    ]);
}

// Honeypot: pole ukryte przed ludźmi. Wypełnione = bot. Odpowiadamy sukcesem,
// bo komunikat o odrzuceniu tylko podpowiedziałby, co poprawić.
if (read_field('company') !== '') {
    respond(200, ['ok' => true]);
}

// Wieloliniowa jest wyłącznie treść zgłoszenia — reszta to pola jednoliniowe.
$name = read_line('name');
$phone = read_line('phone');
$email = read_line('email');
$place = read_line('place');
$service = read_line('service');
$consent = read_line('consent');
$message = read_field('message');

// --- Walidacja (lustro validate() z ContactForm.tsx) ------------------------

$errors = [];

$values = [
    'name' => $name,
    'place' => $place,
    'phone' => $phone,
    'email' => $email,
    'message' => $message,
];

foreach (LIMITS as $field => $max) {
    if (text_length($values[$field]) > $max) {
        $errors[$field] = 'To pole jest za długie — zmieść się w ' . $max . ' znakach.';
    }
}

if (text_length($name) < 2) {
    $errors['name'] = 'Proszę podać imię — będziemy wiedzieć, jak się zwracać.';
}

$digits = preg_replace('/[^0-9]/', '', $phone);
$has_phone = strlen((string) $digits) >= 9;
$has_email = preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u', $email) === 1
    && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;

if ($phone !== '' && !$has_phone) {
    $errors['phone'] = 'Numer wygląda na niepełny — prosimy o 9 cyfr.';
}

if ($email !== '' && !$has_email) {
    $errors['email'] = 'W tym adresie jest literówka.';
}

// Dopiero gdy oba pola są puste — inaczej błąd wisiałby przy telefonie,
// którego użytkownik świadomie nie wypełnił.
if (!$has_phone && !$has_email && !isset($errors['phone']) && !isset($errors['email'])) {
    $errors['phone'] = 'Potrzebujemy telefonu albo e-maila, żeby odpowiedzieć.';
}

// array_key_exists, nie isset — isset() na stałej tablicowej to błąd składni.
if (!array_key_exists($service, CATEGORIES)) {
    $errors['service'] = 'Prosimy wybrać, czego dotyczy zlecenie.';
}

if (text_length($message) < 10) {
    $errors['message'] = 'Kilka zdań o tym, co trzeba zrobić, bardzo nam pomoże.';
}

if (!in_array($consent, ['1', 'true', 'on'], true)) {
    $errors['consent'] = 'Bez tej zgody nie możemy przetwarzać danych.';
}

if ($errors !== []) {
    respond(422, [
        'ok' => false,
        'message' => 'Formularz wymaga poprawki.',
        'errors' => $errors,
    ]);
}

$ip = client_ip();

if (rate_limit_reached($ip)) {
    respond(429, [
        'ok' => false,
        'message' => 'Z tego łącza poszło już kilka zgłoszeń. '
            . 'Poczekaj chwilę albo zadzwoń — 723 505 307.',
    ]);
}

// --- Wysyłka ----------------------------------------------------------------

if (!function_exists('mail')) {
    respond(500, [
        'ok' => false,
        'message' => 'Wysyłka jest chwilowo niedostępna.',
    ]);
}

$category = CATEGORIES[$service];
$sent_at = (new DateTimeImmutable('now', new DateTimeZone('Europe/Warsaw')))
    ->format('Y-m-d H:i');

$lines = [
    'Nowe zapytanie z formularza na handybruk.pl',
    '',
    'Imię: ' . $name,
    'Telefon: ' . ($phone !== '' ? $phone : '—'),
    'E-mail: ' . ($email !== '' ? $email : '—'),
    'Miejscowość: ' . ($place !== '' ? $place : '—'),
    'Kategoria: ' . $category,
    '',
    'Treść zgłoszenia:',
    wordwrap($message, 78, "\n", false),
    '',
    '--',
    'Wysłane ' . $sent_at . ($ip !== '' ? ' z adresu ' . $ip : ''),
];

// Quoted-printable, nie surowe 8bit: treść ma polskie znaki, a nie każdy serwer
// po drodze deklaruje 8BITMIME. Kodowanie robi funkcja wbudowana w PHP.
$body = quoted_printable_encode(str_replace("\n", "\r\n", implode("\n", $lines)));
$subject = mime_header('Zapytanie: ' . $category . ' — ' . $name);

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    'From: ' . display_name(SENDER_NAME) . ' <' . SENDER . '>',
];

// Reply-To tylko wtedy, gdy adres przeszedł walidację — inaczej „Odpowiedz”
// w kliencie poczty wysłałoby wiadomość w nicość.
if ($has_email) {
    $headers[] = $name !== ''
        ? 'Reply-To: ' . display_name($name) . ' <' . $email . '>'
        : 'Reply-To: ' . $email;
}

// Piąty argument ustawia kopertowego nadawcę (SPF, zwroty). Część hostingów
// go blokuje i mail() zwraca wtedy false — stąd druga próba bez niego.
$ok = @mail(MAILBOX, $subject, $body, implode("\r\n", $headers), '-f' . SENDER);

if (!$ok) {
    $ok = @mail(MAILBOX, $subject, $body, implode("\r\n", $headers));
}

if (!$ok) {
    respond(500, [
        'ok' => false,
        'message' => 'Serwer poczty odrzucił wiadomość.',
    ]);
}

rate_limit_record($ip);

respond(200, ['ok' => true]);
