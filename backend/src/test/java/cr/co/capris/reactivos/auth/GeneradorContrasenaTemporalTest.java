package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.seguridad.ValidadorPoliticaContrasenaImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GeneradorContrasenaTemporalTest {

    private ValidadorPoliticaContrasenaImpl validador;
    private GeneradorContrasenaTemporal generador;

    @BeforeEach
    void setUp() {
        validador = new ValidadorPoliticaContrasenaImpl();
        generador = new GeneradorContrasenaTemporal(validador);
    }

    @Test
    void doscientasContrasenasGeneradasCumplenSiemprePoliticaHU042() {
        for (int i = 0; i < 200; i++) {
            String contrasena = generador.generar();
            assertThat(validador.validar(contrasena)).isEmpty();
        }
    }
}
