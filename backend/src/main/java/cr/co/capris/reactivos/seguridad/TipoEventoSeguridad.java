package cr.co.capris.reactivos.seguridad;

/**
 * Vocabulario de eventos que HU-043, HU-047 y HU-048 piden registrar explicitamente
 * en la bitacora de seguridad. Agregar valores nuevos aqui si una HU necesita un
 * evento que no esta en la lista.
 */
public enum TipoEventoSeguridad {
	LOGIN_EXITOSO,
	LOGIN_FALLIDO,
	CUENTA_BLOQUEADA,
	CUENTA_DESBLOQUEADA,
	SESION_CERRADA,
	CONTRASENA_CAMBIADA,
	CAMBIO_CONTRASENA_FALLIDO,
	CONTRASENA_RECUPERACION_SOLICITADA,
	USUARIO_CREADO,
	USUARIO_INACTIVADO,
	USUARIO_REACTIVADO
}
