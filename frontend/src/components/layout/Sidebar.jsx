import { NavLink } from 'react-router-dom'
import Icon from '../ui/Icon'
import { NAV_ITEMS } from '../../routes/navConfig'
import styles from './Sidebar.module.css'

export default function Sidebar({ rolUsuario }) {
    const items = NAV_ITEMS.filter(
        (item) => !item.rolRequerido || item.rolRequerido === rolUsuario,
    )

    return (
        <aside className={styles.sidebar} aria-label="Navegación principal">
            <div className={styles.marca}>
                <span className={styles.wordmark}>CAPRIS</span>
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
