import { API_BASE_URL } from './apiBaseUrl.js'

const API_URL = `${API_BASE_URL}/api`

async function procesarRespuesta(response) {
    let datos = null

    try {
        datos = await response.json()
    } catch {
        datos = null
    }

    if (!response.ok) {
        const mensaje =
            datos?.mensaje ?? 'No fue posible completar la solicitud'

        const error = new Error(mensaje)
        error.codigo = datos?.codigo
        error.status = response.status

        throw error
    }

    return datos
}

/** HU-003: catalogo de bodegas (ver BodegaConsultaController en el backend). */
export async function listarBodegas(token) {
    const response = await fetch(`${API_URL}/auditoria/bodegas`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    return procesarRespuesta(response)
}

/** HU-003: articulos esperados en la bodega, con su cantidad teorica. */
export async function listarDetalleBodega(token, codBod) {
    const response = await fetch(
        `${API_URL}/auditoria/bodegas/${codBod}/detalle`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    )

    return procesarRespuesta(response)
}

/** HU-003: lotes y vencimientos de la bodega. */
export async function listarLotesBodega(token, codBod) {
    const response = await fetch(
        `${API_URL}/auditoria/bodegas/${codBod}/lotes`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    )

    return procesarRespuesta(response)
}

/**
 * HU-037: bodegas asignadas al usuario del token que todavia no estan
 * finalizadas, sin filtro de fecha (ver RutaController en el backend).
 */
export async function obtenerMiRuta(token) {
    const response = await fetch(`${API_URL}/auditoria/visitas/mi-ruta`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    return procesarRespuesta(response)
}

/**
 * HU-005/HU-021: registra un conteo fisico. idempotenciaKey la genera el
 * cliente al guardarlo localmente (ver conteosPendientesRepositorio.js) y
 * se reenvia tal cual aqui -- un reintento del mismo conteo nunca duplica
 * (ver ConteoFisicoService en el backend).
 */
export async function registrarConteo(token, datos) {
    const response = await fetch(`${API_URL}/auditoria/conteos`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(datos),
    })

    return procesarRespuesta(response)
}

/**
 * HU-021/HU-038: estado de la jornada de hoy. Se consulta mientras hay
 * conexion y se cachea localmente (ver conteosPendientesRepositorio.js)
 * para poder decidir sin red si se puede registrar un conteo -- el backend
 * exige jornada iniciada (JornadaNoIniciadaException, HTTP 409) y "iniciar
 * jornada" en si necesita conexion.
 */
export async function obtenerJornadaHoy(token) {
    const response = await fetch(`${API_URL}/auditoria/jornadas/hoy`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    return procesarRespuesta(response)
}

/** HU-038: confirma el inicio de jornada de hoy (ver ConteoPage). */
export async function iniciarJornada(token) {
    const response = await fetch(`${API_URL}/auditoria/jornadas/iniciar`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    return procesarRespuesta(response)
}

/**
 * HU-031: sincroniza un registro de trazabilidad generado offline.
 * idIdempotencia lo genera el cliente al guardarlo localmente (ver
 * trazabilidadRepositorio.js) y se reenvia tal cual aqui -- un reintento no
 * duplica (ver TrazabilidadService en el backend).
 */
export async function registrarTrazabilidad(token, datos) {
    const response = await fetch(`${API_URL}/auditoria/trazabilidad`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(datos),
    })

    return procesarRespuesta(response)
}

/**
 * HU-031 criterio 4: consulta el log de trazabilidad, solo lectura. Un
 * Administrador recibe el de toda su empresa; un Usuario de Campo, solo el
 * propio (ver TrazabilidadController en el backend).
 */
export async function listarTrazabilidad(token) {
    const response = await fetch(`${API_URL}/auditoria/trazabilidad`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    return procesarRespuesta(response)
}
