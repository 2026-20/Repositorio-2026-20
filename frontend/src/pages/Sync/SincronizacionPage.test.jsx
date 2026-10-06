import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SincronizacionContext } from '../../context/SincronizacionContext'
import SincronizacionPage from './SincronizacionPage'

function renderConEstado(estadoParcial) {
    const valor = {
        estado: 'inactivo',
        error: null,
        ultimaSincronizacion: null,
        sincronizar: vi.fn(),
        ...estadoParcial,
    }

    return render(
        <SincronizacionContext.Provider value={valor}>
            <SincronizacionPage />
        </SincronizacionContext.Provider>,
    )
}

describe('SincronizacionPage', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('muestra que todavia no se ha sincronizado cuando no hay fecha previa', () => {
        renderConEstado({})

        expect(screen.getByText(/todavía no se ha sincronizado/)).toBeInTheDocument()
    })

    it('muestra la fecha de la ultima sincronizacion cuando existe', () => {
        renderConEstado({ ultimaSincronizacion: '2026-10-05T20:00:00.000Z' })

        expect(screen.queryByText(/todavía no se ha sincronizado/)).not.toBeInTheDocument()
    })

    it('muestra el motivo especifico del error cuando la sincronizacion falla (criterio 3)', () => {
        renderConEstado({ estado: 'error', error: new Error('Token invalido') })

        expect(screen.getByRole('alert')).toHaveTextContent('Token invalido')
    })

    it('deshabilita el boton y avisa cuando no hay conexion', () => {
        vi.stubGlobal('navigator', { ...navigator, onLine: false })

        renderConEstado({})

        expect(screen.getByRole('status')).toHaveTextContent(/No hay conexión/)
        expect(screen.getByRole('button', { name: /Sincronizar ahora/ })).toBeDisabled()
    })

    it('dispara sincronizar al hacer click en el boton', () => {
        const sincronizar = vi.fn()
        renderConEstado({ sincronizar })

        fireEvent.click(screen.getByRole('button', { name: /Sincronizar ahora/ }))

        expect(sincronizar).toHaveBeenCalledTimes(1)
    })

    it('deshabilita el boton y muestra "Sincronizando…" mientras esta en curso', () => {
        renderConEstado({ estado: 'sincronizando' })

        expect(screen.getByRole('button', { name: /Sincronizando/ })).toBeDisabled()
    })
})
