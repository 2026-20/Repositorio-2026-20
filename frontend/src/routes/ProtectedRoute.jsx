import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { paths } from './paths'

// rolRequerido es solo una conveniencia de UX (evita el parpadeo de una
// pantalla que de todas formas el backend va a rechazar). La autorizacion
// real la sigue aplicando el backend via hasRole (ver SecurityConfig) --
// esto nunca es el limite de seguridad, solo mejora la experiencia de
// alguien que entra por URL directa a una seccion que no le corresponde.
export default function ProtectedRoute({ children, rolRequerido }) {
    const { estaAutenticado, usuario } = useAuth()

    if (!estaAutenticado) {
        return <Navigate to={paths.login} replace />
    }

    if (rolRequerido && usuario?.rol !== rolRequerido) {
        return <Navigate to={paths.dashboard} replace />
    }

    return children
}
