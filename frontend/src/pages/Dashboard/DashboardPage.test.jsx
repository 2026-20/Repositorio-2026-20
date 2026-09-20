import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AuthContext } from '../../context/AuthContext'
import DashboardPage from './DashboardPage'

function renderDashboard(usuario) {
    return render(
        <AuthContext.Provider value={{ usuario }}>
            <MemoryRouter>
                <DashboardPage />
            </MemoryRouter>
        </AuthContext.Provider>,
    )
}

describe('DashboardPage', () => {
    it('saluda con el primer nombre y muestra el rol', () => {
        renderDashboard({
            nombreCompleto: 'William Molina',
            rol: 'Administrador',
        })

        expect(screen.getByText('Hola, William')).toBeInTheDocument()
        expect(screen.getByText('Rol: Administrador')).toBeInTheDocument()
    })

    it('incluye el acceso a Usuarios solo para Administrador', () => {
        renderDashboard({
            nombreCompleto: 'William Molina',
            rol: 'Administrador',
        })

        expect(
            screen.getByRole('link', { name: /Usuarios/ }),
        ).toBeInTheDocument()
    })

    it('no incluye el acceso a Usuarios para Usuario de Campo', () => {
        renderDashboard({
            nombreCompleto: 'Andrey Meléndez',
            rol: 'Usuario de Campo',
        })

        expect(
            screen.queryByRole('link', { name: /Usuarios/ }),
        ).not.toBeInTheDocument()
    })

    it('marca las secciones sin implementar como proximamente', () => {
        renderDashboard({
            nombreCompleto: 'William Molina',
            rol: 'Administrador',
        })

        expect(screen.getAllByText('Próximamente').length).toBeGreaterThan(0)
    })
})
