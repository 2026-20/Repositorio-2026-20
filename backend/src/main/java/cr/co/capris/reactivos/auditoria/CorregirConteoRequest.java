package cr.co.capris.reactivos.auditoria;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/** HU-007 criterio 4: misma validacion que RegistrarConteoRequest (cero valido, negativo no). */
public record CorregirConteoRequest(
		@NotNull @DecimalMin(value = "0", inclusive = true) BigDecimal cantidadFisica,
		String observaciones) {
}
