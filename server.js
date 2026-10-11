import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Configuracion de base de datos XAMPP por defecto
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'clickgo' // asumiendo el nombre de bd, se puede cambiar luego
};

// 1. Crear un pedido
app.post('/api/pedidos', async (req, res) => {
  const { id_categoria } = req.body;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO pedido_historico (ID_categoria, fecha_hora, en_espera) VALUES (?, NOW(), 1)',
      [id_categoria]
    );
    await connection.end();
    res.json({ success: true, id_pedido: result.insertId });
  } catch (error) {
    console.error('Error al crear pedido:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Obtener estado del pedido actual (para la vista de progreso)
app.get('/api/estado', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM Estado ORDER BY ID_estado DESC LIMIT 1');
    await connection.end();
    if (rows.length > 0) {
      res.json({ success: true, estado: rows[0] });
    } else {
      res.json({ success: true, estado: null });
    }
  } catch (error) {
    console.error('Error al obtener estado:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Obtener estado de en_espera del ultimo pedido (para rechazo)
app.get('/api/pedido/ultimo', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM pedido_historico ORDER BY ID_pedido DESC LIMIT 1');
    await connection.end();
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
    const connection = await mysql.createConnection(dbConfig);
    const [tablesResult] = await connection.execute('SHOW TABLES');
    const tableNames = tablesResult.map(row => Object.values(row)[0]);

    const findTable = (candidates) =>
      tableNames.find(t => candidates.includes(t.toLowerCase()));

    const catTable = findTable(['categoria_piezas', 'categoría_piezas']);
    const almTable = findTable(['almacen', 'almacén']);

    let categoriasRows = [];
    let almacenRows = [];

    if (catTable) {
      const [rows] = await connection.execute(`SELECT * FROM \`${catTable}\``);
      categoriasRows = rows;
    }

    if (almTable) {
      const [rows] = await connection.execute(`SELECT * FROM \`${almTable}\``);
      almacenRows = rows;
    }

    await connection.end();
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

// Inicializar la base de datos y tablas automáticamente si no existen
const initDatabase = async () => {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
    await connection.query(`USE \`${dbConfig.database}\``);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`Estado\` (
        \`ID_estado\` TINYINT(1) NOT NULL,
        \`almacen\` TINYINT(1) NOT NULL DEFAULT 3,
        \`banda\` TINYINT(1) NOT NULL DEFAULT 3,
        \`mitsubishi\` TINYINT(1) NOT NULL DEFAULT 3,
        \`lugar_entrega\` TINYINT(1) NOT NULL DEFAULT 3,
        PRIMARY KEY (\`ID_estado\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.query(`
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

    await connection.query(`
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

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`categoria_piezas\` (
        \`ID_categoria\` TINYINT(1) NOT NULL,
        \`nombre_categoria\` VARCHAR(15) NOT NULL,
        \`cantidad\` TINYINT(1) NOT NULL DEFAULT 3,
        PRIMARY KEY (\`ID_categoria\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.query(`
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

    await connection.query(`
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

    // Insertar datos iniciales solo si las tablas están vacías
    await connection.query(`
      INSERT IGNORE INTO \`Estado\` (\`ID_estado\`, \`almacen\`, \`banda\`, \`mitsubishi\`, \`lugar_entrega\`)
      VALUES (1, 3, 3, 3, 3)
    `);

    await connection.query(`
      INSERT IGNORE INTO \`categoria_piezas\` (\`ID_categoria\`, \`nombre_categoria\`, \`cantidad\`) VALUES
        (1, 'Electrónica', 3),
        (2, 'Arte', 3),
        (3, 'Juguetes', 3)
    `);

    await connection.query(`
      INSERT IGNORE INTO \`estado_historico\` (\`ID_estado_historico\`, \`ID_estado\`)
      VALUES (1, 1)
    `);

    await connection.query(`
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

    await connection.end();
    console.log('Base de datos clickgo verificada/inicializada correctamente.');
  } catch (error) {
    console.warn('No se pudo inicializar automáticamente la BD (verifica que MySQL en XAMPP esté activo):', error.message);
  }
};

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  initDatabase();
});



