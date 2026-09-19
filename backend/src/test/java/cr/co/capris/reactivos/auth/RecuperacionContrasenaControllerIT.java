package cr.co.capris.reactivos.auth;

import com.jayway.jsonpath.JsonPath;
import cr.co.capris.reactivos.seguridad.EmailService;
import cr.co.capris.reactivos.seguridad.TokenRecuperacionRepository;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prueba de extremo a extremo de HU-046 contra la semilla real (V2), mismo
 * estilo que AutenticacionControllerIT. Requiere Docker; se ejecuta con
 * "mvn verify".
 *
 * IMPORTANTE: EmailService se reemplaza con un mock -- esta prueba (y CI)
 * NUNCA debe llamar a la API real de SendGrid.
 *
 * NOTA: @MockitoBean es la anotación vigente en Spring Framework 6.2+ /
 * Spring Boot 3.4+ para esto (reemplazó a @MockBean). Si no compila contra la
 * version exacta de spring-boot-starter-webmvc-test que resuelva el pom en
 * Spring Boot 4.1.1, es porque esa reestructuración de paquetes de pruebas
 * (ya visible en este mismo archivo tipo con AutoConfigureMockMvc y en
 * AutenticacionControllerIT) movió algo de lugar -- ubicar el reemplazo
 * correcto y avisar al resto del equipo, ya que probablemente afecte a más
 * de una IT.
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class RecuperacionContrasenaControllerIT {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private TokenRecuperacionRepository tokenRecuperacionRepository;

	@Autowired
	private UsuarioRepository usuarioRepository;

	@MockitoBean
	private EmailService emailService;

	@Test
	void flujoCompletoDeRecuperacionFunciona() throws Exception {
		String correo = "wmolina@capris.cr";

		mockMvc.perform(post("/api/auth/recuperacion/solicitar")
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(new SolicitarRecuperacionRequest(correo))))
				.andExpect(status().isOk());

		ArgumentCaptor<String> otpCapturado = ArgumentCaptor.forClass(String.class);
		verify(emailService).enviarOtpRecuperacion(eq(correo), anyString(), otpCapturado.capture(), anyInt());
		String otp = otpCapturado.getValue();

		String respuestaValidar = mockMvc.perform(post("/api/auth/recuperacion/validar-otp")
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(new ValidarOtpRequest(correo, otp))))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();

		String tokenSesionTemporal = JsonPath.read(respuestaValidar, "$.tokenSesionTemporal");
		assertThat(tokenSesionTemporal).isNotBlank();

		mockMvc.perform(post("/api/auth/recuperacion/nueva-contrasena")
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(
								new NuevaContrasenaRequest(tokenSesionTemporal, "NuevaClave2027!"))))
				.andExpect(status().isOk());
	}

	@Test
	void solicitarConCorreoInexistenteRespondeIgualQueConUnoExistente() throws Exception {
		mockMvc.perform(post("/api/auth/recuperacion/solicitar")
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(new SolicitarRecuperacionRequest("nadie@capris.cr"))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.mensaje").value(
						"Si el correo corresponde a una cuenta registrada, vas a recibir un mensaje con instrucciones."));
	}

	@Test
	void tresIntentosIncorrectosBloqueanElToken() throws Exception {
		String correo = "wmolina@capris.cr";

		mockMvc.perform(post("/api/auth/recuperacion/solicitar")
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(new SolicitarRecuperacionRequest(correo))))
				.andExpect(status().isOk());

		// Los 2 primeros intentos fallidos devuelven el mismo "código incorrecto o vencido".
		for (int i = 1; i <= 2; i++) {
			mockMvc.perform(post("/api/auth/recuperacion/validar-otp")
							.contentType("application/json")
							.content(objectMapper.writeValueAsString(new ValidarOtpRequest(correo, "000000"))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.codigo").value("TOKEN_RECUPERACION_INVALIDO"));
		}

		// El 3er intento supera el tope (criterio 5): el token se invalida y la respuesta
		// debe ser FORBIDDEN con el código de "bloqueado", señal de que el contador
		// persiste de verdad (no se perdió por rollback de la transacción).
		mockMvc.perform(post("/api/auth/recuperacion/validar-otp")
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(new ValidarOtpRequest(correo, "000000"))))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.codigo").value("TOKEN_RECUPERACION_BLOQUEADO"));

		// Después de 3 fallos el token queda usado e inutilizable: el siguiente intento
		// ya no debe ser un fallo contable adicional.
		mockMvc.perform(post("/api/auth/recuperacion/validar-otp")
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(new ValidarOtpRequest(correo, "000000"))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.codigo").value("TOKEN_RECUPERACION_INVALIDO"));

		// No debe quedar ningún token vigente sin usar para el usuario.
		var tokens = tokenRecuperacionRepository.findByUsuarioIdAndUsadoFalse(wmolina().getId());
		assertThat(tokens).isEmpty();
	}

	private cr.co.capris.reactivos.usuario.Usuario wmolina() {
		return usuarioRepository.findByUsername("wmolina").orElseThrow();
	}
}
