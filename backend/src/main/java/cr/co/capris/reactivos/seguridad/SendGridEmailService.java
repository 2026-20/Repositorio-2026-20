package cr.co.capris.reactivos.seguridad;

import com.sendgrid.Method;
import com.sendgrid.Request;
import com.sendgrid.Response;
import com.sendgrid.SendGrid;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.helpers.mail.objects.Email;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;

/**
 * Envía el correo real vía la API HTTP de SendGrid (no SMTP). Solo se activa
 * cuando app.email.proveedor=sendgrid -- en cualquier otro caso (desarrollo
 * local, pruebas, CI) se usa LogEmailService y esta clase ni se instancia, así
 * que nadie necesita una API key real para compilar o correr las pruebas.
 *
 * IMPORTANTE: la clave que se usa aquí es la API Key de SendGrid (Settings >
 * API Keys, permiso restringido solo a "Mail Send"), NUNCA la contraseña del
 * buzón de correo -- SendGrid no la usa ni la necesita para enviar correos.
 * Verificar el remitente por Single Sender Verification (o Domain
 * Authentication más adelante) solo requiere entrar al correo una vez para
 * click en el enlace de verificación; la contraseña del buzón no debe
 * terminar en ningún archivo de este repositorio.
 */
@Service
@ConditionalOnProperty(name = "app.email.proveedor", havingValue = "sendgrid")
public class SendGridEmailService implements EmailService {

	private static final Logger log = LoggerFactory.getLogger(SendGridEmailService.class);

	private final SendGrid sendGrid;
	private final String remitente;
	private final String nombreRemitente;

	public SendGridEmailService(
			@Value("${app.email.sendgrid.api-key}") String apiKey,
			@Value("${app.email.remitente}") String remitente,
			@Value("${app.email.remitente-nombre:CAPRIS Médica - Reactivos}") String nombreRemitente) {
		if (apiKey == null || apiKey.isBlank()) {
			throw new IllegalStateException(
					"app.email.proveedor=sendgrid pero app.email.sendgrid.api-key está vacío. "
							+ "Definir la variable de entorno APP_SENDGRID_API_KEY antes de arrancar.");
		}
		this.sendGrid = new SendGrid(apiKey);
		this.remitente = remitente;
		this.nombreRemitente = nombreRemitente;
	}

	@Override
	public void enviarOtpRecuperacion(String correoDestino, String nombreCompleto, String otp, int minutosExpiracion) {
		Email from = new Email(remitente, nombreRemitente);
		Email to = new Email(correoDestino);
		String asunto = "Código para recuperar tu contraseña - CAPRIS Reactivos";
		Content content = new Content("text/plain", cuerpoCorreo(nombreCompleto, otp, minutosExpiracion));
		Mail mail = new Mail(from, asunto, to, content);

		Request request = new Request();
		try {
			request.setMethod(Method.POST);
			request.setEndpoint("mail/send");
			request.setBody(mail.build());
			Response response = sendGrid.api(request);

			if (response.getStatusCode() >= 300) {
				// No se registra el cuerpo de la respuesta de SendGrid en el log por si
				// llegara a incluir datos del destinatario -- solo el código de estado.
				log.error("SendGrid respondió {} al intentar enviar el OTP de recuperación", response.getStatusCode());
				throw new EnvioCorreoFallidoException(
						"El proveedor de correo rechazó el envío (código " + response.getStatusCode() + ")");
			}
		} catch (IOException ex) {
			log.error("Error de red al llamar a la API de SendGrid", ex);
			throw new EnvioCorreoFallidoException("No se pudo contactar al proveedor de correo", ex);
		}
	}

	private String cuerpoCorreo(String nombreCompleto, String otp, int minutosExpiracion) {
		return "Hola " + nombreCompleto + ",\n\n"
				+ "Tu código para restablecer la contraseña es: " + otp + "\n\n"
				+ "Este código vence en " + minutosExpiracion + " minutos y solo se puede usar una vez.\n"
				+ "Si no solicitaste este cambio, podés ignorar este correo -- tu contraseña actual sigue vigente.\n\n"
				+ "CAPRIS Médica - Sistema de Gestión de Reactivos";
	}
}