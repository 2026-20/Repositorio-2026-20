import {
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react'
import {
    MemoryRouter,
    Route,
    Routes,
} from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../../context/AuthContext'
import AppLayout from './AppLayout'

describe('AppLayout', () => {
    it('permite cerrar sesion desde una pantalla autenticada', async () => {
        const logout = vi.fn().mockResolvedValue()

        render(
            <AuthContext.Provider
                value={{
                    usuario: {
                        nombreCompleto: 'William Molina',
                    },
                    logout,
                    estaAutenticado: true,
                }}
            >
                <MemoryRouter initialEntries={['/dashboard']}>
                    <Routes>
                        <Route element={<AppLayout />}>
                            <Route
                                path="/dashboard"
                                element={<p>Contenido privado</p>}
                            />
                        </Route>
                    </Routes>
                </MemoryRouter>
            </AuthContext.Provider>,
        )

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Cerrar sesión',
            }),
        )

        await waitFor(() => {
            expect(logout).toHaveBeenCalledTimes(1)
        })
    })
})