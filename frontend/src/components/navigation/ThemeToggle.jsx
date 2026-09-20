import Icon from '../ui/Icon'
import { useTheme } from '../../hooks/useTheme'
import styles from './ThemeToggle.module.css'

// D10: alternador compacto de un solo boton en la barra superior -- el
// selector completo (Claro/Oscuro) vive en la pantalla de Ajustes.
export default function ThemeToggle() {
    const { temaEfectivo, alternarTema } = useTheme()
    const esOscuro = temaEfectivo === 'oscuro'
    const etiqueta = esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'

    return (
        <button
            type="button"
            className={styles.boton}
            onClick={alternarTema}
            aria-label={etiqueta}
            title={etiqueta}
        >
            <Icon name={esOscuro ? 'temaOscuro' : 'temaClaro'} size={20} />
        </button>
    )
}
