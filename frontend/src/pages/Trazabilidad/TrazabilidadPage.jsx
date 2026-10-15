import { useEffect, useState } from 'react'
import StatusBadge from '../../components/ui/StatusBadge'
import { useAuth } from '../../context/useAuth'
import { listarTrazabilidad } from '../../services/auditoriaService.js'
import styles from './TrazabilidadPage.module.css'

// HU-031 criterio 3: etiquetas legibles para lo que el backend manda como
// enum (TipoAccionTrazabilidad). Un tipo nuevo que el backend no conocia
// todavia al momento de este deploy (otra version de la app) cae al texto
// crudo en vez de romper la pantalla.
const ETIQUETA_ACCION = {
    INICIO_SESION: 'Inicio de sesión',
    CONTEO_REGISTRADO: 'Conteo registrado',
}

function formatearFecha(fechaIso) {
    return new Date(fechaIso).toLocaleString('es-CR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

// HU-031 criterio 4/5: pantalla de solo lectura -- no hay ninguna accion
// para editar o borrar un registro (el backend tampoco expone esos verbos,
// ver TrazabilidadController).
export default function TrazabilidadPage() {
    const { token } = useAuth()

    const [registros, setRegistros] = useState([])
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let activo = true

        async function cargar() {
            try {
                setCargando(true)
                setError('')
                const datos = await listarTrazabilidad(token)
                if (activo) setRegistros(datos)
            } catch {
                if (activo) setError('No fue posible cargar el registro de trazabilidad.')
            } finally {
                if (activo) setCargando(false)
            }
        }

        if (token) cargar()

        return () => {
            activo = false
        }
    }, [token])

    return (
        <main className={styles.pagina}>
            <h1>Trazabilidad</h1>

            <p className={styles.descripcion}>
                Registro de solo lectura de las acciones realizadas: inicio de sesión, conteos
                registrados y las demás que se vayan agregando.
            </p>

            {error && (
                <div className={styles.error} role="alert">
                    {error}
                </div>
            )}

            {cargando ? (
                <p>Cargando...</p>
            ) : registros.length === 0 ? (
                <p className={styles.vacio}>Todavía no hay registros de trazabilidad.</p>
            ) : (
                <table className={styles.tabla}>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Acción</th>
                            <th>Usuario</th>
                            <th>Bodega</th>
                            <th>Resultado</th>
                            <th>Detalle</th>
                        </tr>
                    </thead>

                    <tbody>
                        {registros.map((registro) => (
                            <tr key={registro.id}>
                                <td data-label="Fecha">{formatearFecha(registro.fecha)}</td>
                                <td data-label="Acción">
                                    {ETIQUETA_ACCION[registro.tipoAccion] ?? registro.tipoAccion}
                                </td>
                                <td data-label="Usuario">{registro.usuarioNombre}</td>
                                <td data-label="Bodega">{registro.codBod ?? '—'}</td>
                                <td data-label="Resultado">
                                    <StatusBadge tono={registro.resultado === 'EXITOSO' ? 'exito' : 'peligro'}>
                                        {registro.resultado}
                                    </StatusBadge>
                                </td>
                                <td data-label="Detalle">{registro.detalle ?? '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </main>
    )
}
