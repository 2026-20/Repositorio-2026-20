import { registrarTrazabilidad } from '../services/auditoriaService.js'
import { marcarAccionConError, marcarAccionSincronizada, obtenerAccionesPendientes } from './trazabilidadRepositorio.js'

/**
 * HU-031 criterio 6: sube las acciones trazadas sin conexion al volver a
 * tener internet, una por una -- mismo criterio que subirConteosPendientes
 * en sincronizacionConteos.js.
 *
 * Si una falla por un error REAL del backend se anota el motivo con
 * marcarAccionConError y se sigue con las demas. Si falla por falta de
 * conexion real (nunca hubo respuesta del backend) se detiene ahi -- las
 * que quedan se reintentan en la proxima llamada.
 */
export async function subirTrazabilidadPendiente(usuarioId, token) {
    if (!navigator.onLine) return

    const pendientes = await obtenerAccionesPendientes(usuarioId)

    for (const accion of pendientes) {
        try {
            await registrarTrazabilidad(token, {
                idIdempotencia: accion.idIdempotencia,
                tipoAccion: accion.tipoAccion,
                codBod: accion.codBod,
                resultado: accion.resultado,
                detalle: accion.detalle,
                fecha: accion.fecha,
            })
            await marcarAccionSincronizada(usuarioId, accion.idIdempotencia)
        } catch (error) {
            if (error.status === undefined) {
                return
            }
            await marcarAccionConError(usuarioId, accion.idIdempotencia, error.message)
        }
    }
}
