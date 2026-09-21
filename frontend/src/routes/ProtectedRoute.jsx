import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { paths } from './paths'

// rolRequerido y la redireccion de primer ingreso son solo conveniencias de UX
// (evitan el parpadeo de una pantalla que de todas formas el backend va a
// rechazar). La autorizacion real la sigue aplicando el backend: hasRole en
// SecurityConfig para los roles, y JwtAuthenticationFilter para el primer
// ingreso pendiente (HU-044) -- esto nunca es el limite de seguridad, solo
// mejora la experiencia de alguien que entra por URL directa.
export default function ProtectedRoute({ children, rolRequerido }) {
    const { estaAutenticado, usuario } = useAuth()
    const ubicacion = useLocation()

    if (!estaAutenticado) {
        return <Navigate to={paths.login} replace />
    }

    // HU-044: mientras la contraseña temporal siga vigente, la unica pantalla
    // accesible es la de cambio obligatorio, sin importar el rol.
    const enPantallaDePrimerIngreso = ubicacion.pathname === paths.primerIngreso

    if (usuario?.debeCambiarContrasena && !enPantallaDePrimerIngreso) {
        return <Navigate to={paths.primerIngreso} replace />
    }

    if (!usuario?.debeCambiarContrasena && enPantallaDePrimerIngreso) {
        return <Navigate to={paths.dashboard} replace />
    }

    if (rolRequerido && usuario?.rol !== rolRequerido) {
        return <Navigate to={paths.dashboard} replace />
    }

    return children
}
