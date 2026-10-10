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
