package cr.co.capris.reactivos.usuario;
import java.time.OffsetDateTime;

/**
 * Nunca incluye passwordHash ni datos sensibles -- esto es lo unico que la API expone.
 */
public record UsuarioResumenDTO(
		Long id,
		String nombreCompleto,
		String correo,
		String username,
		String rol,
		String empresa,
		String estado,
		boolean bloqueado,
		OffsetDateTime bloqueadoHasta) {

	public static UsuarioResumenDTO from(Usuario usuario) {

		OffsetDateTime bloqueadoHasta = usuario.getBloqueadoHasta();
		boolean bloqueado = bloqueadoHasta != null && bloqueadoHasta.isAfter(OffsetDateTime.now());

		return new UsuarioResumenDTO(
				usuario.getId(),
				usuario.getNombreCompleto(),
				usuario.getCorreo(),
				usuario.getUsername(),
				usuario.getRol().getNombre(),
				usuario.getEmpresa().getNombre(),
				usuario.getEstado().name(),
				bloqueado,
				bloqueadoHasta);
	}
}
