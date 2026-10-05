package cr.co.capris.reactivos.auditoria;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/**
 * HU-037 (stopgap manual -- ver SUPUESTO en Bodega sobre codUsu). fecha es
 * opcional: si no se manda, se asigna para hoy.
 */
public record AsignarVisitaRequest(@NotNull Long usuarioId, LocalDate fecha) {
}
