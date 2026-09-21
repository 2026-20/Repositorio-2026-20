package cr.co.capris.reactivos.seguridad;

/** HU-044: la contraseña temporal es correcta pero su vigencia ya termino; hay que pedir otra al administrador. */
public class PasswordTemporalVencidaException extends RuntimeException {
	private static final long serialVersionUID = 1L;

	public PasswordTemporalVencidaException(String mensaje) {
		super(mensaje);
	}
}
