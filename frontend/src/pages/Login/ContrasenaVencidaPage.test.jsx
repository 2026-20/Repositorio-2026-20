import {
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'

import { AuthContext } from '../../context/AuthContext'
import * as authService from '../../services/authService'
import ContrasenaVencidaPage from './ContrasenaVencidaPage'

function renderPagina({
                          usuario = {
                              nombreCompleto: 'Persona de prueba',
                              contrasenaVencida: true,
                          },
                          token = 'token-prueba',
                          logout = vi.fn(),
                          marcarContrasenaCambiada = vi.fn(),
                      } = {}) {
    return {
        logout,
        marcarContrasenaCambiada,

        ...render(
            <AuthContext.Provider
                value={{
                    usuario,
                    token,
                    logout,
                    marcarContrasenaCambiada,
                }}
            >
                <MemoryRouter>
                    <ContrasenaVencidaPage />
                </MemoryRouter>
            </AuthContext.Provider>,
        ),
    }
}

describe('ContrasenaVencidaPage - HU-049', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('muestra que la contraseña esta vencida y solicita la contraseña actual', () => {
        renderPagina()

        expect(
            screen.getByRole('heading', {
                name: 'Contraseña vencida',
            }),
        ).toBeInTheDocument()

        expect(
            screen.getByLabelText('Contraseña actual'),
        ).toBeInTheDocument()

        expect(
            screen.getByLabelText('Contraseña nueva'),
        ).toBeInTheDocument()

        expect(
            screen.getByLabelText('Confirmar contraseña nueva'),
        ).toBeInTheDocument()
    })

    it('muestra el nombre del usuario en el mensaje', () => {
        renderPagina({
            usuario: {
                nombreCompleto: 'Ana Vargas',
                contrasenaVencida: true,
            },
        })

        expect(
            screen.getByText(/Ana Vargas/i),
        ).toBeInTheDocument()
    })

    it('no envia el cambio cuando la confirmacion no coincide', async () => {
        const cambiarContrasena = vi
            .spyOn(authService, 'cambiarContrasena')
            .mockResolvedValue({})

        renderPagina()

        fireEvent.change(
            screen.getByLabelText('Contraseña actual'),
            {
                target: {
                    value: 'Actual123!',
                },
            },
        )

        fireEvent.change(
            screen.getByLabelText('Contraseña nueva'),
            {
                target: {
                    value: 'Nueva123!',
                },
            },
        )

        fireEvent.change(
            screen.getByLabelText('Confirmar contraseña nueva'),
            {
                target: {
                    value: 'Otra123!',
                },
            },
        )

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Guardar y continuar',
            }),
        )

        expect(
            await screen.findByRole('alert'),
        ).toHaveTextContent(
            'La confirmación no coincide con la contraseña nueva.',
        )

        expect(cambiarContrasena)
            .not.toHaveBeenCalled()
    })

    it('envia la contraseña actual y la nueva al backend', async () => {
        const cambiarContrasena = vi
            .spyOn(authService, 'cambiarContrasena')
            .mockResolvedValue({})

        renderPagina()

        fireEvent.change(
            screen.getByLabelText('Contraseña actual'),
            {
                target: {
                    value: 'Actual123!',
                },
            },
        )

        fireEvent.change(
            screen.getByLabelText('Contraseña nueva'),
            {
                target: {
                    value: 'Nueva123!',
                },
            },
        )

        fireEvent.change(
            screen.getByLabelText('Confirmar contraseña nueva'),
            {
                target: {
                    value: 'Nueva123!',
                },
            },
        )

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Guardar y continuar',
            }),
        )

        await waitFor(() => {
            expect(cambiarContrasena)
                .toHaveBeenCalledWith(
                    'token-prueba',
                    'Actual123!',
                    'Nueva123!',
                )
        })
    })

    it('marca la contraseña como cambiada despues de un cambio exitoso', async () => {
        vi.spyOn(authService, 'cambiarContrasena')
            .mockResolvedValue({})

        const marcarContrasenaCambiada = vi.fn()

        renderPagina({
            marcarContrasenaCambiada,
        })

        fireEvent.change(
            screen.getByLabelText('Contraseña actual'),
            {
                target: {
                    value: 'Actual123!',
                },
            },
        )

        fireEvent.change(
            screen.getByLabelText('Contraseña nueva'),
            {
                target: {
                    value: 'Nueva123!',
                },
            },
        )

        fireEvent.change(
            screen.getByLabelText('Confirmar contraseña nueva'),
            {
                target: {
                    value: 'Nueva123!',
                },
            },
        )

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Guardar y continuar',
            }),
        )

        await waitFor(() => {
            expect(marcarContrasenaCambiada)
                .toHaveBeenCalledTimes(1)
        })
    })

    it('permite cerrar sesion', () => {
        const logout = vi.fn()

        renderPagina({
            logout,
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Cerrar sesión',
            }),
        )

        expect(logout)
            .toHaveBeenCalledTimes(1)
    })
})
