package cr.co.capris.reactivos.seguridad;

/**
 * Contrato de envío de correo. Se definió como interfaz a propósito (mismo
 * patrón que ValidadorPoliticaContrasena) para que todas las HUs que mandan
 * correo (HU-046 recuperación por OTP, HU-047 credenciales iniciales, y las
 * que vengan) reutilicen UN solo mecanismo y para poder cambiar de proveedor
 * (hoy SendGrid o SMTP/MailHog, el día que se resuelva el dominio propio de
 * CAPRIS puede ser otro) sin tocar a quien la consume.
 *
 * Cada tipo de correo de la app es un método distinto de este contrato; una HU
 * nueva agrega su método acá y lo implementa en TODAS las implementaciones, o
 * el arranque falla (Spring exige el bean completo).
 *
 * Implementaciones (se elige con app.email.proveedor):
 *  - "log"      (default): LogEmailService. Escribe el correo en el log, nada real.
 *  - "sendgrid" : SendGridEmailService. API HTTP de SendGrid.
 *  - "smtp"     : SmtpEmailService. JavaMailSender vía SMTP (MailHog en desarrollo).
 */
public interface EmailService {

	void enviarOtpRecuperacion(String correoDestino, String nombreCompleto, String otp, int minutosExpiracion);

	/**
	 * HU-047: correo con las credenciales iniciales de un usuario recién creado.
	 * Contiene el nombre de usuario (login) y la contraseña temporal que el
	 * usuario deberá cambiar en su primer acceso.
	 */
	void enviarCredencialesIniciales(String correoDestino, String nombreCompleto, String nombreUsuario, String contrasenaTemporal);
}
