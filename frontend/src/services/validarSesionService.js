
import { API_BASE_URL } from './apiBaseUrl.js'
import { procesarRespuesta } from './procesarRespuesta.js'

export async function validarSesion(token, usuarioId) {
    const response = await fetch(
        `${API_BASE_URL}/api/usuarios/${usuarioId}`,
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    )

    return procesarRespuesta(response, true, token)
}
