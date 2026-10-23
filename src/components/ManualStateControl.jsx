import React, { useState, useEffect } from 'react'
import {
  fetchEstado,
  updateEstado,
  fetchDisponibilidad,
  updateDisponibilidadPieza,
  checkBackendHealth,
  ALMACEN_ID_BY_PIECE
} from '../plcConnection'

const STATIONS = [
  { key: 'almacen', label: 'Almacén' },
  { key: 'banda', label: 'Banda' },
  { key: 'mitsubishi', label: 'Mitsubishi' },
  { key: 'lugar_entrega', label: 'Lugar de entrega (Rampa)' }
]

const STATUS_OPTIONS = [
  { value: 0, label: '0 - Apagado (Desenergizado)', color: 'bg-gray-700 text-white border-gray-800' },
  { value: 1, label: '1 - En Proceso (Por defecto)', color: 'bg-[#004b93] text-white border-[#003b75]' },
  { value: 2, label: '2 - Terminado (Avanzar)', color: 'bg-emerald-600 text-white border-emerald-700' },
  { value: 3, label: '3 - En espera', color: 'bg-amber-500 text-white border-amber-600' },
  { value: 4, label: '4 - Error', color: 'bg-red-600 text-white border-red-700' }
]

const CATALOG = [
  {
    category: 'Arte',
    id_categoria: 2,
    pieces: [
      { id: 'acuarela', name: 'Acuarela' },
      { id: 'gises', name: 'Gises pasteles' },
      { id: 'plumones', name: 'Plumones' }
    ]
  },
  {
    category: 'Electrónica',
    id_categoria: 1,
    pieces: [
      { id: 'computadora', name: 'Computadoras' },
      { id: 'celular', name: 'Celular' },
      { id: 'audifonos', name: 'Audífonos' }
    ]
  },
  {
    category: 'Juguetes',
    id_categoria: 3,
    pieces: [
      { id: 'legos', name: 'Lego' },
      { id: 'juegos_mesa', name: 'Juego de mesa' },
      { id: 'rompecabezas', name: 'Rompecabezas' }
    ]
  }
]

export default function ManualStateControl() {
  const [estado, setEstado] = useState({
    almacen: 1,
    banda: 1,
    mitsubishi: 1,
    lugar_entrega: 1
  })
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
  const [saving, setSaving] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [isConnected, setIsConnected] = useState(true)
  const [feedbackMsg, setFeedbackMsg] = useState('')

  const showFeedback = (msg) => {
    setFeedbackMsg(msg)
    setTimeout(() => setFeedbackMsg(''), 2500)
  }

  // Heartbeat cada 2 segundos leyendo el estado actual y disponibilidad desde SQL
  useEffect(() => {
    let isMounted = true
    const loadFromSql = async () => {
      try {
        const health = await checkBackendHealth()
        if (!isMounted) return

        setIsConnected(health)
        if (!health) return

        const [estData, dispData] = await Promise.all([
          fetchEstado(),
          fetchDisponibilidad()
        ])
        if (!isMounted) return

        if (estData) {
          setEstado({
            almacen: Number(estData.almacen ?? 1),
            banda: Number(estData.banda ?? 1),
            mitsubishi: Number(estData.mitsubishi ?? 1),
            lugar_entrega: Number(estData.lugar_entrega ?? 1)
          })
        }
        if (dispData) {
          setAvailability(dispData)
        }
        setLastSync(new Date().toLocaleTimeString())
      } catch (err) {
        if (isMounted) setIsConnected(false)
      }
    }

    loadFromSql()
    const interval = setInterval(loadFromSql, 2000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  // Asignar estado a una estación libremente
  const handleAssignState = async (stationKey, newValue) => {
    const updated = {
      ...estado,
      [stationKey]: Number(newValue)
    }

    // Actualización optimista inmediata en la UI
    setEstado(updated)
    setSaving(true)
    showFeedback(`Actualizando ${stationKey} a ${newValue}...`)

    const saved = await updateEstado(updated)
    if (saved) {
      setEstado({
        almacen: Number(saved.almacen ?? 1),
        banda: Number(saved.banda ?? 1),
        mitsubishi: Number(saved.mitsubishi ?? 1),
        lugar_entrega: Number(saved.lugar_entrega ?? 1)
      })
      showFeedback(`✓ ${stationKey.toUpperCase()} = ${newValue} guardado en SQL`)
      setIsConnected(true)
    } else {
      showFeedback(`⚠️ No se pudo guardar en SQL (verifica el servidor)`)
    }
    setSaving(false)
  }

  // Reiniciar todo a 1 (Por defecto)
  const handleResetDefault = async () => {
    const defaultState = {
      almacen: 1,
      banda: 1,
      mitsubishi: 1,
      lugar_entrega: 1
    }
    setEstado(defaultState)
    setSaving(true)
    showFeedback('Reiniciando estaciones a 1...')
    const saved = await updateEstado(defaultState)
    if (saved) {
      showFeedback('✓ Todas las estaciones en 1 (En Proceso)')
    }
    setSaving(false)
  }

  // Avanzar siguiente estación disponible a 2 (Terminado)
  const handleAdvanceNext = async () => {
    const updated = { ...estado }
    let changedStation = null

    for (const station of STATIONS) {
      if (Number(updated[station.key]) !== 2) {
        updated[station.key] = 2
        changedStation = station.label
        break
      }
    }

    if (!changedStation) {
      showFeedback('Todas las estaciones ya están en 2 (Terminado)')
      return
    }

    setEstado(updated)
    setSaving(true)
    showFeedback(`Avanzando ${changedStation} a 2 (Terminado)...`)
    await updateEstado(updated)
    showFeedback(`✓ ${changedStation} avanzado a 2 en SQL`)
    setSaving(false)
  }

  // Simular Error (4) en la estación actual activa
  const handleTriggerError = async () => {
    const updated = { ...estado }
    let targetStation = 'almacen'

    // Buscar la estación que está en proceso (1) o la primera
    for (const station of STATIONS) {
      if (Number(updated[station.key]) === 1) {
        targetStation = station.key
        break
      }
    }

    updated[targetStation] = 4
    setEstado(updated)
    setSaving(true)
    showFeedback(`Simulando Error (4) en ${targetStation}...`)
    await updateEstado(updated)
    showFeedback(`✓ Error (4) asignado a ${targetStation}. Alarma registrada.`)
    setSaving(false)
  }

  // Alternar disponibilidad de una pieza individual
  const handleTogglePiece = async (pieceId) => {
    const currentDisp = availability.pieces[pieceId] !== false
    const nextDisp = !currentDisp
    const id_almacen = ALMACEN_ID_BY_PIECE[pieceId]

    setAvailability((prev) => {
      const nextPieces = { ...prev.pieces, [pieceId]: nextDisp }
      const nextCategories = { ...prev.categories }
      for (const group of CATALOG) {
        nextCategories[group.category] = group.pieces.some((p) => nextPieces[p.id] !== false)
      }
      return { categories: nextCategories, pieces: nextPieces }
    })

    setSaving(true)
    showFeedback(`Actualizando pieza ${pieceId}...`)
    await updateDisponibilidadPieza({ id_almacen, disponible: nextDisp ? 1 : 0 })
    const dispData = await fetchDisponibilidad()
    if (dispData) setAvailability(dispData)
    showFeedback(`✓ ${pieceId}: ${nextDisp ? 'Disponible' : 'Agotado'} en BD`)
    setSaving(false)
  }

  // Alternar disponibilidad de toda una categoría
  const handleToggleCategory = async (group) => {
    const isAnyAvailable = group.pieces.some((p) => availability.pieces[p.id] !== false)
    const nextDisp = !isAnyAvailable

    setSaving(true)
    showFeedback(`Actualizando caja ${group.category}...`)
    await updateDisponibilidadPieza({
      id_categoria: group.id_categoria,
      disponible: nextDisp ? 1 : 0
    })
    const dispData = await fetchDisponibilidad()
    if (dispData) setAvailability(dispData)
    showFeedback(`✓ Caja ${group.category}: ${nextDisp ? 'Habilitada' : 'Agotada'} en BD`)
    setSaving(false)
  }

  return (
    <div className="w-full max-w-md mx-auto py-3 px-3 flex flex-col gap-4 select-none pb-12">
      {/* Banner de Estado de Conexión y Notificaciones */}
      <div className={`p-3 rounded-2xl border shadow-sm transition-all flex items-center justify-between ${
        isConnected ? 'bg-white border-blue-200' : 'bg-red-50 border-red-300'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs font-bold text-gray-800">
            {isConnected ? 'Backend & MySQL: Conectados' : 'Desconectado: Revisa node server.js'}
          </span>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#004b93]">
          Sync: {lastSync || '...'}
        </span>
      </div>

      {feedbackMsg && (
        <div className="bg-[#003b75] text-white text-xs font-bold py-2 px-3 rounded-xl shadow-md text-center animate-fade-in">
          {feedbackMsg}
        </div>
      )}

      {/* Sección 1: Asignación Manual de Estado */}
      <div className="bg-white rounded-2xl shadow-md p-4 border border-blue-200">
        <h2 className="text-base font-extrabold text-[#003b75] mb-1">
          1. Panel de Asignación de Estado (SQL)
        </h2>
        <p className="text-xs text-gray-600 mb-2">
          Haz clic en cualquier número para asignarlo directamente en la tabla <strong>Estado</strong> de MySQL:
        </p>
        <div className="flex flex-wrap gap-1.5 text-[11px] text-gray-700 bg-blue-50/70 p-2 rounded-xl mb-3">
          <span className="font-bold">0: Apagado</span> |
          <span className="font-bold text-[#004b93]">1: En Proceso</span> |
          <span className="font-bold text-emerald-700">2: Terminado (Avanzar)</span> |
          <span className="font-bold text-amber-600">3: Espera</span> |
          <span className="font-bold text-red-600">4: Error</span>
        </div>

        {/* Lista de estaciones */}
        <div className="flex flex-col gap-3">
          {STATIONS.map((station, idx) => {
            const currentVal = Number(estado[station.key] ?? 1)

            return (
              <div
                key={station.key}
                className="bg-[#f8fbff] rounded-xl p-3 border border-blue-100 flex flex-col gap-2 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#003b75] text-sm">
                    {idx + 1}. {station.label}
                  </span>
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#003b75] text-white">
                    SQL: {currentVal}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const isSelected = currentVal === opt.value

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleAssignState(station.key, opt.value)}
                        className={`py-2.5 px-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          isSelected
                            ? `${opt.color} shadow-md scale-105 ring-2 ring-blue-300`
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-100 hover:border-blue-400 active:scale-95'
                        }`}
                        title={opt.label}
                      >
                        {opt.value}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Botones de acción rápida */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleAdvanceNext}
              className="py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow transition-all cursor-pointer active:scale-95 text-center"
            >
              Avanzar etapa (➔ 2)
            </button>
            <button
              type="button"
              onClick={handleTriggerError}
              className="py-2 px-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow transition-all cursor-pointer active:scale-95 text-center"
            >
              Simular Error (➔ 4)
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetDefault}
            className="w-full py-2.5 rounded-xl bg-[#003b75] text-white font-extrabold text-xs shadow hover:bg-[#004b93] transition-all cursor-pointer active:scale-95"
          >
            Reiniciar todo a Estado 1 (Por defecto)
          </button>
        </div>
      </div>

      {/* Sección 2: Disponibilidad de Piezas en SQL */}
      <div className="bg-white rounded-2xl shadow-md p-4 border border-blue-200">
        <h2 className="text-base font-extrabold text-[#003b75] mb-1">
          2. Disponibilidad de Piezas (SQL)
        </h2>
        <p className="text-xs text-gray-600 mb-3">
          Haz clic en una pieza o en una caja para cambiar su disponibilidad en las tablas <strong>Almacén</strong> y <strong>categoría_piezas</strong>.
        </p>

        <div className="flex flex-col gap-3">
          {CATALOG.map((group) => {
            const availableCount = group.pieces.filter(
              (p) => availability.pieces[p.id] !== false
            ).length
            const isCatAvailable = availableCount > 0

            return (
              <div
                key={group.category}
                className="rounded-xl border border-blue-100 bg-[#f8fbff] p-3 flex flex-col gap-2 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[#003b75]">
                      {group.category}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isCatAvailable
                          ? 'bg-blue-100 text-[#004b93]'
                          : 'bg-gray-300 text-gray-600'
                      }`}
                    >
                      piezas: {availableCount}/3
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleCategory(group)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      isCatAvailable
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-[#4a90e2] text-white hover:bg-[#004b93]'
                    }`}
                  >
                    {isCatAvailable ? 'Agotar caja' : 'Habilitar caja'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {group.pieces.map((piece) => {
                    const isAvailable = availability.pieces[piece.id] !== false
                    return (
                      <button
                        key={piece.id}
                        type="button"
                        onClick={() => handleTogglePiece(piece.id)}
                        className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          isAvailable
                            ? 'bg-[#b8dafc]/80 text-[#003b75] border-blue-300 hover:bg-[#4a90e2] hover:text-white active:scale-95'
                            : 'bg-gray-300 text-gray-600 border-gray-400 hover:bg-gray-400 hover:text-white active:scale-95'
                        }`}
                      >
                        <span className="truncate w-full text-center">{piece.name}</span>
                        <span className="text-[10px] font-normal">
                          {isAvailable ? 'Disponible (1)' : 'Agotada (0)'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
