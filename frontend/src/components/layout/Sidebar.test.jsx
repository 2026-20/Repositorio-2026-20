import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import Sidebar from './Sidebar'

describe('Sidebar', () => {
    it('muestra Usuarios para un Administrador', () => {
        render(
            <MemoryRouter>
                <Sidebar rolUsuario="Administrador" />
            </MemoryRouter>,
        )

        expect(
            screen.getByRole('link', { name: /Usuarios/ }),
        ).toBeInTheDocument()
    })

    it('oculta Usuarios para un Usuario de Campo', () => {
        render(
            <MemoryRouter>
                <Sidebar rolUsuario="Usuario de Campo" />
            </MemoryRouter>,
        )

        expect(
            screen.queryByRole('link', { name: /Usuarios/ }),
        ).not.toBeInTheDocument()
    })

    it('marca las secciones sin implementar como no navegables', () => {
        render(
            <MemoryRouter>
                <Sidebar rolUsuario="Administrador" />
            </MemoryRouter>,
        )

        expect(
            screen.queryByRole('link', { name: /Alertas/ }),
        ).not.toBeInTheDocument()

        expect(screen.getByText('Alertas')).toBeInTheDocument()
    })

    it('HU-021: Conteo ya esta implementado y es navegable', () => {
        render(
            <MemoryRouter>
                <Sidebar rolUsuario="Usuario de Campo" />
            </MemoryRouter>,
        )

        expect(screen.getByRole('link', { name: /Conteo/ })).toBeInTheDocument()
    })

    it('muestra el nombre de la empresa de la sesion como marca', () => {
        render(
            <MemoryRouter>
                <Sidebar rolUsuario="Usuario de Campo" empresaNombre="CAPRIS Médica" />
            </MemoryRouter>,
        )

        expect(screen.getByText('CAPRIS Médica')).toBeInTheDocument()
    })

    it('usa la marca generica si la sesion no trae empresa', () => {
        render(
            <MemoryRouter>
                <Sidebar rolUsuario="Usuario de Campo" />
            </MemoryRouter>,
        )

        expect(screen.getAllByText('CAPRIS').length).toBeGreaterThan(0)
    })
})
