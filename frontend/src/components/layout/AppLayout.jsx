import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

export default function AppLayout() {
    const {
        usuario,
        logout,
        estaAutenticado,
    } = useAuth()

    async function manejarCerrarSesion() {
        await logout()
    }

    if (!estaAutenticado) {
        return <Navigate to="/login" replace />
    }

    return (
        <>
            <header>
                <strong>CAPRIS Médica</strong>

                <span>
          {usuario?.nombreCompleto}
        </span>

                <button
                    type="button"
                    onClick={manejarCerrarSesion}
                >
                    Cerrar sesión
                </button>
            </header>

            <Outlet />
        </>
    )
}