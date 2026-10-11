import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function OrderConfirmation() {
  const location = useLocation()
  const navigate = useNavigate()
  const isSuccess = location.state?.success ?? true
  const piece = location.state?.piece

  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-24px)] w-full max-w-sm mx-auto select-none">
      {/* Barra decorativa superior */}
      <div className="w-full h-5 bg-[#b3d8ff] rounded-xl shrink-0" />

      {/* Logo Click-Go alineado a la derecha como en la imagen */}
      <div className="w-full flex justify-end pr-3 mt-1.5">
        <img
          src="/assets/logo_text.png"
          alt="Click-Go"
          className="h-9 object-contain drop-shadow-sm"
        />
      </div>

      {/* Título principal */}
      <h2 className="text-[28px] font-extrabold text-[#003b75] mt-2 mb-4 text-center px-4 leading-tight tracking-tight">
        {isSuccess ? 'Pedido confirmado' : 'Pedido rechazado'}
      </h2>
      
      {isSuccess ? (
        <div className="flex flex-col items-center flex-grow justify-center w-full max-w-sm">
          <div className="w-48 h-48 rounded-[32px] flex items-center justify-center shadow-sm mb-6 bg-[#a6d1ff]">
            {piece?.img ? (
              <img src={piece.img} alt={piece.name} className="w-40 h-40 object-contain drop-shadow-xl" />
            ) : (
              <span className="text-7xl">📦</span>
            )}
          </div>
          
          <h3 className="text-xl font-extrabold text-[#003b75] mb-3 text-center">
            Producto: {piece?.name || 'Arte'}
          </h3>
          <p className="text-sm font-extrabold text-[#003b75] text-center px-6 leading-snug">
            {piece?.desc || 'El arte de mezclar agua con colores hasta que parezca un accidente muy elegante y caro.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center flex-grow justify-center w-full max-w-sm">
          <div className="w-48 h-48 rounded-[32px] flex items-center justify-center shadow-sm mb-6 bg-[#a6d1ff]">
            <span className="text-[#003b75] text-[105px] font-serif font-bold leading-none mt-[-10px] tracking-tighter">
              :(
            </span>
          </div>
          
          <h3 className="text-[25px] font-extrabold text-[#003b75] mb-3 text-center px-4 leading-tight">
            No eres tú, somos nosotros
          </h3>
          <p className="text-[15px] font-extrabold text-[#003b75] text-left px-6 leading-snug">
            Tenemos una pieza en proceso. Espera tu turno para pedir tu pieza
          </p>
        </div>
      )}

      {/* Botón inferior */}
      <div className="w-full flex justify-center px-2 mt-4">
        {isSuccess ? (
          <button 
            onClick={() => navigate('/progress', { state: { piece } })}
            className="bg-[#003b75] text-[#a6d1ff] font-extrabold py-3.5 px-8 rounded-full shadow-md hover:bg-[#004b93] hover:text-white w-full text-xl tracking-wide transition-all active:scale-95 flex items-center justify-center"
          >
            Ver estado del pedido
          </button>
        ) : (
          <button 
            onClick={() => navigate('/')}
            className="bg-[#003b75] text-[#a6d1ff] font-extrabold py-3.5 px-8 rounded-full shadow-md hover:bg-[#004b93] hover:text-white w-full text-xl tracking-wide transition-all active:scale-95"
          >
            Volver a pedidos
          </button>
        )}
      </div>

      {/* Barra decorativa inferior */}
      <div className="w-full h-5 bg-[#b3d8ff] rounded-xl mt-3 shrink-0" />
    </div>
  )
}

