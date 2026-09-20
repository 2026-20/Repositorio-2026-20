import ThemeToggle from '../navigation/ThemeToggle'
import UserMenu from '../navigation/UserMenu'
import styles from './TopBar.module.css'

// D08: barra superior fija de 64px con acciones (alternador de tema,
// menu de usuario). En movil, el unico punto de entrada al menu completo
// es "Mas" en BottomNav (zona mas alcanzable con el pulgar) -- no se
// duplica aqui con una hamburguesa, para evitar dos botones que abren lo
// mismo con un icono que ademas sugeria un comportamiento distinto
// (panel lateral) al que en realidad tenia (hoja inferior).
export default function TopBar({ usuario, onCerrarSesion }) {
    return (
        <header className={styles.topBar}>
            <span className={styles.marcaMovil}>CAPRIS</span>

            <div className={styles.acciones}>
                <ThemeToggle />
                <UserMenu usuario={usuario} onCerrarSesion={onCerrarSesion} />
            </div>
        </header>
    )
}
