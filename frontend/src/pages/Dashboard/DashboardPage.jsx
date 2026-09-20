import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import Icon from '../../components/ui/Icon'
import { NAV_ITEMS } from '../../routes/navConfig'
import styles from './DashboardPage.module.css'

export default function DashboardPage() {
    const { usuario } = useAuth()

    const accesos = NAV_ITEMS.filter(
        (item) =>
            item.label !== 'Inicio'
            && (!item.rolRequerido || item.rolRequerido === usuario?.rol),
    )

    return (
        <main>
            <h1 className={styles.saludo}>
                Hola, {usuario?.nombreCompleto?.split(' ')[0]}
            </h1>

            <p className={styles.subtitulo}>
                Rol: {usuario?.rol}
            </p>

            <section className={styles.seccion}>
                <h2 className={styles.tituloSeccion}>Accesos</h2>

                <div className={styles.grid}>
                    {accesos.map((item) =>
                        item.disponible ? (
                            <Link
                                key={item.label}
                                to={item.path}
                                className={styles.tarjeta}
                            >
                                <Icon name={item.icon} size={22} />

                                <span className={styles.etiquetaTarjeta}>
                                    {item.label}
                                </span>

                                <Icon
                                    name="chevronDerecha"
                                    size={18}
                                    className={styles.flecha}
                                />
                            </Link>
                        ) : (
                            <div
                                key={item.label}
                                className={`${styles.tarjeta} ${styles.tarjetaDeshabilitada}`}
                            >
                                <Icon name={item.icon} size={22} />

                                <span className={styles.etiquetaTarjeta}>
                                    {item.label}
                                </span>

                                <span className={styles.badge}>Próximamente</span>
                            </div>
                        ),
                    )}
                </div>
            </section>
        </main>
    )
}
