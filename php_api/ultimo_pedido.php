<?php
/**
 * GET /php_api/ultimo_pedido.php
 * Devuelve el último pedido de `pedido_historico` (para verificar si `en_espera` = 1).
 * Si la tabla `Estado` ya terminó (todo en 2) o tiene error (4), libera `en_espera` primero.
 */

require_once __DIR__ . '/config.php';

try {
    $pdo = getDbConnection();

    $estStmt = $pdo->query('SELECT * FROM `Estado` ORDER BY `ID_estado` DESC LIMIT 1');
    $estado = $estStmt->fetch();
    if ($estado !== false) {
        releaseWaitIfFinishedOrError($pdo, $estado);
    }

    $stmt = $pdo->query('SELECT * FROM `pedido_historico` ORDER BY `ID_pedido` DESC LIMIT 1');
    $pedido = $stmt->fetch();

    sendJson([
        'success' => true,
        'pedido' => $pedido !== false ? $pedido : null,
    ]);
} catch (Throwable $e) {
    sendJson([
        'success' => false,
        'error' => $e->getMessage(),
    ], 500);
}
