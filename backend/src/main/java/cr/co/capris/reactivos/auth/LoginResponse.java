package cr.co.capris.reactivos.auth;

public record LoginResponse(
		String token,
		Long usuarioId,
		String nombreCompleto,
		String rol,
		boolean debeCambiarContrasena) {
}
