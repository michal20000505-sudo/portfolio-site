<?php
/* ==========================================================================
   OVERPRINT: ranking wyników (shooter.html)

   GET  ?period=all|week&limit=50        → { entries: [...] }
   POST { action: "start" }              → { token }
   POST { action: "submit", token, name, score, wave, kills, time, build }
                                         → { ok, id, rank, rankWeek }

   Dane leżą w api/data/ w plikach .php zaczynających się od "<?php exit;",
   więc nawet bez .htaccess nie da się ich pobrać przez przeglądarkę.
   Token jest podpisany HMAC-iem, jednorazowy i niesie czas startu przebiegu;
   serwer odrzuca wyniki niemożliwe do osiągnięcia w zgłoszonym czasie.
   Pełnej ochrony przed oszustwem w grze przeglądarkowej nie ma: to są
   rozsądne bariery, nie gwarancja.
   ========================================================================== */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const DATA_DIR = __DIR__ . '/data';
const DB_FILE = DATA_DIR . '/scores.php';
const SECRET_FILE = DATA_DIR . '/secret.php';
const GUARD = "<?php exit; ?>\n";
const KEEP_TOP = 500;          // tyle najlepszych wyników zostaje na zawsze
const KEEP_DAYS = 8;           // plus wszystkie z ostatnich dni (do rankingu tygodnia)
const MAX_ROWS = 4000;
const SUBMIT_GAP = 15;         // sekundy między zapisami z jednego IP

function out(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function ensure_dir(): void {
    if (!is_dir(DATA_DIR) && !mkdir(DATA_DIR, 0755, true)) out(500, ['error' => 'Brak katalogu danych.']);
    $ht = DATA_DIR . '/.htaccess';
    if (!file_exists($ht)) @file_put_contents($ht, "Require all denied\nDeny from all\n");
    $idx = DATA_DIR . '/index.html';
    if (!file_exists($idx)) @file_put_contents($idx, '');
}

function secret(): string {
    ensure_dir();
    if (file_exists(SECRET_FILE)) {
        $raw = (string) file_get_contents(SECRET_FILE);
        $key = trim(substr($raw, strlen(GUARD)));
        if (strlen($key) >= 32) return $key;
    }
    $key = bin2hex(random_bytes(32));
    file_put_contents(SECRET_FILE, GUARD . $key, LOCK_EX);
    return $key;
}

function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64u_dec(string $s): string { return (string) base64_decode(strtr($s, '-_', '+/')); }

// Odczyt i zapis bazy pod jedną blokadą.
function with_db(callable $fn) {
    ensure_dir();
    $fh = fopen(DB_FILE, 'c+');
    if (!$fh) out(500, ['error' => 'Nie można otworzyć bazy.']);
    flock($fh, LOCK_EX);
    $raw = stream_get_contents($fh);
    $db = null;
    if ($raw !== false && strlen($raw) > strlen(GUARD)) $db = json_decode(substr($raw, strlen(GUARD)), true);
    if (!is_array($db)) $db = ['scores' => [], 'used' => [], 'ips' => []];
    [$db, $result, $write] = $fn($db);
    if ($write) {
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, GUARD . json_encode($db, JSON_UNESCAPED_UNICODE));
        fflush($fh);
    }
    flock($fh, LOCK_UN);
    fclose($fh);
    return $result;
}

function sort_scores(array &$rows): void {
    usort($rows, fn($a, $b) => $b['score'] <=> $a['score'] ?: $a['date'] <=> $b['date']);
}

function public_row(array $r): array {
    return ['id' => $r['id'], 'name' => $r['name'], 'score' => $r['score'], 'wave' => $r['wave'],
            'kills' => $r['kills'], 'time' => $r['time'], 'build' => $r['build'], 'date' => $r['date']];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// --- GET: tablica wyników ------------------------------------------------------------------------
if ($method === 'GET') {
    $period = ($_GET['period'] ?? 'all') === 'week' ? 'week' : 'all';
    $limit = max(1, min(100, (int) ($_GET['limit'] ?? 50)));
    $rows = with_db(fn($db) => [$db, $db['scores'], false]);
    if ($period === 'week') {
        $since = time() - 7 * 86400;
        $rows = array_values(array_filter($rows, fn($r) => $r['date'] >= $since));
    }
    sort_scores($rows);
    out(200, ['entries' => array_map('public_row', array_slice($rows, 0, $limit))]);
}

if ($method !== 'POST') out(405, ['error' => 'Metoda niedozwolona.']);

$body = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($body)) out(400, ['error' => 'Zły format.']);
$action = $body['action'] ?? '';

// --- POST start: token przebiegu ------------------------------------------------------------------
if ($action === 'start') {
    $payload = b64u(json_encode(['t' => time(), 'n' => bin2hex(random_bytes(8))]));
    $sig = b64u(hash_hmac('sha256', $payload, secret(), true));
    out(200, ['token' => $payload . '.' . $sig]);
}

// --- POST submit: zapis wyniku --------------------------------------------------------------------
if ($action === 'submit') {
    $token = (string) ($body['token'] ?? '');
    $parts = explode('.', $token);
    if (count($parts) !== 2) out(400, ['error' => 'Brak tokenu.']);
    [$payload, $sig] = $parts;
    if (!hash_equals(b64u(hash_hmac('sha256', $payload, secret(), true)), $sig)) out(403, ['error' => 'Zły token.']);
    $tok = json_decode(b64u_dec($payload), true);
    if (!is_array($tok) || !isset($tok['t'], $tok['n'])) out(403, ['error' => 'Zły token.']);

    $name = trim(preg_replace('/\s+/u', ' ', (string) ($body['name'] ?? '')));
    if (!preg_match('/^[\p{L}\p{N} _\-.!?]{2,16}$/u', $name)) out(400, ['error' => 'Nick: 2–16 znaków (litery, cyfry, spacja, _ - . ! ?).']);
    $score = (int) ($body['score'] ?? 0);
    $wave = (int) ($body['wave'] ?? 0);
    $kills = (int) ($body['kills'] ?? 0);
    $gameTime = (int) ($body['time'] ?? 0);
    $build = mb_substr(preg_replace('/[^\p{L}\p{N} \[\]·.\-]/u', '', (string) ($body['build'] ?? '')), 0, 120);

    $now = time();
    $age = $now - (int) $tok['t'];
    // Wiarygodność: czas gry nie dłuższy niż czas od startu, fale i zabójstwa w rozsądnym tempie,
    // wynik ograniczony przez liczbę zabójstw i fal (z dużym zapasem).
    $plausible = $score >= 0 && $wave >= 1 && $kills >= 0 && $gameTime >= 0
        && $age <= 6 * 3600
        && $gameTime <= $age + 15
        && $wave <= 2 + intdiv($gameTime, 8)
        && $kills <= $gameTime * 30 + 60
        && $score <= $kills * 60 * 3 * 5 * (1 + 0.1 * $wave) + 30000 * $wave + 400 * $wave * $wave;
    if (!$plausible) out(422, ['error' => 'Wynik nie przeszedł weryfikacji.']);

    $ip = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . secret());
    $nonce = (string) $tok['n'];

    $result = with_db(function ($db) use ($nonce, $ip, $now, $name, $score, $wave, $kills, $gameTime, $build) {
        // sprzątanie starych wpisów zabezpieczeń
        $db['used'] = array_filter($db['used'], fn($t) => $t > $now - 7 * 3600);
        $db['ips'] = array_filter($db['ips'], fn($t) => $t > $now - 3600);
        if (isset($db['used'][$nonce])) return [$db, ['code' => 409, 'error' => 'Ten przebieg jest już zapisany.'], false];
        if (isset($db['ips'][$ip]) && $db['ips'][$ip] > $now - SUBMIT_GAP) return [$db, ['code' => 429, 'error' => 'Za szybko. Spróbuj za chwilę.'], false];
        $db['used'][$nonce] = $now;
        $db['ips'][$ip] = $now;

        $id = bin2hex(random_bytes(5));
        $db['scores'][] = ['id' => $id, 'name' => $name, 'score' => $score, 'wave' => $wave, 'kills' => $kills,
                           'time' => $gameTime, 'build' => $build, 'date' => $now];
        $rows = $db['scores'];
        sort_scores($rows);
        $rank = 1 + (int) array_search($id, array_column($rows, 'id'), true);
        $since = $now - 7 * 86400;
        $week = array_values(array_filter($rows, fn($r) => $r['date'] >= $since));
        $rankWeek = 1 + (int) array_search($id, array_column($week, 'id'), true);
        // przycinanie: najlepsze na zawsze + świeże do rankingu tygodnia
        $keepSince = $now - KEEP_DAYS * 86400;
        $kept = [];
        foreach ($rows as $i => $r) if ($i < KEEP_TOP || $r['date'] >= $keepSince) $kept[] = $r;
        $db['scores'] = array_slice($kept, 0, MAX_ROWS);
        return [$db, ['ok' => true, 'id' => $id, 'rank' => $rank, 'rankWeek' => $rankWeek], true];
    });
    if (isset($result['code'])) out($result['code'], ['error' => $result['error']]);
    out(200, $result);
}

out(400, ['error' => 'Nieznana akcja.']);
