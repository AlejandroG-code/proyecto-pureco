import 'dotenv/config';
import mysql from 'mysql2/promise';

const rawDbName = (process.env.DB_NAME || process.env.MYSQLDATABASE || 'proyecto_redes').trim();
const dbName = rawDbName.replace(/[`'"]/g, '') || 'proyecto_redes';

const baseConfig = {
  host: (process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1').trim(),
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
  user: (process.env.DB_USER || process.env.MYSQLUSER || 'root').trim(),
  password: process.env.DB_PASSWORD !== undefined
    ? process.env.DB_PASSWORD
    : (process.env.MYSQLPASSWORD !== undefined ? process.env.MYSQLPASSWORD : ''),
  ssl: (process.env.DB_SSL === 'true' || process.env.MYSQL_SSL === 'true')
    ? { rejectUnauthorized: false }
    : undefined
};

const normalizeName = (name) =>
  String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

async function resetDatabase() {
  let conn;
  try {
    console.log(`Conectando a MySQL (${baseConfig.host}:${baseConfig.port}) para limpiar BD "${dbName}"...`);
    conn = await mysql.createConnection(baseConfig);

    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
    await conn.query(`USE \`${dbName}\``);

    const [tablesResult] = await conn.query('SHOW TABLES');
    const existing = tablesResult.map((row) => Object.values(row)[0]);

    const findExisting = (candidates, fallback) => {
      const norm = candidates.map(normalizeName);
      return existing.find((t) => norm.includes(normalizeName(t))) || fallback;
    };
    const hasTable = (candidates) => {
      const norm = candidates.map(normalizeName);
      return existing.some((t) => norm.includes(normalizeName(t)));
    };

    // Crear tablas faltantes si aún no existen
    if (!hasTable(['Estado'])) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`Estado\` (
          \`ID_estado\` TINYINT(1) NOT NULL,
          \`almacen\` TINYINT(1) NOT NULL DEFAULT 3,
          \`banda\` TINYINT(1) NOT NULL DEFAULT 3,
          \`mitsubishi\` TINYINT(1) NOT NULL DEFAULT 3,
          \`lugar_entrega\` TINYINT(1) NOT NULL DEFAULT 3,
          PRIMARY KEY (\`ID_estado\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (!hasTable(['estado_historico'])) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`estado_historico\` (
          \`ID_estado_historico\` INT NOT NULL AUTO_INCREMENT,
          \`ID_estado\` INT NOT NULL,
          \`almacen\` TINYINT(1) NOT NULL DEFAULT 3,
          \`banda\` TINYINT(1) NOT NULL DEFAULT 3,
          \`mitsubishi\` TINYINT(1) NOT NULL DEFAULT 3,
          \`lugar_entrega\` TINYINT(1) NOT NULL DEFAULT 3,
          \`fecha_hora\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`ID_estado_historico\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (!hasTable(['alarmas'])) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`alarmas\` (
          \`ID_alarmas\` INT NOT NULL AUTO_INCREMENT,
          \`ID_estado\` INT NOT NULL,
          \`fecha_hora\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`descripcion\` TINYTEXT NOT NULL,
          PRIMARY KEY (\`ID_alarmas\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (!hasTable(['categoria_piezas', 'categoría_piezas'])) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`categoria_piezas\` (
          \`ID_categoria\` INT NOT NULL,
          \`Nombre_categoria\` VARCHAR(50) NOT NULL,
          \`Cantidad\` TINYINT(1) NOT NULL DEFAULT 3,
          \`Posicion\` VARCHAR(20) NOT NULL DEFAULT '',
          PRIMARY KEY (\`ID_categoria\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (!hasTable(['Piezas', 'piezas'])) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`Piezas\` (
          \`ID_pieza\` INT NOT NULL AUTO_INCREMENT,
          \`ID_categoria\` INT NOT NULL,
          \`nombre_pieza\` VARCHAR(50) NOT NULL,
          \`disponible\` TINYINT(1) NOT NULL DEFAULT 1,
          PRIMARY KEY (\`ID_pieza\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (!hasTable(['pedido_historico'])) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`pedido_historico\` (
          \`ID_pedido\` INT NOT NULL AUTO_INCREMENT,
          \`ID_categoria\` INT NOT NULL,
          \`fecha_hora\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`en_espera\` TINYINT(1) NOT NULL DEFAULT 1,
          PRIMARY KEY (\`ID_pedido\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    // Re-consultar nombres reales de tablas
    const [tablesAfter] = await conn.query('SHOW TABLES');
    const allTables = tablesAfter.map((row) => Object.values(row)[0]);
    const getTable = (candidates, fallback) => {
      const norm = candidates.map(normalizeName);
      return allTables.find((t) => norm.includes(normalizeName(t))) || fallback;
    };

    const t = {
      estado: getTable(['Estado', 'estado'], 'Estado'),
      estado_historico: getTable(['estado_historico'], 'estado_historico'),
      alarmas: getTable(['alarmas'], 'alarmas'),
      categoria_piezas: getTable(['categoria_piezas', 'categoría_piezas'], 'categoria_piezas'),
      piezas: getTable(['Piezas', 'piezas'], 'Piezas'),
      pedido_historico: getTable(['pedido_historico'], 'pedido_historico')
    };

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // Eliminar tabla Almacen si existía en la base de datos
    const existingAlmacen = allTables.find((name) =>
      ['almacen', 'almacén'].includes(normalizeName(name))
    );
    if (existingAlmacen) {
      await conn.query(`DROP TABLE IF EXISTS \`${existingAlmacen}\``);
    }

    // Limpiar todas las tablas y reiniciar AUTO_INCREMENT
    for (const tableName of Object.values(t)) {
      await conn.query(`TRUNCATE TABLE \`${tableName}\``);
    }

    // 1. Insertar las 3 categorías en categoria_piezas:
    //    1, Electronica, 3, 1,2,3
    //    2, Arte,        2, 4,5
    //    3, Juguetes,    2, 6,7
    const [catCols] = await conn.query(`SHOW COLUMNS FROM \`${t.categoria_piezas}\``);
    const catColNames = catCols.map((c) => c.Field);
    const catIdCol = catColNames.find((c) => normalizeName(c) === 'id_categoria') || 'ID_categoria';
    const catNameCol =
      catColNames.find((c) => ['nombre_categoria', 'nombre', 'categoria'].includes(normalizeName(c))) ||
      'Nombre_categoria';
    let catCantCol = catColNames.find((c) => normalizeName(c) === 'cantidad') || null;
    let catPosCol = catColNames.find((c) => normalizeName(c) === 'posicion') || null;

    if (!catCantCol) {
      await conn.query(`ALTER TABLE \`${t.categoria_piezas}\` ADD COLUMN \`Cantidad\` TINYINT(1) NOT NULL DEFAULT 3`);
      catCantCol = 'Cantidad';
    }
    if (!catPosCol) {
      await conn.query(`ALTER TABLE \`${t.categoria_piezas}\` ADD COLUMN \`Posicion\` VARCHAR(20) NOT NULL DEFAULT ''`);
      catPosCol = 'Posicion';
    }

    await conn.query(`
      INSERT INTO \`${t.categoria_piezas}\` (\`${catIdCol}\`, \`${catNameCol}\`, \`${catCantCol}\`, \`${catPosCol}\`) VALUES
        (1, 'Electronica', 3, '1,2,3'),
        (2, 'Arte', 2, '4,5'),
        (3, 'Juguetes', 2, '6,7')
    `);

    // 2. Insertar las 9 piezas en Piezas con su relación ID_categoria
    const [pCols] = await conn.query(`SHOW COLUMNS FROM \`${t.piezas}\``);
    const pColNames = pCols.map((c) => c.Field);
    const pIdCol =
      pColNames.find((c) => ['id_pieza', 'id_piezas', 'id'].includes(normalizeName(c))) ||
      pColNames[0] ||
      'ID_pieza';
    const pCatCol =
      pColNames.find((c) => ['id_categoria', 'categoria_id', 'categoria'].includes(normalizeName(c))) ||
      'ID_categoria';
    const pDispCol = pColNames.find((c) => normalizeName(c) === 'disponible') || null;
    let pNameCol =
      pColNames.find((c) =>
        ['nombre_pieza', 'nombre_piezas', 'nombre', 'pieza', 'piezas', 'descripcion', 'producto', 'tipo', 'articulo'].includes(
          normalizeName(c)
        )
      ) || null;

    if (!pNameCol) {
      // Tomar la primera columna de texto (varchar/char/text) que exista en Piezas
      const textCol = pCols.find((c) => {
        const type = String(c.Type || '').toLowerCase();
        const isKnown = [pIdCol, pCatCol, pDispCol].filter(Boolean).includes(c.Field);
        return !isKnown && (type.includes('char') || type.includes('text'));
      });
      pNameCol = textCol ? textCol.Field : null;
    }

    if (!pNameCol) {
      await conn.query(`ALTER TABLE \`${t.piezas}\` ADD COLUMN \`nombre_pieza\` VARCHAR(50) NOT NULL DEFAULT ''`);
      pNameCol = 'nombre_pieza';
    }

    console.log(`   Columnas detectadas en "${t.piezas}":`, { pIdCol, pCatCol, pNameCol, pDispCol });

    const defaultPiezas = [
      [1, 1, 'Computadoras'],
      [2, 1, 'Celular'],
      [3, 1, 'Audífonos'],
      [4, 2, 'Acuarela'],
      [5, 2, 'Gises pasteles'],
      [6, 2, 'Plumones'],
      [7, 3, 'Lego'],
      [8, 3, 'Juego de mesa'],
      [9, 3, 'Rompecabezas']
    ];

    for (const [idPieza, idCat, nombre] of defaultPiezas) {
      if (pDispCol) {
        await conn.execute(
          `INSERT INTO \`${t.piezas}\` (\`${pIdCol}\`, \`${pCatCol}\`, \`${pNameCol}\`, \`${pDispCol}\`) VALUES (?, ?, ?, 1)`,
          [idPieza, idCat, nombre]
        );
      } else {
        await conn.execute(
          `INSERT INTO \`${t.piezas}\` (\`${pIdCol}\`, \`${pCatCol}\`, \`${pNameCol}\`) VALUES (?, ?, ?)`,
          [idPieza, idCat, nombre]
        );
      }
    }

    // 3. Detectar columnas de Estado e inicializar todo en 3 (En espera)
    const [estCols] = await conn.query(`SHOW COLUMNS FROM \`${t.estado}\``);
    const estColNames = estCols.map((c) => c.Field);
    const findEstCol = (candidates) => {
      const norm = candidates.map(normalizeName);
      return estColNames.find((c) => norm.includes(normalizeName(c))) || null;
    };

    const estIdCol = findEstCol(['ID_estado', 'id_estado', 'id']) || estColNames[0] || 'ID_estado';
    const estAlmCol = findEstCol(['almacen', 'almacén']) || 'almacen';
    const estBandaCol = findEstCol(['banda']) || 'banda';
    const estMitCol = findEstCol(['mitsubishi', 'robot']) || 'mitsubishi';
    let estEntCol = findEstCol([
      'lugar_entrega',
      'lugar_de_entrega',
      'rampa',
      'entrega',
      'zona_entrega',
      'estacion_entrega',
      'punto_entrega'
    ]);
    if (!estEntCol) {
      const known = new Set([estIdCol, estAlmCol, estBandaCol, estMitCol].map(normalizeName));
      estEntCol = estColNames.find((c) => !known.has(normalizeName(c))) || null;
    }
    if (!estEntCol) {
      await conn.query(`ALTER TABLE \`${t.estado}\` ADD COLUMN \`lugar_entrega\` TINYINT(1) NOT NULL DEFAULT 3`);
      estEntCol = 'lugar_entrega';
    }

    await conn.query(`
      INSERT INTO \`${t.estado}\` (\`${estIdCol}\`, \`${estAlmCol}\`, \`${estBandaCol}\`, \`${estMitCol}\`, \`${estEntCol}\`)
      VALUES (1, 3, 3, 3, 3)
    `);

    // 4. Asegurar columnas de estaciones en estado_historico e insertar registro inicial en 3 (En espera)
    const [ehCols] = await conn.query(`SHOW COLUMNS FROM \`${t.estado_historico}\``);
    const ehColNames = ehCols.map((c) => c.Field);
    const findEhCol = (candidates) => {
      const norm = candidates.map(normalizeName);
      return ehColNames.find((c) => norm.includes(normalizeName(c))) || null;
    };
    const ensureEhCol = async (candidates, defaultName) => {
      let col = findEhCol(candidates);
      if (!col) {
        await conn.query(`ALTER TABLE \`${t.estado_historico}\` ADD COLUMN \`${defaultName}\` TINYINT(1) NOT NULL DEFAULT 3`);
        col = defaultName;
      }
      return col;
    };

    const ehIdEstCol = findEhCol(['ID_estado', 'id_estado']) || 'ID_estado';
    const ehFechaCol = findEhCol(['fecha_hora', 'fecha', 'timestamp', 'created_at']) || 'fecha_hora';
    const ehAlmCol = await ensureEhCol(['almacen', 'almacén'], estAlmCol);
    const ehBandaCol = await ensureEhCol(['banda'], estBandaCol);
    const ehMitCol = await ensureEhCol(['mitsubishi', 'robot'], estMitCol);
    const ehEntCol = await ensureEhCol(
      [estEntCol, 'lugar_entrega', 'lugar_de_entrega', 'rampa', 'entrega', 'zona_entrega', 'estacion_entrega'],
      estEntCol
    );

    await conn.query(`
      INSERT INTO \`${t.estado_historico}\` (\`${ehIdEstCol}\`, \`${ehAlmCol}\`, \`${ehBandaCol}\`, \`${ehMitCol}\`, \`${ehEntCol}\`, \`${ehFechaCol}\`)
      VALUES (1, 3, 3, 3, 3, NOW())
    `);

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log(`\n✅ Base de datos "${dbName}" limpiada y reinicializada correctamente:`);
    console.log(`   - ${t.categoria_piezas}: 3 categorías (Electronica, Arte, Juguetes)`);
    console.log(`   - ${t.piezas}: 9 piezas con su relación ID_categoria`);
    console.log(`   - ${t.estado} y ${t.estado_historico}: todas las estaciones en 3 (En espera)`);
    console.log(`   - ${t.pedido_historico} y ${t.alarmas}: vacías`);
    console.log(`   - Tabla Almacen: eliminada`);
  } catch (error) {
    console.error('❌ Error al limpiar la base de datos:', error.message);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
}

resetDatabase();
