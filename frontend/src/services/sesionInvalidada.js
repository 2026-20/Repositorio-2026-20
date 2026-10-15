
const EVENTO_SESION_INVALIDADA = 'capris:sesion-invalidada'

export function notificarSesionInvalidada(token) {
    window.dispatchEvent(
        new CustomEvent(EVENTO_SESION_INVALIDADA, {
            detail: { token },
        }),
    )
}

export function escucharSesionInvalidada(callback) {
    window.addEventListener(EVENTO_SESION_INVALIDADA, callback)

    return () => {
        window.removeEventListener(EVENTO_SESION_INVALIDADA, callback)
    }
}
