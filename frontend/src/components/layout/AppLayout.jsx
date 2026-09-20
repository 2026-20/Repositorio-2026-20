import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import BienvenidaOverlay from '../feedback/BienvenidaOverlay'
import styles from './AppLayout.module.css'

export default function AppLayout() {
    const {
        usuario,
        logout,
        estaAutenticado,
        mostrarBienvenida,
        ocultarBienvenida,
    } = useAuth()

    async function manejarCerrarSesion() {
        await logout()
    }

    if (!estaAutenticado) {
        return <Navigate to="/login" replace />
    }

    return (
        <div className={styles.shell}>
            <BienvenidaOverlay
                nombre={usuario?.nombreCompleto?.split(' ')[0]}
                visible={mostrarBienvenida}
                onTerminar={ocultarBienvenida}
            />

            <Sidebar rolUsuario={usuario?.rol} />

            <div className={styles.contenido}>
                <TopBar
                    usuario={usuario}
                    onCerrarSesion={manejarCerrarSesion}
                />

                <main className={styles.principal}>
                    <Outlet />
                </main>
            </div>

            <BottomNav rolUsuario={usuario?.rol} />
        </div>
    )
}
