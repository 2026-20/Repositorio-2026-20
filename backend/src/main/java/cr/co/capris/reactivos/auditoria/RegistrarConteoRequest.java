package cr.co.capris.reactivos.auditoria;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * HU-005. idempotenciaKey la genera el cliente (PWA, offline-first con
 * wa-sqlite/OPFS) al registrar el conteo localmente -- ver javadoc de
 * ConteoFisico. numLote y numCon son opcionales (numLote no aplica a
 * articulos sin indicador de lote).
 */
public record RegistrarConteoRequest(
		@NotBlank String idempotenciaKey,
		@NotBlank String codBod,
		@NotBlank String codArt,
		String numLote,
		String numCon,
		@NotNull BigDecimal cantidadTeorica,
		// HU-005 criterio 2/3: cero es valido, negativo se rechaza.
		@NotNull @DecimalMin(value = "0", inclusive = true) BigDecimal cantidadFisica,
		String observaciones) {
}
