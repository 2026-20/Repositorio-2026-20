import { abrirBaseLocal, cerrarBaseLocal, consultar, ejecutar } from './baseDatosLocal.js'
import { hoyLocal } from '../utils/fecha.js'

const NOMBRE_ARCHIVO = 'conteos-pendientes.db'

// Archivo separado de datos-maestros.db a proposito: AccessHandlePoolVFS no
// soporta acceso concurrente al MISMO archivo (ver datosMaestrosRepositorio.js),
// pero dos archivos distintos si se pueden abrir a la vez sin chocar -- asi
// que registrar un conteo no tiene que esperar a que termine una
// sincronizacion de catalogos en curso, y viceversa. Cola propia, separada
// de la de datosMaestrosRepositorio.js, por la misma razon: cada archivo
// necesita su propia serializacion, no una compartida entre archivos
// distintos (eso solo agregaria esperas sin necesidad).
let colaOperaciones = Promise.resolve()

function encolar(operacion) {
    const resultado = colaOperaciones.then(operacion, operacion)
    colaOperaciones = resultado.catch(() => {})
    return resultado
}

function directorioParaUsuario(usuarioId) {
    return `capris/usuario-${usuarioId}`
}


async function crearEsquema(sesion) {
    await ejecutar(
        sesion,
        `CREATE TABLE IF NOT EXISTS conteos_pendientes (
            id_idempotencia TEXT PRIMARY KEY,
            cod_bod TEXT NOT NULL,
            cod_art TEXT NOT NULL,
            num_lote TEXT,
            num_con TEXT,
            cantidad_teorica TEXT NOT NULL,
            cantidad_fisica TEXT NOT NULL,
            observaciones TEXT,
            registrado_en TEXT NOT NULL,
            sincronizado INTEGER NOT NULL DEFAULT 0,
            ultimo_error TEXT
        );
        -- Cache de "la jornada de hoy ya esta iniciada" (HU-038 criterio 4,
        -- ver JornadaService en el backend). Se llena mientras hay conexion
        -- (ConteoPage/sincronizarDatosMaestros) para poder decidir sin red si
        -- se puede registrar un conteo -- una fila vieja de otro dia no
        -- cuenta, por eso la clave es la fecha misma.
        CREATE TABLE IF NOT EXISTS jornada_local (
            fecha TEXT PRIMARY KEY,
            iniciada_en TEXT NOT NULL
        );`,
    )
}

async function registrarConteoLocalInterno(usuarioId, datos) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        const idempotenciaKey = crypto.randomUUID()
        await ejecutar(
            sesion,
            `INSERT INTO conteos_pendientes
                (id_idempotencia, cod_bod, cod_art, num_lote, num_con, cantidad_teorica, cantidad_fisica, observaciones, registrado_en, sincronizado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                idempotenciaKey,
                datos.codBod,
                datos.codArt,
                datos.numLote ?? null,
                datos.numCon ?? null,
                String(datos.cantidadTeorica),
                String(datos.cantidadFisica),
                datos.observaciones ?? null,
                new Date().toISOString(),
            ],
        )
        return idempotenciaKey
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

async function obtenerConteosPendientesInterno(usuarioId) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        const resultado = await consultar(
            sesion,
            `SELECT id_idempotencia, cod_bod, cod_art, num_lote, num_con, cantidad_teorica, cantidad_fisica, observaciones, registrado_en, sincronizado, ultimo_error
                FROM conteos_pendientes ORDER BY registrado_en`,
        )
        return resultado.rows.map(
            ([
                idempotenciaKey,
                codBod,
                codArt,
                numLote,
                numCon,
                cantidadTeorica,
                cantidadFisica,
                observaciones,
                registradoEn,
                sincronizado,
                ultimoError,
            ]) => ({
                idempotenciaKey,
                codBod,
                codArt,
                numLote,
                numCon,
                cantidadTeorica,
                cantidadFisica,
                observaciones,
                registradoEn,
                sincronizado: sincronizado === 1,
                ultimoError,
            }),
        )
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

async function marcarConteoSincronizadoInterno(usuarioId, idempotenciaKey) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        await ejecutar(
            sesion,
            'UPDATE conteos_pendientes SET sincronizado = 1, ultimo_error = NULL WHERE id_idempotencia = ?',
            [idempotenciaKey],
        )
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

// HU-007: corrige un conteo que TODAVIA no se sincronizo (sincronizado=0) --
// sigue siendo el mismo id_idempotencia, asi que la proxima sincronizacion
// lo sube con los valores ya corregidos, como si siempre hubiera sido ese
// el valor. Corregir un conteo YA sincronizado necesita el endpoint del
// backend (PUT /api/auditoria/conteos/{id}, ver ConteoFisicoController) --
// eso queda fuera de este prototipo porque esta base local no guarda el id
// numerico que el backend le asigna al sincronizar (solo id_idempotencia).
async function corregirConteoLocalInterno(usuarioId, idempotenciaKey, datos) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        await ejecutar(
            sesion,
            'UPDATE conteos_pendientes SET cantidad_fisica = ?, observaciones = ? WHERE id_idempotencia = ? AND sincronizado = 0',
            [String(datos.cantidadFisica), datos.observaciones ?? null, idempotenciaKey],
        )
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

async function marcarConteoConErrorInterno(usuarioId, idempotenciaKey, mensaje) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        await ejecutar(sesion, 'UPDATE conteos_pendientes SET ultimo_error = ? WHERE id_idempotencia = ?', [
            mensaje,
            idempotenciaKey,
        ])
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

async function guardarJornadaIniciadaInterno(usuarioId, iniciadaEn) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        await ejecutar(sesion, 'DELETE FROM jornada_local WHERE fecha = ?', [hoyLocal()])
        await ejecutar(sesion, 'INSERT INTO jornada_local (fecha, iniciada_en) VALUES (?, ?)', [
            hoyLocal(),
            iniciadaEn,
        ])
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

/**
 * Borra los conteos y la jornada local de un usuario -- ver "Ajustes >
 * Borrar auditoría cargada" en AjustesPage.jsx. Separado del catalogo a
 * proposito (ver comentario arriba sobre por que este archivo esta aparte
 * de datos-maestros.db): borrarCatalogoLocal no toca esto, y viceversa.
 */
async function borrarConteosLocalesInterno(usuarioId) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        await ejecutar(sesion, 'BEGIN')
        try {
            await ejecutar(sesion, 'DELETE FROM conteos_pendientes')
            await ejecutar(sesion, 'DELETE FROM jornada_local')
            await ejecutar(sesion, 'COMMIT')
        } catch (error) {
            await ejecutar(sesion, 'ROLLBACK')
            throw error
        }
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

async function estaJornadaIniciadaHoyInterno(usuarioId) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        const resultado = await consultar(sesion, 'SELECT 1 FROM jornada_local WHERE fecha = ?', [hoyLocal()])
        return resultado.rows.length > 0
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

export function registrarConteoLocal(usuarioId, datos) {
    return encolar(() => registrarConteoLocalInterno(usuarioId, datos))
}

export function obtenerConteosPendientes(usuarioId) {
    return encolar(() => obtenerConteosPendientesInterno(usuarioId))
}

export function marcarConteoSincronizado(usuarioId, idempotenciaKey) {
    return encolar(() => marcarConteoSincronizadoInterno(usuarioId, idempotenciaKey))
}

export function corregirConteoLocal(usuarioId, idempotenciaKey, datos) {
    return encolar(() => corregirConteoLocalInterno(usuarioId, idempotenciaKey, datos))
}

export function marcarConteoConError(usuarioId, idempotenciaKey, mensaje) {
    return encolar(() => marcarConteoConErrorInterno(usuarioId, idempotenciaKey, mensaje))
}

export function guardarJornadaIniciada(usuarioId, iniciadaEn) {
    return encolar(() => guardarJornadaIniciadaInterno(usuarioId, iniciadaEn))
}

export function estaJornadaIniciadaHoy(usuarioId) {
    return encolar(() => estaJornadaIniciadaHoyInterno(usuarioId))
}

export function borrarConteosLocales(usuarioId) {
    return encolar(() => borrarConteosLocalesInterno(usuarioId))
}
