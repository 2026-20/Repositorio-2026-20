package cr.co.capris.reactivos.seguridad;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * HU-046/HU-047: SmtpEmailService solo se activa con app.email.proveedor=smtp
 * (MailHog en desarrollo). El JavaMailSenderImpl real se reemplaza por un mock via
 * reflexion -- el constructor lo arma internamente a partir del host/puerto, no lo
 * recibe por parametro, asi que no hay otra forma de aislarlo de una conexion SMTP real.
 */
@ExtendWith(MockitoExtension.class)
class SmtpEmailServiceTest {

    @Mock
    private JavaMailSenderImpl mailSender;

    private SmtpEmailService service;

    @BeforeEach
    void setUp() {
        service = new SmtpEmailService(
                "localhost", 1025, "", "", "recuperacioncapris@hotmail.com", "CAPRIS Médica - Reactivos");
        ReflectionTestUtils.setField(service, "mailSender", mailSender);
    }

    private MimeMessage mensajeReal() {
        return new MimeMessage(Session.getInstance(new Properties()));
    }

    @Test
    void enviarOtpRecuperacionEnviaElMensajeATravesDelMailSender() {
        MimeMessage mensaje = mensajeReal();
        when(mailSender.createMimeMessage()).thenReturn(mensaje);

        service.enviarOtpRecuperacion("wmolina@caprismedica.co.cr", "William Molina", "482913", 15);

        verify(mailSender).send(mensaje);
    }

    @Test
    void enviarCredencialesInicialesEnviaElMensajeATravesDelMailSender() {
        MimeMessage mensaje = mensajeReal();
        when(mailSender.createMimeMessage()).thenReturn(mensaje);

        service.enviarCredencialesIniciales(
                "ana.fernandez@caprismedica.co.cr", "Ana Fernández Rojas", "afernandez", "Temp0ral!23x");

        verify(mailSender).send(mensaje);
    }

    @Test
    void unaFallaDelServidorSmtpLanzaEnvioCorreoFallidoException() {
        MimeMessage mensaje = mensajeReal();
        when(mailSender.createMimeMessage()).thenReturn(mensaje);
        doThrow(new MailSendException("MailHog no responde")).when(mailSender).send(mensaje);

        assertThatThrownBy(() -> service.enviarOtpRecuperacion(
                "wmolina@caprismedica.co.cr", "William Molina", "482913", 15))
                .isInstanceOf(EnvioCorreoFallidoException.class)
                .hasMessageContaining("SMTP");
    }
}
