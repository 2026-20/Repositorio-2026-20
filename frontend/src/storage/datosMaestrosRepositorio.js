import { abrirBaseLocal, cerrarBaseLocal, consultar, ejecutar } from './baseDatosLocal.js'

const NOMBRE_ARCHIVO = 'datos-maestros.db'
const CLAVE_ULTIMA_SINCRONIZACION = 'ultima_sincronizacion_en'

// HU-037: la ruta del usuario se guarda como JSON en metadatos_sincronizacion
// en vez de en una tabla propia (decision del equipo: no crear tablas
// nuevas). Son pocas decenas de paradas que siempre se leen completas, asi
// que no hace falta consultarlas con SQL -- y guardarla aqui la deja dentro
// de la misma transaccion que el catalogo (ver reemplazarCatalogosInterno).
const CLAVE_RUTA = 'ruta_paradas'

// AccessHandlePoolVFS (el VFS de OPFS que usa baseDatosLocal.js) no soporta
// acceso concurrente -- confirmado en un navegador real: si dos funciones
// de este modulo abren una sesion sobre el mismo archivo al mismo tiempo
// (ej. la pantalla pidiendo la ultima sincronizacion justo cuando el login
// dispara una sincronizacion nueva), la segunda falla con "Access Handles
// cannot be created if there is another open Access Handle...". Por eso
// todas las funciones de aqui abajo pasan por esta cola -- nunca hay mas
// de una sesion abierta a la vez contra el almacenamiento local.
let colaOperaciones = Promise.resolve()

function encolar(operacion) {
    const resultado = colaOperaciones.then(operacion, operacion)
    colaOperaciones = resultado.catch(() => {})
    return resultado
}

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

// Las 4 tablas en una sola llamada (un solo viaje de ida y vuelta al
// worker): ninguna necesita parametros, asi que sqlite3.run() las puede
// ejecutar todas de una, como cualquier script SQL con varias sentencias
// separadas por ";". crearEsquema() se llama en cada funcion exportada de
// este modulo (es idempotente, "IF NOT EXISTS"), asi que esto evita 4
// round-trips de mas en cada una.
async function crearEsquema(sesion) {
    await ejecutar(
        sesion,
        // cod_bod NO es unico por si solo -- el ERP reusa el mismo codigo
        // de bodega bajo distinto tipo_bod/num_con (ej. "MEPRIN" como ENT
        // y como DEV). Mismo problema, y misma clave compuesta, que el
        // equipo ya tuvo que corregir en la entidad Bodega del backend
        // (ver javadoc de esa clase) -- confirmado con datos reales al
        // probar esta pantalla.
        `CREATE TABLE IF NOT EXISTS bodegas (
            cod_bod TEXT NOT NULL,
            des_bod TEXT NOT NULL,
            num_con TEXT NOT NULL,
            tipo_bod TEXT NOT NULL,
            PRIMARY KEY (cod_bod, num_con, tipo_bod)
        );
        -- cantidad_teorica/cantidad_minima se guardan como TEXT (no REAL):
        -- son BigDecimal en el backend (precision 14, escala 4) y un float
        -- de SQLite perderia precision en el viaje de ida y vuelta.
        --
        -- cod_art tampoco es unico por bodega solo con cod_bod -- el mismo
        -- articulo puede estar bajo dos contratos distintos de la misma
        -- bodega. Mismo caso que arriba, confirmado con datos reales.
        CREATE TABLE IF NOT EXISTS detalle_bodega (
            cod_bod TEXT NOT NULL,
            cod_art TEXT NOT NULL,
            des_art TEXT NOT NULL,
            cantidad_teorica TEXT NOT NULL,
            indicador_lote INTEGER NOT NULL,
            num_con TEXT NOT NULL,
            cantidad_minima TEXT,
            PRIMARY KEY (cod_bod, cod_art, num_con)
        );
        CREATE TABLE IF NOT EXISTS lote_bodega (
            cod_bod TEXT NOT NULL,
            cod_art TEXT NOT NULL,
            num_lote TEXT NOT NULL,
            fecha_vencimiento TEXT,
            cantidad TEXT NOT NULL,
            PRIMARY KEY (cod_bod, cod_art, num_lote)
        );
        CREATE TABLE IF NOT EXISTS metadatos_sincronizacion (
            clave TEXT PRIMARY KEY,
            valor TEXT NOT NULL
        );`,
    )
}

/**
 * Reemplaza todo el catalogo local de un usuario en una sola transaccion
 * (todo o nada). Quien llama (ver sincronizacionDatosMaestros.js) ya tiene
 * que haber descargado TODO del backend con exito antes de llamar esto --
 * este modulo no sabe nada de HTTP ni de conectividad, solo de persistir
 * lo que se le pasa.
 */
async function reemplazarCatalogosInterno(usuarioId, { bodegas, detallesPorBodega, lotesPorBodega, ruta = [] }) {
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
            }

            // El detalle y los lotes los expone el backend agrupados solo
            // por cod_bod (no por num_con/tipo_bod) -- un mismo cod_bod
            // puede aparecer en varias filas de "bodegas" (ver arriba), asi
            // que se insertan una sola vez por cod_bod distinto, no una vez
            // por cada fila de bodega (eso duplicaria las filas e insertaria
            // la misma clave dos veces).
            const codigosBodegaUnicos = [...new Set(bodegas.map((bodega) => bodega.codBod))]

            for (const codBod of codigosBodegaUnicos) {
                for (const detalle of detallesPorBodega[codBod] ?? []) {
                    await ejecutar(
                        sesion,
                        `INSERT INTO detalle_bodega
                            (cod_bod, cod_art, des_art, cantidad_teorica, indicador_lote, num_con, cantidad_minima)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            codBod,
                            detalle.codArt,
                            detalle.desArt,
                            String(detalle.cantidadTeorica),
                            detalle.indicadorLote ? 1 : 0,
                            detalle.numCon,
                            detalle.cantidadMinima == null ? null : String(detalle.cantidadMinima),
                        ],
                    )
                }

                for (const lote of lotesPorBodega[codBod] ?? []) {
                    await ejecutar(
                        sesion,
                        `INSERT INTO lote_bodega (cod_bod, cod_art, num_lote, fecha_vencimiento, cantidad)
                            VALUES (?, ?, ?, ?, ?)`,
                        [codBod, lote.codArt, lote.numLote, lote.fechaVencimiento, String(lote.cantidad)],
                    )
                }
            }

            await ejecutar(sesion, 'DELETE FROM metadatos_sincronizacion WHERE clave = ?', [CLAVE_RUTA])
            await ejecutar(sesion, 'INSERT INTO metadatos_sincronizacion (clave, valor) VALUES (?, ?)', [
                CLAVE_RUTA,
                JSON.stringify(ruta),
            ])

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

async function obtenerUltimaSincronizacionInterno(usuarioId) {
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

// HU-037: lee la ruta guardada en la ultima sincronizacion exitosa -- sin
// red de por medio, asi que funciona igual sin conexion. Sin sincronizacion
// previa devuelve [].
async function obtenerRutaInterno(usuarioId) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        const resultado = await consultar(sesion, 'SELECT valor FROM metadatos_sincronizacion WHERE clave = ?', [
            CLAVE_RUTA,
        ])
        const valor = resultado.rows[0]?.[0]
        return valor ? JSON.parse(valor) : []
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

async function obtenerBodegasInterno(usuarioId) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        const resultado = await consultar(sesion, 'SELECT cod_bod, des_bod, num_con, tipo_bod FROM bodegas ORDER BY des_bod')
        return resultado.rows.map(([codBod, desBod, numCon, tipoBod]) => ({ codBod, desBod, numCon, tipoBod }))
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

async function obtenerDetalleBodegaInterno(usuarioId, codBod) {
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

async function obtenerLotesBodegaInterno(usuarioId, codBod) {
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

// Unica puerta de entrada publica de este modulo: todo pasa por encolar()
// para que nunca haya dos sesiones abiertas a la vez contra el mismo
// archivo (ver comentario de encolar() arriba).
export function reemplazarCatalogos(usuarioId, datos) {
    return encolar(() => reemplazarCatalogosInterno(usuarioId, datos))
}

export function obtenerUltimaSincronizacion(usuarioId) {
    return encolar(() => obtenerUltimaSincronizacionInterno(usuarioId))
}

export function obtenerRuta(usuarioId) {
    return encolar(() => obtenerRutaInterno(usuarioId))
}

export function obtenerBodegas(usuarioId) {
    return encolar(() => obtenerBodegasInterno(usuarioId))
}

export function obtenerDetalleBodega(usuarioId, codBod) {
    return encolar(() => obtenerDetalleBodegaInterno(usuarioId, codBod))
}

export function obtenerLotesBodega(usuarioId, codBod) {
    return encolar(() => obtenerLotesBodegaInterno(usuarioId, codBod))
}
