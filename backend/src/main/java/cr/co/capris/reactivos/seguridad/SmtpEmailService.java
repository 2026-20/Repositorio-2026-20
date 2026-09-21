package cr.co.capris.reactivos.seguridad;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

import java.io.UnsupportedEncodingException;
import java.util.Properties;

/**
 * Envío vía SMTP con JavaMailSender. Se activa cuando app.email.proveedor=smtp.
 * Pensado para desarrollo/pruebas con MailHog (host localhost, puerto 1025, sin
 * autenticación) y para servir de base a HU-047 mientras no haya un dominio
 * propio verificado en SendGrid: con MailHog no se depende de ninguna API key.
 *
 * Configuración (todas sobreescribibles por variables de entorno, ver README):
 *  - app.email.smtp.host     (default localhost)
 *  - app.email.smtp.port     (default 1025, el puerto de MailHog)
 *  - app.email.smtp.username / app.email.smtp.password
 *      dejarlas vacías para un SMTP sin autenticación (como MailHog).
 */
@Service
@ConditionalOnProperty(name = "app.email.proveedor", havingValue = "smtp")
public class SmtpEmailService implements EmailService {

	private static final Logger log = LoggerFactory.getLogger(SmtpEmailService.class);

	private static final int TIMEOUT_MS = 10000;

	private final JavaMailSenderImpl mailSender;
	private final String remitente;
	private final String nombreRemitente;

	public SmtpEmailService(
			@Value("${app.email.smtp.host:localhost}") String host,
			@Value("${app.email.smtp.port:1025}") int port,
			@Value("${app.email.smtp.username:}") String username,
			@Value("${app.email.smtp.password:}") String password,
			@Value("${app.email.remitente}") String remitente,
			@Value("${app.email.remitente-nombre:CAPRIS Médica - Reactivos}") String nombreRemitente) {
		boolean autentica = username != null && !username.isBlank();
		this.remitente = remitente;
		this.nombreRemitente = nombreRemitente;

		this.mailSender = new JavaMailSenderImpl();
		this.mailSender.setHost(host);
		this.mailSender.setPort(port);
		if (autentica) {
			this.mailSender.setUsername(username);
			this.mailSender.setPassword(password);
		}
		Properties props = this.mailSender.getJavaMailProperties();
		props.put("mail.transport.protocol", "smtp");
		props.put("mail.smtp.auth", autentica ? "true" : "false");
		props.put("mail.smtp.starttls.enable", "true");
		props.put("mail.smtp.connectiontimeout", String.valueOf(TIMEOUT_MS));
		props.put("mail.smtp.timeout", String.valueOf(TIMEOUT_MS));
		props.put("mail.smtp.writetimeout", String.valueOf(TIMEOUT_MS));
	}

	@Override
	public void enviarOtpRecuperacion(String correoDestino, String nombreCompleto, String otp, int minutosExpiracion) {
		enviar(correoDestino, nombreCompleto,
				"Código para recuperar tu contraseña - CAPRIS Reactivos",
				cuerpoOtp(nombreCompleto, otp, minutosExpiracion));
	}

	@Override
	public void enviarCredencialesIniciales(String correoDestino, String nombreCompleto, String nombreUsuario, String contrasenaTemporal) {
		enviar(correoDestino, nombreCompleto,
				"Tus credenciales de acceso - CAPRIS Reactivos",
				cuerpoCredenciales(nombreCompleto, nombreUsuario, contrasenaTemporal));
	}

	private void enviar(String correoDestino, String nombreCompleto, String asunto, String cuerpo) {
		try {
			MimeMessage mensaje = mailSender.createMimeMessage();
			MimeMessageHelper helper = new MimeMessageHelper(mensaje, false, "UTF-8");
			helper.setFrom(remitente, nombreRemitente);
			helper.setTo(correoDestino);
			helper.setSubject(asunto);
			helper.setText(cuerpo);
			mailSender.send(mensaje);
		} catch (MailException | MessagingException | UnsupportedEncodingException ex) {
			log.error("No se pudo enviar el correo a {} vía SMTP", correoDestino, ex);
			throw new EnvioCorreoFallidoException("No se pudo enviar el correo por SMTP", ex);
		}
	}

	private String cuerpoOtp(String nombreCompleto, String otp, int minutosExpiracion) {
		return "Hola " + nombreCompleto + ",\n\n"
				+ "Tu código para restablecer la contraseña es: " + otp + "\n\n"
				+ "Este código vence en " + minutosExpiracion + " minutos y solo se puede usar una vez.\n"
				+ "Si no solicitaste este cambio, podés ignorar este correo -- tu contraseña actual sigue vigente.\n\n"
				+ "CAPRIS Médica - Sistema de Gestión de Reactivos";
	}

	private String cuerpoCredenciales(String nombreCompleto, String nombreUsuario, String contrasenaTemporal) {
		return "Hola " + nombreCompleto + ",\n\n"
				+ "Se creó tu cuenta en el Sistema de Gestión de Reactivos de CAPRIS Médica.\n\n"
				+ "Usuario: " + nombreUsuario + "\n"
				+ "Contraseña temporal: " + contrasenaTemporal + "\n\n"
				+ "Te pedimos que la cambies en tu primer acceso.\n\n"
				+ "CAPRIS Médica - Sistema de Gestión de Reactivos";
	}
}