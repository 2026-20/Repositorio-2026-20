package cr.co.capris.reactivos.seguridad;

/** El proveedor de correo (hoy SendGrid) rechazó el envío o no se pudo contactar. */
public class EnvioCorreoFallidoException extends RuntimeException {

	public EnvioCorreoFallidoException(String mensaje) {
		super(mensaje);
	}

	public EnvioCorreoFallidoException(String mensaje, Throwable causa) {
		super(mensaje, causa);
	}
}
