package cr.co.capris.reactivos.usuario;

/** HU-048: el motivo es opcional (la HU dice "si el sistema lo solicita"). */
public record InactivarUsuarioRequest(String motivo) {
}
