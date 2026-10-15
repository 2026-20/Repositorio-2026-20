import { fireEvent, render, screen, act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useContext } from 'react'
import * as authService from '../services/authService'
import { cerrarSesion } from '../services/authService'
import { AuthProvider } from './AuthProvider'
import { AuthContext } from './AuthContext'
import { useAuth } from './useAuth'
import { validarSesion } from '../services/validarSesionService.js'
import { notificarSesionInvalidada } from '../services/sesionInvalidada.js'

vi.mock('../services/authService', async () => {
    const real = await vi.importActual('../services/authService')
    return {
        ...real,
        iniciarSesion: vi.fn(),
        cerrarSesion: vi.fn(),
    }
})

vi.mock('../services/validarSesionService.js', () => ({
    validarSesion: vi.fn(() => Promise.resolve({ id: 1 })),
}))

function ConsumidorAuth() {
    const { usuario, login, marcarContrasenaCambiada } = useAuth()

    return (
        <div>
            <p>
                Vencida:
                {usuario?.contrasenaVencida ? 'si' : 'no'}
            </p>

            <p>
                Primer ingreso:
                {usuario?.debeCambiarContrasena ? 'si' : 'no'}
            </p>

            <button
                onClick={() =>
                    login(
                        'wmolina',
                        'Clave123!',
                        1,
                        'CAPRIS Médica',
                    )
                }
            >
                Iniciar prueba
            </button>

            <button
                onClick={marcarContrasenaCambiada}
            >
                Marcar cambiada
            </button>
        </div>
    )
}

const TOKEN_ACTUAL = 'jwt-prueba'

function prepararSesion(token = TOKEN_ACTUAL) {
    sessionStorage.setItem(
        'capris_usuario',
        JSON.stringify({
            id: 1,
            nombreCompleto: 'Andrey Melendez',
            rol: 'Usuario de Campo',
        }),
    )

    sessionStorage.setItem('capris_token', token)
}

function MostrarSesion() {
    const { usuario, token, estaAutenticado } = useContext(AuthContext)

    return (
        <div>
            <span data-testid="usuario">
                {usuario?.nombreCompleto ?? 'Sin usuario'}
            </span>

            <span data-testid="token">
                {token ?? 'Sin token'}
            </span>

            <span data-testid="autenticado">
                {estaAutenticado ? 'Si' : 'No'}
            </span>
        </div>
    )
}

describe('AuthProvider - HU-049', () => {
    beforeEach(() => {
        sessionStorage.clear()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        sessionStorage.clear()
    })

    it('guarda contrasenaVencida cuando el backend la devuelve en true', async () => {
        vi.spyOn(authService, 'iniciarSesion')
            .mockResolvedValue({
                token: 'token-prueba',
                usuarioId: 20,
                nombreCompleto: 'William Molina',
                rol: 'Administrador',
                debeCambiarContrasena: false,
                contrasenaVencida: true,
            })

        render(
            <AuthProvider>
                <ConsumidorAuth />
            </AuthProvider>,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Iniciar prueba' }))

        await waitFor(() => {
            expect(screen.getByText(/Vencida:\s*si/i)).toBeInTheDocument()
        })

        const usuarioGuardado = JSON.parse(sessionStorage.getItem('capris_usuario'))

        expect(usuarioGuardado.contrasenaVencida).toBe(true)
        expect(usuarioGuardado.debeCambiarContrasena).toBe(false)
        expect(sessionStorage.getItem('capris_token')).toBe('token-prueba')
    })

    it('marca la contrasena como vigente despues de un cambio exitoso', () => {
        sessionStorage.setItem(
            'capris_usuario',
            JSON.stringify({
                id: 20,
                nombreCompleto: 'William Molina',
                rol: 'Administrador',
                debeCambiarContrasena: false,
                contrasenaVencida: true,
                empresaNombre: 'CAPRIS Médica',
            }),
        )

        sessionStorage.setItem('capris_token', 'token-prueba')

        render(
            <AuthProvider>
                <ConsumidorAuth />
            </AuthProvider>,
        )

        expect(screen.getByText(/Vencida:\s*si/i)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Marcar cambiada' }))

        expect(screen.getByText(/Vencida:\s*no/i)).toBeInTheDocument()

        const usuarioGuardado = JSON.parse(sessionStorage.getItem('capris_usuario'))

        expect(usuarioGuardado.contrasenaVencida).toBe(false)
        expect(usuarioGuardado.debeCambiarContrasena).toBe(false)
    })

    it('limpia tambien el primer ingreso al marcar la contrasena como cambiada', () => {
        sessionStorage.setItem(
            'capris_usuario',
            JSON.stringify({
                id: 20,
                nombreCompleto: 'William Molina',
                rol: 'Administrador',
                debeCambiarContrasena: true,
                contrasenaVencida: false,
                empresaNombre: 'CAPRIS Médica',
            }),
        )

        sessionStorage.setItem('capris_token', 'token-prueba')

        render(
            <AuthProvider>
                <ConsumidorAuth />
            </AuthProvider>,
        )

        expect(screen.getByText(/Primer ingreso:\s*si/i)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Marcar cambiada' }))

        expect(screen.getByText(/Primer ingreso:\s*no/i)).toBeInTheDocument()

        const usuarioGuardado = JSON.parse(sessionStorage.getItem('capris_usuario'))

        expect(usuarioGuardado.debeCambiarContrasena).toBe(false)
        expect(usuarioGuardado.contrasenaVencida).toBe(false)
    })
})

describe('HU-036 - AuthProvider', () => {
    beforeEach(() => {
        sessionStorage.clear()
        vi.clearAllMocks()

        vi.mocked(validarSesion).mockResolvedValue({ id: 1 })
    })

    afterEach(() => {
        sessionStorage.clear()
    })

    it('elimina la sesion cuando se invalida su JWT actual', () => {
        prepararSesion()

        render(
            <AuthProvider>
                <MostrarSesion />
            </AuthProvider>,
        )

        expect(screen.getByTestId('autenticado').textContent)
            .toBe('Si')

        act(() => {
            notificarSesionInvalidada(TOKEN_ACTUAL)
        })

        expect(screen.getByTestId('usuario').textContent)
            .toBe('Sin usuario')

        expect(screen.getByTestId('token').textContent)
            .toBe('Sin token')

        expect(screen.getByTestId('autenticado').textContent)
            .toBe('No')

        expect(sessionStorage.getItem('capris_usuario'))
            .toBeNull()

        expect(sessionStorage.getItem('capris_token'))
            .toBeNull()
    })

    it('mantiene la sesion si no recibe invalidacion', () => {
        prepararSesion()

        render(
            <AuthProvider>
                <MostrarSesion />
            </AuthProvider>,
        )

        expect(screen.getByTestId('usuario').textContent)
            .toBe('Andrey Melendez')

        expect(screen.getByTestId('autenticado').textContent)
            .toBe('Si')

        expect(sessionStorage.getItem('capris_token'))
            .toBe(TOKEN_ACTUAL)
    })

    it('comprueba la sesion cuando vuelve la conexion', async () => {
        prepararSesion()

        render(
            <AuthProvider>
                <MostrarSesion />
            </AuthProvider>,
        )

        await waitFor(() => {
            expect(validarSesion).toHaveBeenCalledWith(
                TOKEN_ACTUAL,
                1,
            )
        })

        vi.mocked(validarSesion).mockClear()

        act(() => {
            window.dispatchEvent(new Event('online'))
        })

        await waitFor(() => {
            expect(validarSesion).toHaveBeenCalledWith(
                TOKEN_ACTUAL,
                1,
            )
        })

        expect(screen.getByTestId('autenticado').textContent)
            .toBe('Si')

        expect(cerrarSesion).not.toHaveBeenCalled()
    })

    it('cierra la sesion al reconectarse si el backend la invalida', async () => {
        prepararSesion()

        render(
            <AuthProvider>
                <MostrarSesion />
            </AuthProvider>,
        )

        await waitFor(() => {
            expect(validarSesion).toHaveBeenCalled()
        })

        vi.mocked(validarSesion).mockClear()

        vi.mocked(validarSesion).mockImplementationOnce(async () => {
            notificarSesionInvalidada(TOKEN_ACTUAL)

            throw Object.assign(
                new Error('No hay sesion activa'),
                { status: 401 },
            )
        })

        await act(async () => {
            window.dispatchEvent(new Event('online'))
        })

        await waitFor(() => {
            expect(screen.getByTestId('autenticado').textContent)
                .toBe('No')
        })

        expect(screen.getByTestId('usuario').textContent)
            .toBe('Sin usuario')

        expect(sessionStorage.getItem('capris_usuario'))
            .toBeNull()

        expect(sessionStorage.getItem('capris_token'))
            .toBeNull()

        expect(cerrarSesion).not.toHaveBeenCalled()
    })

    it('no cierra la sesion si se invalida un JWT anterior', () => {
        prepararSesion('jwt-usuario-nuevo')

        render(
            <AuthProvider>
                <MostrarSesion />
            </AuthProvider>,
        )

        act(() => {
            notificarSesionInvalidada('jwt-usuario-anterior')
        })

        expect(screen.getByTestId('autenticado').textContent)
            .toBe('Si')

        expect(screen.getByTestId('usuario').textContent)
            .toBe('Andrey Melendez')

        expect(screen.getByTestId('token').textContent)
            .toBe('jwt-usuario-nuevo')

        expect(sessionStorage.getItem('capris_token'))
            .toBe('jwt-usuario-nuevo')
    })

    it('no cierra la sesion cuando el evento no tiene JWT', () => {
        prepararSesion()

        render(
            <AuthProvider>
                <MostrarSesion />
            </AuthProvider>,
        )

        act(() => {
            notificarSesionInvalidada()
        })

        expect(screen.getByTestId('autenticado').textContent)
            .toBe('Si')

        expect(sessionStorage.getItem('capris_token'))
            .toBe(TOKEN_ACTUAL)
    })
})
