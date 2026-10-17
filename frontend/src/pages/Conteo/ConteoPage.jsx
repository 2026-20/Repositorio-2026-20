import { useEffect, useState } from 'react'

import SearchInput from '../../components/ui/SearchInput'
import StatusBadge from '../../components/ui/StatusBadge'
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

// Un mismo codArt puede repetirse en la misma bodega bajo dos contratos
// distintos (ver datosMaestrosRepositorio.js, el mismo caso real que
// "MEPRIN" para bodegas) -- codArt solo no alcanza para identificar una
// opcion del selector sin ambiguedad, hace falta tambien numCon.
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

const TONO_TIPO_DIFERENCIA = {
    FALTANTE: 'peligro',
    SOBRANTE: 'advertencia',
    SIN_DIFERENCIA: 'exito',
}

const ETIQUETA_TIPO_DIFERENCIA = {
    FALTANTE: 'Faltante',
    SOBRANTE: 'Sobrante',
    SIN_DIFERENCIA: 'Sin diferencia',
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
    // HU-004: si hay un contrato activo (elegido en Mi ruta), solo se cuenta
    // dentro de ese contrato, y la bodega elegida alli llega ya seleccionada.
    // Sin contrato activo la pantalla funciona igual que antes.
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
    // el formulario esta en modo "registrar uno nuevo" (el de siempre).
    const [corrigiendoIdempotenciaKey, setCorrigiendoIdempotenciaKey] = useState(null)

    const [guardando, setGuardando] = useState(false)
    // Guarda el texto de exito (no un boolean): HU-007 necesita un mensaje
    // distinto al de registrar, y para cuando se muestra ya se limpio
    // corrigiendoIdempotenciaKey (limpiarFormularioDeConteo), asi que no se
    // puede derivar de ese estado en el render.
    const [mensajeExito, setMensajeExito] = useState('')
    const [errorFormulario, setErrorFormulario] = useState(null)
    // HU-008/HU-026: todos los conteos locales del usuario (sincronizados o
    // no) -- de aqui salen tanto el contador de "sin sincronizar" como el
    // resumen de avance (contados/pendientes) de la bodega activa. Una sola
    // lectura local para los dos usos, no dos.
    const [conteosLocales, setConteosLocales] = useState([])
    // HU-032 criterio 3: filtro del resumen por estado. "Todos" por defecto.
    const [filtroEstado, setFiltroEstado] = useState('TODOS')
    // HU-027: busqueda por nombre o codigo. Por lote queda fuera a proposito
    // -- los lotes de la bodega se cargan recien al elegir un articulo con
    // indicador de lote (ver el useEffect de obtenerLotesBodega), no antes;
    // buscar por lote necesitaria cargarlos todos por adelantado, que es un
    // cambio de carga de datos aparte, no solo de este formulario.
    const [busquedaArticulo, setBusquedaArticulo] = useState('')

    async function actualizarConteosLocales() {
        if (!usuario?.id) return
        const conteos = await obtenerConteosPendientes(usuario.id)
        setConteosLocales(conteos)
    }

    const pendientesSinSincronizar = conteosLocales.filter((conteo) => !conteo.sincronizado).length

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

    // HU-027 criterio 1: termino parcial contra nombre o codigo, dentro del
    // contexto activo (articulosVisibles ya esta acotado a ese contexto).
    const terminoBusqueda = normalizar(busquedaArticulo.trim())
    const articulosFiltrados = terminoBusqueda
        ? articulosVisibles.filter(
              (articulo) =>
                  normalizar(articulo.desArt).includes(terminoBusqueda) ||
                  normalizar(articulo.codArt).includes(terminoBusqueda),
          )
        : articulosVisibles

    // HU-008/HU-026: resumen de avance de la bodega activa, armado del lado
    // del cliente combinando el catalogo esperado (articulosVisibles, ya
    // local) con lo que ya se registro localmente -- igual que hace
    // VisitaController del lado del backend para HU-008 (ver su javadoc),
    // pero aqui con datos locales para que funcione sin conexion (criterio 4).
    const conteosDeLaBodega = conteosLocales.filter((conteo) => conteo.codBod === codBodSeleccionado)
    const articulosContados = articulosVisibles
        .map((articulo) => ({
            articulo,
            conteo: conteosDeLaBodega.find(
                (conteo) => conteo.codArt === articulo.codArt && conteo.numCon === articulo.numCon,
            ),
        }))
        .filter(({ conteo }) => conteo !== undefined)
    const articulosPendientes = articulosVisibles.filter(
        (articulo) =>
            !conteosDeLaBodega.some(
                (conteo) => conteo.codArt === articulo.codArt && conteo.numCon === articulo.numCon,
            ),
    )

    // HU-032: mismo resumen de HU-008, agrupado tambien por "con diferencia"
    // (contado pero con faltante o sobrante) -- no incluye "no localizado"
    // a proposito: esa es una marca explicita que el usuario tendria que
    // poder hacer ("busque y no esta"), y hoy no existe esa interaccion en
    // ningun lado del sistema; agregarla es una HU aparte, no un derivado
    // de datos que ya existen (como si lo son contado/pendiente/diferencia).
    const articulosConDiferencia = articulosContados.filter(
        ({ conteo }) => tipoDiferencia(conteo.cantidadTeorica, conteo.cantidadFisica) !== 'SIN_DIFERENCIA',
    )

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
    }

    // HU-007 criterio 1: precarga el formulario con los valores actuales del
    // registro, para que el usuario solo modifique lo necesario.
    function iniciarCorreccion(articulo, conteo) {
        setErrorFormulario(null)
        setMensajeExito('')
        setClaveArticuloSeleccionado(claveArticulo(articulo))
        setNumLoteSeleccionado(conteo.numLote ?? '')
        setCantidadFisica(conteo.cantidadFisica)
        setObservaciones(conteo.observaciones ?? '')
        setCorrigiendoIdempotenciaKey(conteo.idempotenciaKey)
    }

    async function manejarRegistrar(evento) {
        evento.preventDefault()
        setErrorFormulario(null)
        setMensajeExito('')

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
                setMensajeExito('Corrección guardada en este dispositivo.')
                limpiarFormularioDeConteo()
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

            setMensajeExito('Conteo guardado en este dispositivo.')
            limpiarFormularioDeConteo()
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

            {contexto && (
                <p className={styles.pendientes} data-testid="contrato-activo">
                    Contrato activo: {contexto.objCon ? `${contexto.numCon} · ${contexto.objCon}` : contexto.numCon}
                </p>
            )}

            {pendientesSinSincronizar > 0 && (
                <p className={styles.pendientes}>
                    {pendientesSinSincronizar} conteo{pendientesSinSincronizar === 1 ? '' : 's'} todavía sin
                    sincronizar.
                </p>
            )}

            {/* HU-008/HU-026: resumen de avance de la bodega activa -- misma
                señal para "cuanto llevo" (HU-008) y para "que me falta al
                retomar" (HU-026 criterio 2, reanudar). */}
            {codBodSeleccionado && (
                <section className={styles.resumen} aria-label="Resumen de avance">
                    <h2 className={styles.tituloResumen}>
                        Avance: {articulosContados.length} contado{articulosContados.length === 1 ? '' : 's'},{' '}
                        {articulosPendientes.length} pendiente{articulosPendientes.length === 1 ? '' : 's'}
                    </h2>

                    {/* HU-032 criterio 1/3: cada estado con su color (via
                        StatusBadge) y, al tocarlo, filtra el detalle de abajo. */}
                    <div className={styles.filtrosEstado} role="group" aria-label="Filtrar por estado">
                        {[
                            { valor: 'TODOS', etiqueta: 'Todos', tono: 'primario', cantidad: articulosVisibles.length },
                            { valor: 'CONTADO', etiqueta: 'Contados', tono: 'exito', cantidad: articulosContados.length },
                            {
                                valor: 'PENDIENTE',
                                etiqueta: 'Pendientes',
                                tono: 'advertencia',
                                cantidad: articulosPendientes.length,
                            },
                            {
                                valor: 'CON_DIFERENCIA',
                                etiqueta: 'Con diferencia',
                                tono: 'peligro',
                                cantidad: articulosConDiferencia.length,
                            },
                        ].map((opcion) => (
                            <button
                                key={opcion.valor}
                                type="button"
                                aria-pressed={filtroEstado === opcion.valor}
                                className={styles.chipEstado}
                                onClick={() => setFiltroEstado(opcion.valor)}
                            >
                                <StatusBadge tono={opcion.tono}>
                                    {opcion.etiqueta} ({opcion.cantidad})
                                </StatusBadge>
                            </button>
                        ))}
                    </div>

                    {(filtroEstado === 'TODOS' || filtroEstado === 'CONTADO' || filtroEstado === 'CON_DIFERENCIA') &&
                        (filtroEstado === 'CON_DIFERENCIA' ? articulosConDiferencia : articulosContados).length >
                            0 && (
                            <ul className={styles.listaResumen}>
                                {(filtroEstado === 'CON_DIFERENCIA' ? articulosConDiferencia : articulosContados).map(
                                    ({ articulo, conteo }) => {
                                        const tipo = tipoDiferencia(conteo.cantidadTeorica, conteo.cantidadFisica)
                                        return (
                                            <li key={claveArticulo(articulo)}>
                                                <span>{articulo.desArt}</span>
                                                <span>{conteo.cantidadFisica}</span>
                                                <StatusBadge tono={TONO_TIPO_DIFERENCIA[tipo]}>
                                                    {ETIQUETA_TIPO_DIFERENCIA[tipo]}
                                                </StatusBadge>
                                                {/* HU-007: solo se puede corregir mientras no se haya
                                                    sincronizado -- corregir uno ya sincronizado necesita
                                                    el endpoint del backend, fuera de este prototipo (ver
                                                    el comentario de corregirConteoLocal). */}
                                                {!conteo.sincronizado && (
                                                    <button
                                                        type="button"
                                                        className={styles.botonCorregir}
                                                        onClick={() => iniciarCorreccion(articulo, conteo)}
                                                    >
                                                        Corregir
                                                    </button>
                                                )}
                                            </li>
                                        )
                                    },
                                )}
                            </ul>
                        )}

                    {(filtroEstado === 'TODOS' || filtroEstado === 'PENDIENTE') && articulosPendientes.length > 0 && (
                        <ul className={styles.listaResumen}>
                            {articulosPendientes.map((articulo) => (
                                <li key={claveArticulo(articulo)}>
                                    <span>{articulo.desArt}</span>
                                    <StatusBadge tono="advertencia">Pendiente</StatusBadge>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
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
                            setFiltroEstado('TODOS')
                            setBusquedaArticulo('')
                        }}
                    >
                        <option value="">Seleccioná una bodega</option>
                        {bodegasVisibles.map((bodega) => (
                            <option key={bodega.codBod} value={bodega.codBod}>
                                {bodega.desBod}
                            </option>
                        ))}
                    </select>
                </div>

                <div className={styles.grupo}>
                    <label htmlFor="conteo-articulo">Artículo</label>
                    {codBodSeleccionado && (
                        <SearchInput
                            value={busquedaArticulo}
                            onChange={setBusquedaArticulo}
                            placeholder="Buscar por nombre o código..."
                        />
                    )}
                    {terminoBusqueda && articulosFiltrados.length === 0 ? (
                        <p className={styles.pendientes}>No se encontraron resultados</p>
                    ) : (
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
                            {articulosFiltrados.map((articulo) => (
                                <option key={claveArticulo(articulo)} value={claveArticulo(articulo)}>
                                    {articulo.desArt} (teórico: {articulo.cantidadTeorica})
                                </option>
                            ))}
                        </select>
                    )}
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
                        {mensajeExito}
                    </div>
                )}

                {corrigiendoIdempotenciaKey && (
                    <p className={styles.pendientes} role="status">
                        Corrigiendo un conteo ya registrado.
                    </p>
                )}

                <button type="submit" className={styles.boton} disabled={guardando}>
                    {guardando ? 'Guardando…' : corrigiendoIdempotenciaKey ? 'Guardar corrección' : 'Registrar conteo'}
                </button>

                {corrigiendoIdempotenciaKey && (
                    <button type="button" className={styles.botonCorregir} onClick={limpiarFormularioDeConteo}>
                        Cancelar corrección
                    </button>
                )}
            </form>
        </main>
    )
}
