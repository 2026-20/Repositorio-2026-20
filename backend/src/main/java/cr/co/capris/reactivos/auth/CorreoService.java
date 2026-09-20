package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.usuario.Usuario;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 *  Envia el correo con las credenciales iniciales (username + contraseña
 * temporal) al usuario recien creado. Usa SimpleMailMessage (texto plano) porque
 * todavia no hay infraestructura de plantillas HTML en el proyecto -- si mas
 * adelante se necesita un diseño mas elaborado, este es el punto para introducirla.
 */
@Service
public class CorreoService {

	private final JavaMailSender mailSender;
	private final String remitente;

	public CorreoService(
			JavaMailSender mailSender,
			@Value("${app.mail.remitente}") String remitente) {
		this.mailSender = mailSender;
		this.remitente = remitente;
	}

	public void enviarCredencialesIniciales(Usuario usuario, String contrasenaTemporal) {
		SimpleMailMessage mensaje = new SimpleMailMessage();
		mensaje.setFrom(remitente);
		mensaje.setTo(usuario.getCorreo());
		mensaje.setSubject("Tu cuenta en el Sistema de Gestion y Control de Reactivos");
		mensaje.setText("""
				Hola %s,

				Se creo una cuenta para vos en el sistema. Estas son tus credenciales iniciales:

				Usuario: %s
				Contraseña temporal: %s

				Debes cambiarla al iniciar sesion por primera vez.
				""".formatted(usuario.getNombreCompleto(), usuario.getUsername(), contrasenaTemporal));

		mailSender.send(mensaje);
	}
}
