package cr.co.capris.reactivos.seguridad;

/** HU-046 criterio 3: el OTP superó los 15 minutos de vigencia. */
public class TokenRecuperacionExpiradoException extends RuntimeException {

	public TokenRecuperacionExpiradoException(String mensaje) {
		super(mensaje);
	}
}
