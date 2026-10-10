import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, X } from 'lucide-react'

export default function OrderConfirmation() {
  const location = useLocation()
  const navigate = useNavigate()
  const isSuccess = location.state?.success ?? true
  const piece = location.state?.piece

  return (
    <div className="flex flex-col items-center h-full justify-between pb-12 pt-8">
      <h2 className="text-3xl font-extrabold text-[#004b93] mb-8 text-center px-4 leading-tight tracking-tight">
        {isSuccess ? 'Pedido confirmado' : 'Pedido rechazado'}
      </h2>
      
      {isSuccess ? (
        <div className="flex flex-col items-center flex-grow justify-center w-full max-w-sm">
          <div className={`w-48 h-48 rounded-[40px] flex items-center justify-center shadow-lg mb-8 bg-[#e8f1fa]`}>
            {piece?.img ? (
              <img src={piece.img} alt={piece.name} className="w-40 h-40 object-contain drop-shadow-xl" />
            ) : (
              <span className="text-7xl">📦</span>
            )}
          </div>
          
          <h3 className="text-xl font-extrabold text-[#004b93] mb-3 text-center">
            Producto: {piece?.name || 'Arte'}
          </h3>
          <p className="text-sm font-bold text-[#004b93] text-center px-8">
            {piece?.desc || 'El arte de mezclar agua con colores hasta que parezca un accidente muy elegante y caro.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center flex-grow justify-center w-full max-w-sm">
          <div className="w-48 h-48 rounded-[40px] flex items-center justify-center shadow-lg mb-8 bg-[#e8f1fa]">
            <span className="text-[#004b93] text-[100px] font-bold mt-[-20px]">:(</span>
          </div>
          
          <h3 className="text-2xl font-extrabold text-[#004b93] mb-4 text-center px-4">
            No eres tú, somos nosotros
          </h3>
          <p className="text-sm font-bold text-[#004b93] text-center px-8">
            Tenemos una pieza en proceso. Espera tu turno para pedir tu pieza
          </p>
        </div>
      )}

      <div className="mt-8 w-full flex justify-center">
        {isSuccess ? (
          <button 
            onClick={() => navigate('/progress', { state: { piece } })}
            className="bg-[#004b93] text-white font-bold py-3.5 px-8 rounded-full shadow-lg hover:bg-blue-800 w-11/12 text-lg transition-transform active:scale-95 flex items-center justify-center"
          >
            Ver estado del pedido <span className="ml-4 bg-white w-2 h-2 rounded-full inline-block"></span>
          </button>
        ) : (
          <button 
            onClick={() => navigate('/')}
            className="bg-[#004b93] text-white font-bold py-3.5 px-8 rounded-full shadow-lg hover:bg-blue-800 w-11/12 text-lg transition-transform active:scale-95"
          >
            Volver a pedidos
          </button>
        )}
      </div>
    </div>
  )
}
