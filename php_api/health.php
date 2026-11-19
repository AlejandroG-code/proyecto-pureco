<?php
/**
 * GET /php_api/health.php
 * Verifica que Apache, PHP y la conexión a MySQL (pitufibase) estén funcionando.
 */

require_once __DIR__ . '/config.php';

try {
    $pdo = getDbConnection();
    $pdo->query('SELECT 1');

    sendJson([
        'success' => true,
        'status' => 'ok',
        'db' => 'connected',
        'database' => DB_NAME,
    ]);
} catch (Throwable $e) {
    sendJson([
        'success' => false,
        'status' => 'error',
        'db' => $e->getMessage(),
    ], 500);
}
