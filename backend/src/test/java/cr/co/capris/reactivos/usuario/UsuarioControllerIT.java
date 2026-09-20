package cr.co.capris.reactivos.usuario;

import cr.co.capris.reactivos.auth.CorreoService;
import cr.co.capris.reactivos.auth.JwtService;
import cr.co.capris.reactivos.seguridad.BitacoraSeguridadRepository;
import cr.co.capris.reactivos.seguridad.TipoEventoSeguridad;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prueba de extremo a extremo del aislamiento multiempresa de HU-023 sobre
 * UsuarioController, enteramente contra la semilla real (V1-V6): "CAPRIS Médica" (con
 * amelendez/arcea/wmolina) y "Diagnostika" (con pruebadiagnostika) ya son datos reales,
 * no fixtures de prueba -- no hace falta insertar nada a mano en esta clase.
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

	/** Muy por encima de cualquier id que la secuencia BIGSERIAL pueda haber alcanzado. */
	private static final long ID_QUE_NO_EXISTE_EN_NINGUNA_EMPRESA = 999_999_999L;

	// Usernames que los tests de alta intentan crear -- se limpian en @AfterEach para
	// que un usuario creado por un test no contamine las aserciones de otro (ej. el
	// listado de usuarioDeCaprisSoloVeUsuariosDeCaprisEnElListado, que exige que la
	// semilla sea exactamente wmolina/amelendez/arcea). Algunos de estos nunca llegan
	// a crearse de verdad (los que prueban un camino de error) -- limpiar un username
	// que no existe es un no-op, no hace falta distinguir los casos aqui.
	private static final List<String> USERNAMES_DE_PRUEBA = List.of(
			"persona.nueva",
			"otra.persona",
			"intento.no.autorizado",
			"rol.inexistente",
			"persona.otra.empresa",
			"empresa.inexistente");

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
	private JwtService jwtService;

	@Autowired
	private BitacoraSeguridadRepository bitacoraSeguridadRepository;

	@MockitoBean
	private CorreoService correoService;

	private String tokenUsuarioCapris;
	private String tokenUsuarioDeCampoCapris;
	private Long usuarioDiagnostikaId;

	@BeforeAll
	void prepararTokens() {
		Usuario wmolina = usuarioRepository.findByUsername("wmolina").orElseThrow();
		tokenUsuarioCapris = jwtService.generar(
				wmolina.getId(), wmolina.getEmpresa().getId(), wmolina.getRol().getNombre());

		Usuario amelendez = usuarioRepository.findByUsername("amelendez").orElseThrow();
		tokenUsuarioDeCampoCapris = jwtService.generar(
				amelendez.getId(), amelendez.getEmpresa().getId(), amelendez.getRol().getNombre());

		usuarioDiagnostikaId = usuarioRepository.findByUsername("pruebadiagnostika").orElseThrow().getId();
	}

	@AfterEach
	void limpiarUsuariosCreadosPorLasPruebas() {
		USERNAMES_DE_PRUEBA.stream()
				.map(usuarioRepository::findByUsername)
				.flatMap(Optional::stream)
				.forEach(usuario -> {
					bitacoraSeguridadRepository.deleteByUsuarioId(usuario.getId());
					usuarioRepository.delete(usuario);
				});
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

	@Test
	void altaDeUsuarioConDatosValidosYTokenDeAdministradorDevuelve201YQuedaPendienteDePrimerIngreso() throws Exception {
		Usuario admin = usuarioRepository.findByUsername("wmolina").orElseThrow();
		Long rolUsuarioDeCampoId = usuarioRepository.findByUsername("amelendez").orElseThrow().getRol().getId();

		CrearUsuarioRequest request = new CrearUsuarioRequest(
				"Persona Nueva Prueba",
				"PENDIENTE-100",
				"persona.nueva@capris.co.cr",
				"persona.nueva",
				rolUsuarioDeCampoId,
				admin.getEmpresa().getId());

		String respuesta = mockMvc.perform(post("/api/usuarios")
						.header("Authorization", "Bearer " + tokenUsuarioCapris)
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.estado").value("PENDIENTE_PRIMER_INGRESO"))
				.andExpect(jsonPath("$.username").value("persona.nueva"))
				.andReturn()
				.getResponse()
				.getContentAsString();

		// La respuesta nunca debe filtrar la contraseña temporal ni su hash, sin
		// importar el nombre exacto que tome el campo.
		assertThat(respuesta).doesNotContainIgnoringCase("password");
		assertThat(respuesta).doesNotContainIgnoringCase("contrasena");
		assertThat(respuesta).doesNotContainIgnoringCase("contraseña");

		Usuario creado = usuarioRepository.findByUsername("persona.nueva").orElseThrow();
		assertThat(creado.getEstado()).isEqualTo(EstadoUsuario.PENDIENTE_PRIMER_INGRESO);
		assertThat(creado.getPasswordTemporalExpiraEn()).isNotNull();

		boolean seRegistroEnBitacora = bitacoraSeguridadRepository.findAll().stream()
				.anyMatch(registro -> registro.getUsuarioId().equals(creado.getId())
						&& registro.getTipoEvento() == TipoEventoSeguridad.USUARIO_CREADO);
		assertThat(seRegistroEnBitacora).isTrue();

		verify(correoService).enviarCredencialesIniciales(any(Usuario.class), anyString());
	}

	@Test
	void altaDeUsuarioConCorreoDuplicadoDevuelve409UsuarioDuplicado() throws Exception {
		Usuario admin = usuarioRepository.findByUsername("wmolina").orElseThrow();
		Long rolUsuarioDeCampoId = usuarioRepository.findByUsername("amelendez").orElseThrow().getRol().getId();

		CrearUsuarioRequest request = new CrearUsuarioRequest(
				"Otra Persona",
				"PENDIENTE-101",
				"wmolina@capris.cr", // correo ya usado por el admin semilla
				"otra.persona",
				rolUsuarioDeCampoId,
				admin.getEmpresa().getId());

		mockMvc.perform(post("/api/usuarios")
						.header("Authorization", "Bearer " + tokenUsuarioCapris)
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.codigo").value("USUARIO_DUPLICADO"));

		assertThat(usuarioRepository.existsByUsername("otra.persona")).isFalse();
	}

	@Test
	void altaDeUsuarioComoUsuarioDeCampoDevuelve403YNoCreaElUsuario() throws Exception {
		Usuario admin = usuarioRepository.findByUsername("wmolina").orElseThrow();
		Long rolUsuarioDeCampoId = usuarioRepository.findByUsername("amelendez").orElseThrow().getRol().getId();

		CrearUsuarioRequest request = new CrearUsuarioRequest(
				"Intento No Autorizado",
				"PENDIENTE-102",
				"intento.no.autorizado@capris.co.cr",
				"intento.no.autorizado",
				rolUsuarioDeCampoId,
				admin.getEmpresa().getId());

		mockMvc.perform(post("/api/usuarios")
						.header("Authorization", "Bearer " + tokenUsuarioDeCampoCapris)
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.codigo").value("ACCESO_NO_AUTORIZADO"));

		assertThat(usuarioRepository.existsByUsername("intento.no.autorizado")).isFalse();
	}

	@Test
	void altaDeUsuarioConRolInexistenteDevuelve404UsuarioNoEncontrado() throws Exception {
		Usuario admin = usuarioRepository.findByUsername("wmolina").orElseThrow();

		CrearUsuarioRequest request = new CrearUsuarioRequest(
				"Rol Inexistente",
				"PENDIENTE-103",
				"rol.inexistente@capris.co.cr",
				"rol.inexistente",
				ID_QUE_NO_EXISTE_EN_NINGUNA_EMPRESA,
				admin.getEmpresa().getId());

		mockMvc.perform(post("/api/usuarios")
						.header("Authorization", "Bearer " + tokenUsuarioCapris)
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.codigo").value("USUARIO_NO_ENCONTRADO"));

		assertThat(usuarioRepository.existsByUsername("rol.inexistente")).isFalse();
	}

	@Test
	void altaDeUsuarioParaOtraEmpresaDevuelve201YQuedaAsociadoAEsaEmpresa() throws Exception {
		// Un administrador puede dar de alta usuarios tanto en su propia empresa
		// como en otras -- HU-047 solo exige que el usuario nuevo quede asociado
		// exclusivamente a la empresa seleccionada, no que el administrador este
		// limitado a la suya.
		Long rolUsuarioDeCampoId = usuarioRepository.findByUsername("amelendez").orElseThrow().getRol().getId();
		Long empresaDiagnostikaId = usuarioRepository.findByUsername("pruebadiagnostika").orElseThrow()
				.getEmpresa().getId();

		CrearUsuarioRequest request = new CrearUsuarioRequest(
				"Persona De Otra Empresa",
				"PENDIENTE-104",
				"persona.otra.empresa@diagnostika.test",
				"persona.otra.empresa",
				rolUsuarioDeCampoId,
				empresaDiagnostikaId);

		mockMvc.perform(post("/api/usuarios")
						.header("Authorization", "Bearer " + tokenUsuarioCapris)
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.empresa").value("Diagnostika"));

		Usuario creado = usuarioRepository.findByUsername("persona.otra.empresa").orElseThrow();
		assertThat(creado.getEmpresa().getId()).isEqualTo(empresaDiagnostikaId);
	}

	@Test
	void altaDeUsuarioConEmpresaInexistenteDevuelve404UsuarioNoEncontrado() throws Exception {
		Long rolUsuarioDeCampoId = usuarioRepository.findByUsername("amelendez").orElseThrow().getRol().getId();

		CrearUsuarioRequest request = new CrearUsuarioRequest(
				"Empresa Inexistente",
				"PENDIENTE-105",
				"empresa.inexistente@capris.co.cr",
				"empresa.inexistente",
				rolUsuarioDeCampoId,
				ID_QUE_NO_EXISTE_EN_NINGUNA_EMPRESA);

		mockMvc.perform(post("/api/usuarios")
						.header("Authorization", "Bearer " + tokenUsuarioCapris)
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.codigo").value("USUARIO_NO_ENCONTRADO"));

		assertThat(usuarioRepository.existsByUsername("empresa.inexistente")).isFalse();
	}
}
