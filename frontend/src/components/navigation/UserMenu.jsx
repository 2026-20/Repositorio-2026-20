import { useRef, useState } from 'react'
import Icon from '../ui/Icon'
import styles from './UserMenu.module.css'

function obtenerIniciales(nombre = '') {
    return nombre
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) => parte[0])
        .join('')
        .toUpperCase()
}

// Ajustes vive en el menu principal (Sidebar/BottomNav), no aqui -- tenerlo
// en los dos lados seria la misma redundancia de "dos botones para lo
// mismo" que se corrigio en la topbar movil.
export default function UserMenu({ usuario, onCerrarSesion }) {
    const [abierto, setAbierto] = useState(false)
    const referenciaContenedor = useRef(null)

    if (!usuario) return null

    function manejarPerdidaFoco(event) {
        if (!referenciaContenedor.current?.contains(event.relatedTarget)) {
            setAbierto(false)
        }
    }

    function manejarCerrarSesion() {
        setAbierto(false)
        onCerrarSesion()
    }

    return (
        <div
            className={styles.contenedor}
            ref={referenciaContenedor}
            onBlur={manejarPerdidaFoco}
        >
            <button
                type="button"
                className={styles.disparador}
                onClick={() => setAbierto((actual) => !actual)}
                aria-haspopup="menu"
                aria-expanded={abierto}
                aria-label={`Menú de ${usuario.nombreCompleto}`}
            >
                <span className={styles.avatar}>
                    {obtenerIniciales(usuario.nombreCompleto)}
                </span>
            </button>

            {abierto && (
                <div className={styles.menu} role="menu">
                    <div className={styles.info}>
                        <p className={styles.nombre}>{usuario.nombreCompleto}</p>
                        <p className={styles.rol}>{usuario.rol}</p>
                    </div>

                    <button
                        type="button"
                        className={styles.itemCerrarSesion}
                        role="menuitem"
                        onClick={manejarCerrarSesion}
                    >
                        <Icon name="cerrarSesion" size={16} />
                        Cerrar sesión
                    </button>
                </div>
            )}
        </div>
    )
}
