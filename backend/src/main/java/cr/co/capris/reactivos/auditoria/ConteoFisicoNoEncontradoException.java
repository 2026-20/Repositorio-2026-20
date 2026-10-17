package cr.co.capris.reactivos.auditoria;

/** HU-007: se intenta corregir un conteo que no existe. */
public class ConteoFisicoNoEncontradoException extends RuntimeException {

	public ConteoFisicoNoEncontradoException(String mensaje) {
		super(mensaje);
	}
}
