package cr.co.capris.reactivos.seguridad;

/**
 * El usuario autenticado intenta acceder a un recurso de otra empresa.
 * El mensaje debe ser siempre generico -- nunca revelar si el recurso existe en otra empresa.
 */
public class AccesoNoAutorizadoException extends RuntimeException {

	public AccesoNoAutorizadoException(String mensaje) {
		super(mensaje);
	}
}
