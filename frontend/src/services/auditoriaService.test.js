import { afterEach, describe, expect, it, vi } from 'vitest'

import {
    iniciarJornada,
    listarBodegas,
    listarDetalleBodega,
    listarLotesBodega,
    obtenerEstadoJornada,
    obtenerMiRuta
} from './auditoriaService'

describe('auditoriaService', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('lista las bodegas con el token del usuario', async () => {
        const bodegas = [{ codBod: 'MEPRIN', desBod: 'Bodega Medicamentos Principal', numCon: '123', tipoBod: 'CLI' }]

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => bodegas,
        })

        const resultado = await listarBodegas('jwt-prueba')

        expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/auditoria/bodegas', {
            headers: { Authorization: 'Bearer jwt-prueba' },
        })
        expect(resultado).toEqual(bodegas)
    })

    it('lista el detalle de una bodega', async () => {
        const detalle = [{ codArt: 'ART1', desArt: 'Articulo 1', cantidadTeorica: 10, indicadorLote: false }]

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => detalle,
        })

        const resultado = await listarDetalleBodega('jwt-prueba', 'MEPRIN')

        expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/auditoria/bodegas/MEPRIN/detalle', {
            headers: { Authorization: 'Bearer jwt-prueba' },
        })
        expect(resultado).toEqual(detalle)
    })

    it('lista los lotes de una bodega', async () => {
        const lotes = [{ codArt: 'ART1', numLote: 'L1', cantidad: 5 }]

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => lotes,
        })

        const resultado = await listarLotesBodega('jwt-prueba', 'MEPRIN')

        expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/auditoria/bodegas/MEPRIN/lotes', {
            headers: { Authorization: 'Bearer jwt-prueba' },
        })
        expect(resultado).toEqual(lotes)
    })

    it('HU-037: obtiene la ruta del usuario del token', async () => {
        const ruta = [
            {
                codBod: 'MEPRIN',
                desBod: 'Bodega Medicamentos Principal',
                numCon: '123',
                objCon: 'Reactivos',
                estadoErp: 'PEND',
                estadoApp: 'PENDIENTE',
                fechaAsignada: '2026-10-07',
            },
        ]

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ruta,
        })

        const resultado = await obtenerMiRuta('jwt-prueba')

        expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/auditoria/visitas/mi-ruta', {
            headers: { Authorization: 'Bearer jwt-prueba' },
        })
        expect(resultado).toEqual(ruta)
    })

    it('lanza error con el status cuando el backend rechaza la solicitud', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ codigo: 'NO_AUTENTICADO', mensaje: 'Token invalido' }),
        })

        await expect(listarBodegas('jwt-vencido')).rejects.toMatchObject({
            message: 'Token invalido',
            codigo: 'NO_AUTENTICADO',
            status: 401,
        })
    })

    // HU-038
    it('confirma el inicio de jornada con POST y el token del usuario', async () => {
        const estado = { iniciada: true, iniciadaEn: '2026-10-10T08:00:00-06:00' }

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => estado,
        })

        const resultado = await iniciarJornada('jwt-prueba')

        expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/auditoria/jornadas/iniciar', {
            method: 'POST',
            headers: { Authorization: 'Bearer jwt-prueba' },
        })
        expect(resultado).toEqual(estado)
    })

    it('consulta el estado de la jornada de hoy', async () => {
        const estado = { iniciada: false, iniciadaEn: null }

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => estado,
        })

        const resultado = await obtenerEstadoJornada('jwt-prueba')

        expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/auditoria/jornadas/hoy', {
            headers: { Authorization: 'Bearer jwt-prueba' },
        })
        expect(resultado).toEqual(estado)
    })

    it('propaga el codigo y status del error cuando el backend rechaza confirmar la jornada', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ codigo: 'NO_AUTENTICADO', mensaje: 'Token invalido' }),
        })

        await expect(iniciarJornada('jwt-vencido')).rejects.toMatchObject({
            codigo: 'NO_AUTENTICADO',
            status: 401,
        })
    })
})
