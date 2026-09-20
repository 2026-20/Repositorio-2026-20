package cr.co.capris.reactivos;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * HU-047: MailHog (ver README.md, seccion "Correo en desarrollo") es opcional para
 * arrancar el backend -- Spring Boot arma el bean JavaMailSender sin abrir ninguna
 * conexion SMTP; el socket real solo se abre cuando CorreoService.enviarCredencialesIniciales
 * llama a send(). Esta prueba corre con MailHog apagado a proposito (igual que en CI) para
 * dejar esa garantia verificada, en vez de depender de que nadie levante MailHog por error
 * al correr el resto de las pruebas de integracion.
 */
@Testcontainers
@SpringBootTest
class ArranqueSinMailHogIT {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private JavaMailSenderImpl mailSender;

	@Test
	void elContextoArrancaConMailHogApagadoYElBeanDeCorreoQuedaConfigurado() {
		assertThat(mailSender.getHost()).isEqualTo("localhost");
		assertThat(mailSender.getPort()).isEqualTo(1025);
	}
}
