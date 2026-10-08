import { useEffect, useState } from 'react'

import { useAuth } from '../../context/useAuth'
import { useSincronizacion } from '../../context/useSincronizacion'
import { useConectividad } from '../../hooks/useConectividad'
import { obtenerRuta } from '../../storage/datosMaestrosRepositorio.js'
import styles from './MiRutaPage.module.css'

const ETIQUETA_ESTADO = {
    PENDIENTE: 'Pendiente',
    EN_PROGRESO: 'En progreso',
}

// "YYYY-MM-DD" en hora local del dispositivo -- el mismo formato en que el
// backend manda fechaAsignada (LocalDate), asi que se pueden comparar como
// texto. toISOString() no sirve: daria la fecha en UTC.
function hoyLocal() {
    const ahora = new Date()
    const mes = String(ahora.getMonth() + 1).padStart(2, '0')
    const dia = String(ahora.getDate()).padStart(2, '0')
    return `${ahora.getFullYear()}-${mes}-${dia}`
}

function formatearDia(fechaIso) {
    const [anio, mes, dia] = fechaIso.split('-').map(Number)
    return new Date(anio, mes - 1, dia).toLocaleDateString('es-CR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    })
}

function formatearFechaHora(fechaIso) {
    return new Date(fechaIso).toLocaleString('es-CR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

// Las paradas ya vienen ordenadas por fecha desde el backend (ver
// ResultadoVisitaRepository.findRutaPendiente), asi que basta con cortar
// donde cambia la fecha.
function agruparPorFecha(paradas) {
    const grupos = []
    for (const parada of paradas) {
        const ultimo = grupos[grupos.length - 1]
        if (ultimo && ultimo.fecha === parada.fechaAsignada) {
            ultimo.paradas.push(parada)
        } else {
            grupos.push({ fecha: parada.fechaAsignada, paradas: [parada] })
        }
    }
    return grupos
}

function tituloGrupo(fecha, hoy) {
    if (!fecha) return 'Sin fecha asignada'
    if (fecha === hoy) return `Hoy, ${formatearDia(fecha)}`
    return formatearDia(fecha)
}

// HU-037: ruta del Usuario de Campo. Lee SOLO del almacenamiento local (la
// guarda sincronizarDatosMaestros), asi que se ve igual con o sin conexion:
// una ruta sincronizada hace dias sigue aqui, cada grupo con su fecha, hasta
// que se complete y una sincronizacion nueva la actualice.
export default function MiRutaPage() {
    const { usuario } = useAuth()
    const { estado, ultimaSincronizacion } = useSincronizacion()
    const enLinea = useConectividad()

    const [paradas, setParadas] = useState(null)
    const [errorLectura, setErrorLectura] = useState(false)

    // Se vuelve a leer cuando termina una sincronizacion (ultimaSincronizacion
    // cambia) -- la descarga automatica de AppLayout puede terminar despues
    // de que esta pantalla ya se mostro con la ruta anterior.
    useEffect(() => {
        if (!usuario?.id) return

        let cancelado = false

        obtenerRuta(usuario.id)
            .then((ruta) => {
                if (!cancelado) {
                    setParadas(ruta)
                    setErrorLectura(false)
                }
            })
            .catch(() => {
                if (!cancelado) setErrorLectura(true)
            })

        return () => {
            cancelado = true
        }
    }, [usuario?.id, ultimaSincronizacion])

    const hoy = hoyLocal()

    return (
        <main>
            <h1>Mi ruta</h1>

            <p className={styles.estadoLinea}>
                Ruta sincronizada:{' '}
                {ultimaSincronizacion ? formatearFechaHora(ultimaSincronizacion) : 'todavía no se ha sincronizado'}
                {estado === 'sincronizando' && ' · actualizando…'}
            </p>

            {!enLinea && (
                <div className={styles.aviso} role="status">
                    Sin conexión: se muestra la ruta guardada en este dispositivo.
                </div>
            )}

            {errorLectura && (
                <div className={styles.error} role="alert">
                    No fue posible leer la ruta guardada en este dispositivo.
                </div>
            )}

            {paradas?.length === 0 && (
                <p className={styles.vacio}>No tiene bodegas asignadas pendientes.</p>
            )}

            {paradas &&
                agruparPorFecha(paradas).map((grupo) => (
                    <section key={grupo.fecha ?? 'sin-fecha'} className={styles.grupo}>
                        <h2 className={styles.tituloGrupo}>{tituloGrupo(grupo.fecha, hoy)}</h2>

                        <ul className={styles.lista}>
                            {grupo.paradas.map((parada) => (
                                <li key={`${parada.numCon}-${parada.codBod}`} className={styles.parada}>
                                    <div className={styles.nombre}>{parada.desBod}</div>
                                    <div className={styles.detalle}>
                                        {parada.codBod} · Contrato {parada.numCon}
                                        {parada.objCon && ` · ${parada.objCon}`}
                                    </div>
                                    <span className={styles.estado}>
                                        {ETIQUETA_ESTADO[parada.estadoApp] ?? parada.estadoApp}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
        </main>
    )
}
