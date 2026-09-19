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

export async function obtenerEmpresas() {
    const response = await fetch(`${API_URL}/empresas`)

    return procesarRespuesta(response)
}

export async function iniciarSesion(username, contrasena, empresaId) {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username,
            contrasena,
            empresaId: Number(empresaId),
        }),
    })

    return procesarRespuesta(response)
}
export async function cerrarSesion(token) {
    const response = await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    if (!response.ok) {
        const error = new Error('No fue posible cerrar la sesión')
        error.status = response.status
        throw error
    }
}
