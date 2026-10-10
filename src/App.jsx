import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PieceSelection from './components/PieceSelection'
import OrderConfirmation from './components/OrderConfirmation'
import OrderProgress from './components/OrderProgress'
import OrderDelivered from './components/OrderDelivered'

function App() {
  return (
    <BrowserRouter>
      <div className="app-container overflow-y-auto overflow-x-hidden min-h-screen bg-[#f3f8ff]">
          <div className="w-full text-center py-4 sticky top-0 z-10 bg-[#f3f8ff]/90 backdrop-blur-sm">
            <div className="flex justify-center items-center">
              <img src="/assets/logo.png" alt="Click-Go" className="h-14 object-contain drop-shadow-md" />
            </div>
          </div>

          <div className="p-4 flex-grow flex flex-col relative">
            <Routes>
              <Route path="/" element={<PieceSelection />} />
              <Route path="/confirmation" element={<OrderConfirmation />} />
              <Route path="/progress" element={<OrderProgress />} />
              <Route path="/delivered" element={<OrderDelivered />} />
            </Routes>
          </div>
          
        </div>
    </BrowserRouter>
  )
}

export default App
