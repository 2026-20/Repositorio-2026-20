package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.seguridad.ValidadorPoliticaContrasena;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;

/**
 *  Genera la contraseña temporal que se envia por correo al usuario nuevo.
 * El algoritmo de generacion ya intercala mayuscula, minuscula, numero y caracter
 * especial a proposito, pero igual se revalida el resultado contra
 * ValidadorPoliticaContrasenaImpl.
 */
@Component
public class GeneradorContrasenaTemporal {

	private static final String MAYUSCULAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	private static final String MINUSCULAS = "abcdefghijklmnopqrstuvwxyz";
	private static final String NUMEROS = "0123456789";
	private static final String ESPECIALES = "!@#$%^&*-_+=?";
	private static final String TODOS = MAYUSCULAS + MINUSCULAS + NUMEROS + ESPECIALES;

	private static final int LONGITUD = 12;
	private static final int MAX_INTENTOS = 10;

	private final ValidadorPoliticaContrasena validadorPoliticaContrasena;
	private final SecureRandom secureRandom = new SecureRandom();

	public GeneradorContrasenaTemporal(ValidadorPoliticaContrasena validadorPoliticaContrasena) {
		this.validadorPoliticaContrasena = validadorPoliticaContrasena;
	}

	public String generar() {
		for (int intento = 0; intento < MAX_INTENTOS; intento++) {
			String candidata = generarCandidata();
			if (validadorPoliticaContrasena.validar(candidata).isEmpty()) {
				return candidata;
			}
		}
		throw new IllegalStateException(
				"No se pudo generar una contraseña temporal valida en " + MAX_INTENTOS + " intentos");
	}

	private String generarCandidata() {
		char[] caracteres = new char[LONGITUD];
		caracteres[0] = MAYUSCULAS.charAt(secureRandom.nextInt(MAYUSCULAS.length()));
		caracteres[1] = MINUSCULAS.charAt(secureRandom.nextInt(MINUSCULAS.length()));
		caracteres[2] = NUMEROS.charAt(secureRandom.nextInt(NUMEROS.length()));
		caracteres[3] = ESPECIALES.charAt(secureRandom.nextInt(ESPECIALES.length()));

		for (int i = 4; i < LONGITUD; i++) {
			caracteres[i] = TODOS.charAt(secureRandom.nextInt(TODOS.length()));
		}

		for (int i = caracteres.length - 1; i > 0; i--) {
			int j = secureRandom.nextInt(i + 1);
			char temp = caracteres[i];
			caracteres[i] = caracteres[j];
			caracteres[j] = temp;
		}

		return new String(caracteres);
	}
}
