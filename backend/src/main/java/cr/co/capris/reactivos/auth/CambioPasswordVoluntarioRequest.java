package cr.co.capris.reactivos.auth;

import jakarta.validation.constraints.NotBlank;

public record CambioPasswordVoluntarioRequest(
        @NotBlank(message = "La contraseña actual es obligatoria") String contrasenaActual,
        @NotBlank(message = "La contraseña nueva es obligatoria") String contrasenaNueva) {
}
