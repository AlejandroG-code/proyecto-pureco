import React, { useState, useEffect } from 'react'
import {
  fetchEstado,
  updateEstado,
  fetchDisponibilidad,
  updateDisponibilidadPieza,
  ALMACEN_ID_BY_PIECE
} from '../plcConnection'

const STATIONS = [
  { key: 'almacen', label: 'Almacén' },
  { key: 'banda', label: 'Banda' },
  { key: 'mitsubishi', label: 'Mitsubishi' },
  { key: 'lugar_entrega', label: 'Lugar de entrega (Rampa)' }
]

const STATUS_OPTIONS = [
  { value: 0, label: '0 - Apagado (Desenergizado)', color: 'bg-gray-600 text-white' },
  { value: 1, label: '1 - En Proceso (Por defecto)', color: 'bg-[#4a90e2] text-white' },
  { value: 2, label: '2 - Terminado (Avanzar)', color: 'bg-emerald-600 text-white' },
  { value: 3, label: '3 - En espera', color: 'bg-amber-500 text-white' },
  { value: 4, label: '4 - Error', color: 'bg-red-600 text-white' }
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

  // Heartbeat cada 2 segundos leyendo el estado actual y disponibilidad desde SQL
  useEffect(() => {
    let isMounted = true
    const loadFromSql = async () => {
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
    }

    loadFromSql()
    const interval = setInterval(loadFromSql, 2000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  // Verifica si las estaciones anteriores ya están en 2 (Terminado) para permitir avanzar
  const canSetTerminado = (stationIndex) => {
    for (let i = 0; i < stationIndex; i++) {
      const prevKey = STATIONS[i].key
      if (Number(estado[prevKey]) !== 2) {
        return false
      }
    }
    return true
  }

  const handleAssignState = async (stationKey, newValue, stationIndex) => {
    if (newValue === 2 && !canSetTerminado(stationIndex)) {
      return
    }

    const updated = {
      ...estado,
      [stationKey]: Number(newValue)
    }

    // Si una estación regresa a != 2, las siguientes que estaban en 2 vuelven a 1 (por defecto)
    if (newValue !== 2) {
      for (let i = stationIndex + 1; i < STATIONS.length; i++) {
        const nextKey = STATIONS[i].key
        if (updated[nextKey] === 2) {
          updated[nextKey] = 1
        }
      }
    }

    setEstado(updated)
    setSaving(true)
    const saved = await updateEstado(updated)
    if (saved) {
      setEstado({
        almacen: Number(saved.almacen ?? 1),
        banda: Number(saved.banda ?? 1),
        mitsubishi: Number(saved.mitsubishi ?? 1),
        lugar_entrega: Number(saved.lugar_entrega ?? 1)
      })
    }
    setSaving(false)
  }

  const handleResetDefault = async () => {
    const defaultState = {
      almacen: 1,
      banda: 1,
      mitsubishi: 1,
      lugar_entrega: 1
    }
    setEstado(defaultState)
    setSaving(true)
    await updateEstado(defaultState)
    setSaving(false)
  }

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
    await updateDisponibilidadPieza({ id_almacen, disponible: nextDisp ? 1 : 0 })
    const dispData = await fetchDisponibilidad()
    if (dispData) setAvailability(dispData)
    setSaving(false)
  }

  const handleToggleCategory = async (group) => {
    const isAnyAvailable = group.pieces.some((p) => availability.pieces[p.id] !== false)
    const nextDisp = !isAnyAvailable

    setSaving(true)
    await updateDisponibilidadPieza({
      id_categoria: group.id_categoria,
      disponible: nextDisp ? 1 : 0
    })
    const dispData = await fetchDisponibilidad()
    if (dispData) setAvailability(dispData)
    setSaving(false)
  }

  return (
    <div className="w-full max-w-md mx-auto py-3 px-3 flex flex-col gap-4 select-none pb-10">
      {/* Sección 1: Estado del Proceso */}
      <div className="bg-white rounded-2xl shadow-md p-4 border border-blue-200">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-extrabold text-[#003b75]">
            1. Asignación Manual de Estado (SQL)
          </h2>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-[#004b93]">
            Heartbeat: 2s {lastSync ? `(${lastSync})` : ''}
          </span>
        </div>
        <p className="text-xs text-gray-600">
          Por defecto todo inicia en <strong>1 (En Proceso)</strong>. Asigna <strong>2 (Terminado)</strong> en orden para avanzar, o <strong>0 (Desenergizado)</strong> / <strong>4 (Error)</strong> en cualquier momento.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {STATIONS.map((station, idx) => {
          const currentVal = Number(estado[station.key] ?? 1)
          const unlockedForAdvance = canSetTerminado(idx)

          return (
            <div
              key={station.key}
              className="bg-white rounded-2xl shadow-sm p-3 border border-blue-100 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[#003b75] text-sm">
                  {idx + 1}. {station.label}
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#e6f0fa] text-[#003b75]">
                  SQL ({station.key}): {currentVal}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = currentVal === opt.value
                  const isDisabled = opt.value === 2 && !unlockedForAdvance

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isDisabled || saving}
                      onClick={() => handleAssignState(station.key, opt.value, idx)}
                      title={
                        isDisabled
                          ? 'La estación anterior debe estar en estado 2 (Terminado) para avanzar'
                          : opt.label
                      }
                      className={`py-2 px-1 rounded-xl text-xs font-extrabold border transition-all ${
                        isSelected
                          ? `${opt.color} border-transparent shadow-md scale-[1.03]`
                          : isDisabled
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-[#f3f8ff] text-[#003b75] border-blue-200 hover:bg-[#d8ecff] cursor-pointer'
                      }`}
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

      <button
        type="button"
        disabled={saving}
        onClick={handleResetDefault}
        className="w-full py-2.5 rounded-full bg-[#003b75] text-white font-bold text-sm shadow hover:bg-[#004b93] transition-all active:scale-95"
      >
        Reiniciar todo a Estado 1 (Por defecto)
      </button>

      {/* Sección 2: Disponibilidad de Piezas */}
      <div className="bg-white rounded-2xl shadow-md p-4 border border-blue-200 mt-2">
        <h2 className="text-base font-extrabold text-[#003b75] mb-1">
          2. Disponibilidad de Piezas (SQL)
        </h2>
        <p className="text-xs text-gray-600 mb-3">
          Activa o desactiva la disponibilidad de cada pieza individual o de toda la caja en las tablas <strong>Almacén</strong> y <strong>categoría_piezas</strong>.
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
                className="rounded-xl border border-blue-100 bg-[#f8fbff] p-3 flex flex-col gap-2"
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
                      cantidad: {availableCount}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={saving}
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
                        disabled={saving}
                        onClick={() => handleTogglePiece(piece.id)}
                        className={`py-2 px-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          isAvailable
                            ? 'bg-[#b8dafc]/80 text-[#003b75] border-blue-300 hover:bg-[#4a90e2] hover:text-white'
                            : 'bg-gray-300 text-gray-600 border-gray-400 hover:bg-gray-400 hover:text-white'
                        }`}
                      >
                        <span className="truncate w-full text-center">{piece.name}</span>
                        <span className="text-[10px] font-normal">
                          {isAvailable ? 'Disponible (1)' : 'Sin piezas (0)'}
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
