<?php
declare(strict_types=1);
/**
 * CLI-only preflight for the Opylytel PHP intake.
 * Prints statuses only; never prints the secret salt or personal data.
 * Run on the TARGET server after setting the same environment as intake.php.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$checks = [];
function check(string $name, bool $ok, string $help): void {
    global $checks;
    $checks[] = ['check' => $name, 'ok' => $ok, 'hint' => $ok ? '' : $help];
}
check('PHP >= 8.1', PHP_VERSION_ID >= 80100, 'Select a PHP version 8.1 or newer.');
check('mbstring', extension_loaded('mbstring'), 'Enable PHP extension mbstring.');
check('PDO SQLite', in_array('sqlite', PDO::getAvailableDrivers(), true), 'Enable pdo_sqlite.');
check('TLS site configured', getenv('OPYLITEL_SITE_HTTPS_READY') === '1', 'Verify certificate + HTTPS API URL and set OPYLITEL_SITE_HTTPS_READY=1.');
$docroot = realpath((string)(getenv('OPYLITEL_WEB_ROOT') ?: ''));
check('Public document root', $docroot !== false && is_dir($docroot), 'Set OPYLITEL_WEB_ROOT to absolute public_html path.');
$dbPath = getenv('OPYLITEL_DB_PATH') ?: '';
$privateDir = $dbPath !== '' && str_starts_with($dbPath, '/') ? realpath(dirname($dbPath)) : false;
$safe = $docroot !== false && $privateDir !== false
    && $privateDir !== $docroot && !str_starts_with($privateDir, $docroot . DIRECTORY_SEPARATOR);
check('SQLite outside webroot', $safe, 'Use an existing private folder separate from public_html.');
check('Private folder writable', $safe && is_writable($privateDir), 'Grant access only to the PHP process for private storage.');
check('Hash salt present', strlen((string)(getenv('OPYLITEL_HASH_SALT') ?: '')) >= 32, 'Set a cryptographically random 32+ char server-only value.');
check('Approved consent version', strlen((string)(getenv('OPYLITEL_CONSENT_VERSION') ?: '')) > 0, 'Publish signed-off consent and set its version.');
check('Personal-data compliance sign-off', getenv('OPYLITEL_LEGAL_READY') === '1', 'Complete operator details, notification and security/legal check, then set OPYLITEL_LEGAL_READY=1.');
check('Production API stays off until ready', getenv('OPYLITEL_ACCEPTING') !== '1' || getenv('OPYLITEL_LEGAL_READY') === '1', 'Disable OPYLITEL_ACCEPTING until legal steps are complete.');
$pass = array_reduce($checks, static fn(bool $acc, array $c): bool => $acc && $c['ok'], true);
echo json_encode(['status' => $pass ? 'ready' : 'blocked', 'checks' => $checks], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
exit($pass ? 0 : 1);
