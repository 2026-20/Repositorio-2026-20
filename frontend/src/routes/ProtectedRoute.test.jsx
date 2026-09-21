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

    // HU-044 AC2: mientras la contraseña temporal siga vigente, ninguna otra
    // ruta es accesible, sin importar el rol.
    describe('primer ingreso pendiente (HU-044)', () => {
        function renderEn(ruta, usuario, rolRequerido) {
            render(
                <AuthContext.Provider
                    value={{ estaAutenticado: true, usuario }}
                >
                    <MemoryRouter initialEntries={[ruta]}>
                        <Routes>
                            <Route
                                path="/primer-ingreso/cambiar-password"
                                element={
                                    <ProtectedRoute>
                                        <p>Cambio obligatorio</p>
                                    </ProtectedRoute>
                                }
                            />

                            <Route
                                path="/dashboard"
                                element={
                                    <ProtectedRoute>
                                        <p>Dashboard privado</p>
                                    </ProtectedRoute>
                                }
                            />

                            <Route
                                path="/admin/usuarios"
                                element={
                                    <ProtectedRoute rolRequerido={rolRequerido}>
                                        <p>Panel de usuarios</p>
                                    </ProtectedRoute>
                                }
                            />
                        </Routes>
                    </MemoryRouter>
                </AuthContext.Provider>,
            )
        }

        it('redirige al cambio obligatorio cuando intenta entrar al dashboard', () => {
            renderEn('/dashboard', { rol: 'Usuario de Campo', debeCambiarContrasena: true })

            expect(screen.getByText('Cambio obligatorio')).toBeInTheDocument()
            expect(screen.queryByText('Dashboard privado')).not.toBeInTheDocument()
        })

        it('redirige al cambio obligatorio aunque sea Administrador y la ruta sea de su rol', () => {
            renderEn(
                '/admin/usuarios',
                { rol: 'Administrador', debeCambiarContrasena: true },
                'Administrador',
            )

            expect(screen.getByText('Cambio obligatorio')).toBeInTheDocument()
            expect(screen.queryByText('Panel de usuarios')).not.toBeInTheDocument()
        })

        it('deja ver la pantalla de cambio obligatorio sin entrar en bucle', () => {
            renderEn('/primer-ingreso/cambiar-password', {
                rol: 'Usuario de Campo',
                debeCambiarContrasena: true,
            })

            expect(screen.getByText('Cambio obligatorio')).toBeInTheDocument()
        })

        it('saca del cambio obligatorio a quien ya no tiene la contraseña temporal', () => {
            renderEn('/primer-ingreso/cambiar-password', {
                rol: 'Usuario de Campo',
                debeCambiarContrasena: false,
            })

            expect(screen.getByText('Dashboard privado')).toBeInTheDocument()
            expect(screen.queryByText('Cambio obligatorio')).not.toBeInTheDocument()
        })
    })
})
