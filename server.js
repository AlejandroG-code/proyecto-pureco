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
  almacen: 'Almacen',
  pedido_historico: 'pedido_historico'
};

const normalizeTableName = (name) =>
  String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const refreshTableNames = async () => {
  const [tablesResult] = await pool.query('SHOW TABLES');
  const existing = tablesResult.map((row) => Object.values(row)[0]);

  const findExisting = (candidates, fallback) => {
    const normalizedCandidates = candidates.map(normalizeTableName);
    const match = existing.find((t) => normalizedCandidates.includes(normalizeTableName(t)));
    return match || fallback;
  };

  tables.estado = findExisting(['Estado', 'estado'], 'Estado');
  tables.estado_historico = findExisting(['estado_historico'], 'estado_historico');
  tables.alarmas = findExisting(['alarmas'], 'alarmas');
  tables.categoria_piezas = findExisting(['categoria_piezas', 'categoría_piezas'], 'categoria_piezas');
  tables.almacen = findExisting(['Almacen', 'almacen', 'Almacén', 'almacén'], 'Almacen');
  tables.pedido_historico = findExisting(['pedido_historico'], 'pedido_historico');

  return existing;
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
        const norm = candidates.map(normalizeTableName);
        return existingBefore.some((t) => norm.includes(normalizeTableName(t)));
      };

      // 3. Crear solo las tablas que falten
      if (!hasTable(['Estado'])) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`Estado\` (
            \`ID_estado\` TINYINT(1) NOT NULL,
            \`almacen\` TINYINT(1) NOT NULL DEFAULT 1,
            \`banda\` TINYINT(1) NOT NULL DEFAULT 1,
            \`mitsubishi\` TINYINT(1) NOT NULL DEFAULT 1,
            \`lugar_entrega\` TINYINT(1) NOT NULL DEFAULT 1,
            PRIMARY KEY (\`ID_estado\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      }

      if (!hasTable(['estado_historico'])) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`estado_historico\` (
            \`ID_estado_historico\` MEDIUMINT(6) NOT NULL AUTO_INCREMENT,
            \`ID_estado\` TINYINT(1) NOT NULL,
            \`fecha_hora\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (\`ID_estado_historico\`),
            CONSTRAINT \`fk_estado_historico_estado\`
              FOREIGN KEY (\`ID_estado\`) REFERENCES \`${tables.estado}\` (\`ID_estado\`)
              ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      }

      if (!hasTable(['alarmas'])) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`alarmas\` (
            \`ID_alarmas\` MEDIUMINT(6) NOT NULL AUTO_INCREMENT,
            \`ID_estado\` TINYINT(1) NOT NULL,
            \`fecha_hora\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`descripcion\` TINYTEXT NOT NULL,
            PRIMARY KEY (\`ID_alarmas\`),
            CONSTRAINT \`fk_alarmas_estado\`
              FOREIGN KEY (\`ID_estado\`) REFERENCES \`${tables.estado}\` (\`ID_estado\`)
              ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      }

      if (!hasTable(['categoria_piezas', 'categoría_piezas'])) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`categoria_piezas\` (
            \`ID_categoria\` TINYINT(1) NOT NULL,
            \`nombre_categoria\` VARCHAR(15) NOT NULL,
            \`cantidad\` TINYINT(1) NOT NULL DEFAULT 3,
            PRIMARY KEY (\`ID_categoria\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      }

      if (!hasTable(['Almacen', 'Almacén'])) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`Almacen\` (
            \`ID_almacen\` MEDIUMINT(6) NOT NULL AUTO_INCREMENT,
            \`ID_estado_historico\` MEDIUMINT(6) DEFAULT NULL,
            \`ID_categoria\` TINYINT(1) NOT NULL,
            \`horizontal\` TINYINT(2) NOT NULL,
            \`vertical\` TINYINT(2) NOT NULL,
            \`disponible\` TINYINT(1) NOT NULL DEFAULT 1,
            PRIMARY KEY (\`ID_almacen\`),
            CONSTRAINT \`fk_almacen_estado_historico\`
              FOREIGN KEY (\`ID_estado_historico\`) REFERENCES \`${tables.estado_historico}\` (\`ID_estado_historico\`)
              ON DELETE SET NULL ON UPDATE CASCADE,
            CONSTRAINT \`fk_almacen_categoria\`
              FOREIGN KEY (\`ID_categoria\`) REFERENCES \`${tables.categoria_piezas}\` (\`ID_categoria\`)
              ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      }

      if (!hasTable(['pedido_historico'])) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`pedido_historico\` (
            \`ID_pedido\` INT NOT NULL AUTO_INCREMENT,
            \`ID_categoria\` TINYINT(1) NOT NULL,
            \`fecha_hora\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`en_espera\` TINYINT(1) NOT NULL DEFAULT 1,
            PRIMARY KEY (\`ID_pedido\`),
            CONSTRAINT \`fk_pedido_categoria\`
              FOREIGN KEY (\`ID_categoria\`) REFERENCES \`${tables.categoria_piezas}\` (\`ID_categoria\`)
              ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      }

      // 4. Actualizar mapa final de nombres reales de tablas
      await refreshTableNames();

      // 5. Insertar datos iniciales solo si faltan (sin sobrescribir datos existentes)
      try {
        await pool.query(`
          INSERT IGNORE INTO \`${tables.estado}\` (\`ID_estado\`, \`almacen\`, \`banda\`, \`mitsubishi\`, \`lugar_entrega\`)
          VALUES (1, 1, 1, 1, 1)
        `);
      } catch (seedErr) {
        console.warn(`Aviso al inicializar ${tables.estado}:`, seedErr.message);
      }

      try {
        await pool.query(`
          INSERT IGNORE INTO \`${tables.categoria_piezas}\` (\`ID_categoria\`, \`nombre_categoria\`, \`cantidad\`) VALUES
            (1, 'Electrónica', 3),
            (2, 'Arte', 3),
            (3, 'Juguetes', 3)
        `);
      } catch (seedErr) {
        console.warn(`Aviso al inicializar ${tables.categoria_piezas}:`, seedErr.message);
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
        `INSERT INTO \`${tables.estado}\` (ID_estado, almacen, banda, mitsubishi, lugar_entrega)
         VALUES (1, 1, 1, 1, 1)
         ON DUPLICATE KEY UPDATE
           almacen = 1,
           banda = 1,
           mitsubishi = 1,
           lugar_entrega = 1`
      );
    } catch (estadoErr) {
      console.warn(`Aviso al reiniciar ${tables.estado}:`, estadoErr.message);
    }

    try {
      await pool.execute(
        `INSERT INTO \`${tables.estado_historico}\` (ID_estado, fecha_hora) VALUES (1, NOW())`
      );
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
    const [rows] = await pool.execute(`SELECT * FROM \`${tables.estado}\` ORDER BY ID_estado DESC LIMIT 1`);
    if (rows.length > 0) {
      const est = rows[0];
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

      res.json({ success: true, estado: est });
    } else {
      res.json({ success: true, estado: null });
    }
  } catch (error) {
    console.error('Error al obtener estado:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2b. Actualizar manualmente el estado en SQL (desde la ventana de control manual)
app.put('/api/estado', async (req, res) => {
  const { almacen, banda, mitsubishi, lugar_entrega } = req.body;
  try {
    // Si viene solo un campo o varios, mantenemos los valores previos para los no especificados
    const [currentRows] = await pool.execute(`SELECT * FROM \`${tables.estado}\` WHERE ID_estado = 1`);
    const current = currentRows[0] || { almacen: 1, banda: 1, mitsubishi: 1, lugar_entrega: 1 };

    const vals = {
      almacen: almacen !== undefined ? Number(almacen) : Number(current.almacen ?? 1),
      banda: banda !== undefined ? Number(banda) : Number(current.banda ?? 1),
      mitsubishi: mitsubishi !== undefined ? Number(mitsubishi) : Number(current.mitsubishi ?? 1),
      lugar_entrega: lugar_entrega !== undefined ? Number(lugar_entrega) : Number(current.lugar_entrega ?? 1)
    };

    await pool.execute(
      `INSERT INTO \`${tables.estado}\` (ID_estado, almacen, banda, mitsubishi, lugar_entrega)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         almacen = VALUES(almacen),
         banda = VALUES(banda),
         mitsubishi = VALUES(mitsubishi),
         lugar_entrega = VALUES(lugar_entrega)`,
      [vals.almacen, vals.banda, vals.mitsubishi, vals.lugar_entrega]
    );

    // Registrar cambio en estado_historico
    await pool.execute(
      `INSERT INTO \`${tables.estado_historico}\` (ID_estado, fecha_hora) VALUES (1, NOW())`
    );

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

    const [rows] = await pool.execute(`SELECT * FROM \`${tables.estado}\` WHERE ID_estado = 1`);
    res.json({ success: true, estado: rows[0] });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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

// 2d. Cancelar pedido por inactividad
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
    const [estRows] = await pool.execute(`SELECT * FROM \`${tables.estado}\` ORDER BY ID_estado DESC LIMIT 1`);
    if (estRows.length > 0) {
      const est = estRows[0];
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

// 4. Obtener disponibilidad de piezas desde categoría_piezas y Almacén
app.get('/api/piezas', async (req, res) => {
  try {
    const [categoriasRows] = await pool.execute(`SELECT * FROM \`${tables.categoria_piezas}\``);
    const [almacenRows] = await pool.execute(`SELECT * FROM \`${tables.almacen}\``);

    res.json({
      success: true,
      categoria_piezas: categoriasRows,
      almacen: almacenRows
    });
  } catch (error) {
    console.error('Error al obtener disponibilidad de piezas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4b. Actualizar disponibilidad de una pieza o categoría en Almacén y categoría_piezas
app.put('/api/piezas/disponibilidad', async (req, res) => {
  const { id_almacen, id_categoria, disponible } = req.body;
  try {
    const dispVal = Number(disponible) ? 1 : 0;

    if (id_almacen !== undefined && id_almacen !== null) {
      await pool.execute(
        `UPDATE \`${tables.almacen}\` SET disponible = ? WHERE ID_almacen = ?`,
        [dispVal, Number(id_almacen)]
      );
    } else if (id_categoria !== undefined && id_categoria !== null) {
      await pool.execute(
        `UPDATE \`${tables.almacen}\` SET disponible = ? WHERE ID_categoria = ?`,
        [dispVal, Number(id_categoria)]
      );
    }

    // Recalcular y sincronizar la columna cantidad en categoria_piezas según las piezas disponibles en Almacen
    await pool.execute(`
      UPDATE \`${tables.categoria_piezas}\` c
      SET c.cantidad = (
        SELECT COUNT(*)
        FROM \`${tables.almacen}\` a
        WHERE a.ID_categoria = c.ID_categoria AND a.disponible = 1
      )
    `);

    const [categoriasRows] = await pool.execute(`SELECT * FROM \`${tables.categoria_piezas}\``);
    const [almacenRows] = await pool.execute(`SELECT * FROM \`${tables.almacen}\``);

    res.json({
      success: true,
      categoria_piezas: categoriasRows,
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
