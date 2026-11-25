import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Evitar caídas por excepciones no capturadas o promesas rechazadas
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Configuración de base de datos centralizada en .env (ÚNICO archivo a editar para cambiar de BD)
const rawDbName = (process.env.DB_NAME || process.env.MYSQLDATABASE || 'proyecto_redes').trim();
const dbName = rawDbName.replace(/[`'"]/g, '') || 'proyecto_redes';

const dbConfig = {
  host: (process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1').trim(),
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
  user: (process.env.DB_USER || process.env.MYSQLUSER || 'root').trim(),
  password: process.env.DB_PASSWORD !== undefined
    ? process.env.DB_PASSWORD
    : (process.env.MYSQLPASSWORD !== undefined ? process.env.MYSQLPASSWORD : ''),
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl: (process.env.DB_SSL === 'true' || process.env.MYSQL_SSL === 'true')
    ? { rejectUnauthorized: false }
    : undefined
};

// Pool de conexiones permanente y resistente a caídas temporales
const pool = mysql.createPool(dbConfig);

// Mapa de nombres reales de tablas (resuelve diferencias de mayúsculas/minúsculas o acentos en BD existentes)
const tables = {
  estado: 'Estado',
  estado_historico: 'estado_historico',
  alarmas: 'alarmas',
  categoria_piezas: 'categoria_piezas',
  piezas: 'Piezas',
  almacen: 'Almacen',
  pedido_historico: 'pedido_historico'
};

// Mapa de nombres reales de columnas de la tabla Estado (ej. si en proyecto_redes se llama rampa/entrega en vez de lugar_entrega)
const estadoCols = {
  id: 'ID_estado',
  almacen: 'almacen',
  banda: 'banda',
  mitsubishi: 'mitsubishi',
  lugar_entrega: 'lugar_entrega'
};

// Mapa de nombres reales de columnas de la tabla estado_historico
const estadoHistoricoCols = {
  id: 'ID_estado_historico',
  id_estado: 'ID_estado',
  almacen: 'almacen',
  banda: 'banda',
  mitsubishi: 'mitsubishi',
  lugar_entrega: 'lugar_entrega',
  fecha_hora: 'fecha_hora'
};

let lastLoggedEstadoKey = null;

const normalizeName = (name) =>
  String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const refreshTableNames = async () => {
  const [tablesResult] = await pool.query('SHOW TABLES');
  const existing = tablesResult.map((row) => Object.values(row)[0]);

  const findExisting = (candidates, fallback) => {
    const normalizedCandidates = candidates.map(normalizeName);
    const match = existing.find((t) => normalizedCandidates.includes(normalizeName(t)));
    return match || fallback;
  };

  tables.estado = findExisting(['Estado', 'estado'], 'Estado');
  tables.estado_historico = findExisting(['estado_historico'], 'estado_historico');
  tables.alarmas = findExisting(['alarmas'], 'alarmas');
  tables.categoria_piezas = findExisting(['categoria_piezas', 'categoría_piezas'], 'categoria_piezas');
  tables.piezas = findExisting(['Piezas', 'piezas'], 'Piezas');
  tables.almacen = findExisting(['Almacen', 'almacen', 'Almacén', 'almacén'], 'Almacen');
  tables.pedido_historico = findExisting(['pedido_historico'], 'pedido_historico');

  return existing;
};

const refreshEstadoColumns = async () => {
  const [colsResult] = await pool.query(`SHOW COLUMNS FROM \`${tables.estado}\``);
  const colNames = colsResult.map((c) => c.Field);

  const findCol = (candidates) => {
    const norm = candidates.map(normalizeName);
    return colNames.find((c) => norm.includes(normalizeName(c))) || null;
  };

  estadoCols.id = findCol(['ID_estado', 'id_estado', 'id']) || colNames[0] || 'ID_estado';
  estadoCols.almacen = findCol(['almacen', 'almacén']) || 'almacen';
  estadoCols.banda = findCol(['banda']) || 'banda';
  estadoCols.mitsubishi = findCol(['mitsubishi', 'robot']) || 'mitsubishi';

  let entregaCol = findCol([
    'lugar_entrega',
    'lugar_de_entrega',
    'rampa',
    'entrega',
    'zona_entrega',
    'estacion_entrega',
    'punto_entrega'
  ]);

  if (!entregaCol) {
    // Si hay una 5ta columna con otro nombre, usarla automáticamente
    const known = new Set(
      [estadoCols.id, estadoCols.almacen, estadoCols.banda, estadoCols.mitsubishi].map(normalizeName)
    );
    entregaCol = colNames.find((c) => !known.has(normalizeName(c))) || null;
  }

  if (!entregaCol) {
    // Si la tabla realmente no tiene columna de entrega/rampa, agregarla
    await pool.query(
      `ALTER TABLE \`${tables.estado}\` ADD COLUMN \`lugar_entrega\` TINYINT(1) NOT NULL DEFAULT 1`
    );
    entregaCol = 'lugar_entrega';
  }

  estadoCols.lugar_entrega = entregaCol;
  console.log(`Columnas detectadas en "${tables.estado}":`, estadoCols);
};

const refreshEstadoHistoricoColumns = async () => {
  const [colsResult] = await pool.query(`SHOW COLUMNS FROM \`${tables.estado_historico}\``);
  const colNames = colsResult.map((c) => c.Field);

  const findCol = (candidates) => {
    const norm = candidates.map(normalizeName);
    return colNames.find((c) => norm.includes(normalizeName(c))) || null;
  };

  estadoHistoricoCols.id = findCol(['ID_estado_historico', 'id_estado_historico', 'id']) || colNames[0] || 'ID_estado_historico';
  estadoHistoricoCols.id_estado = findCol(['ID_estado', 'id_estado']) || 'ID_estado';
  estadoHistoricoCols.fecha_hora = findCol(['fecha_hora', 'fecha', 'timestamp', 'created_at']) || 'fecha_hora';

  const ensureStationCol = async (candidates, defaultColName) => {
    let found = findCol(candidates);
    if (!found) {
      await pool.query(
        `ALTER TABLE \`${tables.estado_historico}\` ADD COLUMN \`${defaultColName}\` TINYINT(1) NOT NULL DEFAULT 1`
      );
      found = defaultColName;
    }
    return found;
  };

  estadoHistoricoCols.almacen = await ensureStationCol(['almacen', 'almacén'], estadoCols.almacen);
  estadoHistoricoCols.banda = await ensureStationCol(['banda'], estadoCols.banda);
  estadoHistoricoCols.mitsubishi = await ensureStationCol(['mitsubishi', 'robot'], estadoCols.mitsubishi);
  estadoHistoricoCols.lugar_entrega = await ensureStationCol(
    [
      estadoCols.lugar_entrega,
      'lugar_entrega',
      'lugar_de_entrega',
      'rampa',
      'entrega',
      'zona_entrega',
      'estacion_entrega',
      'punto_entrega'
    ],
    estadoCols.lugar_entrega
  );

  console.log(`Columnas detectadas en "${tables.estado_historico}":`, estadoHistoricoCols);
};

const insertEstadoHistorico = async (vals, idEstado = 1) => {
  const almacen = Number(vals?.almacen ?? 1);
  const banda = Number(vals?.banda ?? 1);
  const mitsubishi = Number(vals?.mitsubishi ?? 1);
  const lugarEntrega = Number(vals?.lugar_entrega ?? 1);

  await pool.execute(
    `INSERT INTO \`${tables.estado_historico}\`
      (\`${estadoHistoricoCols.id_estado}\`, \`${estadoHistoricoCols.almacen}\`, \`${estadoHistoricoCols.banda}\`, \`${estadoHistoricoCols.mitsubishi}\`, \`${estadoHistoricoCols.lugar_entrega}\`, \`${estadoHistoricoCols.fecha_hora}\`)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [Number(idEstado) || 1, almacen, banda, mitsubishi, lugarEntrega]
  );

  lastLoggedEstadoKey = `${almacen}-${banda}-${mitsubishi}-${lugarEntrega}`;
};

const formatEstadoRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    ID_estado: row[estadoCols.id] ?? row.ID_estado ?? 1,
    almacen: row[estadoCols.almacen] ?? row.almacen ?? 1,
    banda: row[estadoCols.banda] ?? row.banda ?? 1,
    mitsubishi: row[estadoCols.mitsubishi] ?? row.mitsubishi ?? 1,
    lugar_entrega: row[estadoCols.lugar_entrega] ?? row.lugar_entrega ?? 1
  };
};

let dbInitialized = false;
let initPromise = null;

// Inicializar la base de datos y tablas automáticamente si no existen
const initDatabase = async () => {
  if (dbInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Conectar sin seleccionar BD para crearla si no existe
      const tempConn = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        ssl: dbConfig.ssl
      });

      await tempConn.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
      );
      await tempConn.end();

      // 2. Detectar tablas ya existentes (por si la BD ya existía con distinto formato de mayúsculas/acentos)
      const existingBefore = await refreshTableNames();
      const hasTable = (candidates) => {
        const norm = candidates.map(normalizeName);
        return existingBefore.some((t) => norm.includes(normalizeName(t)));
      };

      // 3. Crear solo las tablas que falten
      if (!hasTable(['Estado'])) {
        await pool.query(`
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
        await pool.query(`
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
        await pool.query(`
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
        await pool.query(`
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
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`Piezas\` (
            \`ID_pieza\` INT NOT NULL AUTO_INCREMENT,
            \`ID_categoria\` INT NOT NULL,
            \`nombre_pieza\` VARCHAR(50) NOT NULL,
            \`disponible\` TINYINT(1) NOT NULL DEFAULT 1,
            PRIMARY KEY (\`ID_pieza\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      }

      if (!hasTable(['Almacen', 'Almacén'])) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`Almacen\` (
            \`ID_almacen\` INT NOT NULL AUTO_INCREMENT,
            \`ID_estado_historico\` INT DEFAULT NULL,
            \`ID_categoria\` INT NOT NULL,
            \`horizontal\` INT NOT NULL,
            \`vertical\` INT NOT NULL,
            \`disponible\` TINYINT(1) NOT NULL DEFAULT 1,
            PRIMARY KEY (\`ID_almacen\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      }

      if (!hasTable(['pedido_historico'])) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`pedido_historico\` (
            \`ID_pedido\` INT NOT NULL AUTO_INCREMENT,
            \`ID_categoria\` INT NOT NULL,
            \`fecha_hora\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`en_espera\` TINYINT(1) NOT NULL DEFAULT 1,
            PRIMARY KEY (\`ID_pedido\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      }

      // 4. Actualizar mapa final de nombres reales de tablas y columnas de Estado / estado_historico
      await refreshTableNames();
      await refreshEstadoColumns();
      await refreshEstadoHistoricoColumns();

      // 5. Insertar datos iniciales solo si faltan (sin pedido activo -> todas las estaciones en 3 = En espera)
      try {
        await pool.query(`
          INSERT IGNORE INTO \`${tables.estado}\` (\`${estadoCols.id}\`, \`${estadoCols.almacen}\`, \`${estadoCols.banda}\`, \`${estadoCols.mitsubishi}\`, \`${estadoCols.lugar_entrega}\`)
          VALUES (1, 3, 3, 3, 3)
        `);

        // Si todavía no existe ningún pedido registrado, asegurar que todas las estaciones estén en 3 (En espera)
        const [pedCountRows] = await pool.query(`SELECT COUNT(*) AS total FROM \`${tables.pedido_historico}\``);
        if (Number(pedCountRows[0]?.total || 0) === 0) {
          await pool.query(`
            UPDATE \`${tables.estado}\`
            SET \`${estadoCols.almacen}\` = 3,
                \`${estadoCols.banda}\` = 3,
                \`${estadoCols.mitsubishi}\` = 3,
                \`${estadoCols.lugar_entrega}\` = 3
            WHERE \`${estadoCols.id}\` = 1
          `);
        }
      } catch (seedErr) {
        console.warn(`Aviso al inicializar ${tables.estado}:`, seedErr.message);
      }

      try {
        const [catColsResult] = await pool.query(`SHOW COLUMNS FROM \`${tables.categoria_piezas}\``);
        const catColNames = catColsResult.map((c) => c.Field);
        const catIdCol = catColNames.find((c) => normalizeName(c) === 'id_categoria') || 'ID_categoria';
        const catNameCol =
          catColNames.find((c) => ['nombre_categoria', 'nombre', 'categoria'].includes(normalizeName(c))) ||
          'Nombre_categoria';
        let catCantCol = catColNames.find((c) => normalizeName(c) === 'cantidad') || null;
        let catPosCol = catColNames.find((c) => normalizeName(c) === 'posicion') || null;

        if (!catCantCol) {
          await pool.query(`ALTER TABLE \`${tables.categoria_piezas}\` ADD COLUMN \`Cantidad\` TINYINT(1) NOT NULL DEFAULT 3`);
          catCantCol = 'Cantidad';
        }
        if (!catPosCol) {
          await pool.query(`ALTER TABLE \`${tables.categoria_piezas}\` ADD COLUMN \`Posicion\` VARCHAR(20) NOT NULL DEFAULT ''`);
          catPosCol = 'Posicion';
        }

        // Asegurar que SOLO existan 3 categorías: 1=Electronica (3, 1,2,3), 2=Arte (2, 4,5), 3=Juguetes (2, 6,7)
        try {
          await pool.query(`DELETE FROM \`${tables.categoria_piezas}\` WHERE \`${catIdCol}\` NOT IN (1, 2, 3)`);
        } catch (delErr) {
          console.warn(`Aviso al limpiar categorías extra en ${tables.categoria_piezas}:`, delErr.message);
        }

        await pool.query(`
          INSERT INTO \`${tables.categoria_piezas}\` (\`${catIdCol}\`, \`${catNameCol}\`, \`${catCantCol}\`, \`${catPosCol}\`) VALUES
            (1, 'Electronica', 3, '1,2,3'),
            (2, 'Arte', 2, '4,5'),
            (3, 'Juguetes', 2, '6,7')
          ON DUPLICATE KEY UPDATE
            \`${catNameCol}\` = VALUES(\`${catNameCol}\`),
            \`${catPosCol}\` = VALUES(\`${catPosCol}\`)
        `);
      } catch (seedErr) {
        console.warn(`Aviso al inicializar ${tables.categoria_piezas}:`, seedErr.message);
      }

      try {
        // Inicializar tabla Piezas con las 9 piezas y su relación a categoria_piezas (ID_categoria)
        const [piezasColsResult] = await pool.query(`SHOW COLUMNS FROM \`${tables.piezas}\``);
        const pColNames = piezasColsResult.map((c) => c.Field);
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
          const textCol = piezasColsResult.find((c) => {
            const type = String(c.Type || '').toLowerCase();
            const isKnown = [pIdCol, pCatCol, pDispCol].filter(Boolean).includes(c.Field);
            return !isKnown && (type.includes('char') || type.includes('text'));
          });
          pNameCol = textCol ? textCol.Field : null;
        }

        if (!pNameCol) {
          await pool.query(`ALTER TABLE \`${tables.piezas}\` ADD COLUMN \`nombre_pieza\` VARCHAR(50) NOT NULL DEFAULT ''`);
          pNameCol = 'nombre_pieza';
        }

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
            await pool.execute(
              `INSERT IGNORE INTO \`${tables.piezas}\` (\`${pIdCol}\`, \`${pCatCol}\`, \`${pNameCol}\`, \`${pDispCol}\`)
               VALUES (?, ?, ?, 1)`,
              [idPieza, idCat, nombre]
            );
          } else {
            await pool.execute(
              `INSERT IGNORE INTO \`${tables.piezas}\` (\`${pIdCol}\`, \`${pCatCol}\`, \`${pNameCol}\`)
               VALUES (?, ?, ?)`,
              [idPieza, idCat, nombre]
            );
          }
        }
      } catch (seedErr) {
        console.warn(`Aviso al inicializar ${tables.piezas}:`, seedErr.message);
      }

      try {
        await pool.query(`
          INSERT IGNORE INTO \`${tables.estado_historico}\` (\`ID_estado_historico\`, \`ID_estado\`)
          VALUES (1, 1)
        `);
      } catch (seedErr) {
        console.warn(`Aviso al inicializar ${tables.estado_historico}:`, seedErr.message);
      }

      try {
        await pool.query(`
          INSERT IGNORE INTO \`${tables.almacen}\` (\`ID_almacen\`, \`ID_estado_historico\`, \`ID_categoria\`, \`horizontal\`, \`vertical\`, \`disponible\`) VALUES
            (1, 1, 1, 1, 1, 1),
            (2, 1, 1, 1, 2, 1),
            (3, 1, 1, 1, 3, 1),
            (4, 1, 2, 2, 1, 1),
            (5, 1, 2, 2, 2, 1),
            (6, 1, 2, 2, 3, 1),
            (7, 1, 3, 3, 1, 1),
            (8, 1, 3, 3, 2, 1),
            (9, 1, 3, 3, 3, 1)
        `);
      } catch (seedErr) {
        console.warn(`Aviso al inicializar ${tables.almacen}:`, seedErr.message);
      }

      dbInitialized = true;
      console.log(`Base de datos "${dbConfig.database}" verificada/inicializada correctamente.`);
      return true;
    } catch (error) {
      dbInitialized = false;
      console.warn(
        `No se pudo inicializar automáticamente la BD "${dbConfig.database}" (verifica que MariaDB/MySQL esté activo y configurado):`,
        error.message
      );
      throw error;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
};

// Middleware: asegurar que la BD y sus tablas existan antes de cualquier petición a /api/*
app.use('/api', async (req, res, next) => {
  try {
    await initDatabase();
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'error',
      database: dbConfig.database,
      error: error.message
    });
  }
});

// Endpoint de verificación de salud del backend y la base de datos
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      success: true,
      status: 'ok',
      db: 'connected',
      database: dbConfig.database,
      tables
    });
  } catch (error) {
    dbInitialized = false;
    res.json({ success: false, status: 'error', database: dbConfig.database, db: error.message });
  }
});

// 1. Crear un pedido y reiniciar todo el Estado a 1
app.post('/api/pedidos', async (req, res) => {
  const idCategoria = Number(req.body?.id_categoria);
  if (!idCategoria || Number.isNaN(idCategoria)) {
    return res.status(400).json({ success: false, error: 'Falta un id_categoria válido.' });
  }

  try {
    // Cerrar cualquier pedido anterior que hubiera quedado en espera
    await pool.execute(
      `UPDATE \`${tables.pedido_historico}\` SET en_espera = 0 WHERE en_espera = 1`
    );

    // Insertar nuevo pedido en espera
    const [result] = await pool.execute(
      `INSERT INTO \`${tables.pedido_historico}\` (ID_categoria, fecha_hora, en_espera) VALUES (?, NOW(), 1)`,
      [idCategoria]
    );

    // Reiniciar el estado de todas las estaciones a 1 cada vez que se hace un pedido nuevo
    try {
      await pool.execute(
        `INSERT INTO \`${tables.estado}\` (\`${estadoCols.id}\`, \`${estadoCols.almacen}\`, \`${estadoCols.banda}\`, \`${estadoCols.mitsubishi}\`, \`${estadoCols.lugar_entrega}\`)
         VALUES (1, 1, 1, 1, 1)
         ON DUPLICATE KEY UPDATE
           \`${estadoCols.almacen}\` = 1,
           \`${estadoCols.banda}\` = 1,
           \`${estadoCols.mitsubishi}\` = 1,
           \`${estadoCols.lugar_entrega}\` = 1`
      );
    } catch (estadoErr) {
      console.warn(`Aviso al reiniciar ${tables.estado}:`, estadoErr.message);
    }

    try {
      await insertEstadoHistorico({ almacen: 1, banda: 1, mitsubishi: 1, lugar_entrega: 1 }, 1);
    } catch (histErr) {
      console.warn(`Aviso al registrar ${tables.estado_historico}:`, histErr.message);
    }

    res.json({ success: true, id_pedido: result.insertId });
  } catch (error) {
    console.error('Error al crear pedido:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Obtener estado del pedido actual (para la vista de progreso y el heartbeat cada 2s)
app.get('/api/estado', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM \`${tables.estado}\` ORDER BY \`${estadoCols.id}\` DESC LIMIT 1`
    );
    if (rows.length > 0) {
      const est = formatEstadoRow(rows[0]);
      const allDone =
        Number(est.almacen) === 2 &&
        Number(est.banda) === 2 &&
        Number(est.mitsubishi) === 2 &&
        Number(est.lugar_entrega) === 2;
      const hasError = [est.almacen, est.banda, est.mitsubishi, est.lugar_entrega].some(
        (v) => Number(v) === 4
      );

      if (allDone || hasError) {
        await pool.execute(
          `UPDATE \`${tables.pedido_historico}\` SET en_espera = 0 WHERE en_espera = 1`
        );
      }

      // Si el estado cambió en la tabla Estado (ej. desde PLC/SCADA), registrar el nuevo snapshot en estado_historico
      const currentKey = `${Number(est.almacen)}-${Number(est.banda)}-${Number(est.mitsubishi)}-${Number(est.lugar_entrega)}`;
      if (lastLoggedEstadoKey !== null && lastLoggedEstadoKey !== currentKey) {
        try {
          await insertEstadoHistorico(est, est.ID_estado);
        } catch (histErr) {
          console.warn(`Aviso al registrar cambio en ${tables.estado_historico}:`, histErr.message);
        }
      } else if (lastLoggedEstadoKey === null) {
        lastLoggedEstadoKey = currentKey;
      }

      res.json({ success: true, estado: est });
    } else {
      res.json({ success: true, estado: null });
    }
  } catch (error) {
    console.error('Error al obtener estado:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2b. Actualizar estado en SQL (desde el panel de control manual O desde SCADA)
// Acepta:
//  - Campos directos: { almacen: 2, banda: 1, mitsubishi: 1, lugar_entrega: 1 } (también acepta "rampa" o el nombre real de la columna)
//  - Formato estación única desde SCADA: { estacion: "almacen" | "banda" | "mitsubishi" | "lugar_entrega" | "rampa", estado: 2 }
const handleUpdateEstado = async (req, res) => {
  const body = req.body || {};
  let { almacen, banda, mitsubishi, lugar_entrega } = body;

  // Soportar alias de columna de entrega (ej. rampa o el nombre real detectado en BD)
  if (lugar_entrega === undefined) {
    if (body[estadoCols.lugar_entrega] !== undefined) {
      lugar_entrega = body[estadoCols.lugar_entrega];
    } else if (body.rampa !== undefined) {
      lugar_entrega = body.rampa;
    } else if (body.entrega !== undefined) {
      lugar_entrega = body.entrega;
    }
  }

  // Soportar formato individual de SCADA: { estacion: "mitsubishi", estado: 2 }
  if (body.estacion !== undefined && body.estado !== undefined) {
    const estNorm = normalizeName(body.estacion);
    const val = Number(body.estado);
    if (estNorm === 'almacen') almacen = val;
    else if (estNorm === 'banda') banda = val;
    else if (estNorm === 'mitsubishi' || estNorm === 'robot') mitsubishi = val;
    else if (['lugarentrega', 'lugar_entrega', 'rampa', 'entrega', normalizeName(estadoCols.lugar_entrega)].includes(estNorm)) {
      lugar_entrega = val;
    }
  }

  try {
    // Si viene solo un campo o varios, mantenemos los valores previos para los no especificados
    const [currentRows] = await pool.execute(
      `SELECT * FROM \`${tables.estado}\` WHERE \`${estadoCols.id}\` = 1`
    );
    const current = formatEstadoRow(currentRows[0]) || { almacen: 3, banda: 3, mitsubishi: 3, lugar_entrega: 3 };

    const vals = {
      almacen: almacen !== undefined ? Number(almacen) : Number(current.almacen ?? 3),
      banda: banda !== undefined ? Number(banda) : Number(current.banda ?? 3),
      mitsubishi: mitsubishi !== undefined ? Number(mitsubishi) : Number(current.mitsubishi ?? 3),
      lugar_entrega: lugar_entrega !== undefined ? Number(lugar_entrega) : Number(current.lugar_entrega ?? 3)
    };

    await pool.execute(
      `INSERT INTO \`${tables.estado}\` (\`${estadoCols.id}\`, \`${estadoCols.almacen}\`, \`${estadoCols.banda}\`, \`${estadoCols.mitsubishi}\`, \`${estadoCols.lugar_entrega}\`)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         \`${estadoCols.almacen}\` = VALUES(\`${estadoCols.almacen}\`),
         \`${estadoCols.banda}\` = VALUES(\`${estadoCols.banda}\`),
         \`${estadoCols.mitsubishi}\` = VALUES(\`${estadoCols.mitsubishi}\`),
         \`${estadoCols.lugar_entrega}\` = VALUES(\`${estadoCols.lugar_entrega}\`)`,
      [vals.almacen, vals.banda, vals.mitsubishi, vals.lugar_entrega]
    );

    // Registrar cambio completo (almacen, banda, mitsubishi, lugar_entrega/rampa) en estado_historico
    await insertEstadoHistorico(vals, 1);

    // Si alguna estación se puso en 4 (Error), guardar en la tabla alarmas y cancelar el pedido activo
    const errorStations = Object.entries(vals)
      .filter(([, v]) => v === 4)
      .map(([k]) => k);

    if (errorStations.length > 0) {
      const desc = `Error en estación (${errorStations.join(', ')}) - Pedido cancelado`;
      await pool.execute(
        `INSERT INTO \`${tables.alarmas}\` (ID_estado, fecha_hora, descripcion) VALUES (1, NOW(), ?)`,
        [desc]
      );
      await pool.execute(
        `UPDATE \`${tables.pedido_historico}\` SET en_espera = 0 WHERE en_espera = 1`
      );
    }

    // Si todas las etapas llegaron a 2 (Terminado), liberar en_espera del pedido actual
    if (
      vals.almacen === 2 &&
      vals.banda === 2 &&
      vals.mitsubishi === 2 &&
      vals.lugar_entrega === 2
    ) {
      await pool.execute(
        `UPDATE \`${tables.pedido_historico}\` SET en_espera = 0 WHERE en_espera = 1`
      );
    }

    const [rows] = await pool.execute(
      `SELECT * FROM \`${tables.estado}\` WHERE \`${estadoCols.id}\` = 1`
    );
    res.json({ success: true, estado: formatEstadoRow(rows[0]) });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

app.put('/api/estado', handleUpdateEstado);
app.post('/api/estado', handleUpdateEstado);

// 2c. Cancelar pedido y registrar error en BD cuando el heartbeat detecta estado 4 desde SQL
app.post('/api/pedido/error', async (req, res) => {
  const { estacion } = req.body;
  try {
    const desc = `Error detectado en ${estacion || 'proceso'} - Pedido cancelado`;

    // Verificar si ya se canceló el pedido actual para no duplicar alarmas si ya lo hizo PUT /api/estado
    const [pedidosActivos] = await pool.execute(
      `SELECT ID_pedido FROM \`${tables.pedido_historico}\` WHERE en_espera = 1 LIMIT 1`
    );

    if (pedidosActivos.length > 0) {
      await pool.execute(
        `INSERT INTO \`${tables.alarmas}\` (ID_estado, fecha_hora, descripcion) VALUES (1, NOW(), ?)`,
        [desc]
      );
      await pool.execute(
        `UPDATE \`${tables.pedido_historico}\` SET en_espera = 0 WHERE en_espera = 1`
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al cancelar pedido por error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2d. Cancelar pedido por inactividad (regresa todas las estaciones a 3 = En espera)
app.post('/api/pedido/cancelar', async (req, res) => {
  const { motivo = 'Cancelado por inactividad' } = req.body || {};
  try {
    await pool.execute(
      `UPDATE \`${tables.pedido_historico}\` SET en_espera = 0 WHERE en_espera = 1`
    );
    await pool.execute(
      `INSERT INTO \`${tables.alarmas}\` (ID_estado, fecha_hora, descripcion) VALUES (1, NOW(), ?)`,
      [motivo]
    );
    await pool.execute(
      `INSERT INTO \`${tables.estado}\` (\`${estadoCols.id}\`, \`${estadoCols.almacen}\`, \`${estadoCols.banda}\`, \`${estadoCols.mitsubishi}\`, \`${estadoCols.lugar_entrega}\`)
       VALUES (1, 3, 3, 3, 3)
       ON DUPLICATE KEY UPDATE
         \`${estadoCols.almacen}\` = 3,
         \`${estadoCols.banda}\` = 3,
         \`${estadoCols.mitsubishi}\` = 3,
         \`${estadoCols.lugar_entrega}\` = 3`
    );
    await insertEstadoHistorico({ almacen: 3, banda: 3, mitsubishi: 3, lugar_entrega: 3 }, 1);
    res.json({ success: true, message: 'Pedido cancelado correctamente' });
  } catch (error) {
    console.error('Error al cancelar pedido por inactividad:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Obtener estado de en_espera del ultimo pedido (para rechazo)
app.get('/api/pedido/ultimo', async (req, res) => {
  try {
    // Si en la tabla Estado el pedido anterior ya terminó (todo en 2) o tuvo error (4), liberar en_espera antes de consultar
    const [estRows] = await pool.execute(
      `SELECT * FROM \`${tables.estado}\` ORDER BY \`${estadoCols.id}\` DESC LIMIT 1`
    );
    if (estRows.length > 0) {
      const est = formatEstadoRow(estRows[0]);
      const allDone =
        Number(est.almacen) === 2 &&
        Number(est.banda) === 2 &&
        Number(est.mitsubishi) === 2 &&
        Number(est.lugar_entrega) === 2;
      const hasError = [est.almacen, est.banda, est.mitsubishi, est.lugar_entrega].some(
        (v) => Number(v) === 4
      );
      if (allDone || hasError) {
        await pool.execute(`UPDATE \`${tables.pedido_historico}\` SET en_espera = 0 WHERE en_espera = 1`);
      }
    }

    const [rows] = await pool.execute(`SELECT * FROM \`${tables.pedido_historico}\` ORDER BY ID_pedido DESC LIMIT 1`);
    if (rows.length > 0) {
      res.json({ success: true, pedido: rows[0] });
    } else {
      res.json({ success: true, pedido: null });
    }
  } catch (error) {
    console.error('Error al obtener ultimo pedido:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Obtener disponibilidad de piezas desde categoria_piezas, Piezas y Almacen
app.get('/api/piezas', async (req, res) => {
  try {
    const [categoriasRows] = await pool.execute(`SELECT * FROM \`${tables.categoria_piezas}\``);
    const [almacenRows] = await pool.execute(`SELECT * FROM \`${tables.almacen}\``);
    let piezasRows = [];
    try {
      const [rows] = await pool.execute(`SELECT * FROM \`${tables.piezas}\``);
      piezasRows = rows;
    } catch {
      piezasRows = [];
    }

    res.json({
      success: true,
      categoria_piezas: categoriasRows,
      piezas: piezasRows,
      almacen: almacenRows
    });
  } catch (error) {
    console.error('Error al obtener disponibilidad de piezas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4b. Actualizar disponibilidad de una pieza o categoría en Almacen y Piezas
app.put('/api/piezas/disponibilidad', async (req, res) => {
  const { id_almacen, id_categoria, disponible } = req.body;
  try {
    const dispVal = Number(disponible) ? 1 : 0;

    if (id_almacen !== undefined && id_almacen !== null) {
      await pool.execute(
        `UPDATE \`${tables.almacen}\` SET disponible = ? WHERE ID_almacen = ?`,
        [dispVal, Number(id_almacen)]
      );
      try {
        await pool.execute(
          `UPDATE \`${tables.piezas}\` SET disponible = ? WHERE ID_pieza = ?`,
          [dispVal, Number(id_almacen)]
        );
      } catch {
        // Si la tabla Piezas en BD externa no tiene columna disponible, continuar sin error
      }
    } else if (id_categoria !== undefined && id_categoria !== null) {
      await pool.execute(
        `UPDATE \`${tables.almacen}\` SET disponible = ? WHERE ID_categoria = ?`,
        [dispVal, Number(id_categoria)]
      );
      try {
        await pool.execute(
          `UPDATE \`${tables.piezas}\` SET disponible = ? WHERE ID_categoria = ?`,
          [dispVal, Number(id_categoria)]
        );
      } catch {
        // Si la tabla Piezas en BD externa no tiene columna disponible, continuar sin error
      }
    }

    // Recalcular y sincronizar la columna cantidad en categoria_piezas según las piezas disponibles en Almacen
    try {
      await pool.execute(`
        UPDATE \`${tables.categoria_piezas}\` c
        SET c.cantidad = (
          SELECT COUNT(*)
          FROM \`${tables.almacen}\` a
          WHERE a.ID_categoria = c.ID_categoria AND a.disponible = 1
        )
      `);
    } catch {
      // Continuar si la tabla categoria_piezas no tiene columna cantidad
    }

    const [categoriasRows] = await pool.execute(`SELECT * FROM \`${tables.categoria_piezas}\``);
    const [almacenRows] = await pool.execute(`SELECT * FROM \`${tables.almacen}\``);
    let piezasRows = [];
    try {
      const [rows] = await pool.execute(`SELECT * FROM \`${tables.piezas}\``);
      piezasRows = rows;
    } catch {
      piezasRows = [];
    }

    res.json({
      success: true,
      categoria_piezas: categoriasRows,
      piezas: piezasRows,
      almacen: almacenRows
    });
  } catch (error) {
    console.error('Error al actualizar disponibilidad de pieza:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = Number(process.env.PORT) || 3001;
const server = app.listen(PORT, () => {
  console.log(`Servidor Click-Go escuchando en puerto ${PORT} (BD: ${dbConfig.database})`);
  initDatabase().catch(() => {});
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // El puerto ya está en uso por otra instancia; igual inicializamos/verificamos BD
    console.warn(`Puerto ${PORT} en uso, verificando conexión a BD "${dbConfig.database}"...`);
    initDatabase().catch(() => {});
  } else {
    console.error('Error en servidor:', err);
  }
});

export { app, initDatabase };
