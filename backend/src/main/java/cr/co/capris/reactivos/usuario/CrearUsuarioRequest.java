package cr.co.capris.reactivos.usuario;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * empresaId no lleva @NotNull: el alta siempre usa la empresa del administrador
 * autenticado (ver AltaUsuarioService.crear()), nunca la que mande el cliente. El
 * campo solo se conserva para poder rechazar explicitamente (403) a un cliente que
 * mande una empresa distinta a la propia -- el frontend ya no lo pide ni lo envia.
 */
public record CrearUsuarioRequest(
        @NotBlank String nombreCompleto,
        @NotBlank String cedula,
        @NotBlank @Email String correo,
        @NotBlank String username,
        @NotNull Long rolId,
        Long empresaId
) {
}
