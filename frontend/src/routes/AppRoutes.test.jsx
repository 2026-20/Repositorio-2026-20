import {
    fireEvent,
    render,
    screen,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../context/AuthContext'
import AppRoutes from './AppRoutes'

function renderConSesion(entrada, rol = 'Administrador') {
    return render(
        <AuthContext.Provider
            value={{
                estaAutenticado: true,
                usuario: {
                    nombreCompleto: 'Persona de prueba',
                    rol,
                },
                logout: vi.fn(),
            }}
        >
            <MemoryRouter
                initialEntries={[entrada]}
            >
                <AppRoutes />
            </MemoryRouter>
        </AuthContext.Provider>,
    )
}

describe('AppRoutes', () => {
    it('monta /dashboard y renderiza el Dashboard', async () => {
        renderConSesion('/dashboard')

        expect(
            await screen.findByRole('heading', { name: 'Accesos' }),
        ).toBeInTheDocument()
    })

    it('la ruta de usuarios es absoluta bajo el layout (sin error de ruta anidada en CI)', async () => {
        renderConSesion('/admin/usuarios')

        expect(
            await screen.findByRole('heading', { name: 'Usuarios' }),
        ).toBeInTheDocument()
    })

    it('/dashboard/admin/usuarios ya no existe y no rompe el arranque (vuelve al dashboard)', async () => {
        renderConSesion('/dashboard/admin/usuarios')

        expect(
            await screen.findByRole('heading', { name: 'Accesos' }),
        ).toBeInTheDocument()
    })

    it('el enlace del login navega a /recuperar-contrasena y monta la pantalla de HU-046', async () => {
        render(
            <AuthContext.Provider
                value={{
                    estaAutenticado: false,
                    login: vi.fn(),
                }}
            >
                <MemoryRouter
                    initialEntries={['/login']}
                >
                    <AppRoutes />
                </MemoryRouter>
            </AuthContext.Provider>,
        )

        fireEvent.click(
            screen.getByRole('link', {
                name: '¿Olvidaste tu contraseña?',
            }),
        )

        expect(
            await screen.findByRole('heading', {
                name: 'Recuperar contraseña',
            }),
        ).toBeInTheDocument()
    })
})