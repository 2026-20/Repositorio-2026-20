package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.auth.JwtService;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HU-031: POST (sincronizar un registro generado offline, idempotente) y GET
 * (solo lectura -- sin PUT ni DELETE, criterio 5) de TrazabilidadController.
 *
 * Los tokens se generan directo con JwtService (usuarios semilla wmolina =
 * Administrador, amelendez = Usuario de Campo, ambos de CAPRIS Medica),
 * igual que en UsuarioControllerIT -- el login de HU-001 no es lo que se
 * prueba aca.
 *
 * Requiere Docker; corre con "mvn verify".
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class TrazabilidadControllerIT {

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
	private RegistroTrazabilidadRepository registroTrazabilidadRepository;

	private String tokenAdministrador;
	private String tokenUsuarioDeCampo;
	private Long administradorId;
	private Long usuarioDeCampoId;
	private Long empresaId;

	@BeforeAll
	void prepararTokens() {
		Usuario wmolina = usuarioRepository.findByUsername("wmolina").orElseThrow();
		administradorId = wmolina.getId();
		empresaId = wmolina.getEmpresa().getId();
		tokenAdministrador = jwtService.generar(administradorId, empresaId, wmolina.getRol().getNombre());

		Usuario amelendez = usuarioRepository.findByUsername("amelendez").orElseThrow();
		usuarioDeCampoId = amelendez.getId();
		tokenUsuarioDeCampo = jwtService.generar(usuarioDeCampoId, empresaId, amelendez.getRol().getNombre());
	}

	@AfterEach
	void limpiarRegistrosDePrueba() {
		registroTrazabilidadRepository.findAll().stream()
				.filter(registro -> registro.getIdIdempotencia().startsWith("it-"))
				.forEach(registroTrazabilidadRepository::delete);
	}

	private String cuerpoDeRequest(String idIdempotencia, TipoAccionTrazabilidad tipo) throws Exception {
		return objectMapper.writeValueAsString(new RegistrarTrazabilidadRequest(
				idIdempotencia, tipo, "A1", ResultadoAccionTrazabilidad.EXITOSO,
				"registro de prueba", OffsetDateTime.now().minusMinutes(30)));
	}

	@Test
	void registrarSinTokenDevuelve401ConSesionNoValida() throws Exception {
		mockMvc.perform(post("/api/auditoria/trazabilidad")
						.contentType("application/json")
						.content(cuerpoDeRequest("it-sin-token", TipoAccionTrazabilidad.CONTEO_REGISTRADO)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.codigo").value("SESION_NO_VALIDA"));
	}

	@Test
	void registrarGuardaElRegistroConElUsuarioYEmpresaDelToken() throws Exception {
		mockMvc.perform(post("/api/auditoria/trazabilidad")
						.header("Authorization", "Bearer " + tokenUsuarioDeCampo)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-nuevo", TipoAccionTrazabilidad.CONTEO_REGISTRADO)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.tipoAccion").value("CONTEO_REGISTRADO"))
				.andExpect(jsonPath("$.codBod").value("A1"))
				.andExpect(jsonPath("$.resultado").value("EXITOSO"));

		RegistroTrazabilidad guardado = registroTrazabilidadRepository.findByIdIdempotencia("it-nuevo").orElseThrow();
		assertThat(guardado.getUsuarioId()).isEqualTo(usuarioDeCampoId);
		assertThat(guardado.getEmpresaId()).isEqualTo(empresaId);
	}

	@Test
	void reenviarElMismoIdIdempotenciaNoDuplicaElRegistro() throws Exception {
		String cuerpo = cuerpoDeRequest("it-reintento", TipoAccionTrazabilidad.CONTEO_REGISTRADO);

		mockMvc.perform(post("/api/auditoria/trazabilidad")
						.header("Authorization", "Bearer " + tokenUsuarioDeCampo)
						.contentType("application/json")
						.content(cuerpo))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/auditoria/trazabilidad")
						.header("Authorization", "Bearer " + tokenUsuarioDeCampo)
						.contentType("application/json")
						.content(cuerpo))
				.andExpect(status().isCreated());

		List<RegistroTrazabilidad> todos = registroTrazabilidadRepository.findAll().stream()
				.filter(registro -> registro.getIdIdempotencia().equals("it-reintento"))
				.toList();
		assertThat(todos).hasSize(1);
	}

	@Test
	void unAdministradorVeElLogCompletoDeSuEmpresa() throws Exception {
		mockMvc.perform(post("/api/auditoria/trazabilidad")
						.header("Authorization", "Bearer " + tokenUsuarioDeCampo)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-admin-1", TipoAccionTrazabilidad.CONTEO_REGISTRADO)))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/auditoria/trazabilidad")
						.header("Authorization", "Bearer " + tokenAdministrador)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-admin-2", TipoAccionTrazabilidad.INICIO_SESION)))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/auditoria/trazabilidad")
						.header("Authorization", "Bearer " + tokenAdministrador))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.detalle == 'registro de prueba')].length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)));
	}

	@Test
	void unUsuarioDeCampoSoloVeSuPropiaActividad() throws Exception {
		mockMvc.perform(post("/api/auditoria/trazabilidad")
						.header("Authorization", "Bearer " + tokenUsuarioDeCampo)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-propio", TipoAccionTrazabilidad.CONTEO_REGISTRADO)))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/auditoria/trazabilidad")
						.header("Authorization", "Bearer " + tokenAdministrador)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-ajeno", TipoAccionTrazabilidad.INICIO_SESION)))
				.andExpect(status().isCreated());

		String nombreUsuarioDeCampo = usuarioRepository.findById(usuarioDeCampoId).orElseThrow().getNombreCompleto();

		// Solo debe ver su propio registro (it-propio) -- el del administrador
		// (it-ajeno) queda fuera, aunque sea de la misma empresa.
		mockMvc.perform(get("/api/auditoria/trazabilidad")
						.header("Authorization", "Bearer " + tokenUsuarioDeCampo))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[*].usuarioNombre").value(containsInAnyOrder(nombreUsuarioDeCampo)));
	}
}
