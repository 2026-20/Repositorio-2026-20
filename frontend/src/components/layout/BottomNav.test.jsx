import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import BottomNav from './BottomNav'

describe('BottomNav', () => {
    it('muestra todos los items disponibles, sin boton "Mas"', () => {
        render(
            <MemoryRouter>
                <BottomNav rolUsuario="Administrador" />
            </MemoryRouter>,
        )

        expect(screen.getByRole('link', { name: /Inicio/ })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Usuarios/ })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Ajustes/ })).toBeInTheDocument()
        expect(screen.queryByText('Más')).not.toBeInTheDocument()
    })

    it('oculta Usuarios para un Usuario de Campo', () => {
        render(
            <MemoryRouter>
                <BottomNav rolUsuario="Usuario de Campo" />
            </MemoryRouter>,
        )

        expect(screen.queryByRole('link', { name: /Usuarios/ })).not.toBeInTheDocument()
    })

    it('muestra las secciones sin implementar como no navegables', () => {
        render(
            <MemoryRouter>
                <BottomNav rolUsuario="Administrador" />
            </MemoryRouter>,
        )

        expect(screen.queryByRole('link', { name: /Conteo/ })).not.toBeInTheDocument()
        expect(screen.getByTitle(/Conteo \(próximamente\)/)).toBeInTheDocument()
    })

    it('no muestra etiquetas de texto, solo iconos', () => {
        render(
            <MemoryRouter>
                <BottomNav rolUsuario="Administrador" />
            </MemoryRouter>,
        )

        expect(screen.queryByText('Inicio')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Inicio' })).toBeInTheDocument()
    })
})
