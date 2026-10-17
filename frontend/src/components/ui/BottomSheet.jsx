import { useEffect } from 'react'

import styles from './BottomSheet.module.css'

// Hoja inferior generica (mismo patron de overlay que ConfirmDialog, pero
// anclada abajo en vez de centrada -- asi se siente a "panel que sube",
// comun en apps moviles, en vez de un dialogo de escritorio). Cerrar con
// Escape o tocando el fondo, igual que ConfirmDialog.
export default function BottomSheet({ titulo, onCerrar, children }) {
    useEffect(() => {
        function alTeclear(evento) {
            if (evento.key === 'Escape') onCerrar()
        }
        document.addEventListener('keydown', alTeclear)
        return () => document.removeEventListener('keydown', alTeclear)
    }, [onCerrar])

    return (
        <div className={styles.fondo} role="presentation" onClick={onCerrar}>
            <div
                className={styles.hoja}
                role="dialog"
                aria-modal="true"
                aria-labelledby="bottom-sheet-titulo"
                onClick={(evento) => evento.stopPropagation()}
            >
                <div className={styles.agarradera} aria-hidden="true" />
                <div className={styles.encabezado}>
                    <h2 id="bottom-sheet-titulo" className={styles.titulo}>
                        {titulo}
                    </h2>
                    <button type="button" className={styles.cerrar} onClick={onCerrar} aria-label="Cerrar">
                        ✕
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}
