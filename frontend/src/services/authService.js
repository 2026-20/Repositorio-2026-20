
import { API_BASE_URL } from './apiBaseUrl.js'
import { procesarRespuesta } from './procesarRespuesta.js'

const API_URL = `${API_BASE_URL}/api`

// HU-001: obtener las empresas disponibles.
export async function obtenerEmpresas() {
    const response = await fetch(`${API_URL}/empresas`)

    return procesarRespuesta(response)
}

// HU-001: iniciar sesión.
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

// HU-002: cerrar sesión.
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

// HU-044: cambio obligatorio de contraseña en el primer ingreso.
export async function cambiarContrasenaPrimerIngreso(token, contrasenaNueva) {
    const response = await fetch(
        `${API_URL}/auth/primer-ingreso/cambiar-password`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ contrasenaNueva }),
        },
    )

    return procesarRespuesta(response, true, token)
}

// HU-045: cambio voluntario de contraseña.
export async function cambiarContrasena(
    token,
    contrasenaActual,
    contrasenaNueva,
) {
    const response = await fetch(`${API_URL}/auth/cambiar-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            contrasenaActual,
            contrasenaNueva,
        }),
    })

    return procesarRespuesta(response, true, token)
}
