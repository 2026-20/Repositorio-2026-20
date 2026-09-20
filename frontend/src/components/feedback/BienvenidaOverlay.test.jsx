import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BienvenidaOverlay from './BienvenidaOverlay'

describe('BienvenidaOverlay', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('no renderiza nada si visible es false', () => {
        render(
            <BienvenidaOverlay nombre="William" visible={false} onTerminar={() => {}} />,
        )

        expect(screen.queryByText(/Hola/)).not.toBeInTheDocument()
    })

    it('muestra el saludo con el nombre cuando visible es true', () => {
        render(
            <BienvenidaOverlay nombre="William" visible onTerminar={() => {}} />,
        )

        expect(screen.getByText('Hola, William')).toBeInTheDocument()
        expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('llama a onTerminar por respaldo si el navegador no dispara animationend', () => {
        const onTerminar = vi.fn()

        render(
            <BienvenidaOverlay nombre="William" visible onTerminar={onTerminar} />,
        )

        expect(onTerminar).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1900)

        expect(onTerminar).toHaveBeenCalledTimes(1)
    })

    it('no deja el respaldo pendiente si visible pasa a false antes de tiempo', () => {
        const onTerminar = vi.fn()

        const { rerender } = render(
            <BienvenidaOverlay nombre="William" visible onTerminar={onTerminar} />,
        )

        rerender(
            <BienvenidaOverlay nombre="William" visible={false} onTerminar={onTerminar} />,
        )

        vi.advanceTimersByTime(1900)

        expect(onTerminar).not.toHaveBeenCalled()
    })
})
