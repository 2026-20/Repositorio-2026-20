import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { obtenerUltimaSincronizacion } from '../storage/datosMaestrosRepositorio.js'
import { sincronizarDatosMaestros } from '../storage/sincronizacionDatosMaestros.js'
import { AuthContext } from './AuthContext'
import { SincronizacionProvider } from './SincronizacionProvider'
import { useSincronizacion } from './useSincronizacion'

vi.mock('../storage/sincronizacionDatosMaestros.js', () => ({
    sincronizarDatosMaestros: vi.fn(),
}))

vi.mock('../storage/datosMaestrosRepositorio.js', () => ({
    obtenerUltimaSincronizacion: vi.fn(),
}))

function envolver(usuario, token) {
    return function Wrapper({ children }) {
        return (
            <AuthContext.Provider value={{ usuario, token }}>
                <SincronizacionProvider>{children}</SincronizacionProvider>
            </AuthContext.Provider>
        )
    }
}

// renderHook pasa initialProps/rerender(props) al CALLBACK del hook, no al
// wrapper -- el wrapper solo recibe "children". Para poder cambiar de
// usuario entre un render y el siguiente, el wrapper lee de un objeto
// mutable que el test actualiza antes de llamar rerender() (sin argumentos).
function crearWrapperDinamico(sesion) {
    return function WrapperDinamico({ children }) {
        return (
            <AuthContext.Provider value={sesion}>
                <SincronizacionProvider>{children}</SincronizacionProvider>
            </AuthContext.Provider>
        )
    }
}

describe('SincronizacionProvider', () => {
    beforeEach(() => {
        obtenerUltimaSincronizacion.mockResolvedValue(null)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('comparte el mismo estado entre todos los consumidores (el bug que esto reemplaza)', async () => {
        sincronizarDatosMaestros.mockResolvedValue('2026-10-05T20:00:00.000Z')

        const { result: consumidorA } = renderHook(() => useSincronizacion(), {
            wrapper: envolver({ id: 7 }, 'jwt-prueba'),
        })

        await act(async () => {
            await consumidorA.current.sincronizar()
        })

        expect(consumidorA.current.estado).toBe('listo')
        expect(consumidorA.current.ultimaSincronizacion).toBe('2026-10-05T20:00:00.000Z')
    })

    it('no sincroniza si falta el id del usuario o el token', async () => {
        const { result } = renderHook(() => useSincronizacion(), {
            wrapper: envolver({ nombreCompleto: 'Sin id' }, undefined),
        })

        await act(async () => {
            await result.current.sincronizar()
        })

        expect(sincronizarDatosMaestros).not.toHaveBeenCalled()
        expect(result.current.estado).toBe('inactivo')
    })

    it('carga la ultima sincronizacion persistida de una sesion anterior al montar', async () => {
        obtenerUltimaSincronizacion.mockResolvedValue('2026-10-04T10:00:00.000Z')

        const { result } = renderHook(() => useSincronizacion(), {
            wrapper: envolver({ id: 7 }, 'jwt-prueba'),
        })

        await act(async () => {
            await Promise.resolve()
        })

        expect(obtenerUltimaSincronizacion).toHaveBeenCalledWith(7)
        expect(result.current.ultimaSincronizacion).toBe('2026-10-04T10:00:00.000Z')
    })

    it('pasa a error y guarda el motivo cuando la sincronizacion falla', async () => {
        const errorEsperado = new Error('No hay conexion a internet.')
        sincronizarDatosMaestros.mockRejectedValue(errorEsperado)

        const { result } = renderHook(() => useSincronizacion(), {
            wrapper: envolver({ id: 7 }, 'jwt-prueba'),
        })

        await act(async () => {
            await result.current.sincronizar()
        })

        expect(result.current.estado).toBe('error')
        expect(result.current.error).toBe(errorEsperado)
    })

    it('criterio 4: reinicia el estado visible al cambiar de usuario (no arrastra datos del anterior)', async () => {
        sincronizarDatosMaestros.mockResolvedValue('2026-10-05T20:00:00.000Z')
        obtenerUltimaSincronizacion.mockResolvedValue(null)

        const sesion = { usuario: { id: 7, nombreCompleto: 'Usuario A' }, token: 'jwt-A' }
        const { result, rerender } = renderHook(() => useSincronizacion(), {
            wrapper: crearWrapperDinamico(sesion),
        })

        await act(async () => {
            await result.current.sincronizar()
        })
        expect(result.current.estado).toBe('listo')
        expect(result.current.ultimaSincronizacion).toBe('2026-10-05T20:00:00.000Z')

        sesion.usuario = { id: 8, nombreCompleto: 'Usuario B' }
        sesion.token = 'jwt-B'
        rerender()

        expect(result.current.estado).toBe('inactivo')
        expect(result.current.ultimaSincronizacion).toBeNull()
        expect(result.current.error).toBeNull()
    })

    it('no deja que un resultado tardio de un usuario anterior pise el estado del usuario actual', async () => {
        let resolverSincronizacionLenta
        sincronizarDatosMaestros.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolverSincronizacionLenta = resolve
                }),
        )
        obtenerUltimaSincronizacion.mockResolvedValue(null)

        const sesion = { usuario: { id: 7 }, token: 'jwt-A' }
        const { result, rerender } = renderHook(() => useSincronizacion(), {
            wrapper: crearWrapperDinamico(sesion),
        })

        // Dispara la sincronizacion del usuario A, pero no la espera -- se
        // queda "colgada" a proposito, controlada por resolverSincronizacionLenta.
        let promesaSincronizacionA
        act(() => {
            promesaSincronizacionA = result.current.sincronizar()
        })
        expect(result.current.estado).toBe('sincronizando')

        // El usuario A cierra sesion y el usuario B inicia sesion antes de
        // que la sincronizacion de A termine.
        sesion.usuario = { id: 8 }
        sesion.token = 'jwt-B'
        rerender()
        expect(result.current.estado).toBe('inactivo')

        // Ahora termina (tarde) la sincronizacion del usuario A.
        await act(async () => {
            resolverSincronizacionLenta('2026-01-01T00:00:00.000Z')
            await promesaSincronizacionA
        })

        // El resultado tardio de A no debe haber tocado el estado -- sigue
        // reflejando que B todavia no ha sincronizado nada.
        expect(result.current.estado).toBe('inactivo')
        expect(result.current.ultimaSincronizacion).toBeNull()
    })
})
