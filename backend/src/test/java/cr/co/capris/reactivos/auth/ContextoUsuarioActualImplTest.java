package cr.co.capris.reactivos.auth;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Implementacion real de ContextoUsuarioActual (HU-001), que JwtAuthenticationFilter
 * rellena en cada peticion. Sin sufijo Service/Repository -- solo el getter/setter
 * de la identidad del usuario autenticado, pero HU-023 (multiempresa) y HU-047
 * (alta de usuario) dependen de que este comportamiento sea correcto.
 */
class ContextoUsuarioActualImplTest {

    private final ContextoUsuarioActualImpl contexto = new ContextoUsuarioActualImpl();

    @Test
    void quedaVacioAntesDeEstablecerNada() {
        assertThat(contexto.getUsuarioId()).isNull();
        assertThat(contexto.getEmpresaId()).isNull();
        assertThat(contexto.getRol()).isNull();
    }

    @Test
    void establecerDejaDisponiblesLosDatosDelUsuarioAutenticado() {
        contexto.establecer(10L, 1L, "Administrador");

        assertThat(contexto.getUsuarioId()).isEqualTo(10L);
        assertThat(contexto.getEmpresaId()).isEqualTo(1L);
        assertThat(contexto.getRol()).isEqualTo("Administrador");
    }

    @Test
    void unSegundoEstablecerSobreescribeLosDatosDelPrimero() {
        contexto.establecer(10L, 1L, "Administrador");
        contexto.establecer(20L, 2L, "Usuario de Campo");

        assertThat(contexto.getUsuarioId()).isEqualTo(20L);
        assertThat(contexto.getEmpresaId()).isEqualTo(2L);
        assertThat(contexto.getRol()).isEqualTo("Usuario de Campo");
    }
}
