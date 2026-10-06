import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../context/AuthContext'
import { sincronizarDatosMaestros } from '../storage/sincronizacionDatosMaestros.js'
import { useSincronizacionDatosMaestros } from './useSincronizacionDatosMaestros.js'

vi.mock('../storage/sincronizacionDatosMaestros.js', () => ({
    sincronizarDatosMaestros: vi.fn(),
}))

function envolverConUsuario({ children }) {
    return (
        <AuthContext.Provider value={{ usuario: { id: 7 }, token: 'jwt-prueba' }}>{children}</AuthContext.Provider>
    )
}

describe('useSincronizacionDatosMaestros', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('arranca inactivo y pasa a listo con la fecha de sincronizacion', async () => {
        sincronizarDatosMaestros.mockResolvedValue('2026-10-05T20:00:00.000Z')

        const { result } = renderHook(() => useSincronizacionDatosMaestros(), { wrapper: envolverConUsuario })

        expect(result.current.estado).toBe('inactivo')

        await act(async () => {
            await result.current.sincronizar()
        })

        expect(sincronizarDatosMaestros).toHaveBeenCalledWith(7, 'jwt-prueba')
        expect(result.current.estado).toBe('listo')
        expect(result.current.ultimaSincronizacion).toBe('2026-10-05T20:00:00.000Z')
        expect(result.current.error).toBeNull()
    })

    it('pasa a error y guarda el motivo cuando la sincronizacion falla', async () => {
        const errorEsperado = new Error('No hay conexion a internet. Los datos de la ultima sincronizacion no se modificaron.')
        sincronizarDatosMaestros.mockRejectedValue(errorEsperado)

        const { result } = renderHook(() => useSincronizacionDatosMaestros(), { wrapper: envolverConUsuario })

        await act(async () => {
            await result.current.sincronizar()
        })

        expect(result.current.estado).toBe('error')
        expect(result.current.error).toBe(errorEsperado)
    })
})
