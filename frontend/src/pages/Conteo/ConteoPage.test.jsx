import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../../context/AuthContext'
import { ContextoAuditoriaContext } from '../../context/ContextoAuditoriaContext'
import { SincronizacionContext } from '../../context/SincronizacionContext'
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
import ConteoPage from './ConteoPage'

vi.mock('../../services/auditoriaService.js', () => ({
    iniciarJornada: vi.fn(),
}))

vi.mock('../../storage/conteosPendientesRepositorio.js', () => ({
    estaJornadaIniciadaHoy: vi.fn(),
    guardarJornadaIniciada: vi.fn(),
    obtenerConteosPendientes: vi.fn(),
    registrarConteoLocal: vi.fn(),
    corregirConteoLocal: vi.fn(),
}))

vi.mock('../../storage/trazabilidadRepositorio.js', () => ({
    registrarAccionLocal: vi.fn(),
}))

vi.mock('../../storage/datosMaestrosRepositorio.js', () => ({
    obtenerRuta: vi.fn(),
    obtenerDetalleBodega: vi.fn(),
    obtenerLotesBodega: vi.fn(),
}))

const BODEGA = { codBod: 'MEPRIN', desBod: 'Bodega Principal', numCon: '123' }

const ARTICULO_SIN_LOTE = {
    codArt: 'ART1',
    desArt: 'Articulo sin lote',
    cantidadTeorica: '10',
    indicadorLote: false,
    numCon: '123',
    cantidadMinima: null,
}

const ARTICULO_CON_LOTE = {
    codArt: 'ART2',
    desArt: 'Articulo con lote',
    cantidadTeorica: '5',
    indicadorLote: true,
    numCon: '123',
    cantidadMinima: null,
}

function renderPagina(ultimaSincronizacion = '2026-10-08T10:00:00.000Z') {
    return render(
        <AuthContext.Provider value={{ usuario: { id: 7 }, token: 'jwt-prueba' }}>
            <SincronizacionContext.Provider
                value={{ estado: 'listo', error: null, ultimaSincronizacion, sincronizar: vi.fn() }}
            >
                <ConteoPage />
            </SincronizacionContext.Provider>
        </AuthContext.Provider>,
    )
}

describe('ConteoPage', () => {
    beforeEach(() => {
        obtenerConteosPendientes.mockResolvedValue([])
        obtenerRuta.mockResolvedValue([BODEGA])
        obtenerDetalleBodega.mockResolvedValue([ARTICULO_SIN_LOTE, ARTICULO_CON_LOTE])
        obtenerLotesBodega.mockResolvedValue([
            { codArt: 'ART2', numLote: 'L1', fechaVencimiento: '2027-01-01', cantidad: '5' },
        ])
        // La jornada ya estaba confirmada: la mayoria de las pruebas de aqui
        // son del formulario de conteo en si, no de HU-038 -- ver el
        // describe de abajo para los 4 estados del aseguramiento silencioso.
        estaJornadaIniciadaHoy.mockResolvedValue(true)
        // HU-031: no es el foco de estas pruebas, solo necesita no rechazar.
        registrarAccionLocal.mockResolvedValue('id-trazabilidad-generado')
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('registra un conteo sin lote (criterio 1) y lo guarda solo localmente', async () => {
        registrarConteoLocal.mockResolvedValue('clave-generada')
        renderPagina()

        fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
        await screen.findByText('Articulo sin lote (teórico: 10)')
        fireEvent.change(screen.getByLabelText('Artículo'), { target: { value: 'ART1::123' } })
        fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '8' } })
        fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

        await waitFor(() => {
            expect(registrarConteoLocal).toHaveBeenCalledWith(7, {
                codBod: 'MEPRIN',
                codArt: 'ART1',
                numLote: null,
                numCon: '123',
                cantidadTeorica: '10',
                cantidadFisica: 8,
                observaciones: null,
            })
        })
        expect(screen.getByRole('status')).toHaveTextContent('Conteo guardado en este dispositivo')

        // HU-031: el conteo tambien queda trazado localmente.
        expect(registrarAccionLocal).toHaveBeenCalledWith(7, {
            tipoAccion: 'CONTEO_REGISTRADO',
            codBod: 'MEPRIN',
            resultado: 'EXITOSO',
            detalle: 'Articulo sin lote: 8',
        })
    })

    // HU-005 criterio 2: cantidad fisica en cero es valida -- "auditado sin
    // unidades encontradas", no un campo vacio ni un error.
    it('HU-005: acepta una cantidad fisica en cero como un conteo valido', async () => {
        registrarConteoLocal.mockResolvedValue('clave-generada')
        renderPagina()

        fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
        await screen.findByText('Articulo sin lote (teórico: 10)')
        fireEvent.change(screen.getByLabelText('Artículo'), { target: { value: 'ART1::123' } })
        fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '0' } })
        fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

        await waitFor(() => {
            expect(registrarConteoLocal).toHaveBeenCalledWith(7, expect.objectContaining({ cantidadFisica: 0 }))
        })
        expect(screen.getByRole('status')).toHaveTextContent('Conteo guardado en este dispositivo')
    })

    // HU-028 criterios 1-3: la observacion es opcional, viaja junto al
    // registro cuando se completa, y usa el mismo guardado local (OPFS) que
    // el resto del conteo -- no hay manejo especial para "sin conexion".
    it('HU-028: una observacion completada queda vinculada al registro', async () => {
        registrarConteoLocal.mockResolvedValue('clave-generada')
        renderPagina()

        fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
        await screen.findByText('Articulo sin lote (teórico: 10)')
        fireEvent.change(screen.getByLabelText('Artículo'), { target: { value: 'ART1::123' } })
        fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '8' } })
        fireEvent.change(screen.getByLabelText('Observaciones'), {
            target: { value: 'Caja golpeada, se cuenta igual.' },
        })
        fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

        await waitFor(() => {
            expect(registrarConteoLocal).toHaveBeenCalledWith(
                7,
                expect.objectContaining({ observaciones: 'Caja golpeada, se cuenta igual.' }),
            )
        })
    })

    it('distingue dos articulos con el mismo codArt bajo contratos distintos', async () => {
        const articuloContratoA = { ...ARTICULO_SIN_LOTE, numCon: 'A' }
        const articuloContratoB = { ...ARTICULO_SIN_LOTE, numCon: 'B', cantidadTeorica: '99' }
        obtenerDetalleBodega.mockResolvedValue([articuloContratoA, articuloContratoB])
        registrarConteoLocal.mockResolvedValue('clave-generada')
        renderPagina()

        fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
        await screen.findByText('Articulo sin lote (teórico: 99)')
        fireEvent.change(screen.getByLabelText('Artículo'), { target: { value: 'ART1::B' } })
        fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '1' } })
        fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

        await waitFor(() => {
            expect(registrarConteoLocal).toHaveBeenCalledWith(
                7,
                expect.objectContaining({ numCon: 'B', cantidadTeorica: '99' }),
            )
        })
    })

    it('pide el lote solo si el articulo lo requiere, y lo incluye al registrar', async () => {
        registrarConteoLocal.mockResolvedValue('clave-generada')
        renderPagina()

        fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
        expect(screen.queryByLabelText('Lote')).not.toBeInTheDocument()
        await screen.findByText('Articulo con lote (teórico: 5)')

        fireEvent.change(screen.getByLabelText('Artículo'), { target: { value: 'ART2::123' } })
        expect(await screen.findByLabelText('Lote')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Lote'), { target: { value: 'L1' } })
        fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '4' } })
        fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

        await waitFor(() => {
            expect(registrarConteoLocal).toHaveBeenCalledWith(7, expect.objectContaining({ numLote: 'L1' }))
        })
    })

    it('rechaza una cantidad fisica negativa sin guardar nada', async () => {
        renderPagina()

        fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
        await screen.findByText('Articulo sin lote (teórico: 10)')
        fireEvent.change(screen.getByLabelText('Artículo'), { target: { value: 'ART1::123' } })
        fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '-1' } })
        fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

        expect(await screen.findByRole('alert')).toHaveTextContent('no puede ser negativa')
        expect(registrarConteoLocal).not.toHaveBeenCalled()
    })

    // HU-006 criterio 1: campo faltante senalado especificamente (no el
    // mensaje generico de "completa bodega y articulo").
    it('HU-006: si falta la cantidad fisica, senala ese campo puntualmente', async () => {
        renderPagina()

        fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
        await screen.findByText('Articulo sin lote (teórico: 10)')
        fireEvent.change(screen.getByLabelText('Artículo'), { target: { value: 'ART1::123' } })
        fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

        expect(await screen.findByRole('alert')).toHaveTextContent('La cantidad física es obligatoria.')
        expect(registrarConteoLocal).not.toHaveBeenCalled()
    })

    // HU-006 criterio 2 (valor no numerico): no hay prueba de interaccion
    // para esto. Un input type="number" (tanto en navegador real como en
    // jsdom) sanea cualquier valor no parseable a "" antes de que React lo
    // vea -- fireEvent.change con 'abc' termina en cantidadFisica === '',
    // el mismo caso que el criterio 1, nunca en un valor no numerico real.
    // El guard Number.isNaN() en manejarRegistrar queda como defensa
    // adicional (ver comentario ahi), pero no es alcanzable por esta via.

    it('muestra cuantos conteos siguen sin sincronizar', async () => {
        obtenerConteosPendientes.mockResolvedValue([
            { idempotenciaKey: 'a', sincronizado: false },
            { idempotenciaKey: 'b', sincronizado: true },
        ])
        renderPagina()

        expect(await screen.findByText('1 conteo todavía sin sincronizar.')).toBeInTheDocument()
    })

    // Bug real encontrado probando en un navegador real (Cypress): la
    // descarga automatica de AppLayout corre en paralelo a esta pantalla,
    // no antes de que monte. Si la ruta solo se leyera una vez al montar
    // (dependiendo solo de usuario.id), un usuario nuevo veria la bodega
    // vacia para siempre, aunque la sincronizacion haya terminado un
    // instante despues.
    it('vuelve a leer la ruta cuando termina una sincronizacion que arranco despues de montar', async () => {
        obtenerRuta.mockResolvedValueOnce([]).mockResolvedValueOnce([BODEGA])
        const { rerender } = render(
            <AuthContext.Provider value={{ usuario: { id: 7 }, token: 'jwt-prueba' }}>
                <SincronizacionContext.Provider
                    value={{ estado: 'sincronizando', error: null, ultimaSincronizacion: null, sincronizar: vi.fn() }}
                >
                    <ConteoPage />
                </SincronizacionContext.Provider>
            </AuthContext.Provider>,
        )

        await waitFor(() => expect(obtenerRuta).toHaveBeenCalledTimes(1))
        expect(screen.queryByText('Bodega Principal')).not.toBeInTheDocument()

        rerender(
            <AuthContext.Provider value={{ usuario: { id: 7 }, token: 'jwt-prueba' }}>
                <SincronizacionContext.Provider
                    value={{
                        estado: 'listo',
                        error: null,
                        ultimaSincronizacion: '2026-10-08T10:00:00.000Z',
                        sincronizar: vi.fn(),
                    }}
                >
                    <ConteoPage />
                </SincronizacionContext.Provider>
            </AuthContext.Provider>,
        )

        expect(await screen.findByText('Bodega Principal')).toBeInTheDocument()
    })

    // HU-038: sin pantalla, sin dialogo, sin estado compartido -- esta
    // pantalla simplemente se asegura de que la jornada de hoy quede
    // confirmada antes de mostrar el formulario, sin pedirle nada al
    // usuario (ver el comentario al inicio de ConteoPage.jsx).
    describe('aseguramiento silencioso de jornada', () => {
        it('si la jornada ya estaba confirmada localmente, muestra el formulario sin llamar a iniciarJornada', async () => {
            renderPagina()

            await screen.findByLabelText('Bodega')
            expect(iniciarJornada).not.toHaveBeenCalled()
        })

        it('si no estaba confirmada y hay conexion, la confirma en silencio antes de mostrar el formulario', async () => {
            estaJornadaIniciadaHoy.mockResolvedValue(false)
            iniciarJornada.mockResolvedValue({ iniciada: true, iniciadaEn: '2026-10-08T08:00:00.000Z' })

            renderPagina()

            await screen.findByLabelText('Bodega')
            expect(iniciarJornada).toHaveBeenCalledWith('jwt-prueba')
            expect(guardarJornadaIniciada).toHaveBeenCalledWith(7, '2026-10-08T08:00:00.000Z')
        })

        it('si no estaba confirmada y no hay conexion, avisa en vez de mostrar el formulario', async () => {
            estaJornadaIniciadaHoy.mockResolvedValue(false)
            vi.stubGlobal('navigator', { ...navigator, onLine: false })

            renderPagina()

            expect(await screen.findByText('Necesitás conexión para empezar a contar hoy.')).toBeInTheDocument()
            expect(iniciarJornada).not.toHaveBeenCalled()
            expect(screen.queryByLabelText('Bodega')).not.toBeInTheDocument()
        })

        it('si falla la confirmacion, muestra el error con boton de reintentar', async () => {
            estaJornadaIniciadaHoy.mockResolvedValue(false)
            iniciarJornada.mockRejectedValue(new Error('No fue posible completar la solicitud'))

            renderPagina()

            expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible completar la solicitud')
            expect(screen.queryByLabelText('Bodega')).not.toBeInTheDocument()

            iniciarJornada.mockResolvedValue({ iniciada: true, iniciadaEn: '2026-10-08T08:00:00.000Z' })
            fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

            await screen.findByLabelText('Bodega')
            expect(iniciarJornada).toHaveBeenCalledTimes(2)
        })
    })

    // HU-008 (resumen de avance) / HU-026 criterio 2 (reanudar: ver que ya
    // se conto y que falta). Mismo calculo, misma pantalla.
    describe('resumen de avance de la bodega (HU-008/HU-026)', () => {
        it('HU-008 criterio 1/3: distingue contados de pendientes al seleccionar una bodega', async () => {
            obtenerConteosPendientes.mockResolvedValue([
                {
                    idempotenciaKey: 'ya-contado',
                    codBod: 'MEPRIN',
                    codArt: 'ART1',
                    numCon: '123',
                    cantidadTeorica: '10',
                    cantidadFisica: '10',
                    sincronizado: true,
                },
            ])
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })

            expect(await screen.findByText('Avance: 1 contado, 1 pendiente')).toBeInTheDocument()
            expect(screen.getByText('Sin diferencia')).toBeInTheDocument()
            expect(screen.getAllByText('Pendiente')).toHaveLength(1)
        })

        // HU-030 tal cual se ve en el resumen: fisica < teorica -> Faltante.
        it('muestra "Faltante" cuando la cantidad fisica contada es menor que la teorica', async () => {
            obtenerConteosPendientes.mockResolvedValue([
                {
                    idempotenciaKey: 'ya-contado',
                    codBod: 'MEPRIN',
                    codArt: 'ART1',
                    numCon: '123',
                    cantidadTeorica: '10',
                    cantidadFisica: '7',
                    sincronizado: true,
                },
            ])
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })

            expect(await screen.findByText('Faltante')).toBeInTheDocument()
        })

        // HU-008 criterio 2: el resumen refleja un conteo nuevo sin recargar
        // la pantalla -- es el mismo estado de React que ya se actualiza
        // tras registrar.
        it('HU-008 criterio 2: el resumen se actualiza al registrar un conteo, sin recargar', async () => {
            obtenerConteosPendientes.mockResolvedValue([])
            registrarConteoLocal.mockResolvedValue('clave-generada')
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            expect(await screen.findByText('Avance: 0 contados, 2 pendientes')).toBeInTheDocument()

            obtenerConteosPendientes.mockResolvedValue([
                {
                    idempotenciaKey: 'nuevo',
                    codBod: 'MEPRIN',
                    codArt: 'ART1',
                    numCon: '123',
                    cantidadTeorica: '10',
                    cantidadFisica: '8',
                    sincronizado: false,
                },
            ])
            fireEvent.change(screen.getByLabelText('Artículo'), { target: { value: 'ART1::123' } })
            fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '8' } })
            fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

            expect(await screen.findByText('Avance: 1 contado, 1 pendiente')).toBeInTheDocument()
        })
    })

    // HU-032: agrupado por estado, con filtro clickeable.
    describe('cantidad de reactivos por estado (HU-032)', () => {
        function conteos() {
            return [
                {
                    idempotenciaKey: 'sin-diferencia',
                    codBod: 'MEPRIN',
                    codArt: 'ART1',
                    numCon: '123',
                    cantidadTeorica: '10',
                    cantidadFisica: '10',
                    sincronizado: true,
                },
                {
                    idempotenciaKey: 'con-diferencia',
                    codBod: 'MEPRIN',
                    codArt: 'ART2',
                    numCon: '123',
                    cantidadTeorica: '5',
                    cantidadFisica: '3',
                    sincronizado: true,
                },
            ]
        }

        // HU-032 criterio 1: cada estado con su cantidad -- incluido "con
        // diferencia" como categoria propia, distinta de "contados" en general.
        it('muestra los 4 filtros con la cantidad de cada estado', async () => {
            obtenerConteosPendientes.mockResolvedValue(conteos())
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })

            expect(await screen.findByText('Todos (2)')).toBeInTheDocument()
            expect(screen.getByText('Contados (2)')).toBeInTheDocument()
            expect(screen.getByText('Pendientes (0)')).toBeInTheDocument()
            expect(screen.getByText('Con diferencia (1)')).toBeInTheDocument()
        })

        // HU-032 criterio 3: seleccionar un estado filtra el detalle.
        it('al tocar "Con diferencia" solo queda visible el articulo con diferencia', async () => {
            obtenerConteosPendientes.mockResolvedValue(conteos())
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Articulo con lote (teórico: 5)')

            fireEvent.click(screen.getByText('Con diferencia (1)'))

            expect(screen.getByText('Articulo con lote')).toBeInTheDocument()
            expect(screen.queryByText('Articulo sin lote')).not.toBeInTheDocument()
        })
    })

    // HU-027: busqueda por nombre o codigo, sobre el catalogo ya local
    // (criterio 3 sin conexion: no agrega ninguna llamada nueva al backend).
    describe('buscar articulo (HU-027)', () => {
        it('HU-027 criterio 1: un termino parcial, sin tildes/mayusculas, filtra por nombre', async () => {
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Articulo con lote (teórico: 5)')

            // "CON LOTE" (no solo "lote"): ambos articulos de prueba
            // contienen la palabra "lote" en el nombre ("Articulo con lote"
            // / "Articulo sin lote") -- la frase completa si distingue.
            fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o código...'), {
                target: { value: 'CON LOTE' },
            })

            expect(screen.getByRole('option', { name: 'Articulo con lote (teórico: 5)' })).toBeInTheDocument()
            expect(screen.queryByRole('option', { name: /Articulo sin lote/ })).not.toBeInTheDocument()
        })

        it('HU-027 criterio 1: tambien filtra por codigo de articulo', async () => {
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Articulo con lote (teórico: 5)')

            fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o código...'), {
                target: { value: 'art2' },
            })

            expect(screen.getByRole('option', { name: 'Articulo con lote (teórico: 5)' })).toBeInTheDocument()
            expect(screen.queryByRole('option', { name: /Articulo sin lote/ })).not.toBeInTheDocument()
        })

        // HU-027 criterio 2.
        it('HU-027 criterio 2: sin coincidencias, muestra el mensaje en vez del selector', async () => {
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Articulo con lote (teórico: 5)')

            fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o código...'), {
                target: { value: 'no existe este reactivo' },
            })

            expect(screen.getByText('No se encontraron resultados')).toBeInTheDocument()
            expect(screen.queryByLabelText('Artículo')).not.toBeInTheDocument()
        })
    })

    // HU-007: corregir un conteo ya registrado, sin sincronizar todavia.
    describe('corregir conteo (HU-007)', () => {
        const CONTEO_SIN_SINCRONIZAR = {
            idempotenciaKey: 'sin-sincronizar',
            codBod: 'MEPRIN',
            codArt: 'ART1',
            numCon: '123',
            cantidadTeorica: '10',
            cantidadFisica: '7',
            observaciones: 'anotacion original',
            sincronizado: false,
        }

        it('criterio 1: "Corregir" precarga el formulario con los valores actuales', async () => {
            obtenerConteosPendientes.mockResolvedValue([CONTEO_SIN_SINCRONIZAR])
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Faltante')
            fireEvent.click(screen.getByRole('button', { name: 'Corregir' }))

            expect(screen.getByLabelText('Artículo')).toHaveValue('ART1::123')
            expect(screen.getByLabelText('Cantidad física')).toHaveValue(7)
            expect(screen.getByLabelText('Observaciones')).toHaveValue('anotacion original')
            expect(screen.getByRole('button', { name: 'Guardar corrección' })).toBeInTheDocument()
        })

        it('criterios 2 y 4: confirmar la correccion actualiza el mismo registro, con las mismas validaciones', async () => {
            obtenerConteosPendientes.mockResolvedValue([CONTEO_SIN_SINCRONIZAR])
            corregirConteoLocal.mockResolvedValue(undefined)
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Faltante')
            fireEvent.click(screen.getByRole('button', { name: 'Corregir' }))

            fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '-1' } })
            fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }))
            expect(await screen.findByRole('alert')).toHaveTextContent('no puede ser negativa')
            expect(corregirConteoLocal).not.toHaveBeenCalled()

            fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '10' } })
            fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }))

            // findBy (no waitFor sobre el mock): llamar al mock es sincrono,
            // pero el mensaje de exito solo aparece despues de que su
            // promesa resuelve y el componente vuelve a renderizar -- un
            // waitFor sobre "ya se llamo" puede cumplirse antes de eso.
            expect(await screen.findByText('Corrección guardada en este dispositivo.')).toBeInTheDocument()
            expect(corregirConteoLocal).toHaveBeenCalledWith(7, 'sin-sincronizar', {
                cantidadFisica: 10,
                observaciones: 'anotacion original',
            })
            // No es un registro nuevo: no debe volver a trazar HU-031.
            expect(registrarAccionLocal).not.toHaveBeenCalled()
        })

        it('"Cancelar corrección" vuelve al formulario de registrar, sin guardar nada', async () => {
            obtenerConteosPendientes.mockResolvedValue([CONTEO_SIN_SINCRONIZAR])
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Faltante')
            fireEvent.click(screen.getByRole('button', { name: 'Corregir' }))

            fireEvent.click(screen.getByRole('button', { name: 'Cancelar corrección' }))

            expect(screen.getByRole('button', { name: 'Registrar conteo' })).toBeInTheDocument()
            expect(screen.getByLabelText('Cantidad física')).toHaveValue(null)
        })

        // HU-007 criterio 3 (parcial, ver corregirConteoLocal): corregir uno
        // ya sincronizado necesita el endpoint del backend, fuera de este
        // prototipo -- la UI no ofrece la opcion para que nadie intente algo
        // que todavia no esta conectado de punta a punta.
        it('un conteo ya sincronizado no ofrece la opcion de corregir', async () => {
            obtenerConteosPendientes.mockResolvedValue([{ ...CONTEO_SIN_SINCRONIZAR, sincronizado: true }])
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Faltante')

            expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument()
        })
    })

    // HU-004: con un contrato activo elegido en Mi ruta, solo se cuenta
    // dentro de ese contrato y la bodega elegida alli llega ya seleccionada.
    describe('con un contrato activo (HU-004)', () => {
        function renderConContexto(contexto) {
            return render(
                <AuthContext.Provider value={{ usuario: { id: 7 }, token: 'jwt-prueba' }}>
                    <SincronizacionContext.Provider
                        value={{ estado: 'listo', error: null, ultimaSincronizacion: '2026-10-08T10:00:00.000Z', sincronizar: vi.fn() }}
                    >
                        <ContextoAuditoriaContext.Provider value={{ contexto }}>
                            <ConteoPage />
                        </ContextoAuditoriaContext.Provider>
                    </SincronizacionContext.Provider>
                </AuthContext.Provider>,
            )
        }

        it('llega con la bodega elegida en Mi ruta y muestra el contrato activo', async () => {
            renderConContexto({ numCon: '123', objCon: 'HEMATOLOGIA', codBodSeleccionada: 'MEPRIN' })

            expect(await screen.findByText('Articulo sin lote (teórico: 10)')).toBeInTheDocument()
            expect(screen.getByLabelText('Bodega')).toHaveValue('MEPRIN')
            expect(screen.getByTestId('contrato-activo')).toHaveTextContent('123 · HEMATOLOGIA')
        })

        it('solo ofrece las bodegas y los articulos del contrato activo', async () => {
            obtenerRuta.mockResolvedValue([BODEGA, { codBod: 'OTRA', desBod: 'Bodega de otro contrato', numCon: '999' }])
            const articuloContratoA = { ...ARTICULO_SIN_LOTE, numCon: 'A', cantidadTeorica: '1' }
            const articuloContratoActivo = { ...ARTICULO_SIN_LOTE, numCon: '123', cantidadTeorica: '99' }
            obtenerDetalleBodega.mockResolvedValue([articuloContratoA, articuloContratoActivo])
            registrarConteoLocal.mockResolvedValue('clave-generada')

            renderConContexto({ numCon: '123', objCon: 'HEMATOLOGIA', codBodSeleccionada: 'MEPRIN' })

            await screen.findByText('Articulo sin lote (teórico: 99)')
            expect(screen.queryByText('Articulo sin lote (teórico: 1)')).not.toBeInTheDocument()
            expect(screen.queryByRole('option', { name: 'Bodega de otro contrato' })).not.toBeInTheDocument()

            fireEvent.change(screen.getByLabelText('Artículo'), { target: { value: 'ART1::123' } })
            fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '7' } })
            fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

            await waitFor(() => {
                expect(registrarConteoLocal).toHaveBeenCalledWith(
                    7,
                    expect.objectContaining({ codBod: 'MEPRIN', numCon: '123', cantidadTeorica: '99' }),
                )
            })
        })
    })
})
