
import { describe, it, expect, vi } from 'vitest'
import { procesarRespuesta } from './procesarRespuesta.js'

describe('HU-036 - Invalidacion de sesion', () => {

    it('notifica cuando el backend invalida el JWT actual', async () => {
        const evento = vi.fn()
        const token = 'jwt-usuario-actual'

        window.addEventListener('capris:sesion-invalidada', evento)

        const response = {
            ok: false,
            status: 401,
            json: async () => ({
                codigo: 'SESION_NO_VALIDA',
                mensaje: 'No hay sesion activa',
            }),
        }

        await expect(
            procesarRespuesta(response, true, token)
        ).rejects.toThrow('No hay sesion activa')

        expect(evento).toHaveBeenCalledTimes(1)
        expect(evento.mock.calls[0][0].detail.token).toBe(token)

        window.removeEventListener('capris:sesion-invalidada', evento)
    })

    it('no notifica cuando recibe un error 403', async () => {
        const evento = vi.fn()

        window.addEventListener('capris:sesion-invalidada', evento)

        const response = {
            ok: false,
            status: 403,
            json: async () => ({
                codigo: 'ACCESO_NO_AUTORIZADO',
                mensaje: 'No autorizado',
            }),
        }

        await expect(
            procesarRespuesta(response, true, 'jwt-prueba')
        ).rejects.toThrow('No autorizado')

        expect(evento).not.toHaveBeenCalled()

        window.removeEventListener('capris:sesion-invalidada', evento)
    })

    it('no notifica una invalidacion en una solicitud publica', async () => {
        const evento = vi.fn()

        window.addEventListener('capris:sesion-invalidada', evento)

        const response = {
            ok: false,
            status: 401,
            json: async () => ({
                codigo: 'SESION_NO_VALIDA',
                mensaje: 'Credenciales incorrectas',
            }),
        }

        await expect(
            procesarRespuesta(response)
        ).rejects.toThrow('Credenciales incorrectas')

        expect(evento).not.toHaveBeenCalled()

        window.removeEventListener('capris:sesion-invalidada', evento)
    })

    it('procesa correctamente una respuesta exitosa', async () => {
        const response = {
            ok: true,
            status: 200,
            json: async () => ({
                id: 1,
                nombre: 'Usuario de Campo',
            }),
        }

        const resultado = await procesarRespuesta(
            response,
            true,
            'jwt-prueba'
        )

        expect(resultado).toEqual({
            id: 1,
            nombre: 'Usuario de Campo',
        })
    })

    it('no notifica si la respuesta 401 tiene otro codigo', async () => {
        const evento = vi.fn()

        window.addEventListener('capris:sesion-invalidada', evento)

        const response = {
            ok: false,
            status: 401,
            json: async () => ({
                codigo: 'OTRO_ERROR',
                mensaje: 'Error de autenticacion',
            }),
        }

        await expect(
            procesarRespuesta(response, true, 'jwt-prueba')
        ).rejects.toThrow('Error de autenticacion')

        expect(evento).not.toHaveBeenCalled()

        window.removeEventListener('capris:sesion-invalidada', evento)
    })

    it('no notifica si la solicitud no tiene JWT', async () => {
        const evento = vi.fn()

        window.addEventListener('capris:sesion-invalidada', evento)

        const response = {
            ok: false,
            status: 401,
            json: async () => ({
                codigo: 'SESION_NO_VALIDA',
                mensaje: 'Sesion invalidada',
            }),
        }

        await expect(
            procesarRespuesta(response, true)
        ).rejects.toThrow('Sesion invalidada')

        expect(evento).not.toHaveBeenCalled()

        window.removeEventListener('capris:sesion-invalidada', evento)
    })
})
