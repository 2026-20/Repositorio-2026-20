import { registrarConteo } from '../services/auditoriaService.js'
import { marcarConteoConError, marcarConteoSincronizado, obtenerConteosPendientes } from './conteosPendientesRepositorio.js'

/**
 * HU-021 criterio 3: sube los conteos registrados sin conexion al volver a
 * tener internet, uno por uno.
 *
 * Si uno falla por un error REAL del backend (ej. JORNADA_NO_INICIADA,
 * HTTP 409 -- el usuario conto sin haber confirmado la jornada ese dia) se
 * anota el motivo con marcarConteoConError y se sigue con los demas: un
 * conteo rechazado no debe bloquear a los otros que si son validos.
 *
 * Si falla por falta de conexion real (nunca hubo respuesta del backend,
 * ver el mismo criterio que sinFalsoPositivoDeRed en
 * sincronizacionDatosMaestros.js) se detiene ahi -- los que quedan se
 * reintentan en la proxima llamada, no tiene sentido seguir golpeando un
 * backend inalcanzable fila por fila.
 */
export async function subirConteosPendientes(usuarioId, token) {
    if (!navigator.onLine) return

    const pendientes = (await obtenerConteosPendientes(usuarioId)).filter((conteo) => !conteo.sincronizado)

    for (const conteo of pendientes) {
        try {
            await registrarConteo(token, {
                idempotenciaKey: conteo.idempotenciaKey,
                codBod: conteo.codBod,
                codArt: conteo.codArt,
                numLote: conteo.numLote,
                numCon: conteo.numCon,
                cantidadTeorica: conteo.cantidadTeorica,
                cantidadFisica: conteo.cantidadFisica,
                observaciones: conteo.observaciones,
            })
            await marcarConteoSincronizado(usuarioId, conteo.idempotenciaKey)
        } catch (error) {
            if (error.status === undefined) {
                return
            }
            await marcarConteoConError(usuarioId, conteo.idempotenciaKey, error.message)
        }
    }
}
