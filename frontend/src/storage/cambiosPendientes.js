import { obtenerConteosPendientes } from './conteosPendientesRepositorio.js'

/**
 * HU-037/HU-021: punto de enganche para no perder trabajo hecho sin conexion.
 *
 * sincronizarDatosMaestros reemplaza todo el almacenamiento local con la
 * foto que manda el backend. Si el usuario finalizo una visita o registro
 * conteos sin conexion y eso todavia no se subio, ese reemplazo lo borraria
 * (o resucitaria como pendiente una visita ya terminada). Por eso, antes de
 * descargar, se pregunta aqui si hay algo pendiente de subir -- y si lo hay,
 * la sincronizacion no toca nada.
 *
 * Cubre la cola de conteos offline (HU-005/HU-021, ver
 * conteosPendientesRepositorio.js). Todavia NO cubre cambios de estado de
 * visita (HU-024) -- esa cola no existe todavia; quien la implemente tiene
 * que sumarla aqui tambien.
 *
 * Un conteo con ultimoError NO cuenta como "pendiente de subir" para esta
 * pregunta -- ya se intento y el backend lo rechazo (ver
 * subirConteosPendientes), asi que bloquear el catalogo para siempre
 * esperando a que ese conteo en particular se resuelva solo dejaria al
 * usuario sin poder volver a sincronizar nunca mas. Sigue viajando en
 * cada intento de subida (por si la causa del rechazo ya no aplica, ej.
 * confirmar la jornada) y sigue contando en "conteos sin sincronizar" de
 * ConteoPage -- simplemente deja de ser motivo para negarse a refrescar
 * el resto del catalogo.
 */
export async function hayCambiosPendientesDeSubir(usuarioId) {
    const conteos = await obtenerConteosPendientes(usuarioId)
    return conteos.some((conteo) => !conteo.sincronizado && !conteo.ultimoError)
}
