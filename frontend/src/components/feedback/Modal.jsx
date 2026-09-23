import { useEffect } from 'react'
import Icon from '../ui/Icon'
import styles from './Modal.module.css'

// Ventana pequena generica para contenido que no encaja en el patron de
// confirmar/cancelar de ConfirmDialog (por ejemplo, un formulario con su
// propio boton de envio). Se cierra con click en el fondo, Escape, o el
// boton de cerrar.
export default function Modal({ titulo, children, onCerrar }) {
    useEffect(() => {
        function manejarTecla(evento) {
            if (evento.key === 'Escape') {
                onCerrar()
            }
        }

        document.addEventListener('keydown', manejarTecla)
        return () => document.removeEventListener('keydown', manejarTecla)
    }, [onCerrar])

    return (
        <div className={styles.fondo} role="presentation" onClick={onCerrar}>
            <div
                className={styles.dialogo}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-titulo"
                onClick={(event) => event.stopPropagation()}
            >
                <div className={styles.encabezado}>
                    <h2 id="modal-titulo">{titulo}</h2>

                    <button
                        type="button"
                        className={styles.botonCerrar}
                        onClick={onCerrar}
                        aria-label="Cerrar"
                    >
                        <Icon name="cerrar" size={20} />
                    </button>
                </div>

                {children}
            </div>
        </div>
    )
}
