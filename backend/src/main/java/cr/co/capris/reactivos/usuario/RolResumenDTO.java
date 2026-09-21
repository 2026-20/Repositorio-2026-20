package cr.co.capris.reactivos.usuario;

/**
 * Forma que expone RolController -- lista de roles para el formulario de alta
 * de usuario.
 */
public record RolResumenDTO(
        Long id,
        String nombre
) {
    public static RolResumenDTO from(Rol rol) {
        return new RolResumenDTO(
                rol.getId(),
                rol.getNombre()
        );
    }
}
