<?php
/**
 * POST /php_api/cancelar_pedido.php
 * Cancela el pedido activo (`en_espera = 0`) y registra una alarma en `alarmas`.
 *
 * Acepta:
 * - Por inactividad/manual: { "motivo": "Cancelado por inactividad" }
 * - Por error de estación:  { "estacion": "banda" }
 */

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(['success' => false, 'error' => 'Método no permitido. Usa POST.'], 405);
}

$body = getJsonBody();

try {
    $pdo = getDbConnection();

    // Caso 1: Cancelación por error detectado en alguna estación (evita duplicar alarmas)
    if (isset($body['estacion'])) {
        $estacion = trim((string) $body['estacion']) !== '' ? (string) $body['estacion'] : 'proceso';
        $desc = "Error detectado en {$estacion} - Pedido cancelado";

        $activeStmt = $pdo->query('SELECT `ID_pedido` FROM `pedido_historico` WHERE `en_espera` = 1 LIMIT 1');
        $active = $activeStmt->fetch();

        if ($active !== false) {
            $alarmStmt = $pdo->prepare(
                'INSERT INTO `alarmas` (`ID_estado`, `fecha_hora`, `descripcion`) VALUES (1, NOW(), :desc)'
            );
            $alarmStmt->execute([':desc' => $desc]);
            $pdo->exec('UPDATE `pedido_historico` SET `en_espera` = 0 WHERE `en_espera` = 1');
        }

        sendJson([
            'success' => true,
            'message' => 'Pedido cancelado por error',
        ]);
    }

    // Caso 2: Cancelación por inactividad o motivo explícito
    $motivo = isset($body['motivo']) && trim((string) $body['motivo']) !== ''
        ? (string) $body['motivo']
        : 'Cancelado por inactividad';

    $pdo->exec('UPDATE `pedido_historico` SET `en_espera` = 0 WHERE `en_espera` = 1');
    $alarmStmt = $pdo->prepare(
        'INSERT INTO `alarmas` (`ID_estado`, `fecha_hora`, `descripcion`) VALUES (1, NOW(), :motivo)'
    );
    $alarmStmt->execute([':motivo' => $motivo]);

    sendJson([
        'success' => true,
        'message' => 'Pedido cancelado correctamente',
    ]);
} catch (Throwable $e) {
    sendJson([
        'success' => false,
        'error' => $e->getMessage(),
    ], 500);
}
