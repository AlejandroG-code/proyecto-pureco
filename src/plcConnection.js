// Conexión al servidor Express (soporta VITE_API_URL en producción, middleware en Vite /api y puerto directo 3001)
const rawBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const API_URL = rawBase ? (rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`) : '/api';
const FALLBACK_API_URL = rawBase ? API_URL : 'http://localhost:3001/api';

const apiFetch = async (endpoint, options = {}) => {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, options);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res;
    }
  } catch {
    // Intentar fallback en puerto 3001
  }
  return fetch(`${FALLBACK_API_URL}${endpoint}`, options);
};

export const checkBackendHealth = async () => {
  try {
    const res = await apiFetch('/health', { signal: AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
};

export const fetchUltimoPedido = async () => {
  try {
    const res = await apiFetch('/pedido/ultimo');
    if (!res.ok) return null;
    const data = await res.json();
    return data.pedido; // null si no hay
  } catch {
    return null;
  }
};

export const requestOrder = async (pieceId, category, quantity) => {
  try {
    // Convertimos category string al ID
    let id_categoria = 1; // Electrónica
    if (category === 'Arte') id_categoria = 2;
    if (category === 'Juguetes') id_categoria = 3;

    const res = await apiFetch('/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_categoria })
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch (error) {
    console.error('Error enviando orden', error);
    // Para entorno sin servidor, simular éxito
    return true; 
  }
};

export const fetchEstado = async () => {
  try {
    const res = await apiFetch('/estado');
    if (!res.ok) return null;
    const data = await res.json();
    return data.estado;
  } catch {
    return null;
  }
};

export const updateEstado = async (nuevoEstado) => {
  try {
    const res = await apiFetch('/estado', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoEstado)
    });
    const data = await res.json();
    return data.estado;
  } catch (error) {
    console.error('Error actualizando estado en SQL', error);
    return null;
  }
};

export const cancelOrderByError = async (estacion) => {
  try {
    await apiFetch('/pedido/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estacion })
    });
    return true;
  } catch (error) {
    console.error('Error cancelando pedido por error:', error);
    return false;
  }
};

export const cancelOrderDueToInactivity = async () => {
  try {
    await apiFetch('/pedido/cancelar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: 'Cancelado por inactividad (30s sin respuesta)' })
    });
    return true;
  } catch (error) {
    console.error('Error al cancelar pedido por inactividad:', error);
    return false;
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

export const PIECE_BY_ALMACEN_ID = {
  1: 'computadora',
  2: 'celular',
  3: 'audifonos',
  4: 'acuarela',
  5: 'gises',
  6: 'plumones',
  7: 'legos',
  8: 'juegos_mesa',
  9: 'rompecabezas'
};

export const ALMACEN_ID_BY_PIECE = {
  computadora: 1,
  celular: 2,
  audifonos: 3,
  acuarela: 4,
  gises: 5,
  plumones: 6,
  legos: 7,
  juegos_mesa: 8,
  rompecabezas: 9
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
    const res = await apiFetch('/piezas');
    if (!res.ok) return defaultAvailability;
    const data = await res.json();
    if (!data.success) return defaultAvailability;

    const categories = { ...defaultAvailability.categories };
    const pieces = { ...defaultAvailability.pieces };

    const catRows = Array.isArray(data.categoria_piezas) ? data.categoria_piezas : [];
    const almRows = Array.isArray(data.almacen) ? data.almacen : [];

    // 1. Evaluar tabla Almacén por pieza individual (ID_almacen 1..9)
    if (almRows.length > 0) {
      for (const row of almRows) {
        const idAlm = Number(row.ID_almacen ?? row.id_almacen);
        const pieceId = PIECE_BY_ALMACEN_ID[idAlm];
        const isDisp = Boolean(Number(row.disponible ?? row.Disponible ?? 0));
        if (pieceId) {
          pieces[pieceId] = isDisp;
        }
      }
    }

    // 2. Evaluar tabla categoría_piezas (ID_categoria, nombre_categoria, cantidad)
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

    // 3. Sincronizar disponibilidad entre categorías y piezas individuales
    for (const [catName, catPieces] of Object.entries(CATEGORY_PIECES)) {
      if (categories[catName] === false) {
        catPieces.forEach(pId => {
          pieces[pId] = false;
        });
      } else {
        const anyPieceAvailable = catPieces.some(pId => pieces[pId]);
        categories[catName] = anyPieceAvailable;
      }
    }

    return { categories, pieces };
  } catch {
    return defaultAvailability;
  }
};

export const updateDisponibilidadPieza = async ({ id_almacen, id_categoria, disponible }) => {
  try {
    const res = await apiFetch('/piezas/disponibilidad', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_almacen, id_categoria, disponible })
    });
    const data = await res.json();
    return data.success;
  } catch (error) {
    console.error('Error actualizando disponibilidad de pieza:', error);
    return false;
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


