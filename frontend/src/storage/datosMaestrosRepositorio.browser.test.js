import { describe, expect, it } from 'vitest'

import {
    obtenerBodegas,
    obtenerDetalleBodega,
    obtenerLotesBodega,
    obtenerRuta,
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

    // Bug real encontrado probando la pantalla de Sincronizacion en un
    // navegador de verdad (Cypress): al montar, SincronizacionProvider lee
    // la ultima sincronizacion (obtenerUltimaSincronizacion) justo cuando
    // AppLayout dispara una sincronizacion nueva (reemplazarCatalogos) --
    // sin encolar(), la segunda sesion de OPFS fallaba con "Access Handles
    // cannot be created if there is another open Access Handle...". Esta
    // prueba dispara ambas sin esperar la primera, replicando esa carrera.
    it('una escritura y una lectura disparadas al mismo tiempo no chocan en OPFS', async () => {
        const escritura = reemplazarCatalogos(USUARIO_A, {
            bodegas: [BODEGA_MEPRIN],
            detallesPorBodega: {},
            lotesPorBodega: {},
        })
        const lectura = obtenerUltimaSincronizacion(USUARIO_A)

        await expect(Promise.all([escritura, lectura])).resolves.toBeDefined()
    })

    // Bug real encontrado probando con datos reales del ERP (no con el
    // fixture chiquito de los demas tests de este archivo): el ERP reusa
    // el mismo cod_bod bajo distinto tipo_bod/num_con (ej. "MEPRIN" como
    // ENT y como DEV, mismo caso que el equipo ya habia corregido en la
    // entidad Bodega del backend) y el mismo cod_art bajo dos contratos de
    // la misma bodega -- "UNIQUE constraint failed" antes de esta prueba.
    it('acepta una bodega con el mismo cod_bod bajo dos contratos/tipos, y un articulo repetido entre esos dos contratos', async () => {
        const bodegaComoEnt = { codBod: 'MEPRIN', desBod: 'Bodega Principal', numCon: '12555', tipoBod: 'ENT' }
        const bodegaComoDev = { codBod: 'MEPRIN', desBod: 'Bodega Principal', numCon: '8743', tipoBod: 'DEV' }

        await reemplazarCatalogos(USUARIO_A, {
            bodegas: [bodegaComoEnt, bodegaComoDev],
            detallesPorBodega: {
                MEPRIN: [
                    { codArt: 'ART1', desArt: 'Articulo 1', cantidadTeorica: 5, indicadorLote: false, numCon: '12555', cantidadMinima: null },
                    { codArt: 'ART1', desArt: 'Articulo 1', cantidadTeorica: 3, indicadorLote: false, numCon: '8743', cantidadMinima: null },
                ],
            },
            lotesPorBodega: {},
        })

        const bodegas = await obtenerBodegas(USUARIO_A)
        expect(bodegas).toHaveLength(2)

        const detalle = await obtenerDetalleBodega(USUARIO_A, 'MEPRIN')
        expect(detalle).toHaveLength(2)
        expect(detalle.map((d) => d.numCon).sort()).toEqual(['12555', '8743'].sort())
    })

    // HU-037: la ruta vive como JSON en metadatos_sincronizacion (sin tabla
    // propia, ver CLAVE_RUTA) y tiene que quedar disponible sin red.
    describe('ruta (HU-037)', () => {
        const PARADA = {
            codBod: 'MEPRIN',
            desBod: 'Bodega Medicamentos Principal',
            numCon: '123',
            objCon: 'Reactivos',
            estadoErp: 'PEND',
            estadoApp: 'PENDIENTE',
            fechaAsignada: '2026-10-01',
        }

        it('guarda la ruta junto con el catalogo y la devuelve tal cual', async () => {
            await reemplazarCatalogos(USUARIO_A, {
                bodegas: [BODEGA_MEPRIN],
                detallesPorBodega: {},
                lotesPorBodega: {},
                ruta: [PARADA],
            })

            expect(await obtenerRuta(USUARIO_A)).toEqual([PARADA])
        })

        it('una sincronizacion nueva reemplaza la ruta anterior', async () => {
            await reemplazarCatalogos(USUARIO_A, { bodegas: [], detallesPorBodega: {}, lotesPorBodega: {}, ruta: [PARADA] })
            await reemplazarCatalogos(USUARIO_A, { bodegas: [], detallesPorBodega: {}, lotesPorBodega: {}, ruta: [] })

            expect(await obtenerRuta(USUARIO_A)).toEqual([])
        })

        it('la ruta de un usuario no es visible para otro (criterio 2)', async () => {
            await reemplazarCatalogos(USUARIO_A, { bodegas: [], detallesPorBodega: {}, lotesPorBodega: {}, ruta: [PARADA] })

            expect(await obtenerRuta(USUARIO_B)).toEqual([])
        })

        it('si el reemplazo falla a medio camino, la ruta anterior queda intacta (todo o nada)', async () => {
            await reemplazarCatalogos(USUARIO_A, { bodegas: [], detallesPorBodega: {}, lotesPorBodega: {}, ruta: [PARADA] })

            // Dos bodegas con la misma clave primaria -> el INSERT revienta
            // antes de llegar a guardar la ruta nueva, y se hace ROLLBACK.
            await expect(
                reemplazarCatalogos(USUARIO_A, {
                    bodegas: [BODEGA_MEPRIN, BODEGA_MEPRIN],
                    detallesPorBodega: {},
                    lotesPorBodega: {},
                    ruta: [],
                }),
            ).rejects.toThrow()

            expect(await obtenerRuta(USUARIO_A)).toEqual([PARADA])
        })
    })
})
