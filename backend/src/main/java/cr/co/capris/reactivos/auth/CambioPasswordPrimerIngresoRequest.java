package cr.co.capris.reactivos.auth;

import jakarta.validation.constraints.NotBlank;

public record CambioPasswordPrimerIngresoRequest(
        @NotBlank(message = "La contraseña nueva es obligatoria") String contrasenaNueva) {
}
