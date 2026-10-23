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

// Configuración con 127.0.0.1 para evitar conflictos IPv6 (::1) con XAMPP en Windows
const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'clickgo',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Pool de conexiones permanente y resistente a caídas temporales
const pool = mysql.createPool(dbConfig);

// Endpoint de verificación de salud del backend y la base de datos
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(500).json({ success: false, status: 'error', db: error.message });
  }
});

// 1. Crear un pedido y reiniciar todo el Estado a 1
app.post('/api/pedidos', async (req, res) => {
  const { id_categoria } = req.body;
  try {
    // Cerrar cualquier pedido anterior que hubiera quedado en espera
    await pool.execute(
      'UPDATE pedido_historico SET en_espera = 0 WHERE en_espera = 1'
    );

    // Insertar nuevo pedido en espera
    const [result] = await pool.execute(
      'INSERT INTO pedido_historico (ID_categoria, fecha_hora, en_espera) VALUES (?, NOW(), 1)',
      [id_categoria]
    );

    // Reiniciar el estado de todas las estaciones a 1 cada vez que se hace un pedido nuevo
    await pool.execute(
      `INSERT INTO Estado (ID_estado, almacen, banda, mitsubishi, lugar_entrega)
       VALUES (1, 1, 1, 1, 1)
       ON DUPLICATE KEY UPDATE
         almacen = 1,
         banda = 1,
         mitsubishi = 1,
         lugar_entrega = 1`
    );

    await pool.execute(
      'INSERT INTO estado_historico (ID_estado, fecha_hora) VALUES (1, NOW())'
    );

    res.json({ success: true, id_pedido: result.insertId });
  } catch (error) {
    console.error('Error al crear pedido:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Obtener estado del pedido actual (para la vista de progreso y el heartbeat cada 2s)
app.get('/api/estado', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM Estado ORDER BY ID_estado DESC LIMIT 1');
    if (rows.length > 0) {
      const est = rows[0];
      const allDone =
        Number(est.almacen) === 2 &&
        Number(est.banda) === 2 &&
        Number(est.mitsubishi) === 2 &&
        Number(est.lugar_entrega) === 2;
      const hasError = [est.almacen, est.banda, est.mitsubishi, est.lugar_entrega].some(
        v => Number(v) === 4
      );

      if (allDone || hasError) {
        await pool.execute(
          'UPDATE pedido_historico SET en_espera = 0 WHERE en_espera = 1'
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
    const [currentRows] = await pool.execute('SELECT * FROM Estado WHERE ID_estado = 1');
    const current = currentRows[0] || { almacen: 1, banda: 1, mitsubishi: 1, lugar_entrega: 1 };

    const vals = {
      almacen: almacen !== undefined ? Number(almacen) : Number(current.almacen ?? 1),
      banda: banda !== undefined ? Number(banda) : Number(current.banda ?? 1),
      mitsubishi: mitsubishi !== undefined ? Number(mitsubishi) : Number(current.mitsubishi ?? 1),
      lugar_entrega: lugar_entrega !== undefined ? Number(lugar_entrega) : Number(current.lugar_entrega ?? 1)
    };

    await pool.execute(
      `INSERT INTO Estado (ID_estado, almacen, banda, mitsubishi, lugar_entrega)
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
      'INSERT INTO estado_historico (ID_estado, fecha_hora) VALUES (1, NOW())'
    );

    // Si alguna estación se puso en 4 (Error), guardar en la tabla alarmas y cancelar el pedido activo
    const errorStations = Object.entries(vals)
      .filter(([, v]) => v === 4)
      .map(([k]) => k);

    if (errorStations.length > 0) {
      const desc = `Error en estación (${errorStations.join(', ')}) - Pedido cancelado`;
      await pool.execute(
        'INSERT INTO alarmas (ID_estado, fecha_hora, descripcion) VALUES (1, NOW(), ?)',
        [desc]
      );
      await pool.execute(
        'UPDATE pedido_historico SET en_espera = 0 WHERE en_espera = 1'
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
        'UPDATE pedido_historico SET en_espera = 0 WHERE en_espera = 1'
      );
    }

    const [rows] = await pool.execute('SELECT * FROM Estado WHERE ID_estado = 1');
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
      'SELECT ID_pedido FROM pedido_historico WHERE en_espera = 1 LIMIT 1'
    );

    if (pedidosActivos.length > 0) {
      await pool.execute(
        'INSERT INTO alarmas (ID_estado, fecha_hora, descripcion) VALUES (1, NOW(), ?)',
        [desc]
      );
      await pool.execute(
        'UPDATE pedido_historico SET en_espera = 0 WHERE en_espera = 1'
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al cancelar pedido por error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Obtener estado de en_espera del ultimo pedido (para rechazo)
app.get('/api/pedido/ultimo', async (req, res) => {
  try {
    // Si en la tabla Estado el pedido anterior ya terminó (todo en 2) o tuvo error (4), liberar en_espera antes de consultar
    const [estRows] = await pool.execute('SELECT * FROM Estado ORDER BY ID_estado DESC LIMIT 1');
    if (estRows.length > 0) {
      const est = estRows[0];
      const allDone =
        Number(est.almacen) === 2 &&
        Number(est.banda) === 2 &&
        Number(est.mitsubishi) === 2 &&
        Number(est.lugar_entrega) === 2;
      const hasError = [est.almacen, est.banda, est.mitsubishi, est.lugar_entrega].some(
        v => Number(v) === 4
      );
      if (allDone || hasError) {
        await pool.execute('UPDATE pedido_historico SET en_espera = 0 WHERE en_espera = 1');
      }
    }

    const [rows] = await pool.execute('SELECT * FROM pedido_historico ORDER BY ID_pedido DESC LIMIT 1');
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
    const [tablesResult] = await pool.execute('SHOW TABLES');
    const tableNames = tablesResult.map(row => Object.values(row)[0]);

    const findTable = (candidates) =>
      tableNames.find(t => candidates.includes(t.toLowerCase()));

    const catTable = findTable(['categoria_piezas', 'categoría_piezas']);
    const almTable = findTable(['almacen', 'almacén']);

    let categoriasRows = [];
    let almacenRows = [];

    if (catTable) {
      const [rows] = await pool.execute(`SELECT * FROM \`${catTable}\``);
      categoriasRows = rows;
    }

    if (almTable) {
      const [rows] = await pool.execute(`SELECT * FROM \`${almTable}\``);
      almacenRows = rows;
    }

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
        'UPDATE Almacen SET disponible = ? WHERE ID_almacen = ?',
        [dispVal, Number(id_almacen)]
      );
    } else if (id_categoria !== undefined && id_categoria !== null) {
      await pool.execute(
        'UPDATE Almacen SET disponible = ? WHERE ID_categoria = ?',
        [dispVal, Number(id_categoria)]
      );
    }

    // Recalcular y sincronizar la columna cantidad en categoria_piezas según las piezas disponibles en Almacen
    await pool.execute(`
      UPDATE categoria_piezas c
      SET c.cantidad = (
        SELECT COUNT(*)
        FROM Almacen a
        WHERE a.ID_categoria = c.ID_categoria AND a.disponible = 1
      )
    `);

    const [categoriasRows] = await pool.execute('SELECT * FROM categoria_piezas');
    const [almacenRows] = await pool.execute('SELECT * FROM Almacen');

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

// Inicializar la base de datos y tablas automáticamente si no existen
const initDatabase = async () => {
  try {
    const tempConn = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await tempConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
    await tempConn.end();

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`estado_historico\` (
        \`ID_estado_historico\` MEDIUMINT(6) NOT NULL AUTO_INCREMENT,
        \`ID_estado\` TINYINT(1) NOT NULL,
        \`fecha_hora\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`ID_estado_historico\`),
        CONSTRAINT \`fk_estado_historico_estado\`
          FOREIGN KEY (\`ID_estado\`) REFERENCES \`Estado\` (\`ID_estado\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`alarmas\` (
        \`ID_alarmas\` MEDIUMINT(6) NOT NULL AUTO_INCREMENT,
        \`ID_estado\` TINYINT(1) NOT NULL,
        \`fecha_hora\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`descripcion\` TINYTEXT NOT NULL,
        PRIMARY KEY (\`ID_alarmas\`),
        CONSTRAINT \`fk_alarmas_estado\`
          FOREIGN KEY (\`ID_estado\`) REFERENCES \`Estado\` (\`ID_estado\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`categoria_piezas\` (
        \`ID_categoria\` TINYINT(1) NOT NULL,
        \`nombre_categoria\` VARCHAR(15) NOT NULL,
        \`cantidad\` TINYINT(1) NOT NULL DEFAULT 3,
        PRIMARY KEY (\`ID_categoria\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

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
          FOREIGN KEY (\`ID_estado_historico\`) REFERENCES \`estado_historico\` (\`ID_estado_historico\`)
          ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT \`fk_almacen_categoria\`
          FOREIGN KEY (\`ID_categoria\`) REFERENCES \`categoria_piezas\` (\`ID_categoria\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`pedido_historico\` (
        \`ID_pedido\` SMALLINT(3) NOT NULL AUTO_INCREMENT,
        \`ID_categoria\` TINYINT(1) NOT NULL,
        \`fecha_hora\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`en_espera\` TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (\`ID_pedido\`),
        CONSTRAINT \`fk_pedido_categoria\`
          FOREIGN KEY (\`ID_categoria\`) REFERENCES \`categoria_piezas\` (\`ID_categoria\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Insertar datos iniciales solo si las tablas están vacías (por defecto Estado en 1)
    await pool.query(`
      INSERT IGNORE INTO \`Estado\` (\`ID_estado\`, \`almacen\`, \`banda\`, \`mitsubishi\`, \`lugar_entrega\`)
      VALUES (1, 1, 1, 1, 1)
    `);

    await pool.query(`
      INSERT IGNORE INTO \`categoria_piezas\` (\`ID_categoria\`, \`nombre_categoria\`, \`cantidad\`) VALUES
        (1, 'Electrónica', 3),
        (2, 'Arte', 3),
        (3, 'Juguetes', 3)
    `);

    await pool.query(`
      INSERT IGNORE INTO \`estado_historico\` (\`ID_estado_historico\`, \`ID_estado\`)
      VALUES (1, 1)
    `);

    await pool.query(`
      INSERT IGNORE INTO \`Almacen\` (\`ID_almacen\`, \`ID_estado_historico\`, \`ID_categoria\`, \`horizontal\`, \`vertical\`, \`disponible\`) VALUES
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

    console.log('Base de datos clickgo verificada/inicializada correctamente.');
  } catch (error) {
    console.warn('No se pudo inicializar automáticamente la BD (verifica que MySQL en XAMPP esté activo):', error.message);
  }
};

const PORT = 3001;
const server = app.listen(PORT, () => {
  console.log(`Servidor Click-Go escuchando en puerto ${PORT}`);
  initDatabase();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // El puerto 3001 ya está en uso por otra instancia; igual inicializamos/verificamos BD
    initDatabase();
  } else {
    console.error('Error en servidor:', err);
  }
});

export { app, initDatabase };

