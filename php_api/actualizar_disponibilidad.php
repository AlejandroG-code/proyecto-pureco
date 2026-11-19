<?php
/**
 * PUT / POST /php_api/actualizar_disponibilidad.php
 * Recibe JSON: { "id_almacen": 1, "disponible": 0 } o { "id_categoria": 2, "disponible": 1 }
 * Actualiza `Almacen.disponible` y recalcula `categoria_piezas.cantidad`.
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['PUT', 'POST'], true)) {
    sendJson(['success' => false, 'error' => 'Método no permitido. Usa PUT o POST.'], 405);
}

$body = getJsonBody();
$dispVal = !empty($body['disponible']) && (int) $body['disponible'] !== 0 ? 1 : 0;

try {
    $pdo = getDbConnection();

    $catTable = findTableName($pdo, ['categoria_piezas', 'categoría_piezas']) ?? 'categoria_piezas';
    $almTable = findTableName($pdo, ['almacen', 'almacén']) ?? 'Almacen';

    if (isset($body['id_almacen']) && $body['id_almacen'] !== null && $body['id_almacen'] !== '') {
        $stmt = $pdo->prepare("UPDATE `{$almTable}` SET `disponible` = :disp WHERE `ID_almacen` = :id");
        $stmt->execute([
            ':disp' => $dispVal,
            ':id' => (int) $body['id_almacen'],
        ]);
    } elseif (isset($body['id_categoria']) && $body['id_categoria'] !== null && $body['id_categoria'] !== '') {
        $stmt = $pdo->prepare("UPDATE `{$almTable}` SET `disponible` = :disp WHERE `ID_categoria` = :id");
        $stmt->execute([
            ':disp' => $dispVal,
            ':id' => (int) $body['id_categoria'],
        ]);
    }

    // Sincronizar la columna cantidad en categoria_piezas según Almacen
    $pdo->exec(
        "UPDATE `{$catTable}` c
         SET c.`cantidad` = (
           SELECT COUNT(*)
           FROM `{$almTable}` a
           WHERE a.`ID_categoria` = c.`ID_categoria` AND a.`disponible` = 1
         )"
    );

    $categoriasRows = $pdo->query("SELECT * FROM `{$catTable}`")->fetchAll();
    $almacenRows = $pdo->query("SELECT * FROM `{$almTable}`")->fetchAll();

    sendJson([
        'success' => true,
        'categoria_piezas' => $categoriasRows,
        'almacen' => $almacenRows,
    ]);
} catch (Throwable $e) {
    sendJson([
        'success' => false,
        'error' => $e->getMessage(),
    ], 500);
}
