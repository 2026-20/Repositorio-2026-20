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

// HU-044 / HU-049:
// HU-044 tiene prioridad. Si el usuario esta en primer ingreso,solo puede acceder a esa pantalla.
// Si ya no esta en primer ingreso pero la contraseña normal vencio,solo puede acceder a la pantalla obligatoria de cambio por caducidad.

    const enPantallaDePrimerIngreso = ubicacion.pathname === paths.primerIngreso

    const enPantallaDeCaducidad = ubicacion.pathname === paths.contrasenaVencida

// HU-044: primer ingreso obligatorio.
    if (usuario?.debeCambiarContrasena) {
        if (!enPantallaDePrimerIngreso) {return <Navigate to={paths.primerIngreso} replace />}
    }

// HU-049: contraseña vencida. Solo se evalua si ya no esta pendiente el primer ingreso.
    else if (usuario?.contrasenaVencida) {
        if (!enPantallaDeCaducidad) {return <Navigate to={paths.contrasenaVencida} replace />}
    }

// Si intenta entrar manualmente a alguna pantalla de cambio obligatorio
// pero ya no tiene esa restriccion, vuelve al dashboard.
    else if (enPantallaDePrimerIngreso || enPantallaDeCaducidad) {
        return <Navigate to={paths.dashboard} replace />
    }

    if (rolRequerido && usuario?.rol !== rolRequerido) {
        return <Navigate to={paths.dashboard} replace />
    }

    return children
}
