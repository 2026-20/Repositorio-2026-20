import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ThemeToggle from './ThemeToggle'

describe('ThemeToggle', () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.removeAttribute('data-theme')
    })

    afterEach(() => {
        localStorage.clear()
        document.documentElement.removeAttribute('data-theme')
    })

    it('alterna entre claro y oscuro con un solo clic, sin pasar por "sistema"', () => {
        render(<ThemeToggle />)

        const boton = screen.getByRole('button')
        fireEvent.click(boton)
        const primerTema = document.documentElement.getAttribute('data-theme')

        fireEvent.click(boton)
        const segundoTema = document.documentElement.getAttribute('data-theme')

        expect(['light', 'dark']).toContain(primerTema)
        expect(segundoTema).not.toBe(primerTema)
    })
})
