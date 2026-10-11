import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../../context/AuthContext'
import { JornadaContext } from '../../context/JornadaContext'
import { SincronizacionContext } from '../../context/SincronizacionContext'
import { obtenerRuta } from '../../storage/datosMaestrosRepositorio.js'
import MiRutaPage from './MiRutaPage'

vi.mock('../../storage/datosMaestrosRepositorio.js', () => ({
    obtenerRuta: vi.fn(),
}))

function fechaLocal(desplazamientoDias) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + desplazamientoDias)
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const dia = String(fecha.getDate()).padStart(2, '0')
    return `${fecha.getFullYear()}-${mes}-${dia}`
}

function diaEscrito(fechaIso) {
    const [anio, mes, dia] = fechaIso.split('-').map(Number)
    return new Date(anio, mes - 1, dia).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function parada(codBod, desBod, fechaAsignada, estadoApp = 'PENDIENTE') {
    return { codBod, desBod, numCon: 'C-1', objCon: 'Reactivos', estadoErp: 'PEND', estadoApp, fechaAsignada }
}

function renderPagina({ sincronizacion = {}, usuario = { id: 7 }, jornada = {} } = {}) {
    const valorSincronizacion = {
        estado: 'inactivo',
        error: null,
        ultimaSincronizacion: '2026-10-01T15:00:00.000Z',
        sincronizar: vi.fn(),
        ...sincronizacion,
    }

    const valorJornada = {
        iniciada: false,
        iniciadaEn: null,
        cargando: false,
        confirmando: false,
        error: null,
        confirmarInicio: vi.fn(),
        ...jornada,
    }

    return render(
        <AuthContext.Provider value={{ usuario }}>
            <SincronizacionContext.Provider value={valorSincronizacion}>
                <JornadaContext.Provider value={valorJornada}>
                    <MiRutaPage />
                </JornadaContext.Provider>
            </SincronizacionContext.Provider>
        </AuthContext.Provider>,
    )
}

describe('MiRutaPage', () => {
    beforeEach(() => {
        obtenerRuta.mockReset()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('muestra las bodegas asignadas leidas del almacenamiento local del usuario (criterio 1 y 2)', async () => {
        obtenerRuta.mockResolvedValue([parada('HSJD', 'Hospital San Juan de Dios', fechaLocal(0))])

        renderPagina()

        expect(await screen.findByText('Hospital San Juan de Dios')).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(`Hoy, ${diaEscrito(fechaLocal(0))}`)
        expect(screen.getByText('Pendiente')).toBeInTheDocument()
        expect(obtenerRuta).toHaveBeenCalledWith(7)
    })

    it('mantiene lo asignado en dias anteriores, agrupado bajo su fecha', async () => {
        obtenerRuta.mockResolvedValue([
            parada('B1', 'Clinica de la semana pasada', fechaLocal(-7)),
            parada('B2', 'Clinica de hoy', fechaLocal(0), 'EN_PROGRESO'),
        ])

        renderPagina()

        const grupoAnterior = (await screen.findByText('Clinica de la semana pasada')).closest('section')
        expect(within(grupoAnterior).getByRole('heading')).toHaveTextContent(diaEscrito(fechaLocal(-7)))

        const grupoHoy = screen.getByText('Clinica de hoy').closest('section')
        expect(within(grupoHoy).getByRole('heading')).toHaveTextContent(`Hoy, ${diaEscrito(fechaLocal(0))}`)
        expect(within(grupoHoy).getByText('En progreso')).toBeInTheDocument()
    })

    it('agrupa bajo un solo titulo las bodegas del mismo dia y mantiene las de dias siguientes', async () => {
        obtenerRuta.mockResolvedValue([
            parada('B1', 'Hospital Mexico', fechaLocal(0)),
            parada('B2', 'Clinica Biblica', fechaLocal(0)),
            parada('B3', 'Clinica de pasado manana', fechaLocal(2)),
        ])

        renderPagina()

        const grupoHoy = (await screen.findByText('Hospital Mexico')).closest('section')
        expect(within(grupoHoy).getByText('Clinica Biblica')).toBeInTheDocument()
        expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2)

        const grupoFuturo = screen.getByText('Clinica de pasado manana').closest('section')
        expect(within(grupoFuturo).getByRole('heading')).toHaveTextContent(diaEscrito(fechaLocal(2)))
    })

    it('agrupa aparte las bodegas sin fecha asignada', async () => {
        obtenerRuta.mockResolvedValue([parada('HSJD', 'Hospital San Juan de Dios', null)])

        renderPagina()

        const grupo = (await screen.findByText('Hospital San Juan de Dios')).closest('section')
        expect(within(grupo).getByRole('heading')).toHaveTextContent('Sin fecha asignada')
    })

    it('muestra la ruta guardada sin conexion, con un aviso', async () => {
        vi.stubGlobal('navigator', { ...navigator, onLine: false })
        obtenerRuta.mockResolvedValue([parada('HSJD', 'Hospital San Juan de Dios', fechaLocal(0))])

        renderPagina()

        expect(await screen.findByText('Hospital San Juan de Dios')).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent(/Sin conexión/)
    })

    it('avisa cuando no hay bodegas asignadas pendientes', async () => {
        obtenerRuta.mockResolvedValue([])

        renderPagina()

        expect(await screen.findByText('No tiene bodegas asignadas pendientes.')).toBeInTheDocument()
    })

    it('indica cuando todavia no se ha sincronizado', async () => {
        obtenerRuta.mockResolvedValue([])

        renderPagina({ sincronizacion: { ultimaSincronizacion: null } })

        expect(await screen.findByText(/todavía no se ha sincronizado/)).toBeInTheDocument()
    })

    it('vuelve a leer la ruta cuando termina una sincronizacion nueva', async () => {
        obtenerRuta.mockResolvedValueOnce([])
        const { rerender } = renderPagina({ sincronizacion: { ultimaSincronizacion: null } })
        await screen.findByText('No tiene bodegas asignadas pendientes.')

        obtenerRuta.mockResolvedValueOnce([parada('HSJD', 'Hospital San Juan de Dios', fechaLocal(0))])
        rerender(
            <AuthContext.Provider value={{ usuario: { id: 7 } }}>
                <SincronizacionContext.Provider
                    value={{ estado: 'listo', error: null, ultimaSincronizacion: '2026-10-07T12:00:00.000Z', sincronizar: vi.fn() }}
                >
                    <JornadaContext.Provider
                        value={{ iniciada: false, iniciadaEn: null, cargando: false, confirmando: false, error: null, confirmarInicio: vi.fn() }}
                    >
                        <MiRutaPage />
                    </JornadaContext.Provider>
                </SincronizacionContext.Provider>
            </AuthContext.Provider>,
        )

        expect(await screen.findByText('Hospital San Juan de Dios')).toBeInTheDocument()
        expect(obtenerRuta).toHaveBeenCalledTimes(2)
    })

    it('muestra un error si no puede leer el almacenamiento local', async () => {
        obtenerRuta.mockRejectedValue(new Error('OPFS no disponible'))

        renderPagina()

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent('No fue posible leer la ruta guardada'),
        )
    })

    // HU-038
    describe('confirmar inicio de jornada', () => {
        it('criterio 1 y 5: el boton "Iniciar jornada" esta deshabilitado mientras la ruta no termina de cargar', async () => {
            obtenerRuta.mockResolvedValue([parada('HSJD', 'Hospital San Juan de Dios', fechaLocal(0))])

            renderPagina()

            expect(screen.getByRole('button', { name: 'Iniciar jornada' })).toBeDisabled()
            expect(screen.getByText('Esperando a que se cargue la ruta asignada…')).toBeInTheDocument()

            await screen.findByText('Hospital San Juan de Dios')

            expect(screen.getByRole('button', { name: 'Iniciar jornada' })).toBeEnabled()
        })

        it('sin bodegas asignadas, el boton queda deshabilitado con un aviso en vez de permitir confirmar', async () => {
            obtenerRuta.mockResolvedValue([])

            renderPagina()

            await screen.findByText('No tiene bodegas asignadas pendientes.')

            const boton = screen.getByRole('button', { name: 'Iniciar jornada' })
            expect(boton).toBeDisabled()
            expect(screen.getByText('No tiene bodegas asignadas: no es posible iniciar jornada.')).toBeInTheDocument()

            fireEvent.click(boton)
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        })

        it('si falla la lectura de la ruta, tampoco permite iniciar jornada (no se sabe si hay bodegas)', async () => {
            obtenerRuta.mockRejectedValue(new Error('OPFS no disponible'))

            renderPagina()

            await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

            expect(screen.getByRole('button', { name: 'Iniciar jornada' })).toBeDisabled()
        })

        it('criterio 2 y 3: confirmar en el dialogo llama a confirmarInicio y, al confirmarse, se oculta el boton y aparece "Jornada iniciada"', async () => {
            obtenerRuta.mockResolvedValue([parada('HSJD', 'Hospital San Juan de Dios', fechaLocal(0))])
            const confirmarInicio = vi.fn().mockResolvedValue()

            const { rerender } = renderPagina({ jornada: { confirmarInicio } })

            await screen.findByText('Hospital San Juan de Dios')

            fireEvent.click(screen.getByRole('button', { name: 'Iniciar jornada' }))
            expect(screen.getByRole('alertdialog', { name: 'Iniciar jornada' })).toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }))
            expect(confirmarInicio).toHaveBeenCalledTimes(1)

            // El provider real actualizaria `iniciada`/`iniciadaEn` -- aqui se
            // simula ese resultado con un rerender, igual que la prueba de
            // sincronizacion de arriba.
            rerender(
                <AuthContext.Provider value={{ usuario: { id: 7 } }}>
                    <SincronizacionContext.Provider
                        value={{ estado: 'inactivo', error: null, ultimaSincronizacion: '2026-10-01T15:00:00.000Z', sincronizar: vi.fn() }}
                    >
                        <JornadaContext.Provider
                            value={{
                                iniciada: true,
                                iniciadaEn: '2026-10-10T08:00:00-06:00',
                                cargando: false,
                                confirmando: false,
                                error: null,
                                confirmarInicio,
                            }}
                        >
                            <MiRutaPage />
                        </JornadaContext.Provider>
                    </SincronizacionContext.Provider>
                </AuthContext.Provider>,
            )

            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Iniciar jornada' })).not.toBeInTheDocument()
            expect(screen.getByText(/Jornada iniciada/)).toBeInTheDocument()
        })

        it('cancelar el dialogo no llama a confirmarInicio', async () => {
            obtenerRuta.mockResolvedValue([parada('HSJD', 'Hospital San Juan de Dios', fechaLocal(0))])
            const confirmarInicio = vi.fn()

            renderPagina({ jornada: { confirmarInicio } })

            await screen.findByText('Hospital San Juan de Dios')

            fireEvent.click(screen.getByRole('button', { name: 'Iniciar jornada' }))
            fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
            expect(confirmarInicio).not.toHaveBeenCalled()
        })

        it('criterio 5 (estados de error): si confirmarInicio falla, el dialogo sigue abierto con el error y permite reintentar', async () => {
            obtenerRuta.mockResolvedValue([parada('HSJD', 'Hospital San Juan de Dios', fechaLocal(0))])
            const confirmarInicio = vi.fn().mockResolvedValue()

            renderPagina({
                jornada: { confirmarInicio, error: new Error('No fue posible completar la solicitud') },
            })

            await screen.findByText('Hospital San Juan de Dios')

            fireEvent.click(screen.getByRole('button', { name: 'Iniciar jornada' }))

            expect(screen.getByRole('alertdialog')).toBeInTheDocument()
            expect(screen.getByText('No fue posible confirmar el inicio de jornada. Intente de nuevo.')).toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
            expect(confirmarInicio).toHaveBeenCalledTimes(1)
        })

        it('no muestra el boton de iniciar jornada si ya esta confirmada', async () => {
            obtenerRuta.mockResolvedValue([parada('HSJD', 'Hospital San Juan de Dios', fechaLocal(0))])

            renderPagina({ jornada: { iniciada: true, iniciadaEn: '2026-10-10T08:00:00-06:00' } })

            await screen.findByText('Hospital San Juan de Dios')

            expect(screen.queryByRole('button', { name: 'Iniciar jornada' })).not.toBeInTheDocument()
            expect(screen.getByText(/Jornada iniciada/)).toBeInTheDocument()
        })
    })
})
