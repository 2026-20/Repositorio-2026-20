package cr.co.capris.reactivos.auditoria;

import java.time.LocalDate;

/** HU-024/HU-008/HU-037. */
public record VisitaResumenDTO(
		String codBod,
		String numCon,
		String objCon,
		String estadoErp,
		EstadoVisitaApp estadoApp,
		Long asignadoAUsuarioId,
		LocalDate fechaAsignada) {

	public static VisitaResumenDTO desde(ResultadoVisita visita) {
		return new VisitaResumenDTO(
				visita.getCodBod(),
				visita.getNumCon(),
				visita.getObjCon(),
				visita.getEstado(),
				visita.getEstadoApp(),
				visita.getAsignadoAUsuarioId(),
				visita.getFechaAsignada());
	}
}
