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
