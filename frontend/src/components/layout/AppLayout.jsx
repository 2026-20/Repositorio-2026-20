import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { useSincronizacion } from '../../context/useSincronizacion'
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

    const { sincronizar } = useSincronizacion()

    // HU-003 criterio 1: apenas hay sesion, se dispara la descarga de
    // catalogos maestros sola (sincronizar() ya decide por su cuenta, via
    // SincronizacionProvider, si hay usuario/token/conexion). Una sola vez
    // por sesion -- este layout no se desmonta entre rutas protegidas,
    // solo al salir de la app, asi que no hace falta volver a sincronizar
    // en cada cambio de pantalla.
    useEffect(() => {
        sincronizar()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
