package cr.co.capris.reactivos.seguridad;

/**
 * Contrato de envío de correo. Se definió como interfaz a propósito (mismo
 * patrón que ValidadorPoliticaContrasena) para que HU-047 pueda reutilizarla
 * y para poder cambiar de proveedor (hoy SendGrid, el día que se resuelva el
 * dominio propio de CAPRIS puede ser otro) sin tocar a quien la consume.
 */
public interface EmailService {

	void enviarOtpRecuperacion(String correoDestino, String nombreCompleto, String otp, int minutosExpiracion);
}
