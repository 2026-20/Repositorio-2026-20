package cr.co.capris.reactivos.seguridad;

/** Usado por varias HUs (HU-046, HU-047, HU-048) cuando el usuario referenciado no existe. */
public class UsuarioNoEncontradoException extends RuntimeException {

	public UsuarioNoEncontradoException(String mensaje) {
		super(mensaje);
	}
}
