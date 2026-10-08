/**
 * HU-037: punto de enganche para no perder trabajo hecho sin conexion.
 *
 * sincronizarDatosMaestros reemplaza todo el almacenamiento local con la
 * foto que manda el backend. Si el usuario finalizo una visita o registro
 * conteos sin conexion y eso todavia no se subio, ese reemplazo lo borraria
 * (o resucitaria como pendiente una visita ya terminada). Por eso, antes de
 * descargar, se pregunta aqui si hay algo pendiente de subir -- y si lo hay,
 * la sincronizacion no toca nada.
 *
 * Todavia no existe la cola de cambios pendientes (conteo offline de HU-005,
 * cambio de estado de visita de HU-024), asi que por ahora siempre responde
 * false. Quien implemente esa cola tiene que conectarla aqui.
 */
// eslint-disable-next-line no-unused-vars
export async function hayCambiosPendientesDeSubir(usuarioId) {
    return false
}
