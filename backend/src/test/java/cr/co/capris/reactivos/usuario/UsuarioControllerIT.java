package cr.co.capris.reactivos.usuario;

import cr.co.capris.reactivos.auth.JwtService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prueba de extremo a extremo del aislamiento multiempresa de HU-023 sobre
 * UsuarioController, contra la semilla real (V1/V2/V3) mas los fixtures de una
 * segunda empresa que se agregan aqui -- la semilla de Flyway solo trae "CAPRIS
 * Médica", y HU-023 no se puede probar en serio con una sola empresa. Esos
 * fixtures no van en una migracion nueva porque son datos de prueba, no seed
 * real de la aplicacion.
 *
 * Los tokens se generan directamente con JwtService (en vez de loguearse via
 * POST /api/auth/login) porque lo que se prueba aqui es el filtrado por empresa
 * en UsuarioController + ContextoUsuarioActual, no el login de HU-001.
 *
 * Requiere Docker; se ejecuta con "mvn verify".
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class UsuarioControllerIT {

	/** Hash de "Capris2026!" (igual al de la semilla) -- no se usa para login en estas pruebas. */
	private static final String HASH_DE_RELLENO = "$2b$10$gC.hqSLQUPVroKuUU2VVEeG79UbOP3ym5hIjDXdY74Lau35Xe/RAG";

	/** Muy por encima de cualquier id que la secuencia BIGSERIAL pueda haber alcanzado. */
	private static final long ID_QUE_NO_EXISTE_EN_NINGUNA_EMPRESA = 999_999_999L;

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private UsuarioRepository usuarioRepository;

	@Autowired
	private EmpresaRepository empresaRepository;

	@Autowired
	private RolRepository rolRepository;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private String tokenUsuarioCapris;
	private Long usuarioDiagnostikaId;

	@BeforeAll
	void prepararSegundaEmpresaYTokens() {
		Empresa diagnostika = empresaRepository.save(new Empresa("Diagnostika"));

		Long rolUsuarioDeCampoId = rolRepository.findAll().stream()
				.filter(rol -> rol.getNombre().equals("Usuario de Campo"))
				.findFirst()
				.orElseThrow()
				.getId();

		usuarioDiagnostikaId = jdbcTemplate.queryForObject("""
				INSERT INTO usuario
					(nombre_completo, cedula, correo, username, password_hash, estado, rol_id, empresa_id)
				VALUES (?, ?, ?, ?, ?, 'ACTIVO', ?, ?)
				RETURNING id
				""",
				Long.class,
				"Usuaria de Prueba Diagnostika", "PENDIENTE-900", "udiagnostika@diagnostika.test",
				"udiagnostika", HASH_DE_RELLENO, rolUsuarioDeCampoId, diagnostika.getId());

		Usuario wmolina = usuarioRepository.findByUsername("wmolina").orElseThrow();
		tokenUsuarioCapris = jwtService.generar(
				wmolina.getId(), wmolina.getEmpresa().getId(), wmolina.getRol().getNombre());
	}

	@Test
	void usuarioDeCaprisSoloVeUsuariosDeCaprisEnElListado() throws Exception {
		String respuesta = mockMvc.perform(get("/api/usuarios")
						.header("Authorization", "Bearer " + tokenUsuarioCapris))
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString();

		UsuarioResumenDTO[] usuarios = objectMapper.readValue(respuesta, UsuarioResumenDTO[].class);

		assertThat(usuarios)
				.extracting(UsuarioResumenDTO::empresa)
				.containsOnly("CAPRIS Médica");
		assertThat(usuarios)
				.extracting(UsuarioResumenDTO::username)
				.containsExactlyInAnyOrder("wmolina", "amelendez", "arcea");
	}

	@Test
	void pedirUsuarioDeOtraEmpresaOUnIdInexistenteDevuelveExactamenteElMismoError() throws Exception {
		MvcResult respuestaOtraEmpresa = mockMvc.perform(get("/api/usuarios/{id}", usuarioDiagnostikaId)
						.header("Authorization", "Bearer " + tokenUsuarioCapris))
				.andExpect(status().isForbidden())
				.andReturn();

		MvcResult respuestaIdInexistente = mockMvc.perform(
						get("/api/usuarios/{id}", ID_QUE_NO_EXISTE_EN_NINGUNA_EMPRESA)
								.header("Authorization", "Bearer " + tokenUsuarioCapris))
				.andExpect(status().isForbidden())
				.andReturn();

		JsonNode errorOtraEmpresa = objectMapper.readTree(respuestaOtraEmpresa.getResponse().getContentAsString());
		JsonNode errorIdInexistente = objectMapper.readTree(
				respuestaIdInexistente.getResponse().getContentAsString());

		// No basta con que ambos den 403: si el mensaje o el codigo difirieran entre
		// "existe en otra empresa" e "id inexistente", ya se estaria filtrando cuales
		// ids son validos en otras empresas.
		assertThat(errorOtraEmpresa.get("codigo").asText()).isEqualTo("ACCESO_NO_AUTORIZADO");
		assertThat(errorOtraEmpresa.get("codigo").asText()).isEqualTo(errorIdInexistente.get("codigo").asText());
		assertThat(errorOtraEmpresa.get("mensaje").asText()).isEqualTo(errorIdInexistente.get("mensaje").asText());
	}

	@Test
	void peticionSinHeaderAuthorizationDevuelve401ConSesionNoValida() throws Exception {
		mockMvc.perform(get("/api/usuarios"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.codigo").value("SESION_NO_VALIDA"));
	}
}
