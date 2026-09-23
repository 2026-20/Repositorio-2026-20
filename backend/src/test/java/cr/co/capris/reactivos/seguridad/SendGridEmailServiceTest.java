package cr.co.capris.reactivos.seguridad;

import com.sendgrid.Request;
import com.sendgrid.Response;
import com.sendgrid.SendGrid;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * HU-046/HU-047: SendGridEmailService solo se activa con app.email.proveedor=sendgrid.
 * El cliente real de SendGrid (com.sendgrid.SendGrid) se reemplaza por un mock via
 * reflexion -- el constructor de este servicio no lo recibe por parametro, lo crea el
 * mismo a partir de la api key, asi que no hay otra forma de aislarlo sin llamar a la
 * red real.
 */
@ExtendWith(MockitoExtension.class)
class SendGridEmailServiceTest {

    @Mock
    private SendGrid sendGrid;

    private SendGridEmailService service;

    @BeforeEach
    void setUp() {
        service = new SendGridEmailService("SG.clave-de-prueba", "recuperacioncapris@hotmail.com", "CAPRIS Médica - Reactivos");
        ReflectionTestUtils.setField(service, "sendGrid", sendGrid);
    }

    @Test
    void elConstructorRechazaUnaApiKeyVacia() {
        assertThatThrownBy(() -> new SendGridEmailService("   ", "recuperacioncapris@hotmail.com", "CAPRIS"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("app.email.sendgrid.api-key");
    }

    @Test
    void elConstructorRechazaUnaApiKeyNula() {
        assertThatThrownBy(() -> new SendGridEmailService(null, "recuperacioncapris@hotmail.com", "CAPRIS"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void enviarOtpRecuperacionLlamaALaApiDeSendGridConElCuerpoEsperado() throws IOException {
        when(sendGrid.api(any())).thenReturn(new Response(202, "", null));

        service.enviarOtpRecuperacion("wmolina@caprismedica.co.cr", "William Molina", "482913", 15);

        ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);
        verify(sendGrid).api(captor.capture());
        assertThat(captor.getValue().getBody())
                .contains("wmolina@caprismedica.co.cr")
                .contains("482913")
                .contains("15 minutos");
    }

    @Test
    void enviarCredencialesInicialesLlamaALaApiDeSendGridConElCuerpoEsperado() throws IOException {
        when(sendGrid.api(any())).thenReturn(new Response(202, "", null));

        service.enviarCredencialesIniciales(
                "ana.fernandez@caprismedica.co.cr", "Ana Fernández Rojas", "afernandez", "Temp0ral!23x");

        ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);
        verify(sendGrid).api(captor.capture());
        assertThat(captor.getValue().getBody())
                .contains("ana.fernandez@caprismedica.co.cr")
                .contains("afernandez")
                .contains("Temp0ral!23x");
    }

    @Test
    void unaRespuestaDeErrorDeSendGridLanzaEnvioCorreoFallidoException() throws IOException {
        when(sendGrid.api(any())).thenReturn(new Response(500, "server error", null));

        assertThatThrownBy(() -> service.enviarOtpRecuperacion(
                "wmolina@caprismedica.co.cr", "William Molina", "482913", 15))
                .isInstanceOf(EnvioCorreoFallidoException.class)
                .hasMessageContaining("500");
    }

    @Test
    void unaFallaDeRedAlLlamarSendGridLanzaEnvioCorreoFallidoException() throws IOException {
        when(sendGrid.api(any())).thenThrow(new IOException("timeout"));

        assertThatThrownBy(() -> service.enviarCredencialesIniciales(
                "ana.fernandez@caprismedica.co.cr", "Ana Fernández Rojas", "afernandez", "Temp0ral!23x"))
                .isInstanceOf(EnvioCorreoFallidoException.class)
                .hasMessageContaining("No se pudo contactar");
    }
}
