import { useState } from 'react'

import Icon from './Icon'
import styles from './PasswordField.module.css'

// Campo de contraseña con el "ojito" para mostrar/ocultar el texto. Usa el
// catalogo central de iconos (Icon.jsx), nunca lucide-react directo. El
// `<input>` conserva el `id`/`name` que le pasen, para que el asociado
// `<label htmlFor>` (del formulario padre) siga funcionando.
export default function PasswordField({ className, ...props }) {
    const [visible, setVisible] = useState(false)

    const etiqueta = visible ? 'Ocultar contraseña' : 'Mostrar contraseña'

    return (
        <span className={styles.contenedor}>
            <input
                {...props}
                type={visible ? 'text' : 'password'}
                className={`${styles.campo}${className ? ` ${className}` : ''}`}
            />

            <button
                type="button"
                className={styles.alternador}
                onClick={() => setVisible((actual) => !actual)}
                aria-label={etiqueta}
                aria-pressed={visible}
                title={etiqueta}
            >
                {/* key={visible} remonta el span en cada click, para que la
                    animacion de parpadeo se reinicie desde cero cada vez en
                    vez de quedarse pegada la primera vez que corre. */}
                <span className={styles.icono} key={visible}>
                    <Icon
                        name={visible ? 'ojoOculto' : 'ojo'}
                        size={18}
                    />
                </span>
            </button>
        </span>
    )
}