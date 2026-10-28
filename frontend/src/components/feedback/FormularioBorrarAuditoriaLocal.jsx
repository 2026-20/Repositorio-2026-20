import { useState } from 'react'
import styles from './FormularioBorrarAuditoriaLocal.module.css'

const PALABRA_CONFIRMACION = 'confirmar'

// "Ajustes > Borrar auditoría cargada": accion destructiva local (borra el
// catalogo descargado y los conteos guardados en este dispositivo, ver
// borrarAuditoriaLocal en AjustesPage.jsx). Pedido explicito: nada de un
// solo click ni de doble click -- hay que escribir la palabra de
// confirmacion para que el boton de borrar se habilite, igual que un
// "type DELETE to confirm" (mismo patron, en español).
export default function FormularioBorrarAuditoriaLocal({ onConfirmar, onCancelar }) {
    const [texto, setTexto] = useState('')
    const [borrando, setBorrando] = useState(false)
    const [error, setError] = useState('')
    const [exito, setExito] = useState(false)

    const confirmado = texto.trim().toLowerCase() === PALABRA_CONFIRMACION

    async function manejarSubmit(evento) {
        evento.preventDefault()
        if (!confirmado) return

        setError('')
        try {
            setBorrando(true)
            await onConfirmar()
            setExito(true)
        } catch (err) {
            setError(err.message || 'No fue posible borrar los datos locales.')
        } finally {
            setBorrando(false)
        }
    }

    return (
        <form className={styles.formulario} onSubmit={manejarSubmit} noValidate>
            <p className={styles.aviso}>
                Esto borra la ruta, las bodegas, los artículos y los conteos guardados en{' '}
                <strong>este dispositivo</strong> — incluidos los que todavía no se sincronizaron, esos se pierden
                para siempre. Vas a necesitar que un administrador genere la auditoría de nuevo para volver a
                contar.
            </p>

            <div className={styles.grupo}>
                <label htmlFor="confirmar-borrado-local">
                    Escribí <strong>confirmar</strong> para continuar
                </label>
                <input
                    id="confirmar-borrado-local"
                    type="text"
                    value={texto}
                    onChange={(evento) => setTexto(evento.target.value)}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    disabled={borrando || exito}
                />
            </div>

            {error && (
                <div className={styles.error} role="alert">
                    {error}
                </div>
            )}

            {exito && (
                <div className={styles.exito} role="status">
                    Se borraron los datos locales de este dispositivo.
                </div>
            )}

            {!exito && (
                <div className={styles.acciones}>
                    <button type="button" className={styles.botonCancelar} onClick={onCancelar} disabled={borrando}>
                        Cancelar
                    </button>
                    <button type="submit" className={styles.botonBorrar} disabled={!confirmado || borrando}>
                        {borrando ? 'Borrando…' : 'Borrar datos locales'}
                    </button>
                </div>
            )}
        </form>
    )
}
