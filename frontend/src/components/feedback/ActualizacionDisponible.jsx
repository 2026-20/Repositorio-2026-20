import { useRegisterSW } from 'virtual:pwa-register/react'
import Icon from '../ui/Icon'
import styles from './ActualizacionDisponible.module.css'

// HU-021 Etapa 3: registro del service worker, en modo "prompt" (no
// "autoUpdate") a proposito -- recargar la pagina sola en medio de un
// conteo en campo perderia lo que el formulario todavia no alcanzo a
// guardar (ver ConteoPage). El usuario decide cuando actualizar.
export default function ActualizacionDisponible() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW()

    function cerrar() {
        setOfflineReady(false)
        setNeedRefresh(false)
    }

    if (!offlineReady && !needRefresh) return null

    return (
        <div className={styles.aviso} role="status">
            <span>
                {needRefresh
                    ? 'Hay una versión nueva disponible.'
                    : 'La aplicación ya está lista para funcionar sin conexión.'}
            </span>

            <div className={styles.acciones}>
                {needRefresh && (
                    <button type="button" className={styles.boton} onClick={() => updateServiceWorker(true)}>
                        Actualizar
                    </button>
                )}
                <button type="button" className={styles.cerrar} onClick={cerrar} aria-label="Cerrar aviso">
                    <Icon name="cerrar" size={16} />
                </button>
            </div>
        </div>
    )
}
