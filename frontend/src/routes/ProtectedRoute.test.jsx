import { render, screen } from '@testing-library/react'
import {
    MemoryRouter,
    Route,
    Routes,
} from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AuthContext } from '../context/AuthContext'
import ProtectedRoute from './ProtectedRoute'

describe('ProtectedRoute', () => {
    it('redirige al login cuando no existe sesion', () => {
        render(
            <AuthContext.Provider
                value={{
                    estaAutenticado: false,
                }}
            >
                <MemoryRouter
                    initialEntries={['/dashboard']}
                >
                    <Routes>
                        <Route
                            path="/login"
                            element={<p>Página de login</p>}
                        />

                        <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute>
                                    <p>Dashboard privado</p>
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </MemoryRouter>
            </AuthContext.Provider>,
        )

        expect(
            screen.getByText('Página de login'),
        ).toBeInTheDocument()

        expect(
            screen.queryByText('Dashboard privado'),
        ).not.toBeInTheDocument()
    })

    it('permite entrar cuando existe sesion', () => {
        render(
            <AuthContext.Provider
                value={{
                    estaAutenticado: true,
                }}
            >
                <MemoryRouter
                    initialEntries={['/dashboard']}
                >
                    <Routes>
                        <Route
                            path="/login"
                            element={<p>Página de login</p>}
                        />

                        <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute>
                                    <p>Dashboard privado</p>
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </MemoryRouter>
            </AuthContext.Provider>,
        )

        expect(
            screen.getByText('Dashboard privado'),
        ).toBeInTheDocument()
    })

    it('redirige al dashboard cuando el rol no coincide con el requerido', () => {
        render(
            <AuthContext.Provider
                value={{
                    estaAutenticado: true,
                    usuario: { rol: 'Usuario de Campo' },
                }}
            >
                <MemoryRouter
                    initialEntries={['/admin/usuarios']}
                >
                    <Routes>
                        <Route
                            path="/dashboard"
                            element={<p>Dashboard privado</p>}
                        />

                        <Route
                            path="/admin/usuarios"
                            element={
                                <ProtectedRoute rolRequerido="Administrador">
                                    <p>Panel de usuarios</p>
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </MemoryRouter>
            </AuthContext.Provider>,
        )

        expect(
            screen.getByText('Dashboard privado'),
        ).toBeInTheDocument()

        expect(
            screen.queryByText('Panel de usuarios'),
        ).not.toBeInTheDocument()
    })

    it('permite entrar cuando el rol coincide con el requerido', () => {
        render(
            <AuthContext.Provider
                value={{
                    estaAutenticado: true,
                    usuario: { rol: 'Administrador' },
                }}
            >
                <MemoryRouter
                    initialEntries={['/admin/usuarios']}
                >
                    <Routes>
                        <Route
                            path="/admin/usuarios"
                            element={
                                <ProtectedRoute rolRequerido="Administrador">
                                    <p>Panel de usuarios</p>
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </MemoryRouter>
            </AuthContext.Provider>,
        )

        expect(
            screen.getByText('Panel de usuarios'),
        ).toBeInTheDocument()
    })
})