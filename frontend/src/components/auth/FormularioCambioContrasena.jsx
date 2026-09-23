import { useId, useState } from 'react'
import PasswordField from '../ui/PasswordField'
import styles from './FormularioCambioContrasena.module.css'

// Formulario compartido por HU-044 (cambio obligatorio en primer ingreso) y
// HU-045 (cambio voluntario en Ajustes). La confirmacion de la contraseña
// vive solo aqui: el backend nunca la recibe, asi que "las dos veces
// ingresadas deben coincidir" (criterio 3 de ambas HU) se valida antes de
// enviar. La complejidad la valida el backend (HU-042); la ayuda visible
// solo la describe.
export default function FormularioCambioContrasena({
    requiereContrasenaActual = false,
    etiquetaEnvio,
    mensajeExito,
    onEnviar,
}) {
    const idBase = useId()

    const [contrasenaActual, setContrasenaActual] = useState('')
    const [contrasenaNueva, setContrasenaNueva] = useState('')
    const [confirmacion, setConfirmacion] = useState('')

    const [enviando, setEnviando] = useState(false)
    const [error, setError] = useState('')
    const [detalles, setDetalles] = useState([])
    const [exito, setExito] = useState(false)

    function validarLocalmente() {
        if (requiereContrasenaActual && !contrasenaActual) {
            return 'Ingrese su contraseña actual.'
        }

        if (!contrasenaNueva) {
            return 'Ingrese la contraseña nueva.'
        }

        if (contrasenaNueva !== confirmacion) {
            return 'La confirmación no coincide con la contraseña nueva.'
        }

        return ''
    }

    async function manejarSubmit(event) {
        event.preventDefault()
        setError('')
        setDetalles([])
        setExito(false)

        const errorLocal = validarLocalmente()

        if (errorLocal) {
            setError(errorLocal)
            return
        }

        try {
            setEnviando(true)

            await onEnviar({ contrasenaActual, contrasenaNueva })

            setContrasenaActual('')
            setContrasenaNueva('')
            setConfirmacion('')
            setExito(true)
        } catch (err) {
            setError(err.message || 'No fue posible cambiar la contraseña.')
            setDetalles(err.detalles ?? [])
        } finally {
            setEnviando(false)
        }
    }

    return (
        <form className={styles.formulario} onSubmit={manejarSubmit} noValidate>
            {requiereContrasenaActual && (
                <div className={styles.grupo}>
                    <label htmlFor={`${idBase}-actual`}>Contraseña actual</label>

                    <PasswordField
                        id={`${idBase}-actual`}
                        value={contrasenaActual}
                        onChange={(event) => setContrasenaActual(event.target.value)}
                        autoComplete="current-password"
                        disabled={enviando}
                    />
                </div>
            )}

            <div className={styles.grupo}>
                <label htmlFor={`${idBase}-nueva`}>Contraseña nueva</label>

                <PasswordField
                    id={`${idBase}-nueva`}
                    value={contrasenaNueva}
                    onChange={(event) => setContrasenaNueva(event.target.value)}
                    autoComplete="new-password"
                    aria-describedby={`${idBase}-ayuda`}
                    disabled={enviando}
                />

                <p id={`${idBase}-ayuda`} className={styles.ayuda}>
                    Mínimo 8 caracteres, con al menos una mayúscula, una
                    minúscula, un número y un carácter especial.
                </p>
            </div>

            <div className={styles.grupo}>
                <label htmlFor={`${idBase}-confirmacion`}>Confirmar contraseña nueva</label>

                <PasswordField
                    id={`${idBase}-confirmacion`}
                    value={confirmacion}
                    onChange={(event) => setConfirmacion(event.target.value)}
                    autoComplete="new-password"
                    disabled={enviando}
                />
            </div>

            {error && (
                <div className={styles.error} role="alert">
                    {error}

                    {detalles.length > 0 && (
                        <ul className={styles.detalles}>
                            {detalles.map((detalle) => (
                                <li key={detalle}>{detalle}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {exito && mensajeExito && (
                <div className={styles.exito} role="status">
                    {mensajeExito}
                </div>
            )}

            <button className={styles.boton} type="submit" disabled={enviando}>
                {enviando ? 'Guardando...' : etiquetaEnvio}
            </button>
        </form>
    )
}
