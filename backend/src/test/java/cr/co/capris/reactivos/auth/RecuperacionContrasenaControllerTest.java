package cr.co.capris.reactivos.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * HU-046: los 3 endpoints solo orquestan RecuperacionContrasenaService. El mas
 * importante de verificar es que /solicitar responda siempre el mismo mensaje
 * generico (criterio 2: nunca revelar si el correo existe).
 */
@ExtendWith(MockitoExtension.class)
class RecuperacionContrasenaControllerTest {

    @Mock
    private RecuperacionContrasenaService recuperacionContrasenaService;

    private RecuperacionContrasenaController controller;

    @BeforeEach
    void setUp() {
        controller = new RecuperacionContrasenaController(recuperacionContrasenaService);
    }

    @Test
    void solicitarLlamaAlServicioYDevuelveSiempreElMismoMensajeGenerico() {
        ResponseEntity<MensajeResponse> respuesta =
                controller.solicitar(new SolicitarRecuperacionRequest("wmolina@caprismedica.co.cr"));

        verify(recuperacionContrasenaService).solicitar("wmolina@caprismedica.co.cr");
        assertThat(respuesta.getBody().mensaje())
                .isEqualTo("Si el correo corresponde a una cuenta registrada, vas a recibir un mensaje con instrucciones.");
    }

    @Test
    void validarOtpDevuelveElTokenDeSesionTemporalDelServicio() {
        when(recuperacionContrasenaService.validarOtp("wmolina@caprismedica.co.cr", "482913"))
                .thenReturn("token-temporal-123");

        ResponseEntity<ValidarOtpResponse> respuesta =
                controller.validarOtp(new ValidarOtpRequest("wmolina@caprismedica.co.cr", "482913"));

        assertThat(respuesta.getBody().tokenSesionTemporal()).isEqualTo("token-temporal-123");
    }

    @Test
    void nuevaContrasenaLlamaAlServicioConElTokenYLaContrasenaNueva() {
        ResponseEntity<MensajeResponse> respuesta =
                controller.nuevaContrasena(new NuevaContrasenaRequest("token-temporal-123", "Nueva123!"));

        verify(recuperacionContrasenaService).establecerNuevaContrasena("token-temporal-123", "Nueva123!");
        assertThat(respuesta.getBody().mensaje()).contains("actualizada");
    }
}
