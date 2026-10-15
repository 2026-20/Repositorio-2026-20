import { abrirBaseLocal, cerrarBaseLocal, consultar, ejecutar } from './baseDatosLocal.js'

const NOMBRE_ARCHIVO = 'trazabilidad-pendiente.db'

// Archivo propio, separado de conteos-pendientes.db y datos-maestros.db --
// mismo motivo que la separacion entre esos dos (ver conteosPendientesRepositorio.js):
// AccessHandlePoolVFS no soporta acceso concurrente al MISMO archivo, pero
// archivos distintos si se pueden abrir a la vez sin chocar. Cola propia,
// separada de las otras, por la misma razon.
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
        `CREATE TABLE IF NOT EXISTS trazabilidad_pendiente (
            id_idempotencia TEXT PRIMARY KEY,
            tipo_accion TEXT NOT NULL,
            cod_bod TEXT,
            resultado TEXT NOT NULL,
            detalle TEXT,
            fecha TEXT NOT NULL,
            sincronizado INTEGER NOT NULL DEFAULT 0,
            ultimo_error TEXT
        );`,
    )
}

// HU-031 criterio 1/3: se llama en el mismo momento en que ocurre la accion
// que se quiere trazar (ej. ConteoPage al guardar un conteo localmente), no
// cuando se sincroniza -- asi "fecha" queda con la hora real en que paso en
// el dispositivo, aunque la sincronizacion ocurra horas despues (criterio 6).
async function registrarAccionLocalInterno(usuarioId, datos) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        const idIdempotencia = crypto.randomUUID()
        await ejecutar(
            sesion,
            `INSERT INTO trazabilidad_pendiente
                (id_idempotencia, tipo_accion, cod_bod, resultado, detalle, fecha, sincronizado)
                VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [
                idIdempotencia,
                datos.tipoAccion,
                datos.codBod ?? null,
                datos.resultado,
                datos.detalle ?? null,
                new Date().toISOString(),
            ],
        )
        return idIdempotencia
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

async function obtenerAccionesPendientesInterno(usuarioId) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        const resultado = await consultar(
            sesion,
            `SELECT id_idempotencia, tipo_accion, cod_bod, resultado, detalle, fecha, sincronizado, ultimo_error
                FROM trazabilidad_pendiente WHERE sincronizado = 0 ORDER BY fecha`,
        )
        return resultado.rows.map(
            ([idIdempotencia, tipoAccion, codBod, resultado, detalle, fecha, sincronizado, ultimoError]) => ({
                idIdempotencia,
                tipoAccion,
                codBod,
                resultado,
                detalle,
                fecha,
                sincronizado: sincronizado === 1,
                ultimoError,
            }),
        )
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

async function marcarAccionSincronizadaInterno(usuarioId, idIdempotencia) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        await ejecutar(
            sesion,
            'UPDATE trazabilidad_pendiente SET sincronizado = 1, ultimo_error = NULL WHERE id_idempotencia = ?',
            [idIdempotencia],
        )
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

async function marcarAccionConErrorInterno(usuarioId, idIdempotencia, mensaje) {
    const sesion = await abrirBaseLocal(directorioParaUsuario(usuarioId), NOMBRE_ARCHIVO)
    try {
        await crearEsquema(sesion)
        await ejecutar(sesion, 'UPDATE trazabilidad_pendiente SET ultimo_error = ? WHERE id_idempotencia = ?', [
            mensaje,
            idIdempotencia,
        ])
    } finally {
        await cerrarBaseLocal(sesion)
    }
}

export function registrarAccionLocal(usuarioId, datos) {
    return encolar(() => registrarAccionLocalInterno(usuarioId, datos))
}

export function obtenerAccionesPendientes(usuarioId) {
    return encolar(() => obtenerAccionesPendientesInterno(usuarioId))
}

export function marcarAccionSincronizada(usuarioId, idIdempotencia) {
    return encolar(() => marcarAccionSincronizadaInterno(usuarioId, idIdempotencia))
}

export function marcarAccionConError(usuarioId, idIdempotencia, mensaje) {
    return encolar(() => marcarAccionConErrorInterno(usuarioId, idIdempotencia, mensaje))
}
