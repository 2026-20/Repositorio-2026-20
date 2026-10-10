const API_URL = 'http://localhost:8080/api'

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
 * HU-038: confirmar el inicio de la jornada del usuario autenticado para
 * hoy. Idempotente del lado del backend (ver JornadaService.iniciar):
 * llamarlo de nuevo el mismo dia no crea una segunda jornada.
 */
export async function iniciarJornada(token) {
    const response = await fetch(`${API_URL}/auditoria/jornadas/iniciar`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    return procesarRespuesta(response)
}

/** HU-038: consultar si la jornada de hoy del usuario ya esta confirmada. */
export async function obtenerEstadoJornada(token) {
    const response = await fetch(`${API_URL}/auditoria/jornadas/hoy`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    return procesarRespuesta(response)
}
