import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Check, Loader2, MoreHorizontal, X, Power } from 'lucide-react'
import { fetchEstado } from '../plcConnection'

const NODES = [
  { id: 'almacen', label: 'Almacén', x: 25, y: 15, align: 'left', dbField: 'almacen' },
  { id: 'banda', label: 'Banda', x: 75, y: 32, align: 'right', dbField: 'banda' },
  { id: 'mitsubishi', label: 'Mitsubishi', x: 25, y: 49, align: 'left', dbField: 'mitsubishi' },
  { id: 'rampa', label: 'Rampa', x: 75, y: 66, align: 'right', dbField: 'lugar_entrega' },
  { id: 'fin', label: 'Fin', x: 25, y: 83, align: 'left', dbField: 'fin' }
]

export default function OrderProgress() {
  const navigate = useNavigate()
  const location = useLocation()
  const piece = location.state?.piece
  
  const [dbState, setDbState] = useState({
    almacen: 3,
    banda: 3,
    mitsubishi: 3,
    lugar_entrega: 3
  })

  // Elevator music
  const audioRef = useRef(null)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(e => console.log('Audio autoplay prevented:', e));
    }

    const interval = setInterval(async () => {
      const estado = await fetchEstado();
      if (estado) {
        setDbState(estado);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getStatus = (nodeId) => {
    if (nodeId === 'fin') {
      return dbState.lugar_entrega === 2 ? 2 : 3;
    }
    const field = NODES.find(n => n.id === nodeId).dbField;
    return dbState[field] !== undefined ? dbState[field] : 3;
  };

  const renderIcon = (status) => {
    switch(status) {
      case 0: return <Power strokeWidth={5} size={32} />
      case 1: return <Loader2 className="animate-spin" strokeWidth={4} size={32} />
      case 2: return <Check strokeWidth={5} size={32} />
      case 3: return <MoreHorizontal strokeWidth={5} size={32} />
      case 4: return <X strokeWidth={5} size={32} />
      default: return <MoreHorizontal strokeWidth={5} size={32} />
    }
  }

  const getIconStyles = (status) => {
    switch(status) {
      case 0: return 'bg-gray-200 border-4 border-transparent text-gray-500' // Apagado
      case 1: return 'bg-white border-[5px] border-[#004b93] text-[#004b93] scale-110 shadow-lg' // En proceso
      case 2: return 'bg-[#9ac6fa] border-4 border-transparent text-[#004b93]' // Terminado
      case 3: return 'bg-[#c9e1fb] border-4 border-transparent text-[#004b93]' // En espera
      case 4: return 'bg-red-200 border-4 border-transparent text-red-600' // Error
      default: return 'bg-[#c9e1fb] border-4 border-transparent text-[#004b93]'
    }
  }

  const isFinished = dbState.lugar_entrega === 2; // Si rampa/entrega terminó, mostramos botón

  return (
    <div className="flex flex-col min-h-[650px] h-full w-full relative pb-32 pt-4">
      {/* Música de elevador local */}
      <audio ref={audioRef} loop src="/assets/videoplayback.webm" />

      {/* SVG Path drawing with 90 degree angles */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <svg className="w-full h-full">
          {NODES.map((node, i) => {
            if (i === NODES.length - 1) return null
            const nextNode = NODES[i + 1]
            
            const nodeStatus = getStatus(node.id);
            const isFilled = nodeStatus === 2;
            const strokeColor = isFilled ? "#004b93" : "#002050"; 
            const strokeWidth = "3";
            
            return (
              <g key={`segment-${i}`}>
                {/* Horizontal line from node to target x */}
                <line 
                  x1={`${node.x}%`} 
                  y1={`${node.y}%`} 
                  x2={`${nextNode.x}%`} 
                  y2={`${node.y}%`}
                  stroke={strokeColor} 
                  strokeWidth={strokeWidth}
                  className="transition-all duration-500 ease-in-out"
                />
                {/* Vertical line from target x to target y */}
                <line 
                  x1={`${nextNode.x}%`} 
                  y1={`${node.y}%`} 
                  x2={`${nextNode.x}%`} 
                  y2={`${nextNode.y}%`}
                  stroke={strokeColor} 
                  strokeWidth={strokeWidth}
                  className="transition-all duration-500 ease-in-out"
                />
              </g>
            )
          })}
        </svg>
      </div>

      {/* Nodes */}
      {NODES.map((node) => {
        const status = getStatus(node.id);

        return (
          <div 
            key={node.id} 
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-500 ${getIconStyles(status)}`}>
              {renderIcon(status)}
            </div>
            <span className="font-extrabold mt-2 text-sm px-3 py-0.5 rounded-full text-[#004b93] bg-[#e6f0fa] drop-shadow-sm">
              {node.label}
            </span>
          </div>
        )
      })}

      <div className="absolute bottom-16 left-0 w-full flex justify-center z-20 px-4">
        {isFinished ? (
          <button 
            onClick={() => {
              if (audioRef.current) audioRef.current.pause();
              navigate('/delivered', { state: { piece } })
            }}
            className="bg-[#004b93] text-white font-bold py-3.5 px-8 rounded-full shadow-lg hover:bg-blue-800 w-11/12 text-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
          >
            Ver el pedido
          </button>
        ) : (
          <button 
            onClick={() => {
              // Simulador de avance rápido para demostración local si la BD no cambia
              setDbState(prev => {
                if (prev.almacen !== 2) return {...prev, almacen: 2, banda: 1}
                if (prev.banda !== 2) return {...prev, banda: 2, mitsubishi: 1}
                if (prev.mitsubishi !== 2) return {...prev, mitsubishi: 2, lugar_entrega: 1}
                if (prev.lugar_entrega !== 2) return {...prev, lugar_entrega: 2}
                return prev
              })
            }}
            className="bg-[#004b93]/10 text-[#004b93] font-bold py-2 px-8 rounded-full hover:bg-[#004b93]/20 transition-transform active:scale-95 opacity-50 text-xs mt-10"
          >
            Avanzar (Debug)
          </button>
        )}
      </div>
    </div>
  )
}
