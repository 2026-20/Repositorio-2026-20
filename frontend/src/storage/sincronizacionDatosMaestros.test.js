import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { listarBodegas, listarDetalleBodega, listarLotesBodega, obtenerMiRuta } from '../services/auditoriaService.js'
import { hayCambiosPendientesDeSubir } from './cambiosPendientes.js'
import { reemplazarCatalogos } from './datosMaestrosRepositorio.js'
import { ErrorCambiosPendientes, ErrorSinConexion, sincronizarDatosMaestros } from './sincronizacionDatosMaestros.js'

vi.mock('../services/auditoriaService.js', () => ({
    listarBodegas: vi.fn(),
    listarDetalleBodega: vi.fn(),
    listarLotesBodega: vi.fn(),
    obtenerMiRuta: vi.fn(),
}))

vi.mock('./cambiosPendientes.js', () => ({
    hayCambiosPendientesDeSubir: vi.fn(),
}))

vi.mock('./datosMaestrosRepositorio.js', () => ({
    reemplazarCatalogos: vi.fn(),
}))

const BODEGA = { codBod: 'MEPRIN', desBod: 'Bodega Principal', numCon: '123', tipoBod: 'CLI' }
const PARADA = {
    codBod: 'MEPRIN',
    desBod: 'Bodega Principal',
    numCon: '123',
    objCon: 'Reactivos',
    estadoErp: 'PEND',
    estadoApp: 'PENDIENTE',
    fechaAsignada: '2026-10-07',
}

describe('sincronizarDatosMaestros', () => {
    beforeEach(() => {
        vi.spyOn(globalThis.navigator, 'onLine', 'get').mockReturnValue(true)
        hayCambiosPendientesDeSubir.mockResolvedValue(false)
        obtenerMiRuta.mockResolvedValue([PARADA])
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('descarga bodegas, detalle y lotes, y reemplaza el catalogo local (criterio 1)', async () => {
        listarBodegas.mockResolvedValue([BODEGA])
        listarDetalleBodega.mockResolvedValue([{ codArt: 'ART1', cantidadTeorica: 10 }])
        listarLotesBodega.mockResolvedValue([{ codArt: 'ART1', numLote: 'L1', cantidad: 10 }])
        reemplazarCatalogos.mockResolvedValue('2026-10-05T20:00:00.000Z')

        const resultado = await sincronizarDatosMaestros(7, 'jwt-prueba')

        expect(listarBodegas).toHaveBeenCalledWith('jwt-prueba')
        expect(listarDetalleBodega).toHaveBeenCalledWith('jwt-prueba', 'MEPRIN')
        expect(listarLotesBodega).toHaveBeenCalledWith('jwt-prueba', 'MEPRIN')
        expect(obtenerMiRuta).toHaveBeenCalledWith('jwt-prueba')
        expect(reemplazarCatalogos).toHaveBeenCalledWith(7, {
            bodegas: [BODEGA],
            detallesPorBodega: { MEPRIN: [{ codArt: 'ART1', cantidadTeorica: 10 }] },
            lotesPorBodega: { MEPRIN: [{ codArt: 'ART1', numLote: 'L1', cantidad: 10 }] },
            ruta: [PARADA],
        })
        expect(resultado).toBe('2026-10-05T20:00:00.000Z')
    })

    it('no pide el detalle/lotes dos veces si el mismo cod_bod aparece en mas de una bodega', async () => {
        // Bug real: el ERP reusa cod_bod bajo distinto tipo_bod/num_con
        // (ver datosMaestrosRepositorio.js). El backend expone el detalle
        // agrupado solo por cod_bod, asi que pedirlo una vez por fila de
        // bodega es trabajo de mas (y causaba inserciones duplicadas).
        const bodegaComoEnt = { ...BODEGA, tipoBod: 'ENT' }
        const bodegaComoDev = { ...BODEGA, tipoBod: 'DEV', numCon: '8743' }
        listarBodegas.mockResolvedValue([bodegaComoEnt, bodegaComoDev])
        listarDetalleBodega.mockResolvedValue([])
        listarLotesBodega.mockResolvedValue([])
        reemplazarCatalogos.mockResolvedValue('2026-10-05T20:00:00.000Z')

        await sincronizarDatosMaestros(7, 'jwt-prueba')

        expect(listarDetalleBodega).toHaveBeenCalledTimes(1)
        expect(listarLotesBodega).toHaveBeenCalledTimes(1)
        expect(reemplazarCatalogos).toHaveBeenCalledWith(7, {
            bodegas: [bodegaComoEnt, bodegaComoDev],
            detallesPorBodega: { MEPRIN: [] },
            lotesPorBodega: { MEPRIN: [] },
            ruta: [PARADA],
        })
    })

    it('no llama al backend si no hay conexion, y no toca el almacenamiento local (criterio 3)', async () => {
        vi.spyOn(globalThis.navigator, 'onLine', 'get').mockReturnValue(false)

        await expect(sincronizarDatosMaestros(7, 'jwt-prueba')).rejects.toBeInstanceOf(ErrorSinConexion)

        expect(listarBodegas).not.toHaveBeenCalled()
        expect(reemplazarCatalogos).not.toHaveBeenCalled()
    })

    it('trata una falla de red (sin status) como sin conexion, sin tocar el almacenamiento local (criterio 3)', async () => {
        listarBodegas.mockRejectedValue(new TypeError('Failed to fetch'))

        await expect(sincronizarDatosMaestros(7, 'jwt-prueba')).rejects.toBeInstanceOf(ErrorSinConexion)

        expect(reemplazarCatalogos).not.toHaveBeenCalled()
    })

    it('propaga tal cual un error que si vino del backend (motivo especifico, criterio 3)', async () => {
        const errorBackend = Object.assign(new Error('Token invalido'), { status: 401, codigo: 'NO_AUTENTICADO' })
        listarBodegas.mockRejectedValue(errorBackend)

        await expect(sincronizarDatosMaestros(7, 'jwt-vencido')).rejects.toBe(errorBackend)

        expect(reemplazarCatalogos).not.toHaveBeenCalled()
    })

    it('no reemplaza el catalogo local si falla una llamada a medio camino (criterio 3)', async () => {
        listarBodegas.mockResolvedValue([BODEGA, { ...BODEGA, codBod: 'OTRA' }])
        listarDetalleBodega.mockResolvedValueOnce([]).mockRejectedValueOnce(new TypeError('Failed to fetch'))
        listarLotesBodega.mockResolvedValue([])

        await expect(sincronizarDatosMaestros(7, 'jwt-prueba')).rejects.toBeInstanceOf(ErrorSinConexion)

        expect(reemplazarCatalogos).not.toHaveBeenCalled()
    })

    it('HU-037: si hay cambios sin subir, no descarga nada ni toca el almacenamiento local', async () => {
        hayCambiosPendientesDeSubir.mockResolvedValue(true)

        await expect(sincronizarDatosMaestros(7, 'jwt-prueba')).rejects.toBeInstanceOf(ErrorCambiosPendientes)

        expect(hayCambiosPendientesDeSubir).toHaveBeenCalledWith(7)
        expect(listarBodegas).not.toHaveBeenCalled()
        expect(obtenerMiRuta).not.toHaveBeenCalled()
        expect(reemplazarCatalogos).not.toHaveBeenCalled()
    })

    it('HU-037: si falla la descarga de la ruta, no reemplaza el catalogo local (la ruta anterior se conserva)', async () => {
        listarBodegas.mockResolvedValue([BODEGA])
        obtenerMiRuta.mockRejectedValue(new TypeError('Failed to fetch'))

        await expect(sincronizarDatosMaestros(7, 'jwt-prueba')).rejects.toBeInstanceOf(ErrorSinConexion)

        expect(reemplazarCatalogos).not.toHaveBeenCalled()
    })
})
