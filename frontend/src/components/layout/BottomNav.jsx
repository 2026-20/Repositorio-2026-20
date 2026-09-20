import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon'
import { NAV_ITEMS } from '../../routes/navConfig'
import styles from './BottomNav.module.css'

// D08: navegacion inferior fija, visible unicamente por debajo de 768px.
// Muestra todo el menu directamente (igual que Sidebar en escritorio),
// incluidas las secciones "proximamente". Solo iconos, sin etiqueta de
// texto -- para que los items quepan sin desplazamiento lateral. El
// nombre sigue disponible para lectores de pantalla via aria-label/title.
//
// "Lampara": un indicador se desliza hasta el icono activo y lo ilumina.
// Se mide la posicion real del elemento en el DOM (no un calculo por
// indice) porque los items no tienen todos el mismo ancho garantizado.
export default function BottomNav({ rolUsuario }) {
    const items = NAV_ITEMS.filter(
        (item) => !item.rolRequerido || item.rolRequerido === rolUsuario,
    )

    const location = useLocation()
    const referenciaNav = useRef(null)
    const referenciasItems = useRef({})
    const [lampara, setLampara] = useState(null)

    useEffect(() => {
        function recalcularLampara() {
            const nav = referenciaNav.current
            const itemActivo = items.find(
                (item) => item.disponible && location.pathname.startsWith(item.path),
            )
            const nodo = itemActivo && referenciasItems.current[itemActivo.label]

            if (!nav || !nodo) {
                setLampara(null)
                return
            }

            const rectNav = nav.getBoundingClientRect()
            const rectItem = nodo.getBoundingClientRect()

            setLampara({
                left: rectItem.left - rectNav.left + nav.scrollLeft,
                width: rectItem.width,
            })
        }

        recalcularLampara()
        window.addEventListener('resize', recalcularLampara)
        return () => window.removeEventListener('resize', recalcularLampara)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, items.length])

    return (
        <nav className={styles.bottomNav} aria-label="Navegación principal" ref={referenciaNav}>
            {lampara && (
                <span
                    className={styles.lampara}
                    style={{ left: `${lampara.left}px`, width: `${lampara.width}px` }}
                    aria-hidden="true"
                >
                    <span className={styles.cono} />
                    <span className={styles.bombilla} />
                </span>
            )}

            {items.map((item) =>
                item.disponible ? (
                    <NavLink
                        key={item.label}
                        ref={(nodo) => {
                            referenciasItems.current[item.label] = nodo
                        }}
                        to={item.path}
                        className={({ isActive }) =>
                            `${styles.item} ${isActive ? styles.activo : ''}`
                        }
                        aria-label={item.label}
                        title={item.label}
                    >
                        <Icon name={item.icon} size={28} />
                    </NavLink>
                ) : (
                    <span
                        key={item.label}
                        className={`${styles.item} ${styles.deshabilitado}`}
                        aria-label={`${item.label} (próximamente)`}
                        title={`${item.label} (próximamente) — ${item.descripcion}`}
                    >
                        <Icon name={item.icon} size={28} />
                    </span>
                ),
            )}
        </nav>
    )
}
