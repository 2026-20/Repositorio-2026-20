package cr.co.capris.reactivos.auditoria;

import jakarta.validation.constraints.NotNull;

public record CambiarEstadoVisitaRequest(@NotNull EstadoVisitaApp estadoApp) {
}
