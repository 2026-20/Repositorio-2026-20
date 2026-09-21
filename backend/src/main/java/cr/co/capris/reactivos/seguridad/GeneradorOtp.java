package cr.co.capris.reactivos.seguridad;

import java.security.SecureRandom;

/** HU-046: genera el código OTP de 6 dígitos que recibe el usuario por correo. */
public final class GeneradorOtp {

	private static final SecureRandom RANDOM = new SecureRandom();

	private GeneradorOtp() {
	}

	public static String generarSeisDigitos() {
		int numero = RANDOM.nextInt(1_000_000); // 0 a 999999
		return String.format("%06d", numero);
	}
}
