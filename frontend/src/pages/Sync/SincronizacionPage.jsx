import { useSincronizacion } from '../../context/useSincronizacion'
import { useConectividad } from '../../hooks/useConectividad'
import styles from './SincronizacionPage.module.css'

function formatearFecha(fechaIso) {
    return new Date(fechaIso).toLocaleString('es-CR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

// HU-003: pantalla de estado de la sincronizacion de catalogos maestros.
// La descarga automatica ocurre sola al iniciar sesion (ver AppLayout) --
// esta pantalla es para ver el resultado y, si algo fallo o el usuario
// quiere forzarla, repetirla a mano.
export default function SincronizacionPage() {
    const enLinea = useConectividad()
    const { estado, error, ultimaSincronizacion, sincronizar } = useSincronizacion()

    const sincronizando = estado === 'sincronizando'

    return (
        <main>
            <h1>Sincronización</h1>

            <section className={styles.seccion}>
                <h2 className={styles.tituloSeccion}>Catálogos maestros</h2>

                <p className={styles.descripcion}>
                    Bodegas, artículos y lotes que se usan para contar sin conexión. Se descargan
                    automáticamente al iniciar sesión; desde aquí podés repetir la descarga cuando quieras.
                </p>

                <p className={styles.estadoLinea}>
                    Última sincronización:{' '}
                    {ultimaSincronizacion ? formatearFecha(ultimaSincronizacion) : 'todavía no se ha sincronizado'}
                </p>

                {!enLinea && (
                    <div className={styles.aviso} role="status">
                        No hay conexión a internet. Los datos de la última sincronización no se modifican.
                    </div>
                )}

                {/* Si no hay conexion, el aviso de arriba ya lo explica -- mostrar
                    tambien esta alerta duplicaria el mismo mensaje. Se reserva
                    para errores reales del backend (401, 500...) o para el caso
                    de un falso positivo de navigator.onLine (ver sinFalsoPositivoDeRed
                    en sincronizacionDatosMaestros.js). */}
                {estado === 'error' && error && enLinea && (
                    <div className={styles.error} role="alert">
                        {error.message}
                    </div>
                )}

                {estado === 'listo' && (
                    <div className={styles.exito} role="status">
                        Sincronización completada.
                    </div>
                )}

                <button
                    type="button"
                    className={styles.boton}
                    onClick={sincronizar}
                    disabled={!enLinea || sincronizando}
                >
                    {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
                </button>
            </section>
        </main>
    )
}
