package cr.co.capris.reactivos.seguridad;

/** HU-046 criterio 5: se superaron los 3 intentos fallidos, el token quedó invalidado. */
public class TokenRecuperacionBloqueadoException extends RuntimeException {

	public TokenRecuperacionBloqueadoException(String mensaje) {
		super(mensaje);
	}
}
