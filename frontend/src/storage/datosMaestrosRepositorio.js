import { abrirBaseLocal, cerrarBaseLocal, consultar, ejecutar } from './baseDatosLocal.js'

const NOMBRE_ARCHIVO = 'datos-maestros.db'
const CLAVE_ULTIMA_SINCRONIZACION = 'ultima_sincronizacion_en'

// HU-003 criterio 4: "los datos descargados quedan asociados unicamente al
// usuario que inicio sesion". Cada usuario tiene su propio directorio OPFS
// (y por lo tanto su propia base/archivo) -- si otro usuario inicia sesion
// en el mismo dispositivo, simplemente no hay forma de que una consulta le
// devuelva datos del usuario anterior, porque esos datos viven en otro
// directorio. Mas simple y mas seguro que una columna usuario_id con
// filtro manual en cada consulta.
function directorioParaUsuario(usuarioId) {
    return `capris/usuario-${usuarioId}`
}

async function crearEsquema(sesion) {
    await ejecutar(
        sesion,
        `CREATE TABLE IF NOT EXISTS bodegas (
            cod_bod TEXT PRIMARY KEY,
            des_bod TEXT NOT NULL,
            num_con TEXT NOT NULL,
            tipo_bod TEXT NOT NULL
        )`,
    )
    await ejecutar(
        sesion,
        // cantidad_teorica/cantidad_minima se guardan como TEXT (no REAL):
        // son BigDecimal en el backend (precision 14, escala 4) y un float
        // de SQLite perderia precision en el viaje de ida y vuelta.
        `CREATE TABLE IF NOT EXISTS detalle_bodega (
            cod_bod TEXT NOT NULL,
            cod_art TEXT NOT NULL,
            des_art TEXT NOT NULL,
            cantidad_teorica TEXT NOT NULL,
            indicador_lote INTEGER NOT NULL,
            num_con TEXT NOT NULL,
            cantidad_minima TEXT,
            PRIMARY KEY (cod_bod, cod_art)
        )`,
    )
    await ejecutar(
        sesion,
        `CREATE TABLE IF NOT EXISTS lote_bodega (
            cod_bod TEXT NOT NULL,
            cod_art TEXT NOT NULL,
            num_lote TEXT NOT NULL,
            fecha_vencimiento TEXT,
            cantidad TEXT NOT NULL,
            PRIMARY KEY (cod_bod, cod_art, num_lote)
        )`,
    )
    await ejecutar(
        sesion,
        `CREATE TABLE IF NOT EXISTS metadatos_sincronizacion (
            clave TEXT PRIMARY KEY,
            valor TEXT NOT NULL
        )`,
    )
}

/**
 * Reemplaza todo el catalogo local de un usuario en una sola transaccion
 * (todo o nada). Quien llama (ver sincronizacionDatosMaestros.js) ya tiene
 * que haber descargado TODO del backend con exito antes de llamar esto --
 * este modulo no sabe nada de HTTP ni de conectividad, solo de persistir
 * lo que se le pasa.
 */
export async function reemplazarCatalogos(usuarioId, { bodegas, detallesPorBodega, lotesPorBodega }) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        await ejecutar(sesion, 'BEGIN')
        try {
            await ejecutar(sesion, 'DELETE FROM bodegas')
            await ejecutar(sesion, 'DELETE FROM detalle_bodega')
            await ejecutar(sesion, 'DELETE FROM lote_bodega')

            for (const bodega of bodegas) {
                await ejecutar(
                    sesion,
                    'INSERT INTO bodegas (cod_bod, des_bod, num_con, tipo_bod) VALUES (?, ?, ?, ?)',
                    [bodega.codBod, bodega.desBod, bodega.numCon, bodega.tipoBod],
                )

                for (const detalle of detallesPorBodega[bodega.codBod] ?? []) {
                    await ejecutar(
                        sesion,
                        `INSERT INTO detalle_bodega
                            (cod_bod, cod_art, des_art, cantidad_teorica, indicador_lote, num_con, cantidad_minima)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            bodega.codBod,
                            detalle.codArt,
                            detalle.desArt,
                            String(detalle.cantidadTeorica),
                            detalle.indicadorLote ? 1 : 0,
                            detalle.numCon,
                            detalle.cantidadMinima == null ? null : String(detalle.cantidadMinima),
                        ],
                    )
                }

                for (const lote of lotesPorBodega[bodega.codBod] ?? []) {
                    await ejecutar(
                        sesion,
                        `INSERT INTO lote_bodega (cod_bod, cod_art, num_lote, fecha_vencimiento, cantidad)
                            VALUES (?, ?, ?, ?, ?)`,
                        [bodega.codBod, lote.codArt, lote.numLote, lote.fechaVencimiento, String(lote.cantidad)],
                    )
                }
            }

            const ahoraIso = new Date().toISOString()
            await ejecutar(sesion, 'DELETE FROM metadatos_sincronizacion WHERE clave = ?', [
                CLAVE_ULTIMA_SINCRONIZACION,
            ])
            await ejecutar(sesion, 'INSERT INTO metadatos_sincronizacion (clave, valor) VALUES (?, ?)', [
                CLAVE_ULTIMA_SINCRONIZACION,
                ahoraIso,
            ])

            await ejecutar(sesion, 'COMMIT')
            return ahoraIso
        } catch (error) {
            await ejecutar(sesion, 'ROLLBACK')
            throw error
        }
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

export async function obtenerUltimaSincronizacion(usuarioId) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        const resultado = await consultar(sesion, 'SELECT valor FROM metadatos_sincronizacion WHERE clave = ?', [
            CLAVE_ULTIMA_SINCRONIZACION,
        ])
        return resultado.rows[0]?.[0] ?? null
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

export async function obtenerBodegas(usuarioId) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        const resultado = await consultar(sesion, 'SELECT cod_bod, des_bod, num_con, tipo_bod FROM bodegas ORDER BY des_bod')
        return resultado.rows.map(([codBod, desBod, numCon, tipoBod]) => ({ codBod, desBod, numCon, tipoBod }))
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

export async function obtenerDetalleBodega(usuarioId, codBod) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        const resultado = await consultar(
            sesion,
            `SELECT cod_art, des_art, cantidad_teorica, indicador_lote, num_con, cantidad_minima
                FROM detalle_bodega WHERE cod_bod = ? ORDER BY des_art`,
            [codBod],
        )
        return resultado.rows.map(([codArt, desArt, cantidadTeorica, indicadorLote, numCon, cantidadMinima]) => ({
            codArt,
            desArt,
            cantidadTeorica,
            indicadorLote: indicadorLote === 1,
            numCon,
            cantidadMinima,
        }))
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

export async function obtenerLotesBodega(usuarioId, codBod) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        const resultado = await consultar(
            sesion,
            'SELECT cod_art, num_lote, fecha_vencimiento, cantidad FROM lote_bodega WHERE cod_bod = ? ORDER BY fecha_vencimiento',
            [codBod],
        )
        return resultado.rows.map(([codArt, numLote, fechaVencimiento, cantidad]) => ({
            codArt,
            numLote,
            fechaVencimiento,
            cantidad,
        }))
    } finally {
        await cerrarBaseLocal(sesion)
    }
}
