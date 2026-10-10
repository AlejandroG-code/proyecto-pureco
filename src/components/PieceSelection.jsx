import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestOrder } from '../plcConnection'

export default function PieceSelection() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [selectedPiece, setSelectedPiece] = useState(null)
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [pendingPiece, setPendingPiece] = useState(null)

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

  const handleSelectChange = (e, category) => {
    const value = e.target.value;
    if (value === 'default') return;
    
    const piece = items[category].find(p => p.name === value);
    if (piece) {
      setPendingPiece(piece);
      setShowModal(true);
    }
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

  const getBoxColor = (category) => {
    if (selectedPiece && items[category].find(p => p.id === selectedPiece)) {
      return 'bg-[#004b93]'; 
    }
    return 'bg-[#c9e1fb]'; 
  };

  return (
    <div className="flex flex-col items-center mt-2 h-full justify-between pb-8 px-4 relative">
      <h2 className="text-2xl font-bold text-[#004b93] mb-4 text-center">Elige tu pieza</h2>
      
      <div className="flex flex-wrap justify-center gap-6 mb-8 w-full max-w-sm">
        {/* Arte */}
        <div className={`flex flex-col items-center p-3 rounded-2xl transition-all ${getBoxColor('Arte')} shadow-md`}>
          <div className={`w-28 h-28 flex items-center justify-center mb-3 relative`}>
            <img src="/assets/box_arte.png" alt="Caja Arte" className="w-full h-full object-contain absolute z-0 drop-shadow-md" />
          </div>
          <select 
            className="text-xs bg-white text-[#004b93] font-bold px-2 py-1.5 rounded-md border border-blue-200 text-center shadow-sm w-32 relative z-10"
            onChange={(e) => handleSelectChange(e, 'Arte')}
            value={pendingPiece && pendingPiece.category === 'Arte' ? pendingPiece.name : 'default'}
          >
            <option value="default" disabled hidden>Arte</option>
            {items['Arte'].map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Electrónica */}
        <div className={`flex flex-col items-center p-3 rounded-2xl transition-all ${getBoxColor('Electrónica')} shadow-md`}>
          <div className={`w-28 h-28 flex items-center justify-center mb-3 relative`}>
            <img src="/assets/box_electronica.png" alt="Caja Electrónica" className="w-full h-full object-contain absolute z-0 drop-shadow-md" />
          </div>
          <select 
            className="text-xs bg-white text-[#004b93] font-bold px-2 py-1.5 rounded-md border border-blue-200 text-center shadow-sm w-32 relative z-10"
            onChange={(e) => handleSelectChange(e, 'Electrónica')}
            value={pendingPiece && pendingPiece.category === 'Electrónica' ? pendingPiece.name : 'default'}
          >
            <option value="default" disabled hidden>Electrónica</option>
            {items['Electrónica'].map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Juguetes */}
        <div className={`flex flex-col items-center p-3 rounded-2xl transition-all ${getBoxColor('Juguetes')} shadow-md`}>
          <div className={`w-28 h-28 flex items-center justify-center mb-3 relative`}>
            <img src="/assets/box_juguetes.png" alt="Caja Juguetes" className="w-full h-full object-contain absolute z-0 drop-shadow-md" />
          </div>
          <select 
            className="text-xs bg-white text-[#004b93] font-bold px-2 py-1.5 rounded-md border border-blue-200 text-center shadow-sm w-32 relative z-10"
            onChange={(e) => handleSelectChange(e, 'Juguetes')}
            value={pendingPiece && pendingPiece.category === 'Juguetes' ? pendingPiece.name : 'default'}
          >
            <option value="default" disabled hidden>Juguetes</option>
            {items['Juguetes'].map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
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
