package cr.co.capris.reactivos.auth;

public record LoginResponse(
		String token,
		Long usuarioId,
		String nombreCompleto,
		String correo,
		String rol,
		boolean debeCambiarContrasena) {
}
