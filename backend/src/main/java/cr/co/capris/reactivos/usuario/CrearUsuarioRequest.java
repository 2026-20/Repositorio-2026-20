package cr.co.capris.reactivos.usuario;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CrearUsuarioRequest(
        @NotBlank String nombreCompleto,
        @NotBlank String cedula,
        @NotBlank @Email String correo,
        @NotBlank String username,
        @NotNull Long rolId,
        @NotNull Long empresaId
) {
}
