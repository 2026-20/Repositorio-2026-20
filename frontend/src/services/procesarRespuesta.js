
import { notificarSesionInvalidada } from './sesionInvalidada.js'

export async function procesarRespuesta(
    response,
    verificarSesion = false,
    token = null,
) {
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
        error.detalles = datos?.detalles ?? []
        error.status = response.status


        if (
            verificarSesion &&
            token &&
            response.status === 401 &&
            datos?.codigo === 'SESION_NO_VALIDA'
        ) {
            notificarSesionInvalidada(token)
        }


        throw error
    }

    return datos
}
