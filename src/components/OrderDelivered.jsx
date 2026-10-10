import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Star } from 'lucide-react'
import { sendRating } from '../plcConnection'

export default function OrderDelivered() {
  const navigate = useNavigate()
  const location = useLocation()
  const piece = location.state?.piece || { img: '/assets/acuarela.png' }
  const [rating, setRating] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const handleRating = async (val) => {
    setRating(val)
    setSubmitted(true)
    await sendRating(val)
    setTimeout(() => {
      navigate('/')
    }, 1500)
  }

  return (
    <div className="flex flex-col items-center h-full pt-8 pb-12 justify-between">
      <h2 className="text-3xl font-extrabold text-[#004b93] mb-6 text-center leading-tight tracking-tight">
        Pedido entregado
      </h2>
      
      <div className={`w-48 h-48 bg-[#e8f1fa] rounded-[40px] shadow-lg mb-8 flex items-center justify-center p-4`}>
        {piece.img ? (
          <img src={piece.img} alt="Entregado" className="w-full h-full object-contain drop-shadow-xl" />
        ) : (
          <span className="text-[100px]">🎨</span>
        )}
      </div>

      <div className="mt-auto w-full flex flex-col items-center gap-6">
        <p className="text-[#004b93] font-extrabold text-lg text-center px-4">
          {submitted ? '¡Gracias por tu opinión!' : 'Nos encantaría saber tu opinión :)'}
        </p>
        
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRating(star)}
              disabled={submitted}
              className={`transition-transform hover:scale-110 active:scale-95 ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <Star 
                size={42} 
                className={`${star <= rating ? 'fill-[#004b93] text-[#004b93]' : 'fill-[#c9e1fb] text-[#c9e1fb]'}`} 
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>

        <button 
          onClick={() => navigate('/')}
          className="bg-[#004b93] text-white font-bold py-3.5 px-8 rounded-full shadow-lg hover:bg-blue-800 w-11/12 text-lg transition-transform active:scale-95 mt-4"
        >
          Hacer otro pedido
        </button>
      </div>
    </div>
  )
}
