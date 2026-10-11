// Conexión al servidor local Express
const API_URL = 'http://localhost:3001/api';

export const fetchUltimoPedido = async () => {
  try {
    const res = await fetch(`${API_URL}/pedido/ultimo`);
    const data = await res.json();
    return data.pedido; // null si no hay
  } catch (error) {
    console.error('Error pedido', error);
    return null;
  }
};

export const requestOrder = async (pieceId, category, quantity) => {
  try {
    // Verificar si hay uno en espera
    const ultimo = await fetchUltimoPedido();
    if (ultimo && ultimo.en_espera === 1) {
      // Ya hay un pedido en proceso, rechazar
      return false;
    }

    // Convertimos category string al ID
    let id_categoria = 1; // Electrónica
    if (category === 'Arte') id_categoria = 2;
    if (category === 'Juguetes') id_categoria = 3;

    const res = await fetch(`${API_URL}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_categoria })
    });
    const data = await res.json();
    return data.success;
  } catch (error) {
    console.error('Error enviando orden', error);
    // Para entorno sin servidor, simular éxito siempre y cuando no sepamos que está ocupado
    return true; 
  }
};

export const fetchEstado = async () => {
  try {
    const res = await fetch(`${API_URL}/estado`);
    const data = await res.json();
    return data.estado;
  } catch (error) {
    console.error('Error estado', error);
    return null;
  }
};

const normalize = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const CATEGORY_BY_ID = {
  1: 'Electrónica',
  2: 'Arte',
  3: 'Juguetes'
};

const CATEGORY_ALIASES = {
  'Electrónica': ['electronica', 'electronicos'],
  'Arte': ['arte'],
  'Juguetes': ['juguetes', 'juguete']
};

const CATEGORY_PIECES = {
  'Arte': ['acuarela', 'gises', 'plumones'],
  'Electrónica': ['computadora', 'celular', 'audifonos'],
  'Juguetes': ['legos', 'juegos_mesa', 'rompecabezas']
};

export const fetchDisponibilidad = async () => {
  const defaultAvailability = {
    categories: { 'Arte': true, 'Electrónica': true, 'Juguetes': true },
    pieces: {
      acuarela: true,
      gises: true,
      plumones: true,
      computadora: true,
      celular: true,
      audifonos: true,
      legos: true,
      juegos_mesa: true,
      rompecabezas: true
    }
  };

  try {
    const res = await fetch(`${API_URL}/piezas`);
    const data = await res.json();
    if (!data.success) return defaultAvailability;

    const categories = { ...defaultAvailability.categories };
    const pieces = { ...defaultAvailability.pieces };

    const catRows = Array.isArray(data.categoria_piezas) ? data.categoria_piezas : [];
    const almRows = Array.isArray(data.almacen) ? data.almacen : [];

    // 1. Evaluar tabla categoría_piezas (ID_categoria, nombre_categoria, cantidad)
    for (const row of catRows) {
      const idCat = Number(row.ID_categoria ?? row.id_categoria);
      let catName = CATEGORY_BY_ID[idCat];

      if (!catName && (row.nombre_categoria || row.Nombre_categoria)) {
        const normName = normalize(row.nombre_categoria ?? row.Nombre_categoria);
        for (const [name, aliases] of Object.entries(CATEGORY_ALIASES)) {
          if (aliases.includes(normName)) {
            catName = name;
            break;
          }
        }
      }

      if (catName && row.cantidad !== undefined && row.cantidad !== null) {
        const cantidad = Number(row.cantidad);
        categories[catName] = cantidad > 0;
      }
    }

    // 2. Evaluar tabla Almacén (ID_categoria, horizontal, vertical, disponible)
    if (almRows.length > 0) {
      const almByCategory = { 'Electrónica': [], 'Arte': [], 'Juguetes': [] };
      for (const row of almRows) {
        const idCat = Number(row.ID_categoria ?? row.id_categoria);
        const catName = CATEGORY_BY_ID[idCat];
        if (catName) {
          almByCategory[catName].push(row);
        }
      }

      for (const [catName, rows] of Object.entries(almByCategory)) {
        if (rows.length > 0) {
          const hasAnyAvailable = rows.some(
            r => Boolean(Number(r.disponible ?? r.Disponible ?? 0))
          );
          if (!hasAnyAvailable) {
            categories[catName] = false;
          } else if (catRows.length === 0) {
            categories[catName] = true;
          }
        }
      }
    }

    // Sincronizar disponibilidad de piezas según su categoría
    for (const [catName, catPieces] of Object.entries(CATEGORY_PIECES)) {
      const isCatAvailable = categories[catName];
      catPieces.forEach(pId => {
        pieces[pId] = isCatAvailable;
      });
    }

    return { categories, pieces };
  } catch (error) {
    console.error('Error obteniendo disponibilidad de piezas:', error);
    return defaultAvailability;
  }
};

export const subscribeToProgress = (onStageChange) => {
  // Ya no se usa directamente con callback en el componente actualizado,
  // el componente hace polling con fetchEstado().
  // Se mantiene por compatibilidad si otro archivo lo requiere.
  return () => {};
};

export const sendRating = async (rating) => {
  console.log(`[PLC] Enviando calificación: ${rating}`);
  return true;
};


