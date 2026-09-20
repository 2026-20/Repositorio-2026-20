import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import AjustesPage from './AjustesPage'

describe('AjustesPage', () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.removeAttribute('data-theme')
    })

    afterEach(() => {
        localStorage.clear()
        document.documentElement.removeAttribute('data-theme')
    })

    it('muestra exactamente dos opciones: Claro y Oscuro (sin "sistema")', () => {
        render(<AjustesPage />)

        const opciones = screen.getAllByRole('radio')
        expect(opciones).toHaveLength(2)
        expect(screen.getByRole('radio', { name: /Claro/ })).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: /Oscuro/ })).toBeInTheDocument()
        expect(screen.queryByText(/Sistema/i)).not.toBeInTheDocument()
    })

    it('al elegir Oscuro, aplica data-theme=dark de inmediato', () => {
        render(<AjustesPage />)

        fireEvent.click(screen.getByRole('radio', { name: /Oscuro/ }))

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
        expect(screen.getByRole('radio', { name: /Oscuro/ })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByRole('radio', { name: /Claro/ })).toHaveAttribute('aria-checked', 'false')
    })

    it('al elegir Claro, aplica data-theme=light y persiste la eleccion', () => {
        render(<AjustesPage />)

        fireEvent.click(screen.getByRole('radio', { name: /Claro/ }))

        expect(document.documentElement.getAttribute('data-theme')).toBe('light')
        expect(localStorage.getItem('capris_tema')).toBe('claro')
    })
})
