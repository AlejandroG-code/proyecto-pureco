<?php
/**
 * POST /php_api/crear_pedido.php
 * Recibe JSON: { "id_categoria": 1 }  (1 = Electrónica, 2 = Arte, 3 = Juguetes)
 * - Cierra pedidos anteriores en espera
 * - Inserta el nuevo pedido en `pedido_historico` con en_espera = 1
 * - Reinicia todas las estaciones en `Estado` a 1 (En Proceso)
 * - Registra el cambio en `estado_historico`
 */

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(['success' => false, 'error' => 'Método no permitido. Usa POST.'], 405);
}

$body = getJsonBody();
$idCategoria = isset($body['id_categoria']) ? (int) $body['id_categoria'] : 0;

if ($idCategoria <= 0) {
    sendJson(['success' => false, 'error' => 'Falta el campo id_categoria válido (1, 2 o 3).'], 400);
}

try {
    $pdo = getDbConnection();
    $pdo->beginTransaction();

    // 1. Cerrar cualquier pedido anterior que hubiera quedado en espera
    $pdo->exec('UPDATE `pedido_historico` SET `en_espera` = 0 WHERE `en_espera` = 1');

    // 2. Insertar nuevo pedido en espera
    $stmt = $pdo->prepare(
        'INSERT INTO `pedido_historico` (`ID_categoria`, `fecha_hora`, `en_espera`) VALUES (:id_categoria, NOW(), 1)'
    );
    $stmt->execute([':id_categoria' => $idCategoria]);
    $idPedido = (int) $pdo->lastInsertId();

    // 3. Reiniciar el estado de todas las estaciones a 1 (En Proceso)
    $pdo->exec(
        'INSERT INTO `Estado` (`ID_estado`, `almacen`, `banda`, `mitsubishi`, `lugar_entrega`)
         VALUES (1, 1, 1, 1, 1)
         ON DUPLICATE KEY UPDATE
           `almacen` = 1,
           `banda` = 1,
           `mitsubishi` = 1,
           `lugar_entrega` = 1'
    );

    // 4. Registrar en estado_historico
    $pdo->exec('INSERT INTO `estado_historico` (`ID_estado`, `fecha_hora`) VALUES (1, NOW())');

    $pdo->commit();

    sendJson([
        'success' => true,
        'id_pedido' => $idPedido,
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendJson([
        'success' => false,
        'error' => $e->getMessage(),
    ], 500);
}
