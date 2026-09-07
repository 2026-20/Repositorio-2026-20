package cr.co.capris.reactivos.usuario;

/**
 * Ciclo de vida del usuario (HU-044, HU-048): un usuario nuevo entra como
 * PENDIENTE_PRIMER_INGRESO con contraseña provisional, pasa a ACTIVO tras cambiarla,
 * y puede pasar a INACTIVO por baja logica del administrador (nunca se borra el registro).
 */
public enum EstadoUsuario {
	PENDIENTE_PRIMER_INGRESO,
	ACTIVO,
	INACTIVO
}
