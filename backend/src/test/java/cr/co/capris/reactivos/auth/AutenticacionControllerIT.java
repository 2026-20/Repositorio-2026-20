package cr.co.capris.reactivos.auth;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prueba de extremo a extremo del login minimo de HU-001, contra la semilla real
 * (V2__seed_usuarios_iniciales.sql). Requiere Docker; se ejecuta con "mvn verify".
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class AutenticacionControllerIT {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Test
	void loginExitosoDevuelveTokenYDatosDelUsuario() throws Exception {
		LoginRequest request = new LoginRequest("wmolina", "Capris2026!", 1L);

		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.token").isNotEmpty())
				.andExpect(jsonPath("$.rol").value("Administrador"))
				.andExpect(jsonPath("$.debeCambiarContrasena").value(false));
	}

	@Test
	void loginConContrasenaIncorrectaDevuelve401() throws Exception {
		LoginRequest request = new LoginRequest("wmolina", "contraseña-incorrecta", 1L);

		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.codigo").value("CREDENCIALES_INVALIDAS"));
	}

	@Test
	void loginConEmpresaQueNoCoincideDevuelve401() throws Exception {
		LoginRequest request = new LoginRequest("wmolina", "Capris2026!", 999L);

		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isUnauthorized());
	}
}
