import { useEffect } from 'react'
import styles from './BienvenidaOverlay.module.css'

// Saludo breve justo despues de iniciar sesion -- nunca se repite en una
// recarga de una sesion ya activa (ver AuthProvider.login/mostrarBienvenida).
// Nivel "delight": evento raro/primera vez, presupuesto de animacion
// explicito. onAnimationEnd cierra el ciclo; el timeout es solo respaldo
// por si el navegador no llega a disparar el evento (pestaña en segundo
// plano, etc.).
export default function BienvenidaOverlay({ nombre, visible, onTerminar }) {
    useEffect(() => {
        if (!visible) return undefined

        const respaldo = setTimeout(onTerminar, 1900)
        return () => clearTimeout(respaldo)
    }, [visible, onTerminar])

    if (!visible) return null

    function manejarFinAnimacion(evento) {
        if (evento.target === evento.currentTarget) {
            onTerminar()
        }
    }

    return (
        <div
            className={styles.overlay}
            role="status"
            aria-live="polite"
            onAnimationEnd={manejarFinAnimacion}
        >
            <div className={styles.contenido}>
                <span className={styles.resplandor} aria-hidden="true" />
                <p className={styles.saludo}>Hola, {nombre}</p>
            </div>
        </div>
    )
}
