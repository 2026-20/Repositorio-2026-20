import { NavLink } from 'react-router-dom'
import Icon from '../ui/Icon'
import { NAV_ITEMS } from '../../routes/navConfig'
import styles from './Sidebar.module.css'

// Sesiones iniciadas antes de guardar empresaNombre (ver AuthProvider.login)
// no lo tienen -- se cae a la marca generica en vez de dejar el hueco vacio.
const MARCA_POR_DEFECTO = 'CAPRIS'

export default function Sidebar({ rolUsuario, empresaNombre }) {
    const marca = empresaNombre || MARCA_POR_DEFECTO

    const items = NAV_ITEMS.filter(
        (item) => !item.rolRequerido || item.rolRequerido === rolUsuario,
    )

    return (
        <aside className={styles.sidebar} aria-label="Navegación principal">
            <div className={styles.marca}>
                {/* La franja de solo iconos (768-1023px) no tiene ancho para el
                    nombre completo -- ahi va solo la primera palabra. */}
                <span className={`${styles.wordmark} ${styles.wordmarkCompleto}`}>{marca}</span>
                <span className={`${styles.wordmark} ${styles.wordmarkCorto}`} aria-hidden="true">
                    {marca.split(' ')[0]}
                </span>
            </div>

            <nav className={styles.nav}>
                {items.map((item) =>
                    item.disponible ? (
                        <NavLink
                            key={item.label}
                            to={item.path}
                            className={({ isActive }) =>
                                `${styles.navItem} ${isActive ? styles.activo : ''}`
                            }
                        >
                            <Icon name={item.icon} size={20} />
                            <span className={styles.etiqueta}>{item.label}</span>
                        </NavLink>
                    ) : (
                        <span
                            key={item.label}
                            className={`${styles.navItem} ${styles.deshabilitado}`}
                            title={`${item.label} (próximamente) — ${item.descripcion}`}
                        >
                            <Icon name={item.icon} size={20} />
                            <span className={styles.etiqueta}>{item.label}</span>
                        </span>
                    ),
                )}
            </nav>
        </aside>
    )
}
