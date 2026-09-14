import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    iniciarSesion,
    obtenerEmpresas,
} from './authService'

describe('authService', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('obtiene las empresas disponibles', async () => {
        const empresas = [
            {
                id: 1,
                nombre: 'CAPRIS Médica',
            },
        ]

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => empresas,
        })

        const resultado = await obtenerEmpresas()

        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/empresas',
        )

        expect(resultado).toEqual(empresas)
    })

    it('envia correctamente los datos del login', async () => {
        const respuestaLogin = {
            token: 'jwt-prueba',
            usuarioId: 3,
            nombreCompleto: 'William Molina',
            rol: 'Administrador',
            debeCambiarContrasena: false,
        }

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => respuestaLogin,
        })

        const resultado = await iniciarSesion(
            'wmolina',
            'Capris2026!',
            '1',
        )

        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/auth/login',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: 'wmolina',
                    contrasena: 'Capris2026!',
                    empresaId: 1,
                }),
            },
        )

        expect(resultado).toEqual(respuestaLogin)
    })

    it('lanza error cuando el backend rechaza el login', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({
                codigo: 'CREDENCIALES_INVALIDAS',
                mensaje: 'Credenciales inválidas',
            }),
        })

        await expect(
            iniciarSesion(
                'wmolina',
                'incorrecta',
                1,
            ),
        ).rejects.toMatchObject({
            message: 'Credenciales inválidas',
            codigo: 'CREDENCIALES_INVALIDAS',
            status: 401,
        })
    })
})