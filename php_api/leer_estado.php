<?php
/**
 * GET /php_api/leer_estado.php
 * Obtiene el estado actual de las estaciones (almacen, banda, mitsubishi, lugar_entrega).
 * Si todas las estaciones están en 2 (Terminado) o alguna está en 4 (Error),
 * libera automáticamente `en_espera = 0` en `pedido_historico`.
 */

require_once __DIR__ . '/config.php';

try {
    $pdo = getDbConnection();
    $stmt = $pdo->query('SELECT * FROM `Estado` ORDER BY `ID_estado` DESC LIMIT 1');
    $estado = $stmt->fetch();

    if ($estado !== false) {
        releaseWaitIfFinishedOrError($pdo, $estado);
        sendJson([
            'success' => true,
            'estado' => $estado,
        ]);
    } else {
        sendJson([
            'success' => true,
            'estado' => null,
        ]);
    }
} catch (Throwable $e) {
    sendJson([
        'success' => false,
        'error' => $e->getMessage(),
    ], 500);
}
