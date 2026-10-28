import { useEffect, useState } from 'react'

import BottomSheet from '../../components/ui/BottomSheet'
import Card from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import SearchInput from '../../components/ui/SearchInput'
import StatTile from '../../components/ui/StatTile'
import StatusBadge from '../../components/ui/StatusBadge'
import Stepper from '../../components/ui/Stepper'
import { useAuth } from '../../context/useAuth'
import { useContextoAuditoria } from '../../context/useContextoAuditoria'
import { useSincronizacion } from '../../context/useSincronizacion'
import { iniciarJornada } from '../../services/auditoriaService.js'
import {
    corregirConteoLocal,
    estaJornadaIniciadaHoy,
    guardarJornadaIniciada,
    obtenerConteosPendientes,
    registrarConteoLocal,
} from '../../storage/conteosPendientesRepositorio.js'
import { obtenerDetalleBodega, obtenerLotesBodega, obtenerRuta } from '../../storage/datosMaestrosRepositorio.js'
import { registrarAccionLocal } from '../../storage/trazabilidadRepositorio.js'
import styles from './ConteoPage.module.css'

// ALTERNATIVA DE DISEÑO (prueba de usabilidad) -- ver frontend/DISENO_WIDGETS_CONTEO.md.
// Misma logica y mismas HU que la version de produccion (sprint3-prototipo-local);
// lo que cambia es la presentacion: lista unica de articulos con su estado
// inline en vez de un <select> + dos listas de resumen separadas, y una
// hoja inferior con stepper en vez de un formulario siempre visible.

// Un mismo codArt puede repetirse en la misma bodega bajo dos contratos
// distintos (ver datosMaestrosRepositorio.js, el mismo caso real que
// "MEPRIN" para bodegas) -- codArt solo no alcanza para identificar una
// opcion sin ambiguedad, hace falta tambien numCon.
function claveArticulo(articulo) {
    return `${articulo.codArt}::${articulo.numCon ?? ''}`
}

// HU-027: minusculas y sin tildes, mismo patron que MiRutaPage, para que
// "quimica" encuentre "QUÍMICA".
function normalizar(texto) {
    return (texto ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
}

// HU-030, calculado del lado del cliente con el mismo criterio que
// ConteoFisico.getTipoDiferencia() en el backend: fisica - teorica,
// negativo = faltante, positivo = sobrante, cero = sin diferencia.
function tipoDiferencia(cantidadTeorica, cantidadFisica) {
    const diferencia = Number(cantidadFisica) - Number(cantidadTeorica)
    if (diferencia < 0) return 'FALTANTE'
    if (diferencia > 0) return 'SOBRANTE'
    return 'SIN_DIFERENCIA'
}

// SOBRANTE va en "info" (azul), NO en "advertencia" (ambar) -- ese tono ya
// lo usa la insignia "Pendiente", y con el mismo color ambos se confundian
// a simple vista (quedaba solo el texto para distinguirlos).
const TONO_TIPO_DIFERENCIA = {
    FALTANTE: 'peligro',
    SOBRANTE: 'info',
    SIN_DIFERENCIA: 'exito',
}

const ETIQUETA_TIPO_DIFERENCIA = {
    FALTANTE: 'Faltante',
    SOBRANTE: 'Sobrante',
    SIN_DIFERENCIA: 'Sin diferencia',
}

// HU-038 (jornada) deliberadamente NO tiene pantalla, dialogo ni estado
// compartido propio -- ver el comentario equivalente en la version de
// produccion. Aqui se mantiene identico: el unico gate real es el del
// backend (ConteoFisicoService exige jornada iniciada), y se asegura en
// silencio sin pedirle nada al usuario.
export default function ConteoPage() {
    const { usuario, token } = useAuth()
    const { ultimaSincronizacion } = useSincronizacion()
    const contexto = useContextoAuditoria()?.contexto ?? null

    // verificando | lista | sin-conexion | error
    const [estadoJornada, setEstadoJornada] = useState('verificando')
    const [errorJornada, setErrorJornada] = useState(null)
    const [intentoJornada, setIntentoJornada] = useState(0)

    const [bodegas, setBodegas] = useState([])
    const [codBodSeleccionado, setCodBodSeleccionado] = useState(contexto?.codBodSeleccionada ?? '')
    const [articulos, setArticulos] = useState([])
    const [claveArticuloSeleccionado, setClaveArticuloSeleccionado] = useState('')
    const [lotes, setLotes] = useState([])
    const [numLoteSeleccionado, setNumLoteSeleccionado] = useState('')
    const [cantidadFisica, setCantidadFisica] = useState('')
    const [observaciones, setObservaciones] = useState('')
    // HU-007: idempotenciaKey del conteo que se esta corrigiendo, o null si
    // la hoja esta en modo "registrar uno nuevo".
    const [corrigiendoIdempotenciaKey, setCorrigiendoIdempotenciaKey] = useState(null)

    const [guardando, setGuardando] = useState(false)
    const [mensajeExito, setMensajeExito] = useState('')
    const [errorFormulario, setErrorFormulario] = useState(null)
    const [conteosLocales, setConteosLocales] = useState([])
    // HU-032 criterio 3: filtro del resumen por estado. "Todos" por defecto.
    const [filtroEstado, setFiltroEstado] = useState('TODOS')
    // HU-027: busqueda por nombre o codigo, sobre la lista completa (no solo
    // lo pendiente) -- a diferencia de la version de produccion, aqui es una
    // sola lista con todo, asi que la busqueda aplica a todo por igual.
    const [busquedaArticulo, setBusquedaArticulo] = useState('')

    async function actualizarConteosLocales() {
        if (!usuario?.id) return
        const conteos = await obtenerConteosPendientes(usuario.id)
        setConteosLocales(conteos)
    }

    const pendientesSinSincronizar = conteosLocales.filter((conteo) => !conteo.sincronizado).length

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

    useEffect(() => {
        if (!usuario?.id) return
        let cancelado = false

        obtenerRuta(usuario.id).then((ruta) => {
            if (!cancelado) setBodegas(ruta)
        })
        actualizarConteosLocales()

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

    const bodegasVisibles = contexto ? bodegas.filter((bodega) => bodega.numCon === contexto.numCon) : bodegas
    const articulosVisibles = contexto
        ? articulos.filter((articulo) => articulo.numCon === contexto.numCon)
        : articulos
    const articuloSeleccionado = articulosVisibles.find(
        (articulo) => claveArticulo(articulo) === claveArticuloSeleccionado,
    )

    // HU-008/HU-026: resumen de avance, armado del lado del cliente
    // combinando el catalogo esperado (articulosVisibles, ya local) con lo
    // ya registrado localmente -- igual que VisitaController del lado del
    // backend para HU-008 (ver su javadoc), aqui con datos locales para que
    // funcione sin conexion (criterio 4).
    const conteosDeLaBodega = conteosLocales.filter((conteo) => conteo.codBod === codBodSeleccionado)
    const itemsTodos = articulosVisibles.map((articulo) => ({
        articulo,
        conteo: conteosDeLaBodega.find((conteo) => conteo.codArt === articulo.codArt && conteo.numCon === articulo.numCon),
    }))
    const articulosContados = itemsTodos.filter(({ conteo }) => conteo !== undefined)
    const articulosPendientes = itemsTodos.filter(({ conteo }) => conteo === undefined).map(({ articulo }) => articulo)
    // HU-032 criterio 1: "con diferencia" no incluye "no localizado" a
    // proposito -- esa marca explicita no existe todavia en ningun lado del
    // sistema (ver comentario de la version de produccion).
    const articulosConDiferencia = articulosContados.filter(
        ({ conteo }) => tipoDiferencia(conteo.cantidadTeorica, conteo.cantidadFisica) !== 'SIN_DIFERENCIA',
    )

    // HU-027 criterio 1: termino parcial contra nombre o codigo.
    const terminoBusqueda = normalizar(busquedaArticulo.trim())
    const itemsBuscados = terminoBusqueda
        ? itemsTodos.filter(
              ({ articulo }) =>
                  normalizar(articulo.desArt).includes(terminoBusqueda) || normalizar(articulo.codArt).includes(terminoBusqueda),
          )
        : itemsTodos

    // HU-032 criterio 3: el mismo filtro de los StatTile decide que queda
    // visible en la lista de abajo.
    const itemsFiltrados = itemsBuscados.filter(({ conteo }) => {
        if (filtroEstado === 'CONTADO') return conteo !== undefined
        if (filtroEstado === 'PENDIENTE') return conteo === undefined
        if (filtroEstado === 'CON_DIFERENCIA') {
            return conteo !== undefined && tipoDiferencia(conteo.cantidadTeorica, conteo.cantidadFisica) !== 'SIN_DIFERENCIA'
        }
        return true
    })

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
        setCorrigiendoIdempotenciaKey(null)
        setErrorFormulario(null)
    }

    // Toca un articulo pendiente: abre la hoja en modo "registrar uno nuevo".
    function tocarPendiente(articulo) {
        setMensajeExito('')
        setErrorFormulario(null)
        setClaveArticuloSeleccionado(claveArticulo(articulo))
        setNumLoteSeleccionado('')
        setCantidadFisica('')
        setObservaciones('')
        setCorrigiendoIdempotenciaKey(null)
    }

    // HU-007 criterio 1: toca un articulo ya contado (sin sincronizar) y
    // precarga la hoja con los valores actuales, para que solo se modifique
    // lo necesario. Uno ya sincronizado no se puede tocar en este prototipo
    // (ver el comentario de corregirConteoLocal).
    function tocarContado(articulo, conteo) {
        if (conteo.sincronizado) return
        setMensajeExito('')
        setErrorFormulario(null)
        setClaveArticuloSeleccionado(claveArticulo(articulo))
        setNumLoteSeleccionado(conteo.numLote ?? '')
        setCantidadFisica(conteo.cantidadFisica)
        setObservaciones(conteo.observaciones ?? '')
        setCorrigiendoIdempotenciaKey(conteo.idempotenciaKey)
    }

    async function manejarRegistrar(evento) {
        evento.preventDefault()
        setErrorFormulario(null)

        if (!codBodSeleccionado || !articuloSeleccionado) {
            setErrorFormulario('Completá bodega y artículo.')
            return
        }
        // HU-006 criterio 1: campo faltante senalado especificamente.
        if (cantidadFisica === '') {
            setErrorFormulario('La cantidad física es obligatoria.')
            return
        }
        // HU-006 criterio 2: no numerico -- type="number" ya bloquea la
        // mayoria de los casos en el navegador, pero no todos (pegar texto,
        // notacion rara), asi que se valida igual del lado de la app.
        if (Number.isNaN(Number(cantidadFisica))) {
            setErrorFormulario('La cantidad física debe ser un número positivo o cero.')
            return
        }
        if (Number(cantidadFisica) < 0) {
            setErrorFormulario('La cantidad física no puede ser negativa.')
            return
        }

        setGuardando(true)
        try {
            if (corrigiendoIdempotenciaKey) {
                // HU-007 criterio 2: mismo registro, no uno nuevo.
                await corregirConteoLocal(usuario.id, corrigiendoIdempotenciaKey, {
                    cantidadFisica: Number(cantidadFisica),
                    observaciones: observaciones || null,
                })
                limpiarFormularioDeConteo()
                setMensajeExito('Corrección guardada en este dispositivo.')
                await actualizarConteosLocales()
                return
            }

            await registrarConteoLocal(usuario.id, {
                codBod: codBodSeleccionado,
                codArt: articuloSeleccionado.codArt,
                numLote: numLoteSeleccionado || null,
                numCon: articuloSeleccionado.numCon ?? null,
                cantidadTeorica: articuloSeleccionado.cantidadTeorica,
                cantidadFisica: Number(cantidadFisica),
                observaciones: observaciones || null,
            })

            // HU-031 criterio 1/6: se traza en el mismo momento en que el
            // conteo se guarda localmente (no cuando se sincroniza), para que
            // la hora del registro sea la real, aunque todavia no haya señal.
            await registrarAccionLocal(usuario.id, {
                tipoAccion: 'CONTEO_REGISTRADO',
                codBod: codBodSeleccionado,
                resultado: 'EXITOSO',
                detalle: `${articuloSeleccionado.desArt ?? articuloSeleccionado.codArt}: ${cantidadFisica}`,
            })

            limpiarFormularioDeConteo()
            setMensajeExito('Conteo guardado en este dispositivo.')
            await actualizarConteosLocales()
        } catch {
            setErrorFormulario(
                corrigiendoIdempotenciaKey
                    ? 'No fue posible guardar la corrección en este dispositivo.'
                    : 'No fue posible guardar el conteo en este dispositivo.',
            )
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
                <Card className={styles.avisoWidget}>
                    <Icon name="alerta" size={22} />
                    <p role="status">Necesitás conexión para empezar a contar hoy.</p>
                </Card>
            </main>
        )
    }

    if (estadoJornada === 'error') {
        return (
            <main>
                <h1>Conteo</h1>
                <Card className={`${styles.avisoWidget} ${styles.avisoError}`}>
                    <Icon name="alerta" size={22} />
                    <p role="alert">{errorJornada}</p>
                </Card>
                <button type="button" className={styles.boton} onClick={() => setIntentoJornada((n) => n + 1)}>
                    Reintentar
                </button>
            </main>
        )
    }

    const sheetAbierto = claveArticuloSeleccionado !== ''

    return (
        <main>
            <div className={styles.cabecera}>
                <h1>Conteo</h1>
                {contexto && (
                    <span className={styles.chipContrato} data-testid="contrato-activo">
                        <Icon name="paquete" size={14} />
                        {contexto.objCon ? `${contexto.numCon} · ${contexto.objCon}` : contexto.numCon}
                    </span>
                )}
            </div>

            {pendientesSinSincronizar > 0 && (
                <p className={styles.pendientes}>
                    {pendientesSinSincronizar} conteo{pendientesSinSincronizar === 1 ? '' : 's'} todavía sin
                    sincronizar.
                </p>
            )}

            {mensajeExito && (
                <div className={styles.toastExito} role="status">
                    <Icon name="verificado" size={16} />
                    {mensajeExito}
                </div>
            )}

            {!codBodSeleccionado && (
                <div className={styles.grupo}>
                    <label htmlFor="conteo-bodega">Bodega</label>
                    <select
                        id="conteo-bodega"
                        value={codBodSeleccionado}
                        onChange={(evento) => {
                            setCodBodSeleccionado(evento.target.value)
                            setFiltroEstado('TODOS')
                            setBusquedaArticulo('')
                        }}
                        className={styles.selectBodega}
                    >
                        <option value="">Seleccioná una bodega</option>
                        {bodegasVisibles.map((bodega) => (
                            <option key={bodega.codBod} value={bodega.codBod}>
                                {bodega.desBod}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {codBodSeleccionado && (
                <>
                    {!contexto && bodegasVisibles.length > 1 && (
                        <div className={styles.grupo}>
                            <label htmlFor="conteo-bodega">Bodega</label>
                            <select
                                id="conteo-bodega"
                                value={codBodSeleccionado}
                                onChange={(evento) => {
                                    setCodBodSeleccionado(evento.target.value)
                                    setFiltroEstado('TODOS')
                                    setBusquedaArticulo('')
                                }}
                                className={styles.selectBodega}
                            >
                                {bodegasVisibles.map((bodega) => (
                                    <option key={bodega.codBod} value={bodega.codBod}>
                                        {bodega.desBod}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* HU-008/HU-026/HU-032: cada tile es a la vez una cifra y
                        un filtro -- tocarlo acota la lista de abajo. */}
                    <div className={styles.tiles} role="group" aria-label="Filtrar por estado">
                        <StatTile
                            icono="paquete"
                            valor={itemsTodos.length}
                            etiqueta="Todos"
                            tono="primario"
                            activo={filtroEstado === 'TODOS'}
                            onClick={() => setFiltroEstado('TODOS')}
                        />
                        <StatTile
                            icono="verificado"
                            valor={articulosContados.length}
                            etiqueta="Contados"
                            tono="exito"
                            activo={filtroEstado === 'CONTADO'}
                            onClick={() => setFiltroEstado('CONTADO')}
                        />
                        <StatTile
                            icono="alerta"
                            valor={articulosPendientes.length}
                            etiqueta="Pendientes"
                            tono="advertencia"
                            activo={filtroEstado === 'PENDIENTE'}
                            onClick={() => setFiltroEstado('PENDIENTE')}
                        />
                        <StatTile
                            icono="alerta"
                            valor={articulosConDiferencia.length}
                            etiqueta="Con diferencia"
                            tono="peligro"
                            activo={filtroEstado === 'CON_DIFERENCIA'}
                            onClick={() => setFiltroEstado('CON_DIFERENCIA')}
                        />
                    </div>

                    <SearchInput
                        value={busquedaArticulo}
                        onChange={setBusquedaArticulo}
                        placeholder="Buscar por nombre o código..."
                        className={styles.busqueda}
                    />

                    {terminoBusqueda && itemsFiltrados.length === 0 ? (
                        <p className={styles.pendientes}>No se encontraron resultados</p>
                    ) : (
                        <ul className={styles.listaArticulos}>
                            {itemsFiltrados.map(({ articulo, conteo }) => {
                                const tipo = conteo ? tipoDiferencia(conteo.cantidadTeorica, conteo.cantidadFisica) : null
                                const editable = !conteo || !conteo.sincronizado
                                return (
                                    <li key={claveArticulo(articulo)}>
                                        <Card
                                            as="button"
                                            type="button"
                                            interactive={editable}
                                            className={styles.tarjetaArticulo}
                                            onClick={() => (conteo ? tocarContado(articulo, conteo) : tocarPendiente(articulo))}
                                            disabled={!editable}
                                        >
                                            <span className={styles.infoArticulo}>
                                                <span className={styles.nombreArticulo}>{articulo.desArt}</span>
                                                <span className={styles.metaArticulo}>
                                                    Teórico: {articulo.cantidadTeorica}
                                                    {conteo && ` · Contado: ${conteo.cantidadFisica}`}
                                                </span>
                                            </span>
                                            <span className={styles.estadoArticulo}>
                                                {conteo ? (
                                                    <>
                                                        {/* Icono de alerta solo cuando SI hay diferencia -- SIEMPRE
                                                            rojo a proposito (no sigue el tono de la insignia):
                                                            es la señal de "esto es un hallazgo" que mas resalta,
                                                            mientras el texto/color de la insignia sigue
                                                            distinguiendo Faltante de Sobrante. */}
                                                        {tipo !== 'SIN_DIFERENCIA' && (
                                                            <Icon name="alerta" size={16} className={styles.iconoAlerta} />
                                                        )}
                                                        <StatusBadge tono={TONO_TIPO_DIFERENCIA[tipo]}>
                                                            {ETIQUETA_TIPO_DIFERENCIA[tipo]}
                                                        </StatusBadge>
                                                    </>
                                                ) : (
                                                    <StatusBadge tono="advertencia">Pendiente</StatusBadge>
                                                )}
                                                {editable && <Icon name="chevronDerecha" size={18} className={styles.chevron} />}
                                            </span>
                                        </Card>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </>
            )}

            {sheetAbierto && (
                <BottomSheet
                    titulo={corrigiendoIdempotenciaKey ? 'Corregir conteo' : (articuloSeleccionado?.desArt ?? 'Registrar conteo')}
                    onCerrar={limpiarFormularioDeConteo}
                >
                    <form className={styles.formularioHoja} onSubmit={manejarRegistrar} noValidate>
                        {articuloSeleccionado?.indicadorLote && (
                            <div className={styles.grupo}>
                                <span id="conteo-lote-etiqueta">Lote</span>
                                <div
                                    className={styles.pildorasLote}
                                    role="group"
                                    aria-labelledby="conteo-lote-etiqueta"
                                >
                                    {lotes.map((lote) => (
                                        <button
                                            key={lote.numLote}
                                            type="button"
                                            className={styles.pildoraLote}
                                            aria-pressed={numLoteSeleccionado === lote.numLote}
                                            onClick={() => setNumLoteSeleccionado(lote.numLote)}
                                        >
                                            {lote.numLote} · vence {lote.fechaVencimiento ?? 'sin fecha'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className={styles.grupo}>
                            <label htmlFor="conteo-cantidad">Cantidad física</label>
                            <Stepper id="conteo-cantidad" value={cantidadFisica} onChange={setCantidadFisica} min={0} />
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

                        <div className={styles.accionesHoja}>
                            <button type="button" className={styles.botonCancelar} onClick={limpiarFormularioDeConteo}>
                                {corrigiendoIdempotenciaKey ? 'Cancelar corrección' : 'Cancelar'}
                            </button>
                            <button type="submit" className={styles.boton} disabled={guardando}>
                                {guardando ? 'Guardando…' : corrigiendoIdempotenciaKey ? 'Guardar corrección' : 'Registrar conteo'}
                            </button>
                        </div>
                    </form>
                </BottomSheet>
            )}
        </main>
    )
}
