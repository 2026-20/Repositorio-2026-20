import { describe, expect, it } from 'vitest'

import {
    obtenerBodegas,
    obtenerDetalleBodega,
    obtenerLotesBodega,
    obtenerUltimaSincronizacion,
    reemplazarCatalogos,
} from './datosMaestrosRepositorio.js'

// Usuarios "aleatorios" por ejecucion para no chocar con datos que haya
// dejado una corrida anterior en el mismo perfil de Chromium (OPFS persiste
// entre corridas de npm run test:browser, ver baseDatosLocal.js).
const sufijo = Date.now()
const USUARIO_A = 9000 + (sufijo % 1000)
const USUARIO_B = 9500 + (sufijo % 1000)

const BODEGA_MEPRIN = { codBod: 'MEPRIN', desBod: 'Bodega Medicamentos Principal', numCon: '123', tipoBod: 'CLI' }

describe('datosMaestrosRepositorio', () => {
    it('guarda bodegas/detalle/lotes y los puede volver a leer (criterio 1 y 2)', async () => {
        const cuando = await reemplazarCatalogos(USUARIO_A, {
            bodegas: [BODEGA_MEPRIN],
            detallesPorBodega: {
                MEPRIN: [
                    { codArt: 'ART1', desArt: 'Articulo 1', cantidadTeorica: 10.5, indicadorLote: true, numCon: '123', cantidadMinima: 2 },
                ],
            },
            lotesPorBodega: {
                MEPRIN: [{ codArt: 'ART1', numLote: 'L1', fechaVencimiento: '2027-01-01', cantidad: 10.5 }],
            },
        })

        expect(cuando).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        expect(await obtenerUltimaSincronizacion(USUARIO_A)).toBe(cuando)

        const bodegas = await obtenerBodegas(USUARIO_A)
        expect(bodegas).toEqual([BODEGA_MEPRIN])

        const detalle = await obtenerDetalleBodega(USUARIO_A, 'MEPRIN')
        expect(detalle).toEqual([
            { codArt: 'ART1', desArt: 'Articulo 1', cantidadTeorica: '10.5', indicadorLote: true, numCon: '123', cantidadMinima: '2' },
        ])

        const lotes = await obtenerLotesBodega(USUARIO_A, 'MEPRIN')
        expect(lotes).toEqual([{ codArt: 'ART1', numLote: 'L1', fechaVencimiento: '2027-01-01', cantidad: '10.5' }])
    })

    it('un reemplazo nuevo borra los datos del anterior, no los acumula (sincronizacion = foto actual)', async () => {
        await reemplazarCatalogos(USUARIO_A, {
            bodegas: [BODEGA_MEPRIN, { codBod: 'TEMPOR', desBod: 'Bodega que va a desaparecer', numCon: '999', tipoBod: 'DEV' }],
            detallesPorBodega: {},
            lotesPorBodega: {},
        })
        expect(await obtenerBodegas(USUARIO_A)).toHaveLength(2)

        await reemplazarCatalogos(USUARIO_A, {
            bodegas: [BODEGA_MEPRIN],
            detallesPorBodega: {},
            lotesPorBodega: {},
        })

        const bodegas = await obtenerBodegas(USUARIO_A)
        expect(bodegas).toEqual([BODEGA_MEPRIN])
    })

    it('los datos de un usuario no son visibles para otro usuario (criterio 4)', async () => {
        await reemplazarCatalogos(USUARIO_A, {
            bodegas: [BODEGA_MEPRIN],
            detallesPorBodega: {},
            lotesPorBodega: {},
        })

        expect(await obtenerBodegas(USUARIO_B)).toEqual([])
        expect(await obtenerUltimaSincronizacion(USUARIO_B)).toBeNull()
    })
})
