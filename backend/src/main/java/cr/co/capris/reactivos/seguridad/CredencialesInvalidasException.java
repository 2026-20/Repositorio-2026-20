package cr.co.capris.reactivos.seguridad;

/** HU-001: usuario, contraseña o empresa no coinciden con un usuario autorizado. */
public class CredencialesInvalidasException extends RuntimeException {

	public CredencialesInvalidasException(String mensaje) {
		super(mensaje);
	}
}
