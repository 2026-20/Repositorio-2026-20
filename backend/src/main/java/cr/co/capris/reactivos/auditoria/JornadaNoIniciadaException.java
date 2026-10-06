package cr.co.capris.reactivos.auditoria;

/** HU-038 criterio 4: no se puede registrar un conteo sin jornada confirmada. */
public class JornadaNoIniciadaException extends RuntimeException {

	public JornadaNoIniciadaException(String mensaje) {
		super(mensaje);
	}
}
