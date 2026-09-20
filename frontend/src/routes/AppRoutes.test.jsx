import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../context/AuthContext'
import AppRoutes from './AppRoutes'

function renderConSesion(entrada) {
    return render(
        <AuthContext.Provider
            value={{
                estaAutenticado: true,
                usuario: {
                    nombreCompleto: 'Persona de prueba',
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
    it('monta /dashboard e index renderiza el Dashboard', () => {
        renderConSesion('/dashboard')

        expect(
            screen.getByRole('heading', { name: 'Inicio' }),
        ).toBeInTheDocument()
    })

    it('las rutas hijas de /dashboard son relativas (sin error de ruta absoluta anidada)', () => {
        renderConSesion('/dashboard/admin/usuarios')

        expect(
            screen.getByRole('heading', { name: 'Usuarios' }),
        ).toBeInTheDocument()
    })
})