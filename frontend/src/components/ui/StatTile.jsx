import Icon from './Icon'
import styles from './StatTile.module.css'

// Widget de resumen tocable: numero grande + icono + etiqueta, en vez de
// una insignia de texto plano. Doble uso: muestra una cantidad Y, al
// tocarlo, filtra una lista (aria-pressed indica cual filtro esta activo,
// igual que antes lo hacia StatusBadge dentro de un boton).
export default function StatTile({ icono, valor, etiqueta, tono = 'primario', activo = false, onClick }) {
    return (
        <button
            type="button"
            className={`${styles.tile} ${styles[tono]} ${activo ? styles.activo : ''}`}
            aria-pressed={activo}
            aria-label={`${etiqueta}: ${valor}`}
            onClick={onClick}
        >
            <span className={styles.icono}>
                <Icon name={icono} size={18} />
            </span>
            <span className={styles.valor}>{valor}</span>
            <span className={styles.etiqueta}>{etiqueta}</span>
        </button>
    )
}
