import React from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import PieceSelection from './components/PieceSelection'
import OrderConfirmation from './components/OrderConfirmation'
import OrderProgress from './components/OrderProgress'
import OrderDelivered from './components/OrderDelivered'
import ManualStateControl from './components/ManualStateControl'

function AppLayout() {
  const location = useLocation()
  const isCustomHeaderPage =
    location.pathname === '/progress' || location.pathname === '/confirmation'

  return (
    <div className="app-container overflow-y-auto overflow-x-hidden min-h-screen bg-[#d8ecff]">
      {!isCustomHeaderPage && (
        <div className="w-full text-center py-4 sticky top-0 z-10 bg-[#d8ecff]/90 backdrop-blur-sm">
          <div className="flex justify-center items-center">
            <img src="/assets/logo.png" alt="Click-Go" className="h-14 object-contain drop-shadow-md" />
          </div>
        </div>
      )}

      <div className={`${isCustomHeaderPage ? 'p-3' : 'p-4'} flex-grow flex flex-col relative`}>
        <Routes>
          <Route path="/" element={<PieceSelection />} />
          <Route path="/confirmation" element={<OrderConfirmation />} />
          <Route path="/progress" element={<OrderProgress />} />
          <Route path="/delivered" element={<OrderDelivered />} />
          <Route path="/estado" element={<ManualStateControl />} />
          <Route path="/control" element={<ManualStateControl />} />
        </Routes>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App


