package cr.co.capris.reactivos.auditoria;

import java.time.LocalDate;

/**
 * HU-037: una bodega de la ruta del Usuario de Campo. desBod sale de
 * auditoria_bodega (solo tipoBod = CLI, ver ResultadoVisitaRepository.findRutaPendiente);
 * el resto, de auditoria_resultado_visita.
 */
public record ParadaRutaDTO(
		String codBod,
		String desBod,
		String numCon,
		String objCon,
		String estadoErp,
		EstadoVisitaApp estadoApp,
		LocalDate fechaAsignada) {
}
