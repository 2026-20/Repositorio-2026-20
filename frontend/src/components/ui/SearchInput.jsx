import styles from './SearchInput.module.css'

// Campo de busqueda con lupa (mismo patron que SearchInput de la demo). El
// placeholder hace tambien de nombre accesible si no se pasa aria-label.
export default function SearchInput({ value, onChange, placeholder = 'Buscar...', className = '', ...rest }) {
    return (
        <div className={`${styles.wrapper} ${className}`}>
            <span className={styles.icono} aria-hidden="true">
                ⌕
            </span>
            <input
                type="search"
                className={styles.input}
                value={value}
                onChange={(evento) => onChange(evento.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                {...rest}
            />
        </div>
    )
}
