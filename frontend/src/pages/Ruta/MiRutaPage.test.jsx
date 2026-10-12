import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../../context/AuthContext'
import { CLAVE_CONTEXTO } from '../../context/ContextoAuditoriaContext'
import { ContextoAuditoriaProvider } from '../../context/ContextoAuditoriaProvider'
import { SincronizacionContext } from '../../context/SincronizacionContext'
import { useContextoAuditoria } from '../../context/useContextoAuditoria'
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

function parada(codBod, desBod, fechaAsignada, estadoApp = 'PENDIENTE', numCon = 'C-1', objCon = 'Reactivos') {
    return { codBod, desBod, numCon, objCon, estadoErp: 'PEND', estadoApp, fechaAsignada }
}

const USUARIO = { id: 7, empresaNombre: 'CAPRIS Médica' }

// Muestra lo que Conteo recibiria, para probar el paso Mi ruta -> Conteo.
function ConteoFalso() {
    const { contexto } = useContextoAuditoria()
    return (
        <p>
            Conteo de {contexto?.codBodSeleccionada} en {contexto?.numCon}
        </p>
    )
}

function arbol({ sincronizacion = {}, usuario = USUARIO } = {}) {
    const valorSincronizacion = {
        estado: 'inactivo',
        error: null,
        ultimaSincronizacion: '2026-10-01T15:00:00.000Z',
        sincronizar: vi.fn(),
        ...sincronizacion,
    }

    return (
        <AuthContext.Provider value={{ usuario, token: 'jwt' }}>
            <SincronizacionContext.Provider value={valorSincronizacion}>
                <ContextoAuditoriaProvider>
                    <MemoryRouter initialEntries={['/mi-ruta']}>
                        <Routes>
                            <Route path="/mi-ruta" element={<MiRutaPage />} />
                            <Route path="/conteo" element={<ConteoFalso />} />
                        </Routes>
                    </MemoryRouter>
                </ContextoAuditoriaProvider>
            </SincronizacionContext.Provider>
        </AuthContext.Provider>
    )
}

function renderPagina(opciones) {
    return render(arbol(opciones))
}

// Las pruebas de HU-037 parten de un contrato ya activo en la sesion: con
// contrato elegido, Mi ruta se comporta como antes, pero solo con sus bodegas.
function conContratoActivo(contrato = { numCon: 'C-1', objCon: 'Reactivos' }) {
    sessionStorage.setItem(CLAVE_CONTEXTO, JSON.stringify({ usuarioId: USUARIO.id, contrato }))
}

function tarjetaDeContrato(nombre) {
    return screen.getByRole('button', { name: new RegExp(`^${nombre}`) })
}

describe('MiRutaPage', () => {
    beforeEach(() => {
        obtenerRuta.mockReset()
        sessionStorage.clear()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        sessionStorage.clear()
    })

    describe('HU-037 (con un contrato activo)', () => {
        beforeEach(() => conContratoActivo())

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
            rerender(arbol({ sincronizacion: { estado: 'listo', ultimaSincronizacion: '2026-10-07T12:00:00.000Z' } }))

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

    it('avisa cuando no hay bodegas asignadas pendientes', async () => {
        obtenerRuta.mockResolvedValue([])

        renderPagina()

        expect(await screen.findByText('No tiene bodegas asignadas pendientes.')).toBeInTheDocument()
    })

    describe('HU-004 (seleccion de contrato)', () => {
        const RUTA = [
            parada('B1', 'Clinica Alfa', fechaLocal(0), 'PENDIENTE', '0432025114200211-00-13585', 'HEMATOLOGÍA'),
            parada('B2', 'Clinica Beta', fechaLocal(0), 'PENDIENTE', '0432025114200211-00-13585', 'HEMATOLOGÍA'),
            parada('B3', 'Clinica Gamma', fechaLocal(0), 'PENDIENTE', '12555', 'QUÍMICA CLÍNICA'),
        ]

        it('sin contrato activo muestra los contratos como tarjetas, sin selector de compañía', async () => {
            obtenerRuta.mockResolvedValue(RUTA)

            renderPagina()

            const contratos = await screen.findByRole('region', { name: 'Contratos' })
            expect(within(contratos).getAllByRole('listitem')).toHaveLength(2)
            expect(tarjetaDeContrato('0432025114200211-00-13585 · HEMATOLOGÍA')).toHaveTextContent(
                '2 bodegas pendientes',
            )
            expect(tarjetaDeContrato('12555 · QUÍMICA CLÍNICA')).toHaveTextContent('1 bodega pendiente')
            expect(screen.queryByLabelText('Compañía')).not.toBeInTheDocument()
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
            expect(screen.queryByText('Clinica Alfa')).not.toBeInTheDocument()
        })

        it('busca por numero de contrato', async () => {
            obtenerRuta.mockResolvedValue(RUTA)
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Buscar contrato...'), { target: { value: '1255' } })

            expect(tarjetaDeContrato('12555')).toBeInTheDocument()
            expect(screen.queryByText(/HEMATOLOG/)).not.toBeInTheDocument()
        })

        it('busca por objeto del contrato ignorando mayusculas y tildes', async () => {
            obtenerRuta.mockResolvedValue(RUTA)
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Buscar contrato...'), {
                target: { value: 'quimica clinica' },
            })

            expect(tarjetaDeContrato('12555 · QUÍMICA CLÍNICA')).toBeInTheDocument()
            expect(screen.queryByText(/HEMATOLOG/)).not.toBeInTheDocument()
        })

        it('sin resultados muestra el estado vacio', async () => {
            obtenerRuta.mockResolvedValue(RUTA)
            renderPagina()

            fireEvent.change(await screen.findByLabelText('Buscar contrato...'), { target: { value: 'no existe' } })

            expect(screen.getByText('No se encontraron contratos con ese criterio')).toBeInTheDocument()
            expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
        })

        it('la tarjeta entera es un boton: tocarla activa el contrato y muestra sus bodegas (criterio 2)', async () => {
            obtenerRuta.mockResolvedValue(RUTA)
            renderPagina()

            const tarjeta = await screen.findByRole('button', { name: /^12555 · QUÍMICA CLÍNICA/ })
            expect(tarjeta.tagName).toBe('BUTTON')
            expect(within(tarjeta).queryByRole('button')).not.toBeInTheDocument()
            fireEvent.click(tarjeta)

            expect(screen.getByTestId('contexto-activo')).toHaveTextContent(
                'Contexto activo: 12555 · QUÍMICA CLÍNICA',
            )
            expect(screen.getByText('Clinica Gamma')).toBeInTheDocument()
            expect(screen.queryByText('Clinica Alfa')).not.toBeInTheDocument()
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
            expect(JSON.parse(sessionStorage.getItem(CLAVE_CONTEXTO)).contrato.numCon).toBe('12555')
        })

        it('al cambiar, el contrato activo va primero, con borde y la insignia "Contrato activo"', async () => {
            conContratoActivo({ numCon: '12555', objCon: 'QUÍMICA CLÍNICA' })
            obtenerRuta.mockResolvedValue(RUTA)
            renderPagina()

            fireEvent.click(await screen.findByRole('button', { name: 'Cambiar' }))

            const tarjetas = within(screen.getByRole('region', { name: 'Contratos' })).getAllByRole('button')
            expect(tarjetas[0]).toHaveTextContent('12555 · QUÍMICA CLÍNICA')
            expect(tarjetas[0]).toHaveAttribute('aria-current', 'true')
            expect(within(tarjetas[0]).getByText('Contrato activo')).toBeInTheDocument()
            expect(tarjetas[1]).not.toHaveAttribute('aria-current')
        })

        it('reemplazar el contexto pide confirmacion y cancelar mantiene el anterior (criterio 3)', async () => {
            conContratoActivo({ numCon: '12555', objCon: 'QUÍMICA CLÍNICA' })
            obtenerRuta.mockResolvedValue(RUTA)
            renderPagina()

            fireEvent.click(await screen.findByRole('button', { name: 'Cambiar' }))
            fireEvent.click(tarjetaDeContrato('0432025114200211-00-13585'))

            const dialogo = screen.getByRole('alertdialog')
            expect(dialogo).toHaveTextContent(
                'Cambiar de contexto reemplazará 12555 · QUÍMICA CLÍNICA por ' +
                    '0432025114200211-00-13585 · HEMATOLOGÍA',
            )
            fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
            expect(JSON.parse(sessionStorage.getItem(CLAVE_CONTEXTO)).contrato.numCon).toBe('12555')
        })

        it('solo al confirmar se reemplaza el contexto (criterio 3)', async () => {
            conContratoActivo({ numCon: '12555', objCon: 'QUÍMICA CLÍNICA' })
            obtenerRuta.mockResolvedValue(RUTA)
            renderPagina()

            fireEvent.click(await screen.findByRole('button', { name: 'Cambiar' }))
            fireEvent.click(tarjetaDeContrato('0432025114200211-00-13585'))
            fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cambiar contexto' }))

            expect(screen.getByTestId('contexto-activo')).toHaveTextContent('0432025114200211-00-13585 · HEMATOLOGÍA')
            expect(screen.getByText('Clinica Alfa')).toBeInTheDocument()
            expect(screen.queryByText('Clinica Gamma')).not.toBeInTheDocument()
        })

        it('tocar el contrato activo vuelve a sus bodegas sin pedir confirmacion', async () => {
            conContratoActivo({ numCon: '12555', objCon: 'QUÍMICA CLÍNICA' })
            obtenerRuta.mockResolvedValue(RUTA)
            renderPagina()

            fireEvent.click(await screen.findByRole('button', { name: 'Cambiar' }))
            fireEvent.click(tarjetaDeContrato('12555'))

            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
            expect(screen.getByText('Clinica Gamma')).toBeInTheDocument()
        })

        it('tocar la tarjeta de una bodega la elige y lleva a Conteo', async () => {
            conContratoActivo({ numCon: '12555', objCon: 'QUÍMICA CLÍNICA' })
            obtenerRuta.mockResolvedValue(RUTA)
            renderPagina()

            fireEvent.click(await screen.findByRole('button', { name: /^Clinica Gamma/ }))

            expect(await screen.findByText('Conteo de B3 en 12555')).toBeInTheDocument()
        })

        it('el indicador muestra tambien la bodega elegida', async () => {
            conContratoActivo({ numCon: '12555', objCon: 'QUÍMICA CLÍNICA', codBodSeleccionada: 'B3' })
            obtenerRuta.mockResolvedValue(RUTA)
            renderPagina()

            // La bodega se resuelve con la ruta, que se lee de forma asincrona.
            await waitFor(() =>
                expect(screen.getByTestId('contexto-activo')).toHaveTextContent(
                    'Contexto activo: 12555 · QUÍMICA CLÍNICA · Clinica Gamma',
                ),
            )
        })
    })
})
