package cr.co.capris.reactivos.seguridad;

import java.util.List;

/** HU-042/044/045/046: la contraseña propuesta no cumple la politica de complejidad. */
public class ContrasenaNoValidaException extends RuntimeException {

	private final List<String> violaciones;

	public ContrasenaNoValidaException(List<String> violaciones) {
		super("La contraseña no cumple la política de seguridad");
		this.violaciones = violaciones;
	}

	public List<String> getViolaciones() {
		return violaciones;
	}
}
