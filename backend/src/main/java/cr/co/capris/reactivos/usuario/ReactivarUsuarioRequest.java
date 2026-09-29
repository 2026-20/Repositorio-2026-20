package cr.co.capris.reactivos.usuario;

/** HU-048: el motivo es opcional, igual que en la inactivacion (InactivarUsuarioRequest). */
public record ReactivarUsuarioRequest(String motivo) {
}
