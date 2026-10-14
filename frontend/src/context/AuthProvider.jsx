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

    // empresaNombre no lo devuelve el backend en el login: lo conoce la
    // pantalla de login (selector de empresa) y se guarda en la sesion para
    // mostrar la marca de la empresa activa en el menu (Sidebar/TopBar).
    async function login(username, contrasena, empresaId, empresaNombre) {

        const respuesta = await iniciarSesion(
            username,
            contrasena,
            empresaId,
        )

        const usuarioAutenticado = {
            id: respuesta.usuarioId,
            nombreCompleto: respuesta.nombreCompleto,
            correo: respuesta.correo,
            rol: respuesta.rol,
            debeCambiarContrasena: respuesta.debeCambiarContrasena,
            contrasenaVencida: respuesta.contrasenaVencida,
            empresaNombre,
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

    // HU-044 / HU-049: despues de un cambio obligatorio exitoso, el usuario deja de tener
// pendiente tanto el primer ingreso como la caducidad de contraseña.
    function marcarContrasenaCambiada() {
        const usuarioActualizado = {
            ...usuario, debeCambiarContrasena: false, contrasenaVencida: false,
        }
        setUsuario(usuarioActualizado)
        sessionStorage.setItem('capris_usuario', JSON.stringify(usuarioActualizado),)
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
                marcarContrasenaCambiada,
                estaAutenticado: Boolean(token),
                mostrarBienvenida,
                ocultarBienvenida: () => setMostrarBienvenida(false),
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}