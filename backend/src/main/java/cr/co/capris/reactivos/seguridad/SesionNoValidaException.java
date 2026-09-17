package cr.co.capris.reactivos.seguridad;

/** La sesion (token JWT) no es valida -- ausente, mal formada, expirada o alterada. */
public class SesionNoValidaException extends RuntimeException {

	public SesionNoValidaException(String mensaje) {
		super(mensaje);
	}
}
