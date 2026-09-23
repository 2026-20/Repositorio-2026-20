package cr.co.capris.reactivos.usuario;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * HU-001: endpoint publico (sin sesion) que alimenta el selector de empresa
 * del login.
 */
@ExtendWith(MockitoExtension.class)
class EmpresaControllerTest {

    @Mock
    private EmpresaRepository empresaRepository;

    private EmpresaController controller;

    @BeforeEach
    void setUp() {
        controller = new EmpresaController(empresaRepository);
    }

    @Test
    void listarDevuelveTodasLasEmpresasComoResumen() {
        Empresa capris = new Empresa("CAPRIS Médica");
        Empresa diagnostika = new Empresa("Diagnostika");
        when(empresaRepository.findAll()).thenReturn(List.of(capris, diagnostika));

        List<EmpresaResumenDTO> resultado = controller.listar();

        assertThat(resultado).extracting(EmpresaResumenDTO::nombre)
                .containsExactly("CAPRIS Médica", "Diagnostika");
    }

    @Test
    void listarDevuelveVacioSiNoHayEmpresas() {
        when(empresaRepository.findAll()).thenReturn(List.of());

        assertThat(controller.listar()).isEmpty();
    }
}
