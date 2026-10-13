
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { useContext } from 'react'
import { AuthProvider } from './AuthProvider'
import { AuthContext } from './AuthContext'
import { validarSesion } from '../services/validarSesionService.js'
import { cerrarSesion } from '../services/authService'
import { notificarSesionInvalidada } from '../services/sesionInvalidada.js'

vi.mock('../services/authService', () => ({
    iniciarSesion: vi.fn(),
    cerrarSesion: vi.fn(),
}))

vi.mock('../services/validarSesionService.js', () => ({
    validarSesion: vi.fn(() => Promise.resolve({ id: 1 })),
}))

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

describe('HU-036 - AuthProvider', () => {
    beforeEach(() => {
        sessionStorage.clear()
        vi.clearAllMocks()

        vi.mocked(validarSesion).mockResolvedValue({ id: 1 })
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