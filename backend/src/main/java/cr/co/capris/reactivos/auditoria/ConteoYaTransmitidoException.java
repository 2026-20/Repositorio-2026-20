package cr.co.capris.reactivos.auditoria;

/** HU-007 criterio 3: un conteo ya transmitido al ERP no puede corregirse. */
public class ConteoYaTransmitidoException extends RuntimeException {

	public ConteoYaTransmitidoException(String mensaje) {
		super(mensaje);
	}
}
