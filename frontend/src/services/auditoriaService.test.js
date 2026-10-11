import { afterEach, describe, expect, it, vi } from 'vitest'

import { listarBodegas, listarDetalleBodega, listarLotesBodega, obtenerMiRuta } from './auditoriaService'

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
})
