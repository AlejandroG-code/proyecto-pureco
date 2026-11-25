<?php
/**
 * Configuración central de conexión a MySQL (XAMPP) y utilidades JSON/CORS.
 * Copiar toda la carpeta `php_api` dentro de: C:\xampp\htdocs\php_api\
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Responder inmediatamente a peticiones preflight CORS (OPTIONS)
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ==========================================================
// CREDENCIALES DE MYSQL (leídas automáticamente desde ../.env)
// Cambia DB_NAME / DB_HOST SOLO en el archivo .env de la raíz.
// ==========================================================
$envValues = [];
$envFile = dirname(__DIR__) . '/.env';
if (is_file($envFile) && is_readable($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#') || !str_contains($trimmed, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $trimmed, 2);
        $envValues[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
    }
}

define('DB_HOST', $envValues['DB_HOST'] ?? '127.0.0.1');
define('DB_PORT', (int) ($envValues['DB_PORT'] ?? 3306));
define('DB_NAME', $envValues['DB_NAME'] ?? 'proyecto_redes');
define('DB_USER', $envValues['DB_USER'] ?? 'root');
define('DB_PASS', $envValues['DB_PASSWORD'] ?? '');

/**
 * Crea y devuelve una conexión PDO a MySQL.
 * Si la base de datos no existe, la crea automáticamente.
 */
function getDbConnection(): PDO
{
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        DB_HOST,
        DB_PORT,
        DB_NAME
    );

    try {
        return new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        // Error 1049: Unknown database -> crearla automáticamente y reconectar
        if ((int) ($e->errorInfo[1] ?? 0) === 1049 || str_contains($e->getMessage(), 'Unknown database')) {
            $baseDsn = sprintf('mysql:host=%s;port=%d;charset=utf8mb4', DB_HOST, DB_PORT);
            $pdoInit = new PDO($baseDsn, DB_USER, DB_PASS, $options);
            $safeDb = str_replace('`', '', DB_NAME);
            $pdoInit->exec("CREATE DATABASE IF NOT EXISTS `{$safeDb}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
            return new PDO($dsn, DB_USER, DB_PASS, $options);
        }
        throw $e;
    }
}

/**
 * Envía una respuesta JSON y termina la ejecución.
 */
function sendJson(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Lee el cuerpo JSON enviado por fetch() (o $_POST como respaldo).
 */
function getJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw !== false && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }
    return is_array($_POST) ? $_POST : [];
}

/**
 * Busca el nombre real de una tabla en la BD (maneja mayúsculas y acentos).
 */
function findTableName(PDO $pdo, array $candidates): ?string
{
    $stmt = $pdo->query('SHOW TABLES');
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $lowerCandidates = array_map(
        static fn($name) => mb_strtolower($name, 'UTF-8'),
        $candidates
    );

    foreach ($tables as $table) {
        if (in_array(mb_strtolower((string) $table, 'UTF-8'), $lowerCandidates, true)) {
            return (string) $table;
        }
    }

    return null;
}

/**
 * Si todas las estaciones terminaron (2) o alguna tiene error (4),
 * libera cualquier pedido activo poniendo en_espera = 0.
 */
function releaseWaitIfFinishedOrError(PDO $pdo, array $est): void
{
    $almacen = (int) ($est['almacen'] ?? 0);
    $banda = (int) ($est['banda'] ?? 0);
    $mitsubishi = (int) ($est['mitsubishi'] ?? 0);
    $lugarEntrega = (int) ($est['lugar_entrega'] ?? 0);

    $allDone = ($almacen === 2 && $banda === 2 && $mitsubishi === 2 && $lugarEntrega === 2);
    $hasError = in_array(4, [$almacen, $banda, $mitsubishi, $lugarEntrega], true);

    if ($allDone || $hasError) {
        $pdo->exec('UPDATE `pedido_historico` SET `en_espera` = 0 WHERE `en_espera` = 1');
    }
}
