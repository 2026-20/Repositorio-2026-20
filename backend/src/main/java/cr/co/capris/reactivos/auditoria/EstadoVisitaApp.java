package cr.co.capris.reactivos.auditoria;

/**
 * Estado de avance de una visita de auditoria, gestionado por esta app --
 * NO es lo mismo que ResultadoVisita.estado (ese refleja tal cual lo que
 * manda el ERP, ver su javadoc). HU-024/HU-008 piden exactamente estos 3
 * valores.
 */
public enum EstadoVisitaApp {
	PENDIENTE,
	EN_PROGRESO,
	FINALIZADA
}
