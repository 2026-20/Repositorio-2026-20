import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registrarConteo } from '../services/auditoriaService.js'
import {
    marcarConteoConError,
    marcarConteoSincronizado,
    obtenerConteosPendientes,
} from './conteosPendientesRepositorio.js'
import { subirConteosPendientes } from './sincronizacionConteos.js'

vi.mock('../services/auditoriaService.js', () => ({
    registrarConteo: vi.fn(),
}))

vi.mock('./conteosPendientesRepositorio.js', () => ({
    obtenerConteosPendientes: vi.fn(),
    marcarConteoSincronizado: vi.fn(),
    marcarConteoConError: vi.fn(),
}))

const CONTEO_A = {
    idempotenciaKey: 'a',
    codBod: 'MEPRIN',
    codArt: 'ART1',
    numLote: null,
    numCon: '123',
    cantidadTeorica: '10',
    cantidadFisica: '9',
    observaciones: null,
    sincronizado: false,
}

const CONTEO_B = { ...CONTEO_A, idempotenciaKey: 'b', codArt: 'ART2' }

describe('subirConteosPendientes', () => {
    beforeEach(() => {
        vi.spyOn(globalThis.navigator, 'onLine', 'get').mockReturnValue(true)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('no intenta nada si no hay conexion', async () => {
        vi.spyOn(globalThis.navigator, 'onLine', 'get').mockReturnValue(false)
        obtenerConteosPendientes.mockResolvedValue([CONTEO_A])

        await subirConteosPendientes(7, 'jwt-prueba')

        expect(registrarConteo).not.toHaveBeenCalled()
    })

    it('ignora los conteos ya sincronizados', async () => {
        obtenerConteosPendientes.mockResolvedValue([{ ...CONTEO_A, sincronizado: true }])

        await subirConteosPendientes(7, 'jwt-prueba')

        expect(registrarConteo).not.toHaveBeenCalled()
    })

    it('sube cada conteo pendiente y lo marca sincronizado', async () => {
        obtenerConteosPendientes.mockResolvedValue([CONTEO_A, CONTEO_B])
        registrarConteo.mockResolvedValue({})

        await subirConteosPendientes(7, 'jwt-prueba')

        expect(registrarConteo).toHaveBeenCalledTimes(2)
        expect(registrarConteo).toHaveBeenCalledWith('jwt-prueba', {
            idempotenciaKey: 'a',
            codBod: 'MEPRIN',
            codArt: 'ART1',
            numLote: null,
            numCon: '123',
            cantidadTeorica: '10',
            cantidadFisica: '9',
            observaciones: null,
        })
        expect(marcarConteoSincronizado).toHaveBeenCalledWith(7, 'a')
        expect(marcarConteoSincronizado).toHaveBeenCalledWith(7, 'b')
    })

    it('un conteo rechazado por el backend (ej. JORNADA_NO_INICIADA) se anota y no bloquea a los demas', async () => {
        obtenerConteosPendientes.mockResolvedValue([CONTEO_A, CONTEO_B])
        const errorJornada = Object.assign(new Error('No se puede registrar el conteo sin confirmar la jornada'), {
            status: 409,
            codigo: 'JORNADA_NO_INICIADA',
        })
        registrarConteo.mockRejectedValueOnce(errorJornada).mockResolvedValueOnce({})

        await subirConteosPendientes(7, 'jwt-prueba')

        expect(marcarConteoConError).toHaveBeenCalledWith(7, 'a', errorJornada.message)
        expect(marcarConteoSincronizado).toHaveBeenCalledWith(7, 'b')
        expect(marcarConteoSincronizado).not.toHaveBeenCalledWith(7, 'a')
    })

    it('una falla de red real (sin status) detiene la subida -- no sigue con los demas', async () => {
        obtenerConteosPendientes.mockResolvedValue([CONTEO_A, CONTEO_B])
        registrarConteo.mockRejectedValue(new TypeError('Failed to fetch'))

        await subirConteosPendientes(7, 'jwt-prueba')

        expect(registrarConteo).toHaveBeenCalledTimes(1)
        expect(marcarConteoSincronizado).not.toHaveBeenCalled()
        expect(marcarConteoConError).not.toHaveBeenCalled()
    })

    it('HU-036: detiene la sincronizacion si la sesion fue invalidada', async () => {
        obtenerConteosPendientes.mockResolvedValue([
            CONTEO_A,
            CONTEO_B,
        ])

        const errorSesion = Object.assign(
            new Error('No hay sesion activa'),
            {
                status: 401,
                codigo: 'SESION_NO_VALIDA',
            },
        )

        registrarConteo.mockRejectedValueOnce(errorSesion)

        await subirConteosPendientes(7, 'jwt-prueba')

        // Solo se intenta enviar el primer conteo.
        expect(registrarConteo).toHaveBeenCalledTimes(1)

        // Ningun conteo se marca como sincronizado.
        expect(marcarConteoSincronizado)
            .not.toHaveBeenCalled()

        // El rechazo de sesion no modifica el conteo.
        expect(marcarConteoConError)
            .not.toHaveBeenCalled()
    })

})
