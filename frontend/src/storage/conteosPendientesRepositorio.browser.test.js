import { describe, expect, it } from 'vitest'

import {
    corregirConteoLocal,
    estaJornadaIniciadaHoy,
    guardarJornadaIniciada,
    marcarConteoConError,
    marcarConteoSincronizado,
    obtenerConteosPendientes,
    registrarConteoLocal,
} from './conteosPendientesRepositorio.js'
import { notificarSesionInvalidada } from '../services/sesionInvalidada.js'

// Usuarios "aleatorios" por ejecucion para no chocar con datos de una
// corrida anterior en el mismo perfil de Chromium (ver datosMaestrosRepositorio.browser.test.js).
const sufijo = Date.now()
const USUARIO_A = 7000 + (sufijo % 1000)
const USUARIO_B = 7500 + (sufijo % 1000)

const CONTEO = {
    codBod: 'MEPRIN',
    codArt: 'ART1',
    numLote: null,
    numCon: '123',
    cantidadTeorica: 10,
    cantidadFisica: 9,
    observaciones: 'Faltante de una unidad',
}

describe('conteosPendientesRepositorio', () => {
    it('registra un conteo localmente y lo puede volver a leer, sin sincronizar (criterio 1)', async () => {
        const idempotenciaKey = await registrarConteoLocal(USUARIO_A, CONTEO)

        expect(idempotenciaKey).toEqual(expect.any(String))

        const pendientes = await obtenerConteosPendientes(USUARIO_A)
        const guardado = pendientes.find((c) => c.idempotenciaKey === idempotenciaKey)

        expect(guardado).toMatchObject({
            codBod: 'MEPRIN',
            codArt: 'ART1',
            numLote: null,
            numCon: '123',
            cantidadTeorica: '10',
            cantidadFisica: '9',
            observaciones: 'Faltante de una unidad',
            sincronizado: false,
            ultimoError: null,
        })
    })

    it('cada registro genera su propia idempotenciaKey, ninguna se repite', async () => {
        const claveA = await registrarConteoLocal(USUARIO_A, CONTEO)
        const claveB = await registrarConteoLocal(USUARIO_A, CONTEO)

        expect(claveA).not.toEqual(claveB)
    })

    it('marcarConteoSincronizado lo saca de los pendientes sin sincronizar', async () => {
        const idempotenciaKey = await registrarConteoLocal(USUARIO_A, CONTEO)
        await marcarConteoSincronizado(USUARIO_A, idempotenciaKey)

        const pendientes = await obtenerConteosPendientes(USUARIO_A)
        const guardado = pendientes.find((c) => c.idempotenciaKey === idempotenciaKey)

        expect(guardado.sincronizado).toBe(true)
    })

    it('marcarConteoConError anota el motivo sin marcarlo como sincronizado', async () => {
        const idempotenciaKey = await registrarConteoLocal(USUARIO_A, CONTEO)
        await marcarConteoConError(USUARIO_A, idempotenciaKey, 'JORNADA_NO_INICIADA')

        const pendientes = await obtenerConteosPendientes(USUARIO_A)
        const guardado = pendientes.find((c) => c.idempotenciaKey === idempotenciaKey)

        expect(guardado.sincronizado).toBe(false)
        expect(guardado.ultimoError).toBe('JORNADA_NO_INICIADA')
    })

    it('los conteos de un usuario no son visibles para otro usuario (mismo aislamiento que HU-003)', async () => {
        await registrarConteoLocal(USUARIO_A, CONTEO)

        expect(await obtenerConteosPendientes(USUARIO_B)).toEqual([])
    })

    // HU-007: corregir un conteo que todavia no se sincronizo.
    describe('corregirConteoLocal', () => {
        it('actualiza la cantidad fisica y las observaciones del mismo registro', async () => {
            const idempotenciaKey = await registrarConteoLocal(USUARIO_A, CONTEO)

            await corregirConteoLocal(USUARIO_A, idempotenciaKey, {
                cantidadFisica: 11,
                observaciones: 'Recontado, estaba completo',
            })

            const pendientes = await obtenerConteosPendientes(USUARIO_A)
            const corregido = pendientes.find((c) => c.idempotenciaKey === idempotenciaKey)

            expect(corregido.cantidadFisica).toBe('11')
            expect(corregido.observaciones).toBe('Recontado, estaba completo')
            expect(corregido.sincronizado).toBe(false)
        })

        it('no corrige un conteo que ya se sincronizo', async () => {
            const idempotenciaKey = await registrarConteoLocal(USUARIO_A, CONTEO)
            await marcarConteoSincronizado(USUARIO_A, idempotenciaKey)

            await corregirConteoLocal(USUARIO_A, idempotenciaKey, { cantidadFisica: 99, observaciones: null })

            const pendientes = await obtenerConteosPendientes(USUARIO_A)
            const conteo = pendientes.find((c) => c.idempotenciaKey === idempotenciaKey)

            expect(conteo.cantidadFisica).toBe('9')
        })
    })

    describe('jornada local', () => {
        it('sin jornada guardada, estaJornadaIniciadaHoy devuelve false', async () => {
            expect(await estaJornadaIniciadaHoy(USUARIO_B)).toBe(false)
        })

        it('tras guardarJornadaIniciada, estaJornadaIniciadaHoy devuelve true', async () => {
            await guardarJornadaIniciada(USUARIO_A, '2026-10-08T08:00:00.000Z')

            expect(await estaJornadaIniciadaHoy(USUARIO_A)).toBe(true)
        })

        it('la jornada de un usuario no es visible para otro', async () => {
            await guardarJornadaIniciada(USUARIO_A, '2026-10-08T08:00:00.000Z')

            expect(await estaJornadaIniciadaHoy(USUARIO_B)).toBe(false)
        })
    })

    it('una escritura y una lectura disparadas al mismo tiempo no chocan en OPFS (misma cola que HU-003)', async () => {
        const escritura = registrarConteoLocal(USUARIO_A, CONTEO)
        const lectura = obtenerConteosPendientes(USUARIO_A)

        await expect(Promise.all([escritura, lectura])).resolves.toBeDefined()
    })

    it('HU-036: conserva los conteos pendientes al invalidar la sesión', async () => {
        const idempotenciaKey = await registrarConteoLocal(
            USUARIO_A,
            CONTEO,
        )

        const pendientesAntes = await obtenerConteosPendientes(
            USUARIO_A,
        )

        const conteoAntes = pendientesAntes.find(
            (conteo) => conteo.idempotenciaKey === idempotenciaKey,
        )

        expect(conteoAntes).toBeDefined()
        expect(conteoAntes.sincronizado).toBe(false)

        // Simular la notificación de sesión invalidada.
        notificarSesionInvalidada('jwt-prueba')

        const pendientesDespues = await obtenerConteosPendientes(
            USUARIO_A,
        )

        const conteoDespues = pendientesDespues.find(
            (conteo) => conteo.idempotenciaKey === idempotenciaKey,
        )

        expect(conteoDespues).toBeDefined()
        expect(conteoDespues.sincronizado).toBe(false)
        expect(conteoDespues.cantidadFisica).toBe('9')
        expect(conteoDespues.codArt).toBe('ART1')
    })

})
