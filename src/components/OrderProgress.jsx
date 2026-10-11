import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { fetchEstado } from '../plcConnection'

const NODES = [
  { id: 'almacen', label: 'Almacén', x: 95, y: 50, dbField: 'almacen' },
  { id: 'banda', label: 'Banda', x: 265, y: 138, dbField: 'banda' },
  { id: 'mitsubishi', label: 'Mitsubishi', x: 95, y: 226, dbField: 'mitsubishi' },
  { id: 'rampa', label: 'Rampa', x: 265, y: 314, dbField: 'lugar_entrega' },
  { id: 'fin', label: 'Fin', x: 95, y: 402, dbField: 'fin' }
]

export default function OrderProgress() {
  const navigate = useNavigate()
  const location = useLocation()
  const piece = location.state?.piece
  
  const [dbState, setDbState] = useState({
    almacen: 1,
    banda: 3,
    mitsubishi: 3,
    lugar_entrega: 3
  })

  // Música de elevador
  const audioRef = useRef(null)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(e => console.log('Audio autoplay prevented:', e));
    }

    const loadEstado = async () => {
      const estado = await fetchEstado();
      if (estado) {
        setDbState(estado);
      }
    };

    loadEstado();
    const interval = setInterval(loadEstado, 1000);

    return () => clearInterval(interval);
  }, []);

  const getStatus = (nodeId) => {
    if (nodeId === 'fin') {
      return dbState.lugar_entrega === 2 ? 2 : 3;
    }
    const field = NODES.find(n => n.id === nodeId)?.dbField;
    return dbState[field] !== undefined ? Number(dbState[field]) : 3;
  };

  const renderIcon = (status) => {
    switch (status) {
      case 0: // Apagado
        return (
          <img
            src="/assets/icon_apagado.png"
            alt="Apagado"
            className="w-[50px] h-[50px] object-contain opacity-60 transition-all duration-500"
          />
        )
      case 1: // En proceso
        return (
          <img
            src="/assets/icon_proceso.png"
            alt="En proceso"
            className="w-[52px] h-[52px] object-contain animate-[spin_3s_linear_infinite] transition-all duration-500"
          />
        )
      case 2: // Terminado
        return (
          <img
            src="/assets/icon_terminado.png"
            alt="Terminado"
            className="w-[50px] h-[50px] object-contain drop-shadow-sm transition-all duration-500 scale-100"
          />
        )
      case 3: // En espera
        return (
          <img
            src="/assets/icon_espera.png"
            alt="En espera"
            className="w-[52px] h-[52px] object-contain animate-[pulse_2.5s_ease-in-out_infinite] transition-all duration-500"
          />
        )
      case 4: // Error
        return (
          <img
            src="/assets/icon_error.png"
            alt="Error"
            className="w-[50px] h-[50px] object-contain animate-pulse transition-all duration-500"
          />
        )
      default:
        return (
          <img
            src="/assets/icon_espera.png"
            alt="En espera"
            className="w-[52px] h-[52px] object-contain animate-[pulse_2.5s_ease-in-out_infinite]"
          />
        )
    }
  }

  const getCircleStyles = (status) => {
    switch (status) {
      case 0:
        return 'bg-gray-300/90 opacity-75'
      case 1:
        return 'bg-[#a6d1ff] ring-4 ring-[#7ab8ff]/45 shadow-md scale-[1.04]'
      case 2:
        return 'bg-[#a6d1ff] shadow-sm'
      case 3:
        return 'bg-[#a6d1ff] shadow-sm'
      case 4:
        return 'bg-red-200 ring-4 ring-red-300/50 shadow-md'
      default:
        return 'bg-[#a6d1ff] shadow-sm'
    }
  }

  const isFinished = getStatus('rampa') === 2;

  const handleButtonClick = () => {
    if (isFinished) {
      if (audioRef.current) audioRef.current.pause();
      navigate('/delivered', { state: { piece } });
    } else {
      // Si aún no termina en BD (modo prueba local), avanza suavemente de etapa
      setDbState(prev => {
        if (prev.almacen !== 2) return { ...prev, almacen: 2, banda: 1 };
        if (prev.banda !== 2) return { ...prev, banda: 2, mitsubishi: 1 };
        if (prev.mitsubishi !== 2) return { ...prev, mitsubishi: 2, lugar_entrega: 1 };
        if (prev.lugar_entrega !== 2) return { ...prev, lugar_entrega: 2 };
        return prev;
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-24px)] w-full max-w-sm mx-auto select-none">
      {/* Música de elevador local */}
      <audio ref={audioRef} loop src="/assets/videoplayback.webm" />

      {/* Barra decorativa superior */}
      <div className="w-full h-5 bg-[#b3d8ff] rounded-xl shrink-0" />

      {/* Logo Click-Go alineado a la derecha como en la imagen */}
      <div className="w-full flex justify-end pr-3 mt-1.5 z-20">
        <img
          src="/assets/logo_text.png"
          alt="Click-Go"
          className="h-9 object-contain drop-shadow-sm"
        />
      </div>

      {/* Diagrama de progreso con ángulos de 90 grados */}
      <div className="relative w-full max-w-[360px] h-[465px] mx-auto -mt-2 my-auto">
        <svg
          viewBox="0 0 360 465"
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
        >
          {NODES.map((node, i) => {
            if (i === NODES.length - 1) return null;
            const nextNode = NODES[i + 1];
            const nodeStatus = getStatus(node.id);
            const nextStatus = getStatus(nextNode.id);
            const isSegmentActive = nodeStatus === 1 || nextStatus === 1;
            const isSegmentDone = nodeStatus === 2;

            const points = `${node.x},${node.y} ${nextNode.x},${node.y} ${nextNode.x},${nextNode.y}`;

            return (
              <g key={`segment-${i}`}>
                {/* Línea base azul marino */}
                <polyline
                  points={points}
                  fill="none"
                  stroke="#001871"
                  strokeWidth="5.5"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  className="transition-all duration-700 ease-in-out"
                  style={{ opacity: isSegmentDone || isSegmentActive ? 1 : 0.85 }}
                />

                {/* Efecto sutil de pulso en el tramo activo */}
                {isSegmentActive && (
                  <polyline
                    points={points}
                    fill="none"
                    stroke="#4a90e2"
                    strokeWidth="5.5"
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    className="animate-pulse"
                    style={{ opacity: 0.45 }}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodos */}
        {NODES.map((node) => {
          const status = getStatus(node.id);
          const leftPct = (node.x / 360) * 100;
          const topPct = (node.y / 465) * 100;

          return (
            <div
              key={node.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            >
              {/* Círculo del nodo */}
              <div
                className={`w-[76px] h-[76px] rounded-full flex items-center justify-center transition-all duration-500 ease-out ${getCircleStyles(status)}`}
              >
                {renderIcon(status)}
              </div>

              {/* Etiqueta debajo del círculo */}
              <span
                className={`position-label absolute top-[80px] whitespace-nowrap font-extrabold text-[19px] tracking-tight text-[#003b75] transition-all duration-300 ${
                  status === 1 ? 'scale-105' : ''
                }`}
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Botón inferior "Ver el pedido" */}
      <div className="w-full flex justify-center px-2 mt-2">
        <button
          onClick={handleButtonClick}
          className={`bg-[#003b75] text-[#a6d1ff] font-extrabold py-3.5 px-8 rounded-full shadow-md w-full text-xl tracking-wide transition-all duration-300 active:scale-95 ${
            isFinished
              ? 'hover:bg-[#004b93] hover:text-white hover:shadow-lg animate-[pulse_2s_ease-in-out_infinite]'
              : 'hover:bg-[#004b93]'
          }`}
        >
          Ver el pedido
        </button>
      </div>

      {/* Barra decorativa inferior */}
      <div className="w-full h-5 bg-[#b3d8ff] rounded-xl mt-3 shrink-0" />
    </div>
  )
}

