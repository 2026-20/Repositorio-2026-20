import Icon from './Icon'
import styles from './Stepper.module.css'

// Entrada numerica tipo "widget": +/- para ajustes rapidos de a 1 unidad,
// pero el numero del centro sigue siendo un input real editable a mano
// (hace falta para cantidades con decimales o para escribir un numero
// grande de una vez). id/value/onChange se comportan igual que un
// <input type="number"> normal -- quien lo usa no necesita saber que por
// dentro hay dos botones mas.
export default function Stepper({ id, value, onChange, min = 0, step = 'any', disabled = false }) {
    const numero = value === '' ? NaN : Number(value)

    function ajustar(delta) {
        const base = Number.isNaN(numero) ? 0 : numero
        const siguiente = base + delta
        if (siguiente < min) return
        onChange(String(siguiente))
    }

    return (
        <div className={styles.stepper}>
            <button
                type="button"
                className={styles.boton}
                aria-label="Disminuir"
                onClick={() => ajustar(-1)}
                disabled={disabled || (!Number.isNaN(numero) && numero <= min)}
            >
                <Icon name="menos" size={18} />
            </button>

            <input
                id={id}
                type="number"
                min={min}
                step={step}
                inputMode="decimal"
                className={styles.valor}
                value={value}
                onChange={(evento) => onChange(evento.target.value)}
                disabled={disabled}
            />

            <button
                type="button"
                className={styles.boton}
                aria-label="Aumentar"
                onClick={() => ajustar(1)}
                disabled={disabled}
            >
                <Icon name="mas" size={18} />
            </button>
        </div>
    )
}
