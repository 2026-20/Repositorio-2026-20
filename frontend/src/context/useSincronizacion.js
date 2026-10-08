import { useContext } from 'react'
import { SincronizacionContext } from './SincronizacionContext'

export function useSincronizacion() {
    return useContext(SincronizacionContext)
}
