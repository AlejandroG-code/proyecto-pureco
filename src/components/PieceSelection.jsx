import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestOrder, fetchDisponibilidad } from '../plcConnection'

export default function PieceSelection() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [selectedPiece, setSelectedPiece] = useState(null)
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [pendingPiece, setPendingPiece] = useState(null)

  // Disponibilidad desde la base de datos
  const [availability, setAvailability] = useState({
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
  })

  useEffect(() => {
    let isMounted = true;
    const loadAvailability = async () => {
      const data = await fetchDisponibilidad();
      if (isMounted && data) {
        setAvailability(data);
      }
    };
    loadAvailability();
    const interval = setInterval(loadAvailability, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Estado para controlar qué menú desplegable está abierto
  const [openCategory, setOpenCategory] = useState(null)

  const items = {
    'Arte': [
      { id: 'acuarela', name: 'Acuarela', category: 'Arte', img: '/assets/acuarela.png', desc: 'El arte de mezclar agua con colores hasta que parezca un accidente muy elegante y caro.' },
      { id: 'gises', name: 'Gises pasteles', category: 'Arte', img: '/assets/gises.png', desc: 'Polvo mágico para manos que cuesta una fortuna pero te hace sentir todo un artista renacentista.' },
      { id: 'plumones', name: 'Plumones', category: 'Arte', img: '/assets/plumones.png', desc: 'Tinta de alta precisión diseñada exclusivamente para arruinar la hoja del cuaderno en la última línea.' }
    ],
    'Electrónica': [
      { id: 'computadora', name: 'Computadoras', category: 'Electrónica', img: '/assets/computadora.png', desc: 'La única máquina capaz de congelarse dramáticamente justo cinco segundos antes de entregar el trabajo final.' },
      { id: 'celular', name: 'Celular', category: 'Electrónica', img: '/assets/celular.png', desc: 'El dispositivo que te acompaña a todas partes y cuyo único propósito real es no quedarse sin batería cuando vas a pagar.' },
      { id: 'audifonos', name: 'Audífonos', category: 'Electrónica', img: '/assets/audifonos.png', desc: 'El escudo oficial para fingir que no escuchas a nadie mientras caminas por la calle.' }
    ],
    'Juguetes': [
      { id: 'legos', name: 'Lego', category: 'Juguetes', img: '/assets/legos.png', desc: 'Pequeños bloques de plástico inofensivos que cobran vida en la oscuridad para castigar tus pies descalzos.' },
      { id: 'juegos_mesa', name: 'Juego de mesa', category: 'Juguetes', img: '/assets/juegos_mesa.png', desc: 'La prueba definitiva para destruir amistades y romper familias en menos de dos horas de diversión.' },
      { id: 'rompecabezas', name: 'Rompecabezas', category: 'Juguetes', img: '/assets/rompecabezas.png', desc: 'Cientos de piezas idénticas donde al final siempre faltará la última para que te dé el ataque existencial.' }
    ]
  };

  const isCategoryAvailable = (category) => {
    if (availability.categories[category] === false) return false;
    return items[category].some(p => availability.pieces[p.id] !== false);
  };

  const isPieceAvailable = (pieceId) => {
    return availability.pieces[pieceId] !== false;
  };

  const handlePieceSelect = (piece) => {
    if (!isCategoryAvailable(piece.category) || !isPieceAvailable(piece.id)) return;
    setPendingPiece(piece);
    setOpenCategory(null);
    setShowModal(true);
  };

  const confirmSelection = async () => {
    setShowModal(false);
    if (!pendingPiece) return;
    
    setSelectedPiece(pendingPiece.id);
    setLoading(true);
    try {
      const isSuccess = await requestOrder(pendingPiece.id, pendingPiece.category, 1);
      navigate('/confirmation', { state: { success: isSuccess, piece: pendingPiece } });
    } catch (e) {
      navigate('/confirmation', { state: { success: false, piece: pendingPiece } });
    }
    setLoading(false);
  };

  const cancelSelection = () => {
    setShowModal(false);
    setPendingPiece(null);
  };

  const isCategorySelected = (category) => {
    return (
      openCategory === category ||
      (selectedPiece && items[category].some(p => p.id === selectedPiece)) ||
      (pendingPiece && pendingPiece.category === category)
    );
  };

  const getBoxStyles = (category) => {
    if (!isCategoryAvailable(category)) {
      // Sin piezas en la BD: gris y sin cambio a azul en hover
      return 'bg-gray-300/85 cursor-not-allowed opacity-80';
    }
    if (isCategorySelected(category)) {
      // Seleccionado / desplegado: azul un poco más fuerte y menos opaco
      return 'bg-[#4a90e2]/95 shadow-lg scale-[1.02]';
    }
    // Por defecto: azul opaco y claro; en hover: azul un poco más fuerte y menos opaco
    return 'bg-[#a8d0fb]/60 hover:bg-[#4a90e2]/95 hover:shadow-lg cursor-pointer';
  };

  const getPieceOptionStyles = (piece) => {
    const pieceOk = isPieceAvailable(piece.id);
    const isSelected =
      selectedPiece === piece.id || (pendingPiece && pendingPiece.id === piece.id);

    if (!pieceOk) {
      // Sin piezas en la BD: gris, deshabilitado y sin cambio a azul en hover
      return 'bg-gray-300 text-gray-500 cursor-not-allowed';
    }
    if (isSelected) {
      // Pieza seleccionada: azul más fuerte y menos opaco
      return 'bg-[#4a90e2]/95 text-white font-bold';
    }
    // Pieza disponible: azul opaco y claro por defecto, azul más fuerte y menos opaco en hover
    return 'bg-[#b8dafc]/70 text-[#004b93] hover:bg-[#4a90e2]/95 hover:text-white cursor-pointer';
  };

  const renderCategoryBox = (category, imgSrc, imgAlt) => {
    const available = isCategoryAvailable(category);
    const isOpen = openCategory === category && available;
    const currentLabel =
      pendingPiece && pendingPiece.category === category
        ? pendingPiece.name
        : available
        ? category
        : `${category} (Sin piezas)`;

    return (
      <div
        key={category}
        onClick={() => {
          if (!available) return;
          setOpenCategory(prev => (prev === category ? null : category));
        }}
        className={`flex flex-col items-center p-3 rounded-2xl transition-all duration-200 ${getBoxStyles(category)} shadow-md relative ${
          isOpen ? 'z-40' : 'z-10'
        }`}
      >
        <div className="w-28 h-28 flex items-center justify-center mb-3 relative">
          <img
            src={imgSrc}
            alt={imgAlt}
            className={`w-full h-full object-contain absolute z-0 drop-shadow-md transition-all ${
              !available ? 'grayscale opacity-60' : ''
            }`}
          />
        </div>

        <button
          type="button"
          disabled={!available}
          className={`text-xs font-bold px-2.5 py-1.5 rounded-md border text-center shadow-sm w-32 relative z-10 flex items-center justify-between transition-colors ${
            !available
              ? 'bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed'
              : 'bg-white text-[#004b93] border-blue-200 cursor-pointer'
          }`}
        >
          <span className="truncate flex-1 text-center">{currentLabel}</span>
          <span className="ml-1 text-[10px]">{isOpen ? '▲' : '▼'}</span>
        </button>

        {isOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full mt-2 w-40 bg-white rounded-xl shadow-2xl border border-blue-200 p-1.5 z-50 flex flex-col gap-1"
          >
            {items[category].map(p => {
              const pieceOk = isPieceAvailable(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!pieceOk}
                  onClick={() => handlePieceSelect(p)}
                  className={`text-xs font-semibold px-2.5 py-2 rounded-lg text-center transition-all duration-150 ${getPieceOptionStyles(p)}`}
                >
                  {pieceOk ? p.name : `${p.name} (Agotado)`}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center mt-2 h-full justify-between pb-8 px-4 relative">
      <h2 className="text-2xl font-bold text-[#004b93] mb-4 text-center">Elige tu pieza</h2>
      
      <div className="flex flex-wrap justify-center gap-6 mb-8 w-full max-w-sm">
        {renderCategoryBox('Arte', '/assets/box_arte.png', 'Caja Arte')}
        {renderCategoryBox('Electrónica', '/assets/box_electronica.png', 'Caja Electrónica')}
        {renderCategoryBox('Juguetes', '/assets/box_juguetes.png', 'Caja Juguetes')}
      </div>

      <div className="h-12 w-full"></div>

      {showModal && (
        <div className="absolute inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center text-center animate-fade-in">
            <div className="w-24 h-24 mb-4">
              {pendingPiece && <img src={pendingPiece.img} alt={pendingPiece.name} className="w-full h-full object-contain drop-shadow-lg" />}
            </div>
            <h3 className="text-xl font-bold text-[#004b93] mb-2">¿Seguro de tu elección?</h3>
            <p className="text-gray-600 mb-6 font-medium text-sm">Una vez que inicie el proceso ya no puede anularse.</p>
            <div className="flex w-full gap-4">
              <button 
                onClick={confirmSelection}
                className="flex-1 bg-[#004b93] text-white font-bold py-3 rounded-full shadow hover:bg-blue-800 transition-colors"
              >
                Sí
              </button>
              <button 
                onClick={cancelSelection}
                className="flex-1 bg-white text-[#004b93] border-2 border-[#004b93] font-bold py-3 rounded-full shadow hover:bg-blue-50 transition-colors"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-white/70 z-40 flex items-center justify-center">
          <span className="animate-spin inline-block w-10 h-10 border-4 border-[#004b93] border-t-transparent rounded-full"></span>
        </div>
      )}
    </div>
  )
}
