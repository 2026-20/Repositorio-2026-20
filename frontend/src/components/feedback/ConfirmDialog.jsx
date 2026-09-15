import styles from './ConfirmDialog.module.css'

export default function ConfirmDialog({
    titulo,
    children,
    confirmando,
    textoConfirmar = 'Confirmar',
    textoCancelar = 'Cancelar',
    onConfirmar,
    onCancelar,
}) {
    return (
        <div className={styles.fondo} role="presentation" onClick={onCancelar}>
            <div
                className={styles.dialogo}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-titulo"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 id="confirm-dialog-titulo">{titulo}</h2>

                <div className={styles.contenido}>{children}</div>

                <div className={styles.acciones}>
                    <button
                        type="button"
                        className={styles.botonCancelar}
                        onClick={onCancelar}
                        disabled={confirmando}
                    >
                        {textoCancelar}
                    </button>

                    <button
                        type="button"
                        className={styles.botonConfirmar}
                        onClick={onConfirmar}
                        disabled={confirmando}
                    >
                        {confirmando ? 'Procesando...' : textoConfirmar}
                    </button>
                </div>
            </div>
        </div>
    )
}
