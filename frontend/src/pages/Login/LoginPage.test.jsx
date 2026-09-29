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

describe('LoginPage - mensajes de error', () => {
    // Antes esta pantalla reescribía el mensaje de CUENTA_BLOQUEADA por un
    // texto fijo, así que el tiempo real restante que ahora calcula el
    // backend nunca llegaba a mostrarse -- este caso evita que eso se repita.
    it('muestra el mensaje real del backend cuando la cuenta esta bloqueada, sin reescribirlo', async () => {
        vi.spyOn(authService, 'obtenerEmpresas').mockResolvedValue([
            { id: 1, nombre: 'CAPRIS Médica' },
        ])

        const error = Object.assign(
            new Error('Cuenta bloqueada temporalmente tras múltiples intentos fallidos. Podés reintentar en 3 minutos.'),
            { codigo: 'CUENTA_BLOQUEADA' },
        )
        const login = vi.fn().mockRejectedValue(error)

        render(
            <AuthContext.Provider value={{ login, estaAutenticado: false }}>
                <MemoryRouter>
                    <LoginPage />
                </MemoryRouter>
            </AuthContext.Provider>,
        )

        await screen.findByAltText('Logo de CAPRIS Médica')

        fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'wmolina' } })
        fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'algo' } })
        fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Cuenta bloqueada temporalmente tras múltiples intentos fallidos. Podés reintentar en 3 minutos.',
        )
    })
})
