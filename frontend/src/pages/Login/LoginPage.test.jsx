import {
    fireEvent,
    render,
    screen,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../../context/AuthContext'
import * as authService from '../../services/authService'
import LoginPage from './LoginPage'

function renderLoginPage() {
    return render(
        <AuthContext.Provider
            value={{
                login: vi.fn(),
                estaAutenticado: false,
            }}
        >
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>
        </AuthContext.Provider>,
    )
}

describe('LoginPage - logo por empresa', () => {
    it('muestra el logo de CAPRIS Médica cuando esa es la unica empresa y se autoselecciona', async () => {
        vi.spyOn(authService, 'obtenerEmpresas').mockResolvedValue([
            { id: 1, nombre: 'CAPRIS Médica' },
        ])

        renderLoginPage()

        const logo = await screen.findByAltText('Logo de CAPRIS Médica')

        expect(logo).toBeInTheDocument()
        expect(
            screen.queryByRole('heading', { name: 'Iniciar sesión' }),
        ).not.toBeInTheDocument()
    })

    it('no muestra ningun logo mientras no haya empresa seleccionada, con varias empresas disponibles', async () => {
        vi.spyOn(authService, 'obtenerEmpresas').mockResolvedValue([
            { id: 1, nombre: 'CAPRIS Médica' },
            { id: 2, nombre: 'Diagnostika' },
        ])

        renderLoginPage()

        await screen.findByRole('heading', { name: 'Iniciar sesión' })

        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('cambia el logo a Diagnostika cuando se selecciona esa empresa en el listado', async () => {
        vi.spyOn(authService, 'obtenerEmpresas').mockResolvedValue([
            { id: 1, nombre: 'CAPRIS Médica' },
            { id: 2, nombre: 'Diagnostika' },
        ])

        renderLoginPage()

        await screen.findByRole('heading', { name: 'Iniciar sesión' })

        fireEvent.change(screen.getByLabelText('Empresa'), {
            target: { value: '2' },
        })

        expect(
            await screen.findByAltText('Logo de Diagnostika'),
        ).toBeInTheDocument()
    })
})

// HU-044: quien entra con contraseña temporal aterriza en el cambio obligatorio,
// no en el dashboard.
describe('LoginPage - destino tras autenticarse', () => {
    function renderAutenticado(usuario) {
        vi.spyOn(authService, 'obtenerEmpresas').mockResolvedValue([])

        render(
            <AuthContext.Provider
                value={{ login: vi.fn(), estaAutenticado: true, usuario }}
            >
                <MemoryRouter initialEntries={['/login']}>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/dashboard" element={<p>Dashboard</p>} />
                        <Route
                            path="/primer-ingreso/cambiar-password"
                            element={<p>Cambio obligatorio</p>}
                        />
                    </Routes>
                </MemoryRouter>
            </AuthContext.Provider>,
        )
    }

    it('lleva al cambio obligatorio cuando la contraseña es temporal', () => {
        renderAutenticado({ debeCambiarContrasena: true })

        expect(screen.getByText('Cambio obligatorio')).toBeInTheDocument()
    })

    it('lleva al dashboard cuando la contraseña ya es propia', () => {
        renderAutenticado({ debeCambiarContrasena: false })

        expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
})
