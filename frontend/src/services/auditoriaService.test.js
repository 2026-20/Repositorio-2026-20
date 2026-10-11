import { afterEach, describe, expect, it, vi } from 'vitest'

import {
    iniciarJornada,
    listarBodegas,
    listarDetalleBodega,
    listarLotesBodega,
    obtenerJornadaHoy,
    registrarConteo,
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

    it('HU-021: registra un conteo fisico con el cuerpo tal cual se recibe', async () => {
        const datos = {
            idempotenciaKey: 'clave-generada',
            codBod: 'MEPRIN',
            codArt: 'ART1',
            numLote: null,
            numCon: '123',
            cantidadTeorica: 10,
            cantidadFisica: 9,
            observaciones: null,
        }
        const conteoCreado = { id: 1, ...datos }

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => conteoCreado,
        })

        const resultado = await registrarConteo('jwt-prueba', datos)

        expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/auditoria/conteos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer jwt-prueba',
            },
            body: JSON.stringify(datos),
        })
        expect(resultado).toEqual(conteoCreado)
    })

    it('HU-021/HU-038: consulta el estado de la jornada de hoy', async () => {
        const jornada = { iniciada: true, iniciadaEn: '2026-10-08T08:00:00.000Z' }

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => jornada,
        })

        const resultado = await obtenerJornadaHoy('jwt-prueba')

        expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/auditoria/jornadas/hoy', {
            headers: { Authorization: 'Bearer jwt-prueba' },
        })
        expect(resultado).toEqual(jornada)
    })

    it('HU-038: confirma el inicio de jornada de hoy', async () => {
        const jornada = { iniciada: true, iniciadaEn: '2026-10-08T08:00:00.000Z' }

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => jornada,
        })

        const resultado = await iniciarJornada('jwt-prueba')

        expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/auditoria/jornadas/iniciar', {
            method: 'POST',
            headers: { Authorization: 'Bearer jwt-prueba' },
        })
        expect(resultado).toEqual(jornada)
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
})
