package cr.co.capris.reactivos.seguridad;

import java.time.OffsetDateTime;

/** HU-043: cuenta bloqueada temporalmente tras 4 intentos fallidos consecutivos. */
public class CuentaBloqueadaException extends RuntimeException {

	private final OffsetDateTime bloqueadoHasta;

	public CuentaBloqueadaException(String mensaje, OffsetDateTime bloqueadoHasta) {
		super(mensaje);
		this.bloqueadoHasta = bloqueadoHasta;
	}

	public OffsetDateTime getBloqueadoHasta() {
		return bloqueadoHasta;
	}
}
