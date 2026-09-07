package cr.co.capris.reactivos.seguridad;

import java.time.OffsetDateTime;
import java.util.List;

/** Forma unica de respuesta de error para toda la API -- el frontend solo aprende un formato. */
public record ErrorResponse(String codigo, String mensaje, List<String> detalles, OffsetDateTime timestamp) {

	public static ErrorResponse de(String codigo, String mensaje) {
		return new ErrorResponse(codigo, mensaje, List.of(), OffsetDateTime.now());
	}

	public static ErrorResponse de(String codigo, String mensaje, List<String> detalles) {
		return new ErrorResponse(codigo, mensaje, detalles, OffsetDateTime.now());
	}
}
