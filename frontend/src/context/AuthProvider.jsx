import { useState } from 'react'
import {
    cerrarSesion,
    iniciarSesion,
} from '../services/authService'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }) {
    const [usuario, setUsuario] = useState(() => {
        const usuarioGuardado = sessionStorage.getItem('capris_usuario')

        return usuarioGuardado
            ? JSON.parse(usuarioGuardado)
            : null
    })

    const [token, setToken] = useState(() =>
        sessionStorage.getItem('capris_token'),
    )

    // Arranca siempre en false (nunca se lee de sessionStorage): la
    // bienvenida solo debe dispararse justo despues de un login real en
    // esta ejecucion, no cada vez que se recarga la pagina con una sesion
    // ya activa.
    const [mostrarBienvenida, setMostrarBienvenida] = useState(false)

    async function login(username, contrasena, empresaId) {

        const respuesta = await iniciarSesion(
            username,
            contrasena,
            empresaId,
        )

        const usuarioAutenticado = {
            id: respuesta.usuarioId,
            nombreCompleto: respuesta.nombreCompleto,
            rol: respuesta.rol,
            debeCambiarContrasena: respuesta.debeCambiarContrasena,
        }

        setUsuario(usuarioAutenticado)
        setToken(respuesta.token)
        setMostrarBienvenida(true)

        sessionStorage.setItem(
            'capris_usuario',
            JSON.stringify(usuarioAutenticado),
        )

        sessionStorage.setItem(
            'capris_token',
            respuesta.token,
        )

        return respuesta
    }
    async function logout() {
        try {
            if (token) {
                await cerrarSesion(token)
            }
        } finally {
            setUsuario(null)
            setToken(null)

            sessionStorage.removeItem('capris_usuario')
            sessionStorage.removeItem('capris_token')
        }
    }
    return (
        <AuthContext.Provider
            value={{
                usuario,
                token,
                login,
                logout,
                estaAutenticado: Boolean(token),
                mostrarBienvenida,
                ocultarBienvenida: () => setMostrarBienvenida(false),
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}