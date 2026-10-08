import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../../context/AuthContext'
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

function renderPagina({ sincronizacion = {}, usuario = { id: 7 } } = {}) {
    const valorSincronizacion = {
        estado: 'inactivo',
        error: null,
        ultimaSincronizacion: '2026-10-01T15:00:00.000Z',
        sincronizar: vi.fn(),
        ...sincronizacion,
    }

    return render(
        <AuthContext.Provider value={{ usuario }}>
            <SincronizacionContext.Provider value={valorSincronizacion}>
                <MiRutaPage />
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
                    <MiRutaPage />
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
})
