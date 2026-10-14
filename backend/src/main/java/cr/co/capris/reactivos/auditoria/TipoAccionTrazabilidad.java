package cr.co.capris.reactivos.auditoria;

/**
 * Vocabulario de acciones que HU-031 pide trazar. Agregar un valor nuevo
 * aqui cuando la HU correspondiente exista de verdad:
 * - CORRECCION: HU-007 (corregir un conteo ya registrado) todavia no
 *   existe -- hoy ConteoFisicoService solo tiene registrar(), no
 *   actualizar() (ver su javadoc).
 * - TRANSMISION: HU-040/041 (validar y enviar al ERP) todavia no existe
 *   -- hoy el conteo solo se persiste localmente.
 * - DEVOLUCION: HU-011/HU-018 (gestionar devolucion y redistribucion de
 *   inventario) todavia no existe.
 * Cuando cualquiera de esas se implemente, registrar su trazabilidad es
 * una llamada a TrazabilidadService.registrar(), igual que las dos de
 * abajo.
 */
public enum TipoAccionTrazabilidad {
	INICIO_SESION,
	CONTEO_REGISTRADO
}
