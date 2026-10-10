import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { iniciarJornada, obtenerEstadoJornada } from '../services/auditoriaService'
import { AuthContext } from './AuthContext'
import { JornadaProvider } from './JornadaProvider'
import { useJornada } from './useJornada'

vi.mock('../services/auditoriaService', () => ({
    iniciarJornada: vi.fn(),
    obtenerEstadoJornada: vi.fn(),
}))

function envolver(usuario, token) {
    return function Wrapper({ children }) {
        return (
            <AuthContext.Provider value={{ usuario, token }}>
                <JornadaProvider>{children}</JornadaProvider>
            </AuthContext.Provider>
        )
    }
}

function crearWrapperDinamico(sesion) {
    return function WrapperDinamico({ children }) {
        return (
            <AuthContext.Provider value={sesion}>
                <JornadaProvider>{children}</JornadaProvider>
            </AuthContext.Provider>
        )
    }
}

describe('JornadaProvider', () => {
    beforeEach(() => {
        localStorage.clear()
        obtenerEstadoJornada.mockResolvedValue({ iniciada: false, iniciadaEn: null })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('consulta el estado real al montar con sesion activa', async () => {
        obtenerEstadoJornada.mockResolvedValue({ iniciada: true, iniciadaEn: '2026-10-10T08:00:00-06:00' })

        const { result } = renderHook(() => useJornada(), {
            wrapper: envolver({ id: 7 }, 'jwt-prueba'),
        })

        expect(result.current.cargando).toBe(true)

        await act(async () => {
            await Promise.resolve()
        })

        expect(obtenerEstadoJornada).toHaveBeenCalledWith('jwt-prueba')
        expect(result.current.iniciada).toBe(true)
        expect(result.current.iniciadaEn).toBe('2026-10-10T08:00:00-06:00')
        expect(result.current.cargando).toBe(false)
    })

    it('no consulta nada si falta el id del usuario o el token', async () => {
        const { result } = renderHook(() => useJornada(), {
            wrapper: envolver({ nombreCompleto: 'Sin id' }, undefined),
        })

        await act(async () => {
            await Promise.resolve()
        })

        expect(obtenerEstadoJornada).not.toHaveBeenCalled()
        expect(result.current.cargando).toBe(false)
        expect(result.current.iniciada).toBe(false)
    })

    it('confirmarInicio llama a iniciarJornada y actualiza el estado con el resultado', async () => {
        iniciarJornada.mockResolvedValue({ iniciada: true, iniciadaEn: '2026-10-10T08:05:00-06:00' })

        const { result } = renderHook(() => useJornada(), {
            wrapper: envolver({ id: 7 }, 'jwt-prueba'),
        })

        await act(async () => {
            await Promise.resolve()
        })

        await act(async () => {
            await result.current.confirmarInicio()
        })

        expect(iniciarJornada).toHaveBeenCalledWith('jwt-prueba')
        expect(result.current.iniciada).toBe(true)
        expect(result.current.iniciadaEn).toBe('2026-10-10T08:05:00-06:00')
        expect(result.current.error).toBeNull()
    })

    it('si confirmarInicio falla, guarda el error y no queda "iniciada"', async () => {
        const errorEsperado = new Error('No fue posible completar la solicitud')
        iniciarJornada.mockRejectedValue(errorEsperado)

        const { result } = renderHook(() => useJornada(), {
            wrapper: envolver({ id: 7 }, 'jwt-prueba'),
        })

        await act(async () => {
            await Promise.resolve()
        })

        await act(async () => {
            await result.current.confirmarInicio()
        })

        expect(result.current.iniciada).toBe(false)
        expect(result.current.error).toBe(errorEsperado)
        expect(result.current.confirmando).toBe(false)
    })

    it('guarda el resultado en localStorage y lo reutiliza como estado inicial sin esperar la red', async () => {
        obtenerEstadoJornada.mockResolvedValue({ iniciada: true, iniciadaEn: '2026-10-10T08:00:00-06:00' })

        const primeraSesion = renderHook(() => useJornada(), {
            wrapper: envolver({ id: 7 }, 'jwt-prueba'),
        })

        await act(async () => {
            await Promise.resolve()
        })
        expect(primeraSesion.result.current.iniciada).toBe(true)

        // Una "recarga de la app" monta un JornadaProvider nuevo para el
        // mismo usuario, antes de que la consulta al backend responda --
        // debe ver de una vez lo cacheado, no arrancar en falso.
        obtenerEstadoJornada.mockImplementation(() => new Promise(() => {}))
        const segundaSesion = renderHook(() => useJornada(), {
            wrapper: envolver({ id: 7 }, 'jwt-prueba'),
        })

        expect(segundaSesion.result.current.iniciada).toBe(true)
        expect(segundaSesion.result.current.iniciadaEn).toBe('2026-10-10T08:00:00-06:00')
    })

    it('ignora el cache si quedo de un dia anterior', async () => {
        localStorage.setItem('capris_jornada_7', JSON.stringify({ fecha: '2020-01-01', iniciadaEn: '2020-01-01T08:00:00-06:00' }))
        obtenerEstadoJornada.mockImplementation(() => new Promise(() => {}))

        const { result } = renderHook(() => useJornada(), {
            wrapper: envolver({ id: 7 }, 'jwt-prueba'),
        })

        expect(result.current.iniciada).toBe(false)
    })

    it('reinicia el estado visible al cambiar de usuario', async () => {
        obtenerEstadoJornada.mockResolvedValue({ iniciada: true, iniciadaEn: '2026-10-10T08:00:00-06:00' })

        const sesion = { usuario: { id: 7 }, token: 'jwt-A' }
        const { result, rerender } = renderHook(() => useJornada(), {
            wrapper: crearWrapperDinamico(sesion),
        })

        await act(async () => {
            await Promise.resolve()
        })
        expect(result.current.iniciada).toBe(true)

        obtenerEstadoJornada.mockResolvedValue({ iniciada: false, iniciadaEn: null })
        sesion.usuario = { id: 8 }
        sesion.token = 'jwt-B'
        rerender()

        expect(result.current.iniciada).toBe(false)
        expect(result.current.error).toBeNull()
    })
})
