import {fireEvent, render, screen, waitFor,} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi,} from 'vitest'
import * as authService from '../services/authService'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

function ConsumidorAuth() {
    const {usuario, login, marcarContrasenaCambiada,} = useAuth()

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

describe('AuthProvider - HU-049', () => {beforeEach(() => {sessionStorage.clear()})

    afterEach(() => {vi.restoreAllMocks()
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

        fireEvent.click(screen.getByRole('button', {name: 'Iniciar prueba',}),)

        await waitFor(() => {
            expect(screen.getByText(/Vencida:\s*si/i),).toBeInTheDocument()
        })

        const usuarioGuardado = JSON.parse(sessionStorage.getItem('capris_usuario'),)

        expect(usuarioGuardado.contrasenaVencida).toBe(true)
        expect(usuarioGuardado.debeCambiarContrasena).toBe(false)
        expect(sessionStorage.getItem('capris_token'),).toBe('token-prueba')
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

        sessionStorage.setItem(
            'capris_token',
            'token-prueba',
        )

        render(
            <AuthProvider>
                <ConsumidorAuth />
            </AuthProvider>,
        )

        expect(
            screen.getByText(/Vencida:\s*si/i),).toBeInTheDocument()

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Marcar cambiada',
            }),
        )

        expect(screen.getByText(/Vencida:\s*no/i),).toBeInTheDocument()

        const usuarioGuardado = JSON.parse(
            sessionStorage.getItem('capris_usuario'),
        )

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

        sessionStorage.setItem(
            'capris_token',
            'token-prueba',
        )

        render(
            <AuthProvider>
                <ConsumidorAuth />
            </AuthProvider>,
        )

        expect(
            screen.getByText(/Primer ingreso:\s*si/i),).toBeInTheDocument()

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Marcar cambiada',
            }),
        )

        expect(screen.getByText(/Primer ingreso:\s*no/i),).toBeInTheDocument()

        const usuarioGuardado = JSON.parse(
            sessionStorage.getItem('capris_usuario'),
        )

        expect(usuarioGuardado.debeCambiarContrasena).toBe(false)
        expect(usuarioGuardado.contrasenaVencida).toBe(false)
    })
})