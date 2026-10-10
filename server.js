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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
