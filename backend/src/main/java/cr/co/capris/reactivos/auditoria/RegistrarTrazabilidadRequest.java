package cr.co.capris.reactivos.auditoria;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

/**
 * HU-031: idIdempotencia lo genera el cliente (PWA, offline-first con
 * wa-sqlite/OPFS) al registrar la accion localmente -- ver javadoc de
 * RegistroTrazabilidad. fecha es la hora en que la accion ocurrio en el
 * dispositivo, no la hora de sincronizacion. codBod es opcional (no todas
 * las acciones tienen una bodega asociada, ej. inicio de sesion).
 */
public record RegistrarTrazabilidadRequest(
		@NotBlank String idIdempotencia,
		@NotNull TipoAccionTrazabilidad tipoAccion,
		String codBod,
		@NotNull ResultadoAccionTrazabilidad resultado,
		String detalle,
		@NotNull OffsetDateTime fecha) {
}
