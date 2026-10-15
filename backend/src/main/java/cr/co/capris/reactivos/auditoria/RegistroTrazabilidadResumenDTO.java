package cr.co.capris.reactivos.auditoria;

import java.time.OffsetDateTime;

/** Vista de RegistroTrazabilidad para la API -- nunca se expone la entidad JPA directo. */
public record RegistroTrazabilidadResumenDTO(
		Long id,
		TipoAccionTrazabilidad tipoAccion,
		String usuarioNombre,
		String codBod,
		ResultadoAccionTrazabilidad resultado,
		String detalle,
		OffsetDateTime fecha) {

	public static RegistroTrazabilidadResumenDTO desde(RegistroTrazabilidad registro, String usuarioNombre) {
		return new RegistroTrazabilidadResumenDTO(
				registro.getId(),
				registro.getTipoAccion(),
				usuarioNombre,
				registro.getCodBod(),
				registro.getResultado(),
				registro.getDetalle(),
				registro.getFecha());
	}
}
