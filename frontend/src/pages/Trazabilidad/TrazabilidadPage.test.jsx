import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../context/AuthContext'
import * as auditoriaService from '../../services/auditoriaService.js'
import TrazabilidadPage from './TrazabilidadPage'

const TOKEN_DE_PRUEBA = 'token-de-prueba'

function renderTrazabilidadPage() {
    return render(
        <AuthContext.Provider value={{ token: TOKEN_DE_PRUEBA }}>
            <TrazabilidadPage />
        </AuthContext.Provider>,
    )
}

const registros = [
    {
        id: 2,
        tipoAccion: 'INICIO_SESION',
        usuarioNombre: 'William A. Molina Quirós',
        codBod: null,
        resultado: 'EXITOSO',
        detalle: null,
        fecha: '2026-10-14T13:00:00Z',
    },
    {
        id: 1,
        tipoAccion: 'CONTEO_REGISTRADO',
        usuarioNombre: 'Andrey Meléndez Ovares',
        codBod: 'A2060000',
        resultado: 'EXITOSO',
        detalle: 'Reactivo de prueba: 10',
        fecha: '2026-10-14T12:00:00Z',
    },
]

// HU-031 criterio 4: pantalla de solo lectura.
describe('TrazabilidadPage', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('lista los registros obtenidos del backend con etiquetas legibles', async () => {
        vi.spyOn(auditoriaService, 'listarTrazabilidad').mockResolvedValue(registros)

        renderTrazabilidadPage()

        expect(await screen.findByText('Inicio de sesión')).toBeInTheDocument()
        expect(screen.getByText('Conteo registrado')).toBeInTheDocument()
        expect(screen.getByText('William A. Molina Quirós')).toBeInTheDocument()
        expect(screen.getByText('Andrey Meléndez Ovares')).toBeInTheDocument()
        expect(screen.getByText('A2060000')).toBeInTheDocument()
        expect(screen.getByText('Reactivo de prueba: 10')).toBeInTheDocument()
    })

    it('muestra un guion para bodega y detalle vacios, en vez de nada', async () => {
        vi.spyOn(auditoriaService, 'listarTrazabilidad').mockResolvedValue([registros[0]])

        renderTrazabilidadPage()

        await waitFor(() => {
            expect(screen.getAllByText('—')).toHaveLength(2)
        })
    })

    it('no muestra ningun control de edicion ni borrado', async () => {
        vi.spyOn(auditoriaService, 'listarTrazabilidad').mockResolvedValue(registros)

        renderTrazabilidadPage()

        await screen.findByText('Inicio de sesión')

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('muestra un mensaje cuando no hay registros', async () => {
        vi.spyOn(auditoriaService, 'listarTrazabilidad').mockResolvedValue([])

        renderTrazabilidadPage()

        expect(await screen.findByText('Todavía no hay registros de trazabilidad.')).toBeInTheDocument()
    })

    it('muestra un error cuando falla la carga', async () => {
        vi.spyOn(auditoriaService, 'listarTrazabilidad').mockRejectedValue(new Error('falló'))

        renderTrazabilidadPage()

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No fue posible cargar el registro de trazabilidad.',
        )
    })
})
