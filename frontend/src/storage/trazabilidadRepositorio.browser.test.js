import { describe, expect, it } from 'vitest'

import {
    marcarAccionConError,
    marcarAccionSincronizada,
    obtenerAccionesPendientes,
    registrarAccionLocal,
} from './trazabilidadRepositorio.js'

// Usuarios "aleatorios" por ejecucion para no chocar con datos de una
// corrida anterior en el mismo perfil de Chromium (ver datosMaestrosRepositorio.browser.test.js).
const sufijo = Date.now()
const USUARIO_A = 8000 + (sufijo % 1000)
const USUARIO_B = 8500 + (sufijo % 1000)

const ACCION = {
    tipoAccion: 'CONTEO_REGISTRADO',
    codBod: 'MEPRIN',
    resultado: 'EXITOSO',
    detalle: 'Reactivo de prueba: 9',
}

describe('trazabilidadRepositorio', () => {
    it('registra una accion localmente y la puede volver a leer, sin sincronizar (criterio 1/6)', async () => {
        const idIdempotencia = await registrarAccionLocal(USUARIO_A, ACCION)

        expect(idIdempotencia).toEqual(expect.any(String))

        const pendientes = await obtenerAccionesPendientes(USUARIO_A)
        const guardada = pendientes.find((a) => a.idIdempotencia === idIdempotencia)

        expect(guardada).toMatchObject({
            tipoAccion: 'CONTEO_REGISTRADO',
            codBod: 'MEPRIN',
            resultado: 'EXITOSO',
            detalle: 'Reactivo de prueba: 9',
            sincronizado: false,
            ultimoError: null,
        })
    })

    it('cada registro genera su propio idIdempotencia, ninguno se repite', async () => {
        const idA = await registrarAccionLocal(USUARIO_A, ACCION)
        const idB = await registrarAccionLocal(USUARIO_A, ACCION)

        expect(idA).not.toEqual(idB)
    })

    it('marcarAccionSincronizada la saca de las pendientes', async () => {
        const idIdempotencia = await registrarAccionLocal(USUARIO_A, ACCION)
        await marcarAccionSincronizada(USUARIO_A, idIdempotencia)

        const pendientes = await obtenerAccionesPendientes(USUARIO_A)

        expect(pendientes.find((a) => a.idIdempotencia === idIdempotencia)).toBeUndefined()
    })

    it('marcarAccionConError anota el motivo sin marcarla como sincronizada', async () => {
        const idIdempotencia = await registrarAccionLocal(USUARIO_A, ACCION)
        await marcarAccionConError(USUARIO_A, idIdempotencia, 'SESION_NO_VALIDA')

        const pendientes = await obtenerAccionesPendientes(USUARIO_A)
        const guardada = pendientes.find((a) => a.idIdempotencia === idIdempotencia)

        expect(guardada.sincronizado).toBe(false)
        expect(guardada.ultimoError).toBe('SESION_NO_VALIDA')
    })

    it('una accion sin bodega (ej. inicio de sesion) se guarda con codBod null', async () => {
        const idIdempotencia = await registrarAccionLocal(USUARIO_A, {
            tipoAccion: 'INICIO_SESION',
            codBod: null,
            resultado: 'EXITOSO',
            detalle: null,
        })

        const pendientes = await obtenerAccionesPendientes(USUARIO_A)
        const guardada = pendientes.find((a) => a.idIdempotencia === idIdempotencia)

        expect(guardada.codBod).toBeNull()
        expect(guardada.detalle).toBeNull()
    })

    it('las acciones de un usuario no son visibles para otro (mismo aislamiento que HU-003)', async () => {
        await registrarAccionLocal(USUARIO_A, ACCION)

        expect(await obtenerAccionesPendientes(USUARIO_B)).toEqual([])
    })

    it('una escritura y una lectura disparadas al mismo tiempo no chocan en OPFS (misma cola que HU-003)', async () => {
        const escritura = registrarAccionLocal(USUARIO_A, ACCION)
        const lectura = obtenerAccionesPendientes(USUARIO_A)

        await expect(Promise.all([escritura, lectura])).resolves.toBeDefined()
    })
})
