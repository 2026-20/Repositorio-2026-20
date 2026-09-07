package cr.co.capris.reactivos.usuario;

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
		String estado) {

	public static UsuarioResumenDTO from(Usuario usuario) {
		return new UsuarioResumenDTO(
				usuario.getId(),
				usuario.getNombreCompleto(),
				usuario.getCorreo(),
				usuario.getUsername(),
				usuario.getRol().getNombre(),
				usuario.getEmpresa().getNombre(),
				usuario.getEstado().name());
	}
}
