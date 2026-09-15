package cr.co.capris.reactivos.usuario;

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