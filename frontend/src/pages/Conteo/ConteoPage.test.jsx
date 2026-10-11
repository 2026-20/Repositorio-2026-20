import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../../context/AuthContext'
import { SincronizacionContext } from '../../context/SincronizacionContext'
import { iniciarJornada } from '../../services/auditoriaService.js'
import {
    estaJornadaIniciadaHoy,
    guardarJornadaIniciada,
    obtenerConteosPendientes,
    registrarConteoLocal,
} from '../../storage/conteosPendientesRepositorio.js'
import { obtenerDetalleBodega, obtenerLotesBodega, obtenerRuta } from '../../storage/datosMaestrosRepositorio.js'
import ConteoPage from './ConteoPage'

vi.mock('../../services/auditoriaService.js', () => ({
    iniciarJornada: vi.fn(),
}))

vi.mock('../../storage/conteosPendientesRepositorio.js', () => ({
    estaJornadaIniciadaHoy: vi.fn(),
    guardarJornadaIniciada: vi.fn(),
    obtenerConteosPendientes: vi.fn(),
    registrarConteoLocal: vi.fn(),
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
})
