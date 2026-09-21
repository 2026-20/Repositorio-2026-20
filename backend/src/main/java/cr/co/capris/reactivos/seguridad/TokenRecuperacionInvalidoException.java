package cr.co.capris.reactivos.seguridad;

/** El OTP no existe, ya fue usado, o no coincide con el que se generó. */
public class TokenRecuperacionInvalidoException extends RuntimeException {

	public TokenRecuperacionInvalidoException(String mensaje) {
		super(mensaje);
	}
}
