package cr.co.capris.reactivos.seguridad;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ValidadorPoliticaContrasenaImplTest {

    private ValidadorPoliticaContrasena validador;

    @BeforeEach
    void setUp() {
        validador = new ValidadorPoliticaContrasenaImpl();
    }

    @Test
    void contrasenaValidaNoGeneraViolaciones() {
        assertThat(validador.validar("Clave123!")).isEmpty();
    }

    @Test
    void contrasenaDeOchoCaracteresEsValidaEnElLimite() {
        assertThat(validador.validar("Abcd12!x")).isEmpty();
    }

    @Test
    void contrasenaConMenosDeOchoCaracteresIndicaLongitudMinima() {

        assertThat(validador.validar("Ab1!xyz")).contains("La contraseña debe tener al menos 8 caracteres");
    }

    @Test
    void contrasenaSinMayusculaIndicaElRequisitoFaltante() {

        assertThat(validador.validar("clave123!")).contains("La contraseña debe contener al menos una letra mayúscula");
    }

    @Test
    void contrasenaSinMinusculaIndicaElRequisitoFaltante() {

        assertThat(validador.validar("CLAVE123!")).contains("La contraseña debe contener al menos una letra minúscula");
    }

    @Test
    void contrasenaSinNumeroIndicaElRequisitoFaltante() {

        assertThat(validador.validar("ClaveSegura!")).contains("La contraseña debe contener al menos un número");
    }

    @Test
    void contrasenaSinCaracterEspecialIndicaElRequisitoFaltante() {

        assertThat(validador.validar("Clave1234")).contains("La contraseña debe contener al menos un carácter especial");
    }

    @Test
    void contrasenaConVariosIncumplimientosDevuelveTodosLosMensajes() {

        assertThat(validador.validar("abc")
        ).containsExactly(
                "La contraseña debe tener al menos 8 caracteres",
                "La contraseña debe contener al menos una letra mayúscula",
                "La contraseña debe contener al menos un número",
                "La contraseña debe contener al menos un carácter especial");
    }
}
