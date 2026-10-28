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

// NOTA (rama experimental sprint3-conteo-widgets, ver DISENO_WIDGETS_CONTEO.md):
// mismas HU y misma logica que el prototipo de produccion, pero la interaccion
// cambio de "un <select> de articulo + 2 listas de resumen" a "una lista de
// tarjetas tocables + una hoja inferior con stepper". Donde eso cambia una
// consulta de la prueba (p. ej. ya no hay un <select id="conteo-articulo">),
// se adapta la consulta, no el comportamiento verificado.

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

// Tocar la tarjeta de un articulo (pendiente o ya contado) abre la hoja
// inferior -- equivalente a elegirlo en el <select> de la version anterior.
async function abrirArticulo(nombre) {
    fireEvent.click(await screen.findByText(nombre))
}

describe('ConteoPage (alternativa widgets)', () => {
    beforeEach(() => {
        obtenerConteosPendientes.mockResolvedValue([])
        obtenerRuta.mockResolvedValue([BODEGA])
        obtenerDetalleBodega.mockResolvedValue([ARTICULO_SIN_LOTE, ARTICULO_CON_LOTE])
        obtenerLotesBodega.mockResolvedValue([
            { codArt: 'ART2', numLote: 'L1', fechaVencimiento: '2027-01-01', cantidad: '5' },
        ])
        estaJornadaIniciadaHoy.mockResolvedValue(true)
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
        await abrirArticulo('Articulo sin lote')
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
        expect(await screen.findByRole('status')).toHaveTextContent('Conteo guardado en este dispositivo')

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
        await abrirArticulo('Articulo sin lote')
        fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '0' } })
        fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

        await waitFor(() => {
            expect(registrarConteoLocal).toHaveBeenCalledWith(7, expect.objectContaining({ cantidadFisica: 0 }))
        })
        expect(await screen.findByRole('status')).toHaveTextContent('Conteo guardado en este dispositivo')
    })

    // HU-028 criterios 1-3.
    it('HU-028: una observacion completada queda vinculada al registro', async () => {
        registrarConteoLocal.mockResolvedValue('clave-generada')
        renderPagina()

        fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
        await abrirArticulo('Articulo sin lote')
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
        // Mismo desArt en los dos contratos: solo se distinguen por el
        // teorico mostrado -- se abre la tarjeta que lo muestra en 99.
        await screen.findByText('Teórico: 99')
        fireEvent.click(screen.getByText('Teórico: 99').closest('button'))
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
        await abrirArticulo('Articulo sin lote')
        expect(screen.queryByText('L1 · vence 2027-01-01')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

        await abrirArticulo('Articulo con lote')
        const pildoraLote = await screen.findByRole('button', { name: 'L1 · vence 2027-01-01' })

        fireEvent.click(pildoraLote)
        fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '4' } })
        fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

        await waitFor(() => {
            expect(registrarConteoLocal).toHaveBeenCalledWith(7, expect.objectContaining({ numLote: 'L1' }))
        })
    })

    it('rechaza una cantidad fisica negativa sin guardar nada', async () => {
        renderPagina()

        fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
        await abrirArticulo('Articulo sin lote')
        fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '-1' } })
        fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

        expect(await screen.findByRole('alert')).toHaveTextContent('no puede ser negativa')
        expect(registrarConteoLocal).not.toHaveBeenCalled()
    })

    // HU-006 criterio 1: campo faltante senalado especificamente.
    it('HU-006: si falta la cantidad fisica, senala ese campo puntualmente', async () => {
        renderPagina()

        fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
        await abrirArticulo('Articulo sin lote')
        fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

        expect(await screen.findByRole('alert')).toHaveTextContent('La cantidad física es obligatoria.')
        expect(registrarConteoLocal).not.toHaveBeenCalled()
    })

    // HU-006 criterio 2 (valor no numerico): sin prueba de interaccion, ver
    // el comentario equivalente en la version de produccion -- un input
    // type="number" sanea cualquier valor no parseable a "" antes de que
    // React lo vea, asi que no hay forma de llegar a un valor no numerico
    // real via UI (ni con el Stepper, que usa el mismo input por dentro).

    it('muestra cuantos conteos siguen sin sincronizar', async () => {
        obtenerConteosPendientes.mockResolvedValue([
            { idempotenciaKey: 'a', sincronizado: false },
            { idempotenciaKey: 'b', sincronizado: true },
        ])
        renderPagina()

        expect(await screen.findByText('1 conteo todavía sin sincronizar.')).toBeInTheDocument()
    })

    // Bug real encontrado probando en un navegador real (Cypress): la
    // descarga automatica de AppLayout corre en paralelo a esta pantalla.
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

    // HU-008 (resumen de avance) / HU-026 criterio 2 (reanudar). Ahora
    // representado por los StatTile (ver StatTile.jsx: aria-label
    // "<etiqueta>: <valor>"), no por una frase "Avance: X contados...".
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

            expect(await screen.findByRole('button', { name: 'Contados: 1' })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Pendientes: 1' })).toBeInTheDocument()
            expect(screen.getByText('Sin diferencia')).toBeInTheDocument()
        })

        // HU-030 tal cual se ve en la tarjeta: fisica < teorica -> Faltante.
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

        // HU-008 criterio 2: el resumen refleja un conteo nuevo sin recargar.
        it('HU-008 criterio 2: el resumen se actualiza al registrar un conteo, sin recargar', async () => {
            obtenerConteosPendientes.mockResolvedValue([])
            registrarConteoLocal.mockResolvedValue('clave-generada')
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            expect(await screen.findByRole('button', { name: 'Contados: 0' })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Pendientes: 2' })).toBeInTheDocument()

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
            await abrirArticulo('Articulo sin lote')
            fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '8' } })
            fireEvent.click(screen.getByRole('button', { name: /Registrar conteo/ }))

            expect(await screen.findByRole('button', { name: 'Contados: 1' })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Pendientes: 1' })).toBeInTheDocument()
        })
    })

    // HU-032: agrupado por estado, con tile clickeable como filtro.
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

        it('muestra los 4 tiles con la cantidad de cada estado', async () => {
            obtenerConteosPendientes.mockResolvedValue(conteos())
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })

            expect(await screen.findByRole('button', { name: 'Todos: 2' })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Contados: 2' })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Pendientes: 0' })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Con diferencia: 1' })).toBeInTheDocument()
        })

        // HU-032 criterio 3: seleccionar un estado filtra la lista.
        it('al tocar "Con diferencia" solo queda visible el articulo con diferencia', async () => {
            obtenerConteosPendientes.mockResolvedValue(conteos())
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Articulo con lote')

            fireEvent.click(screen.getByRole('button', { name: 'Con diferencia: 1' }))

            expect(screen.getByText('Articulo con lote')).toBeInTheDocument()
            expect(screen.queryByText('Articulo sin lote')).not.toBeInTheDocument()
        })
    })

    // HU-027: busqueda por nombre o codigo, sobre el catalogo ya local.
    describe('buscar articulo (HU-027)', () => {
        it('HU-027 criterio 1: un termino parcial, sin tildes/mayusculas, filtra por nombre', async () => {
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Articulo con lote')

            fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o código...'), {
                target: { value: 'CON LOTE' },
            })

            expect(screen.getByText('Articulo con lote')).toBeInTheDocument()
            expect(screen.queryByText('Articulo sin lote')).not.toBeInTheDocument()
        })

        it('HU-027 criterio 1: tambien filtra por codigo de articulo', async () => {
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Articulo con lote')

            fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o código...'), {
                target: { value: 'art2' },
            })

            expect(screen.getByText('Articulo con lote')).toBeInTheDocument()
            expect(screen.queryByText('Articulo sin lote')).not.toBeInTheDocument()
        })

        // HU-027 criterio 2.
        it('HU-027 criterio 2: sin coincidencias, muestra el mensaje y ninguna tarjeta', async () => {
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Articulo con lote')

            fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o código...'), {
                target: { value: 'no existe este reactivo' },
            })

            expect(screen.getByText('No se encontraron resultados')).toBeInTheDocument()
            expect(screen.queryByText('Articulo sin lote')).not.toBeInTheDocument()
            expect(screen.queryByText('Articulo con lote')).not.toBeInTheDocument()
        })
    })

    // HU-007: corregir un conteo ya registrado, sin sincronizar todavia.
    // Ahora se toca la tarjeta del articulo ya contado (no un boton
    // "Corregir" aparte) -- tocarContado hace exactamente lo mismo que
    // hacia iniciarCorreccion en la version anterior.
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

        it('criterio 1: tocar la tarjeta ya contada precarga la hoja con los valores actuales', async () => {
            obtenerConteosPendientes.mockResolvedValue([CONTEO_SIN_SINCRONIZAR])
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Faltante')
            await abrirArticulo('Articulo sin lote')

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
            await abrirArticulo('Articulo sin lote')

            fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '-1' } })
            fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }))
            expect(await screen.findByRole('alert')).toHaveTextContent('no puede ser negativa')
            expect(corregirConteoLocal).not.toHaveBeenCalled()

            fireEvent.change(screen.getByLabelText('Cantidad física'), { target: { value: '10' } })
            fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }))

            expect(await screen.findByText('Corrección guardada en este dispositivo.')).toBeInTheDocument()
            expect(corregirConteoLocal).toHaveBeenCalledWith(7, 'sin-sincronizar', {
                cantidadFisica: 10,
                observaciones: 'anotacion original',
            })
            // No es un registro nuevo: no debe volver a trazar HU-031.
            expect(registrarAccionLocal).not.toHaveBeenCalled()
        })

        it('"Cancelar corrección" cierra la hoja sin guardar nada', async () => {
            obtenerConteosPendientes.mockResolvedValue([CONTEO_SIN_SINCRONIZAR])
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Faltante')
            await abrirArticulo('Articulo sin lote')

            fireEvent.click(screen.getByRole('button', { name: 'Cancelar corrección' }))

            expect(screen.queryByLabelText('Cantidad física')).not.toBeInTheDocument()
            expect(corregirConteoLocal).not.toHaveBeenCalled()
        })

        // HU-007 criterio 3 (parcial, ver corregirConteoLocal): corregir uno
        // ya sincronizado necesita el endpoint del backend, fuera de este
        // prototipo -- la tarjeta queda deshabilitada (no abre la hoja).
        it('un conteo ya sincronizado no abre la hoja al tocarlo', async () => {
            obtenerConteosPendientes.mockResolvedValue([{ ...CONTEO_SIN_SINCRONIZAR, sincronizado: true }])
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Bodega'), { target: { value: 'MEPRIN' } })
            await screen.findByText('Faltante')

            fireEvent.click(screen.getByText('Articulo sin lote'))

            expect(screen.queryByLabelText('Cantidad física')).not.toBeInTheDocument()
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

            expect(await screen.findByText('Articulo sin lote')).toBeInTheDocument()
            // Con contrato activo la bodega ya llega decidida -- no tiene
            // sentido mostrar un selector redundante (cambio deliberado de
            // esta alternativa, ver DISENO_WIDGETS_CONTEO.md).
            expect(screen.queryByLabelText('Bodega')).not.toBeInTheDocument()
            expect(screen.getByTestId('contrato-activo')).toHaveTextContent('123 · HEMATOLOGIA')
        })

        it('solo ofrece los articulos del contrato activo', async () => {
            obtenerRuta.mockResolvedValue([BODEGA, { codBod: 'OTRA', desBod: 'Bodega de otro contrato', numCon: '999' }])
            const articuloContratoA = { ...ARTICULO_SIN_LOTE, numCon: 'A', cantidadTeorica: '1' }
            const articuloContratoActivo = { ...ARTICULO_SIN_LOTE, numCon: '123', cantidadTeorica: '99' }
            obtenerDetalleBodega.mockResolvedValue([articuloContratoA, articuloContratoActivo])
            registrarConteoLocal.mockResolvedValue('clave-generada')

            renderConContexto({ numCon: '123', objCon: 'HEMATOLOGIA', codBodSeleccionada: 'MEPRIN' })

            await screen.findByText('Teórico: 99')
            expect(screen.queryByText('Teórico: 1')).not.toBeInTheDocument()

            await abrirArticulo('Articulo sin lote')
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
