<?php
/**
 * PUT / POST /php_api/actualizar_estado.php
 * Actualiza uno o varios campos de la tabla `Estado` (almacen, banda, mitsubishi, lugar_entrega).
 * - Registra el cambio en `estado_historico`
 * - Si alguna estación pasa a 4 (Error), inserta alarma y libera `en_espera = 0`
 * - Si todas llegan a 2 (Terminado), libera `en_espera = 0`
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['PUT', 'POST'], true)) {
    sendJson(['success' => false, 'error' => 'Método no permitido. Usa PUT o POST.'], 405);
}

$body = getJsonBody();

try {
    $pdo = getDbConnection();

    $stmt = $pdo->query('SELECT * FROM `Estado` WHERE `ID_estado` = 1');
    $current = $stmt->fetch() ?: [
        'almacen' => 1,
        'banda' => 1,
        'mitsubishi' => 1,
        'lugar_entrega' => 1,
    ];

    $vals = [
        'almacen' => array_key_exists('almacen', $body) ? (int) $body['almacen'] : (int) ($current['almacen'] ?? 1),
        'banda' => array_key_exists('banda', $body) ? (int) $body['banda'] : (int) ($current['banda'] ?? 1),
        'mitsubishi' => array_key_exists('mitsubishi', $body) ? (int) $body['mitsubishi'] : (int) ($current['mitsubishi'] ?? 1),
        'lugar_entrega' => array_key_exists('lugar_entrega', $body) ? (int) $body['lugar_entrega'] : (int) ($current['lugar_entrega'] ?? 1),
    ];

    $upsert = $pdo->prepare(
        'INSERT INTO `Estado` (`ID_estado`, `almacen`, `banda`, `mitsubishi`, `lugar_entrega`)
         VALUES (1, :almacen, :banda, :mitsubishi, :lugar_entrega)
         ON DUPLICATE KEY UPDATE
           `almacen` = VALUES(`almacen`),
           `banda` = VALUES(`banda`),
           `mitsubishi` = VALUES(`mitsubishi`),
           `lugar_entrega` = VALUES(`lugar_entrega`)'
    );
    $upsert->execute([
        ':almacen' => $vals['almacen'],
        ':banda' => $vals['banda'],
        ':mitsubishi' => $vals['mitsubishi'],
        ':lugar_entrega' => $vals['lugar_entrega'],
    ]);

    // Registrar en estado_historico
    $pdo->exec('INSERT INTO `estado_historico` (`ID_estado`, `fecha_hora`) VALUES (1, NOW())');

    // Si alguna estación se puso en 4 (Error), registrar alarma y cancelar pedido activo
    $errorStations = [];
    foreach ($vals as $station => $value) {
        if ($value === 4) {
            $errorStations[] = $station;
        }
    }

    if (!empty($errorStations)) {
        $desc = 'Error en estación (' . implode(', ', $errorStations) . ') - Pedido cancelado';
        $alarmStmt = $pdo->prepare(
            'INSERT INTO `alarmas` (`ID_estado`, `fecha_hora`, `descripcion`) VALUES (1, NOW(), :desc)'
        );
        $alarmStmt->execute([':desc' => $desc]);
        $pdo->exec('UPDATE `pedido_historico` SET `en_espera` = 0 WHERE `en_espera` = 1');
    }

    // Si todas las estaciones llegaron a 2 (Terminado), liberar en_espera
    if (
        $vals['almacen'] === 2 &&
        $vals['banda'] === 2 &&
        $vals['mitsubishi'] === 2 &&
        $vals['lugar_entrega'] === 2
    ) {
        $pdo->exec('UPDATE `pedido_historico` SET `en_espera` = 0 WHERE `en_espera` = 1');
    }

    $updatedStmt = $pdo->query('SELECT * FROM `Estado` WHERE `ID_estado` = 1');
    $updated = $updatedStmt->fetch();

    sendJson([
        'success' => true,
        'estado' => $updated,
    ]);
} catch (Throwable $e) {
    sendJson([
        'success' => false,
        'error' => $e->getMessage(),
    ], 500);
}
