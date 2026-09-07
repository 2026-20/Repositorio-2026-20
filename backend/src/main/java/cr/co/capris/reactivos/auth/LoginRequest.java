package cr.co.capris.reactivos.auth;

public record LoginRequest(String username, String contrasena, Long empresaId) {
}
