import { afterEach, describe, expect, it, vi } from 'vitest'

import { obtenerConteosPendientes } from './conteosPendientesRepositorio.js'
import { hayCambiosPendientesDeSubir } from './cambiosPendientes.js'

vi.mock('./conteosPendientesRepositorio.js', () => ({
    obtenerConteosPendientes: vi.fn(),
}))

describe('hayCambiosPendientesDeSubir', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('devuelve true si hay al menos un conteo sin sincronizar', async () => {
        obtenerConteosPendientes.mockResolvedValue([
            { idempotenciaKey: 'a', sincronizado: true },
            { idempotenciaKey: 'b', sincronizado: false },
        ])

        expect(await hayCambiosPendientesDeSubir(7)).toBe(true)
    })

    it('devuelve false si todos los conteos ya estan sincronizados', async () => {
        obtenerConteosPendientes.mockResolvedValue([{ idempotenciaKey: 'a', sincronizado: true }])

        expect(await hayCambiosPendientesDeSubir(7)).toBe(false)
    })

    it('devuelve false si no hay ningun conteo registrado', async () => {
        obtenerConteosPendientes.mockResolvedValue([])

        expect(await hayCambiosPendientesDeSubir(7)).toBe(false)
    })

    // Bug real: un conteo rechazado por el backend (ultimoError) se queda
    // sincronizado=false para siempre -- si contara como "pendiente" aqui,
    // bloquearia la sincronizacion del catalogo de ese usuario de forma
    // permanente, sin ninguna forma de resolverlo desde la UI.
    it('un conteo con ultimoError no cuenta como pendiente (ya se intento y el backend lo rechazo)', async () => {
        obtenerConteosPendientes.mockResolvedValue([
            { idempotenciaKey: 'a', sincronizado: false, ultimoError: 'JORNADA_NO_INICIADA' },
        ])

        expect(await hayCambiosPendientesDeSubir(7)).toBe(false)
    })

    it('sigue devolviendo true si ademas hay otro conteo genuinamente sin intentar', async () => {
        obtenerConteosPendientes.mockResolvedValue([
            { idempotenciaKey: 'a', sincronizado: false, ultimoError: 'JORNADA_NO_INICIADA' },
            { idempotenciaKey: 'b', sincronizado: false, ultimoError: null },
        ])

        expect(await hayCambiosPendientesDeSubir(7)).toBe(true)
    })
})
