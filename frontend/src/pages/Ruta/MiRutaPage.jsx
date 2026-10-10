import { useEffect, useState } from 'react'

import ConfirmDialog from '../../components/feedback/ConfirmDialog'
import { useAuth } from '../../context/useAuth'
import { useJornada } from '../../context/useJornada'
import { useSincronizacion } from '../../context/useSincronizacion'
import { useConectividad } from '../../hooks/useConectividad'
import { obtenerRuta } from '../../storage/datosMaestrosRepositorio.js'
import { hoyLocal } from '../../utils/fecha.js'
import styles from './MiRutaPage.module.css'

const ETIQUETA_ESTADO = {
    PENDIENTE: 'Pendiente',
    EN_PROGRESO: 'En progreso',
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
    const {
        iniciada: jornadaIniciada,
        iniciadaEn: jornadaIniciadaEn,
        confirmando: confirmandoJornada,
        error: errorJornada,
        confirmarInicio,
    } = useJornada()

    const [paradas, setParadas] = useState(null)
    const [errorLectura, setErrorLectura] = useState(false)
    const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)

    // Se cierra el dialogo solo cuando la jornada queda realmente
    // confirmada (nunca en el mismo instante del clic): si confirmarInicio
    // falla, errorJornada queda visible y el dialogo sigue abierto para
    // reintentar sin tener que volver a abrirlo.
    useEffect(() => {
        if (jornadaIniciada) setMostrarConfirmacion(false)
    }, [jornadaIniciada])

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

    // HU-038 criterios 1 y 5: solo se puede confirmar el inicio de jornada
    // una vez que la ruta terminó de cargar SIN error, Y ÚNICAMENTE si tiene
    // al menos una bodega asignada -- sin bodegas no hay nada que contar
    // hoy, asi que no tiene sentido ofrecer "Iniciar jornada".
    const rutaCargada = paradas !== null && !errorLectura
    const tieneBodegasAsignadas = rutaCargada && paradas.length > 0

    return (
        <main>
            <h1>Mi ruta</h1>

            <section className={styles.jornada}>
                {jornadaIniciada ? (
                    <p className={styles.jornadaIniciada} role="status">
                        Jornada iniciada · {formatearFechaHora(jornadaIniciadaEn)}
                    </p>
                ) : (
                    <>
                        <button
                            type="button"
                            className={styles.botonIniciarJornada}
                            disabled={!tieneBodegasAsignadas}
                            onClick={() => setMostrarConfirmacion(true)}
                        >
                            Iniciar jornada
                        </button>

                        {!rutaCargada && (
                            <p className={styles.jornadaAviso}>Esperando a que se cargue la ruta asignada…</p>
                        )}

                        {rutaCargada && !tieneBodegasAsignadas && (
                            <p className={styles.jornadaAviso}>
                                No tiene bodegas asignadas: no es posible iniciar jornada.
                            </p>
                        )}
                    </>
                )}
            </section>

            {mostrarConfirmacion && (
                <ConfirmDialog
                    titulo="Iniciar jornada"
                    confirmando={confirmandoJornada}
                    textoConfirmar={errorJornada ? 'Reintentar' : 'Iniciar'}
                    variante="primaria"
                    onConfirmar={confirmarInicio}
                    onCancelar={() => setMostrarConfirmacion(false)}
                >
                    <p>¿Confirma el inicio de su jornada de hoy?</p>

                    {errorJornada && (
                        <p className={styles.error} role="alert">
                            No fue posible confirmar el inicio de jornada. Intente de nuevo.
                        </p>
                    )}
                </ConfirmDialog>
            )}

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
