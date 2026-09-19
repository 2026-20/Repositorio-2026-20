package cr.co.capris.reactivos.auth;

public record NuevaContrasenaRequest(String tokenSesionTemporal, String nuevaContrasena) {
}
