package cr.co.capris.reactivos.seguridad;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * TEMPORAL -- HU-046 depende de ValidadorPoliticaContrasena (dueño: HU-042,
 * ver README "Sprint 1"), que todavía no tiene implementación propia en el
 * repositorio. Sin ALGÚN bean de este tipo, RecuperacionContrasenaService ni
 * siquiera arranca (Spring no puede inyectar la interfaz).
 *
 * Este stub cubre las 4 reglas que la interfaz ya documenta en su Javadoc (8+
 * caracteres, mayúscula, minúscula, número, especial) y se retira solo
 * (@ConditionalOnMissingBean) en cuanto la persona de HU-042 registre su
 * propio @Service que implemente ValidadorPoliticaContrasena -- avisarle para
 * no quedar los dos compitiendo por accidente ni duplicar el trabajo.
 */
@Configuration
public class ValidadorPoliticaContrasenaBasico {

	@Bean
	@ConditionalOnMissingBean(ValidadorPoliticaContrasena.class)
	public ValidadorPoliticaContrasena validadorPoliticaContrasenaTemporal() {
		return contrasena -> {
			List<String> violaciones = new ArrayList<>();
			if (contrasena == null || contrasena.length() < 8) {
				violaciones.add("Debe tener al menos 8 caracteres");
			}
			if (contrasena == null || !Pattern.compile("[A-Z]").matcher(contrasena).find()) {
				violaciones.add("Debe incluir al menos una letra mayúscula");
			}
			if (contrasena == null || !Pattern.compile("[a-z]").matcher(contrasena).find()) {
				violaciones.add("Debe incluir al menos una letra minúscula");
			}
			if (contrasena == null || !Pattern.compile("[0-9]").matcher(contrasena).find()) {
				violaciones.add("Debe incluir al menos un número");
			}
			// El espacio (U+0020) NO cuenta como carácter especial: solo puntuación/símbolos.
			if (contrasena == null || !Pattern.compile("[^A-Za-z0-9 ]").matcher(contrasena).find()) {
				violaciones.add("Debe incluir al menos un carácter especial");
			}
			return violaciones;
		};
	}
}
