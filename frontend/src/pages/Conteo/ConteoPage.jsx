import { useEffect, useState } from 'react'

import { useAuth } from '../../context/useAuth'
import { useSincronizacion } from '../../context/useSincronizacion'
import { iniciarJornada } from '../../services/auditoriaService.js'
import {
    estaJornadaIniciadaHoy,
    guardarJornadaIniciada,
    obtenerConteosPendientes,
    registrarConteoLocal,
} from '../../storage/conteosPendientesRepositorio.js'
import { obtenerDetalleBodega, obtenerLotesBodega, obtenerRuta } from '../../storage/datosMaestrosRepositorio.js'
import styles from './ConteoPage.module.css'

// Un mismo codArt puede repetirse en la misma bodega bajo dos contratos
// distintos (ver datosMaestrosRepositorio.js, el mismo caso real que
// "MEPRIN" para bodegas) -- codArt solo no alcanza para identificar una
// opcion del selector sin ambiguedad, hace falta tambien numCon.
function claveArticulo(articulo) {
    return `${articulo.codArt}::${articulo.numCon ?? ''}`
}

// HU-021. Pantalla minima de registrar conteo (HU-005, sin asignar
// todavia): sin validaciones avanzadas (HU-006), sin corregir un conteo ya
// hecho (HU-007), sin resumen de avance (HU-008) -- esas son HUs aparte.
// El objetivo aqui es tener algo real contra que probar las 4 criterios de
// HU-021 de punta a punta.
//
// HU-038 (jornada) deliberadamente NO tiene pantalla, dialogo ni estado
// compartido propio -- la version anterior (pantalla dedicada + contexto +
// guard de rutas) resulto ser mucho aparato para un dato que hoy nadie mas
// lee (ni reportes, ni un "finalizar jornada", nada). Lo unico que importa
// de verdad es el gate real del backend (ConteoFisicoService exige jornada
// iniciada); aqui se asegura en silencio, sin pedirle nada al usuario.
export default function ConteoPage() {
    const { usuario, token } = useAuth()
    const { ultimaSincronizacion } = useSincronizacion()

    // verificando | lista | sin-conexion | error
    const [estadoJornada, setEstadoJornada] = useState('verificando')
    const [errorJornada, setErrorJornada] = useState(null)
    const [intentoJornada, setIntentoJornada] = useState(0)

    const [bodegas, setBodegas] = useState([])
    const [codBodSeleccionado, setCodBodSeleccionado] = useState('')
    const [articulos, setArticulos] = useState([])
    const [claveArticuloSeleccionado, setClaveArticuloSeleccionado] = useState('')
    const [lotes, setLotes] = useState([])
    const [numLoteSeleccionado, setNumLoteSeleccionado] = useState('')
    const [cantidadFisica, setCantidadFisica] = useState('')
    const [observaciones, setObservaciones] = useState('')

    const [guardando, setGuardando] = useState(false)
    const [mensajeExito, setMensajeExito] = useState(false)
    const [errorFormulario, setErrorFormulario] = useState(null)
    const [pendientesSinSincronizar, setPendientesSinSincronizar] = useState(0)

    async function actualizarContadorPendientes() {
        if (!usuario?.id) return
        const pendientes = await obtenerConteosPendientes(usuario.id)
        setPendientesSinSincronizar(pendientes.filter((conteo) => !conteo.sincronizado).length)
    }

    // Se asegura de que la jornada de hoy quede confirmada SIN pedirle nada
    // al usuario: si ya estaba (por esta pantalla antes, o porque la ultima
    // sincronizacion la trajo del backend ya iniciada) no hace nada; si no,
    // y hay conexion, la confirma en silencio. Sin conexion y sin jornada
    // previa no hay forma de evitarlo -- confirmar jornada es la unica parte
    // de este flujo que de verdad necesita red.
    useEffect(() => {
        if (!usuario?.id) return
        let cancelado = false

        async function asegurarJornada() {
            setEstadoJornada('verificando')
            setErrorJornada(null)

            const yaIniciada = await estaJornadaIniciadaHoy(usuario.id)
            if (cancelado) return
            if (yaIniciada) {
                setEstadoJornada('lista')
                return
            }
            if (!navigator.onLine) {
                setEstadoJornada('sin-conexion')
                return
            }
            try {
                const resultado = await iniciarJornada(token)
                if (cancelado) return
                await guardarJornadaIniciada(usuario.id, resultado.iniciadaEn)
                if (cancelado) return
                setEstadoJornada('lista')
            } catch (error) {
                if (cancelado) return
                setErrorJornada(error.message)
                setEstadoJornada('error')
            }
        }

        asegurarJornada()

        return () => {
            cancelado = true
        }
    }, [usuario?.id, token, ultimaSincronizacion, intentoJornada])

    // Ruta + cola pendiente: las dos salen SOLO del almacenamiento local
    // (criterio 1 y 2), nunca de una llamada directa al backend desde esta
    // pantalla.
    //
    // Depende tambien de ultimaSincronizacion (no solo de usuario.id): la
    // descarga automatica de AppLayout corre en paralelo a este efecto, no
    // antes -- si solo dependiera de usuario.id, esta pantalla se quedaria
    // con la ruta vacia hasta la proxima vez que el componente se vuelva a
    // montar. Mismo patron que MiRutaPage.jsx.
    useEffect(() => {
        if (!usuario?.id) return
        let cancelado = false

        obtenerRuta(usuario.id).then((ruta) => {
            if (!cancelado) setBodegas(ruta)
        })
        actualizarContadorPendientes()

        return () => {
            cancelado = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usuario?.id, ultimaSincronizacion])

    useEffect(() => {
        if (!usuario?.id || !codBodSeleccionado) {
            setArticulos([])
            return
        }
        let cancelado = false
        obtenerDetalleBodega(usuario.id, codBodSeleccionado).then((detalle) => {
            if (!cancelado) setArticulos(detalle)
        })
        return () => {
            cancelado = true
        }
    }, [usuario?.id, codBodSeleccionado])

    const articuloSeleccionado = articulos.find((articulo) => claveArticulo(articulo) === claveArticuloSeleccionado)

    useEffect(() => {
        if (!usuario?.id || !codBodSeleccionado || !articuloSeleccionado?.indicadorLote) {
            setLotes([])
            return
        }
        let cancelado = false
        obtenerLotesBodega(usuario.id, codBodSeleccionado).then((todosLosLotes) => {
            if (!cancelado) {
                setLotes(todosLosLotes.filter((lote) => lote.codArt === articuloSeleccionado.codArt))
            }
        })
        return () => {
            cancelado = true
        }
    }, [usuario?.id, codBodSeleccionado, articuloSeleccionado?.codArt, articuloSeleccionado?.indicadorLote])

    function limpiarFormularioDeConteo() {
        setClaveArticuloSeleccionado('')
        setNumLoteSeleccionado('')
        setCantidadFisica('')
        setObservaciones('')
    }

    async function manejarRegistrar(evento) {
        evento.preventDefault()
        setErrorFormulario(null)
        setMensajeExito(false)

        if (!codBodSeleccionado || !articuloSeleccionado || cantidadFisica === '') {
            setErrorFormulario('Completá bodega, artículo y cantidad física.')
            return
        }
        if (Number(cantidadFisica) < 0) {
            setErrorFormulario('La cantidad física no puede ser negativa.')
            return
        }

        setGuardando(true)
        try {
            await registrarConteoLocal(usuario.id, {
                codBod: codBodSeleccionado,
                codArt: articuloSeleccionado.codArt,
                numLote: numLoteSeleccionado || null,
                numCon: articuloSeleccionado.numCon ?? null,
                cantidadTeorica: articuloSeleccionado.cantidadTeorica,
                cantidadFisica: Number(cantidadFisica),
                observaciones: observaciones || null,
            })
            setMensajeExito(true)
            limpiarFormularioDeConteo()
            await actualizarContadorPendientes()
        } catch {
            setErrorFormulario('No fue posible guardar el conteo en este dispositivo.')
        } finally {
            setGuardando(false)
        }
    }

    if (estadoJornada === 'verificando') {
        return (
            <main>
                <h1>Conteo</h1>
            </main>
        )
    }

    if (estadoJornada === 'sin-conexion') {
        return (
            <main>
                <h1>Conteo</h1>

                <div className={styles.aviso} role="status">
                    Necesitás conexión para empezar a contar hoy.
                </div>
            </main>
        )
    }

    if (estadoJornada === 'error') {
        return (
            <main>
                <h1>Conteo</h1>

                <div className={styles.error} role="alert">
                    {errorJornada}
                </div>

                <button type="button" className={styles.boton} onClick={() => setIntentoJornada((n) => n + 1)}>
                    Reintentar
                </button>
            </main>
        )
    }

    return (
        <main>
            <h1>Conteo</h1>

            {pendientesSinSincronizar > 0 && (
                <p className={styles.pendientes}>
                    {pendientesSinSincronizar} conteo{pendientesSinSincronizar === 1 ? '' : 's'} todavía sin
                    sincronizar.
                </p>
            )}

            <form className={styles.formulario} onSubmit={manejarRegistrar} noValidate>
                <div className={styles.grupo}>
                    <label htmlFor="conteo-bodega">Bodega</label>
                    <select
                        id="conteo-bodega"
                        value={codBodSeleccionado}
                        onChange={(evento) => {
                            setCodBodSeleccionado(evento.target.value)
                            setClaveArticuloSeleccionado('')
                            setNumLoteSeleccionado('')
                        }}
                    >
                        <option value="">Seleccioná una bodega</option>
                        {bodegas.map((bodega) => (
                            <option key={bodega.codBod} value={bodega.codBod}>
                                {bodega.desBod}
                            </option>
                        ))}
                    </select>
                </div>

                <div className={styles.grupo}>
                    <label htmlFor="conteo-articulo">Artículo</label>
                    <select
                        id="conteo-articulo"
                        value={claveArticuloSeleccionado}
                        onChange={(evento) => {
                            setClaveArticuloSeleccionado(evento.target.value)
                            setNumLoteSeleccionado('')
                        }}
                        disabled={!codBodSeleccionado}
                    >
                        <option value="">Seleccioná un artículo</option>
                        {articulos.map((articulo) => (
                            <option key={claveArticulo(articulo)} value={claveArticulo(articulo)}>
                                {articulo.desArt} (teórico: {articulo.cantidadTeorica})
                            </option>
                        ))}
                    </select>
                </div>

                {articuloSeleccionado?.indicadorLote && (
                    <div className={styles.grupo}>
                        <label htmlFor="conteo-lote">Lote</label>
                        <select
                            id="conteo-lote"
                            value={numLoteSeleccionado}
                            onChange={(evento) => setNumLoteSeleccionado(evento.target.value)}
                        >
                            <option value="">Seleccioná un lote</option>
                            {lotes.map((lote) => (
                                <option key={lote.numLote} value={lote.numLote}>
                                    {lote.numLote} (vence: {lote.fechaVencimiento ?? 'sin fecha'})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className={styles.grupo}>
                    <label htmlFor="conteo-cantidad">Cantidad física</label>
                    <input
                        id="conteo-cantidad"
                        type="number"
                        min="0"
                        step="any"
                        value={cantidadFisica}
                        onChange={(evento) => setCantidadFisica(evento.target.value)}
                    />
                </div>

                <div className={styles.grupo}>
                    <label htmlFor="conteo-observaciones">Observaciones</label>
                    <textarea
                        id="conteo-observaciones"
                        value={observaciones}
                        onChange={(evento) => setObservaciones(evento.target.value)}
                    />
                </div>

                {errorFormulario && (
                    <div className={styles.error} role="alert">
                        {errorFormulario}
                    </div>
                )}

                {mensajeExito && (
                    <div className={styles.exito} role="status">
                        Conteo guardado en este dispositivo.
                    </div>
                )}

                <button type="submit" className={styles.boton} disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Registrar conteo'}
                </button>
            </form>
        </main>
    )
}
