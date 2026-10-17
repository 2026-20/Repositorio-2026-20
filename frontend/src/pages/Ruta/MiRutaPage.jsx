import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ConfirmDialog from '../../components/feedback/ConfirmDialog'
import Card from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import SearchInput from '../../components/ui/SearchInput'
import StatusBadge from '../../components/ui/StatusBadge'
import { useAuth } from '../../context/useAuth'
import { useContextoAuditoria } from '../../context/useContextoAuditoria'
import { useSincronizacion } from '../../context/useSincronizacion'
import { useConectividad } from '../../hooks/useConectividad'
import { paths } from '../../routes/paths'
import { obtenerRuta } from '../../storage/datosMaestrosRepositorio.js'
import { hoyLocal } from '../../utils/fecha.js'
import styles from './MiRutaPage.module.css'

const ETIQUETA_ESTADO = {
    PENDIENTE: 'Pendiente',
    EN_PROGRESO: 'En progreso',
    FINALIZADA: 'Finalizada',
}

// HU-026 criterio 1: diferenciar visualmente (no solo por texto) una visita
// en progreso de una finalizada.
const TONO_ESTADO = {
    PENDIENTE: 'advertencia',
    EN_PROGRESO: 'primario',
    FINALIZADA: 'exito',
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

function nombreContrato(contrato) {
    return contrato.objCon ? `${contrato.numCon} · ${contrato.objCon}` : contrato.numCon
}

// Minusculas y sin tildes, para que "quimica" encuentre "QUÍMICA".
function normalizar(texto) {
    return (texto ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

// HU-004: los contratos salen de la ruta guardada localmente (contrato y
// licitacion son lo mismo, identificados por numCon)
// -- una entrada por numCon, con cuantas bodegas pendientes tiene. Asi la
// pantalla funciona igual sin conexion y no llama al backend. El aislamiento
// por empresa ya lo garantiza el login (HU-023): la ruta es solo del usuario.
function contratosDeLaRuta(paradas) {
    const porNumCon = new Map()
    for (const parada of paradas) {
        const contrato = porNumCon.get(parada.numCon)
        if (contrato) {
            contrato.pendientes += 1
        } else {
            porNumCon.set(parada.numCon, {
                numCon: parada.numCon,
                objCon: parada.objCon,
                pendientes: 1,
            })
        }
    }
    return [...porNumCon.values()]
}

// HU-037: ruta del Usuario de Campo. Lee SOLO del almacenamiento local (la
// guarda sincronizarDatosMaestros), asi que se ve igual con o sin conexion:
// una ruta sincronizada hace dias sigue aqui, cada grupo con su fecha, hasta
// que se complete y una sincronizacion nueva la actualice.
//
// HU-004: la ruta se recorre por contrato. Paso 1: elegir el contrato entre
// tarjetas (con busqueda); tocarlo lo deja activo para el resto de la sesion
// (criterio 2) y reemplazar uno ya activo pide confirmacion (criterio 3).
// Paso 2: elegir la bodega del contrato, que lleva a Conteo con esa bodega.
export default function MiRutaPage() {
    const { usuario } = useAuth()
    const { estado, ultimaSincronizacion } = useSincronizacion()
    const { contexto, establecerContexto, seleccionarBodega } = useContextoAuditoria()
    const enLinea = useConectividad()
    const navigate = useNavigate()

    const [paradas, setParadas] = useState(null)
    const [errorLectura, setErrorLectura] = useState(false)

    const [busqueda, setBusqueda] = useState('')
    const [eligiendoContrato, setEligiendoContrato] = useState(false)
    const [contratoPorConfirmar, setContratoPorConfirmar] = useState(null)

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

    const contratos = useMemo(() => contratosDeLaRuta(paradas ?? []), [paradas])

    // Busqueda en el cliente (funciona sin conexion) por numero de contrato y
    // objeto del contrato. El contrato activo va primero.
    const contratosFiltrados = useMemo(() => {
        const criterio = normalizar(busqueda.trim())
        const filtrados = criterio
            ? contratos.filter((contrato) =>
                  [contrato.numCon, contrato.objCon].some((campo) => normalizar(campo).includes(criterio)),
              )
            : contratos
        return [...filtrados].sort(
            (a, b) => Number(b.numCon === contexto?.numCon) - Number(a.numCon === contexto?.numCon),
        )
    }, [contratos, busqueda, contexto?.numCon])

    const hoy = hoyLocal()
    const paradasDelContrato = contexto ? (paradas ?? []).filter((parada) => parada.numCon === contexto.numCon) : []
    const bodegaActiva = paradasDelContrato.find((parada) => parada.codBod === contexto?.codBodSeleccionada)
    const mostrarContratos = !contexto || eligiendoContrato

    function activarContrato(contrato) {
        establecerContexto(contrato)
        setContratoPorConfirmar(null)
        setEligiendoContrato(false)
        setBusqueda('')
    }

    function tocarContrato(contrato) {
        if (contexto?.numCon === contrato.numCon) {
            setEligiendoContrato(false)
            return
        }
        if (contexto) {
            setContratoPorConfirmar(contrato)
            return
        }
        activarContrato(contrato)
    }

    function tocarBodega(parada) {
        seleccionarBodega(parada.codBod)
        navigate(paths.conteo)
    }

    return (
        <main>
            <h1>Mi ruta</h1>

            {contexto && (
                <div className={styles.indicador} data-testid="contexto-activo">
                    <span>
                        Contexto activo: <strong>{nombreContrato(contexto)}</strong>
                        {bodegaActiva && <> · {bodegaActiva.desBod}</>}
                    </span>
                    {!eligiendoContrato && (
                        <button type="button" className={styles.enlace} onClick={() => setEligiendoContrato(true)}>
                            Cambiar
                        </button>
                    )}
                </div>
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

            {paradas?.length === 0 && <p className={styles.vacio}>No tiene bodegas asignadas pendientes.</p>}

            {mostrarContratos && contratos.length > 0 && (
                <section aria-label="Contratos">
                    <SearchInput
                        value={busqueda}
                        onChange={setBusqueda}
                        placeholder="Buscar contrato..."
                        className={styles.busqueda}
                    />

                    {contratosFiltrados.length === 0 ? (
                        <p className={styles.vacio}>No se encontraron contratos con ese criterio</p>
                    ) : (
                        <ul className={styles.cuadricula}>
                            {contratosFiltrados.map((contrato) => {
                                const esActivo = contexto?.numCon === contrato.numCon
                                return (
                                    <li key={contrato.numCon}>
                                        <Card
                                            as="button"
                                            type="button"
                                            interactive
                                            className={`${styles.tarjeta} ${esActivo ? styles.tarjetaActiva : ''}`}
                                            onClick={() => tocarContrato(contrato)}
                                            aria-current={esActivo ? 'true' : undefined}
                                        >
                                            <span className={styles.principal}>
                                                <span className={styles.titulo}>{nombreContrato(contrato)}</span>
                                                {esActivo && (
                                                    <StatusBadge className={styles.insignia}>
                                                        Contrato activo
                                                    </StatusBadge>
                                                )}
                                            </span>
                                            <span className={styles.meta}>
                                                {contrato.pendientes} bodega{contrato.pendientes === 1 ? '' : 's'}{' '}
                                                pendiente{contrato.pendientes === 1 ? '' : 's'}
                                                <Icon name="chevronDerecha" size={18} className={styles.chevron} />
                                            </span>
                                        </Card>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </section>
            )}

            {contexto && !eligiendoContrato && (
                <>
                    {paradas && paradasDelContrato.length === 0 && (
                        <p className={styles.vacio}>No tiene bodegas pendientes en este contrato.</p>
                    )}

                    {agruparPorFecha(paradasDelContrato).map((grupo) => (
                        <section key={grupo.fecha ?? 'sin-fecha'} className={styles.grupo}>
                            <h2 className={styles.tituloGrupo}>{tituloGrupo(grupo.fecha, hoy)}</h2>

                            <ul className={styles.cuadricula}>
                                {grupo.paradas.map((parada) => (
                                    <li key={`${parada.numCon}-${parada.codBod}`}>
                                        <Card
                                            as="button"
                                            type="button"
                                            interactive
                                            className={styles.tarjeta}
                                            onClick={() => tocarBodega(parada)}
                                        >
                                            <span className={styles.principal}>
                                                <span className={styles.titulo}>{parada.desBod}</span>
                                                <span className={styles.subtitulo}>
                                                    {parada.codBod} · Contrato {parada.numCon}
                                                </span>
                                            </span>
                                            <span className={styles.meta}>
                                                <StatusBadge tono={TONO_ESTADO[parada.estadoApp] ?? 'primario'}>
                                                    {ETIQUETA_ESTADO[parada.estadoApp] ?? parada.estadoApp}
                                                </StatusBadge>
                                                <Icon name="chevronDerecha" size={18} className={styles.chevron} />
                                            </span>
                                        </Card>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </>
            )}

            {contratoPorConfirmar && (
                <ConfirmDialog
                    titulo="¿Cambiar de contexto?"
                    textoConfirmar="Cambiar contexto"
                    variante="primaria"
                    onConfirmar={() => activarContrato(contratoPorConfirmar)}
                    onCancelar={() => setContratoPorConfirmar(null)}
                >
                    <p>
                        Cambiar de contexto reemplazará {nombreContrato(contexto)} por{' '}
                        {nombreContrato(contratoPorConfirmar)}
                    </p>
                </ConfirmDialog>
            )}
        </main>
    )
}
