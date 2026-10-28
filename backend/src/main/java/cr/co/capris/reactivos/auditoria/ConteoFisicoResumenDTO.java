package cr.co.capris.reactivos.auditoria;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Vista de ConteoFisico para la API -- nunca se expone la entidad JPA directo. */
public record ConteoFisicoResumenDTO(
		Long id,
		String idempotenciaKey,
		String codBod,
		String codArt,
		String numLote,
		BigDecimal cantidadTeorica,
		BigDecimal cantidadFisica,
		BigDecimal diferencia,
		TipoDiferencia tipoDiferencia,
		String usuarioNombre,
		String observaciones,
		OffsetDateTime registradoEn,
		boolean corregido) {

	public static ConteoFisicoResumenDTO desde(ConteoFisico conteo, String usuarioNombre) {
		return new ConteoFisicoResumenDTO(
				conteo.getId(),
				conteo.getIdempotenciaKey(),
				conteo.getCodBod(),
				conteo.getCodArt(),
				conteo.getNumLote(),
				conteo.getCantidadTeorica(),
				conteo.getCantidadFisica(),
				conteo.getDiferencia(),
				conteo.getTipoDiferencia(),
				usuarioNombre,
				conteo.getObservaciones(),
				conteo.getRegistradoEn(),
				conteo.isCorregido());
	}
}
