<?php
/**
 * GET /php_api/consultar_disponibilidad.php
 * Consulta las tablas `categoria_piezas` y `Almacen` para saber qué categorías
 * y piezas individuales están disponibles en stock.
 */

require_once __DIR__ . '/config.php';

try {
    $pdo = getDbConnection();

    $catTable = findTableName($pdo, ['categoria_piezas', 'categoría_piezas']);
    $almTable = findTableName($pdo, ['almacen', 'almacén']);

    $categoriasRows = [];
    $almacenRows = [];

    if ($catTable !== null) {
        $stmt = $pdo->query("SELECT * FROM `{$catTable}`");
        $categoriasRows = $stmt->fetchAll();
    }

    if ($almTable !== null) {
        $stmt = $pdo->query("SELECT * FROM `{$almTable}`");
        $almacenRows = $stmt->fetchAll();
    }

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
