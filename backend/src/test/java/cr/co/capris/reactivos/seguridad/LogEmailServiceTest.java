package cr.co.capris.reactivos.seguridad;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * HU-046/HU-047: LogEmailService es la implementacion por defecto de EmailService
 * (app.email.proveedor=log) -- no envia nada real, solo escribe en el log. Se
 * verifica que el mensaje generado incluya los datos necesarios para que quien
 * revise el log de desarrollo pueda usar el OTP o las credenciales.
 */
class LogEmailServiceTest {

    private final LogEmailService service = new LogEmailService();
    private ListAppender<ILoggingEvent> appender;
    private Logger logger;

    @BeforeEach
    void setUp() {
        logger = (Logger) LoggerFactory.getLogger(LogEmailService.class);
        appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void tearDown() {
        logger.detachAppender(appender);
    }

    @Test
    void enviarOtpRecuperacionEscribeElCorreoDestinoYElOtpEnElLog() {
        service.enviarOtpRecuperacion("wmolina@caprismedica.co.cr", "William Molina", "482913", 15);

        String mensaje = appender.list.get(0).getFormattedMessage();
        assertThat(mensaje)
                .contains("wmolina@caprismedica.co.cr")
                .contains("William Molina")
                .contains("482913")
                .contains("15");
    }

    @Test
    void enviarCredencialesInicialesEscribeElUsuarioYLaContrasenaTemporalEnElLog() {
        service.enviarCredencialesIniciales(
                "ana.fernandez@caprismedica.co.cr", "Ana Fernández Rojas", "afernandez", "Temp0ral!23x");

        String mensaje = appender.list.get(0).getFormattedMessage();
        assertThat(mensaje)
                .contains("ana.fernandez@caprismedica.co.cr")
                .contains("Ana Fernández Rojas")
                .contains("afernandez")
                .contains("Temp0ral!23x");
    }
}
