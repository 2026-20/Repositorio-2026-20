package cr.co.capris.reactivos.auditoria;

import java.time.OffsetDateTime;

public record JornadaEstadoDTO(boolean iniciada, OffsetDateTime iniciadaEn) {
}
