package cr.co.capris.reactivos.seguridad;

/** HU-047: la cedula, correo o username ya estan registrados en el sistema. */
public class UsuarioDuplicadoException extends RuntimeException {

	public UsuarioDuplicadoException(String mensaje) {
		super(mensaje);
	}
}
