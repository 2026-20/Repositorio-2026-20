package cr.co.capris.reactivos.seguridad;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Implementación para desarrollo local, pruebas y CI: en vez de enviar un
 * correo real, escribe el OTP en el log. Es la implementación por defecto
 * (matchIfMissing = true) -- así nadie necesita una API key de SendGrid para
 * levantar el backend o correr "mvn test" / "mvn verify", y CI nunca llama a
 * la API real de SendGrid por accidente.
 *
 * NUNCA activar app.email.proveedor=log en producción real -- ver README y
 * GUIA_HU-046.md.
 */
@Service
@ConditionalOnProperty(name = "app.email.proveedor", havingValue = "log", matchIfMissing = true)
public class LogEmailService implements EmailService {

	private static final Logger log = LoggerFactory.getLogger(LogEmailService.class);

	@Override
	public void enviarOtpRecuperacion(String correoDestino, String nombreCompleto, String otp, int minutosExpiracion) {
		log.warn("[EMAIL SIMULADO -- app.email.proveedor=log] Para {} ({}): OTP={} (vence en {} min)",
				correoDestino, nombreCompleto, otp, minutosExpiracion);
	}
}
