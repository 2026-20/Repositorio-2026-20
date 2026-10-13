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

export async function listarUsuarios(token) {
    const response = await fetch(`${API_URL}/usuarios`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    return procesarRespuesta(response)
}

export async function inactivarUsuario(token, id, motivo) {
    const response = await fetch(`${API_URL}/usuarios/${id}/inactivar`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ motivo: motivo || null }),
    })

    return procesarRespuesta(response)
}

export async function listarRoles(token) {
    const response = await fetch(`${API_URL}/roles`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    return procesarRespuesta(response)
}

export async function crearUsuario(token, datos) {
    const response = await fetch(`${API_URL}/usuarios`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(datos),
    })

    return procesarRespuesta(response)
}

export async function reactivarUsuario(token, id, motivo) {
    const response = await fetch(`${API_URL}/usuarios/${id}/reactivar`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ motivo: motivo || null }),
    })

    return procesarRespuesta(response)
}

export async function desbloquearUsuario(token, id) {
    const response = await fetch(
        `${API_URL}/usuarios/${id}/desbloquear`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    )

    return procesarRespuesta(response)
}
// HU-022: Consultar el perfil del usuario autenticado.
export async function consultarPerfil(token) {
    const response = await fetch(`${API_URL}/usuarios/perfil`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    return procesarRespuesta(response)
}