import styles from './StatusBadge.module.css'

// Insignia de estado (mismo patron que StatusBadge de la demo). tono:
// primario | exito | advertencia | peligro | info.
export default function StatusBadge({ children, tono = 'primario', className = '' }) {
    return <span className={`${styles.insignia} ${styles[tono]} ${className}`}>{children}</span>
}
