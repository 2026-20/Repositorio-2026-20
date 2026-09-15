package cr.co.capris.reactivos.usuario;

/**
 * Forma que expone EmpresaController -- solo lo que necesita el selector de
 * empresa del login (HU-001).
 */
public record EmpresaResumenDTO(
        Long id,
        String nombre
) {
    public static EmpresaResumenDTO from(Empresa empresa) {
        return new EmpresaResumenDTO(
                empresa.getId(),
                empresa.getNombre()
        );
    }
}