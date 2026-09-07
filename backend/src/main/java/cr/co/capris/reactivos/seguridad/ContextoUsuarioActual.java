package cr.co.capris.reactivos.seguridad;

/**
 * Contrato para "quien es el usuario autenticado en esta peticion". HU-001 provee la
 * implementacion real (a partir del JWT); HU-023 (multiempresa), HU-044 y HU-045
 * (requieren la identidad del usuario actual) programan contra esta interfaz sin
 * esperar a que la implementacion de HU-001 este terminada.
 *
 * No hay implementacion todavia -- se agrega junto con HU-001.
 */
public interface ContextoUsuarioActual {

	Long getUsuarioId();

	Long getEmpresaId();

	String getRol();
}
