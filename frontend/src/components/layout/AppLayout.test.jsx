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
import { SincronizacionContext } from '../../context/SincronizacionContext'
import AppLayout from './AppLayout'

function renderConSesion(valorAuth, valorSincronizacion) {
    return render(
        <AuthContext.Provider value={valorAuth}>
            <SincronizacionContext.Provider value={{ sincronizar: vi.fn(), ...valorSincronizacion }}>
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
            </SincronizacionContext.Provider>
        </AuthContext.Provider>,
    )
}

describe('AppLayout', () => {
    it('permite cerrar sesion desde una pantalla autenticada', async () => {
        const logout = vi.fn().mockResolvedValue()

        renderConSesion({
            usuario: {
                nombreCompleto: 'William Molina',
                rol: 'Administrador',
            },
            logout,
            estaAutenticado: true,
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Menú de William Molina',
            }),
        )

        fireEvent.click(
            screen.getByRole('menuitem', {
                name: 'Cerrar sesión',
            }),
        )

        await waitFor(() => {
            expect(logout).toHaveBeenCalledTimes(1)
        })
    })

    it('HU-003 criterio 1: dispara la sincronizacion automatica al montar con sesion activa', () => {
        const sincronizar = vi.fn()

        renderConSesion(
            {
                usuario: { id: 7, nombreCompleto: 'William Molina', rol: 'Administrador' },
                token: 'jwt-prueba',
                logout: vi.fn(),
                estaAutenticado: true,
            },
            { sincronizar },
        )

        expect(sincronizar).toHaveBeenCalledTimes(1)
    })
})
