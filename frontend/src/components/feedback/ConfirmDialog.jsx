import styles from './ConfirmDialog.module.css'

export default function ConfirmDialog({
    titulo,
    children,
    confirmando,
    textoConfirmar = 'Confirmar',
    textoCancelar = 'Cancelar',
    variante = 'peligro',
    onConfirmar,
    onCancelar,
}) {
    // D05: la variante de peligro (rojo) es exclusiva de acciones destructivas
    // -- confirmaciones normales (ej. crear) usan la variante primaria (azul).
    const claseBotonConfirmar =
        variante === 'primaria' ? styles.botonConfirmarPrimario : styles.botonConfirmarPeligro

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
                        className={claseBotonConfirmar}
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
