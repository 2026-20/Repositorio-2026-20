package cr.co.capris.reactivos.usuario;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/** HU-047: lista de roles para el formulario de alta de usuario. */
@ExtendWith(MockitoExtension.class)
class RolControllerTest {

    @Mock
    private RolRepository rolRepository;

    private RolController controller;

    @BeforeEach
    void setUp() {
        controller = new RolController(rolRepository);
    }

    @Test
    void listarDevuelveTodosLosRolesComoResumen() {
        Rol administrador = new Rol("Administrador");
        Rol usuarioCampo = new Rol("Usuario de Campo");
        when(rolRepository.findAll()).thenReturn(List.of(administrador, usuarioCampo));

        List<RolResumenDTO> resultado = controller.listar();

        assertThat(resultado).extracting(RolResumenDTO::nombre)
                .containsExactly("Administrador", "Usuario de Campo");
    }
}
