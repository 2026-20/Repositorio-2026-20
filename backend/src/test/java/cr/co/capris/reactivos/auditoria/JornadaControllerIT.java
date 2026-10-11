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

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HU-038 de extremo a extremo contra Postgres real (migraciones Flyway
 * reales), sobre la semilla V1-V6 (amelendez/arcea -- ver UsuarioControllerIT
 * para el mismo patron de token via JwtService en vez de loguearse de
 * verdad). Ademas de /jornadas/iniciar y /jornadas/hoy, prueba el enganche
 * real con ConteoFisicoController (HU-005): el criterio 4 de la HU ("no se
 * puede registrar un conteo sin jornada confirmada") es justo lo que un
 * JornadaService mockeado (ver ConteoFisicoServiceTest) no puede demostrar
 * con confianza -- aqui corre contra la base real, con el filtro de
 * excepciones real (GlobalExceptionHandler) de por medio.
 *
 * Requiere Docker; se ejecuta con "mvn verify", no con "mvn test".
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class JornadaControllerIT {

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
	private JornadaRepository jornadaRepository;

	private String tokenAmelendez;
	private String tokenArce;
	private Long idAmelendez;

	@BeforeAll
	void prepararTokens() {
		Usuario amelendez = usuarioRepository.findByUsername("amelendez").orElseThrow();
		idAmelendez = amelendez.getId();
		tokenAmelendez = jwtService.generar(
				amelendez.getId(), amelendez.getEmpresa().getId(), amelendez.getRol().getNombre());

		Usuario arce = usuarioRepository.findByUsername("arcea").orElseThrow();
		tokenArce = jwtService.generar(arce.getId(), arce.getEmpresa().getId(), arce.getRol().getNombre());
	}

	// Cada test confirma la jornada de "hoy" para amelendez -- se limpia
	// despues de cada uno para que el siguiente test vuelva a empezar sin
	// jornada confirmada (misma razon que USERNAMES_DE_PRUEBA en
	// UsuarioControllerIT: aislar los tests entre si).
	@AfterEach
	void limpiarJornadaDeHoy() {
		jornadaRepository.findByUsuarioIdAndFecha(idAmelendez, LocalDate.now())
				.ifPresent(jornadaRepository::delete);
	}

	private String conteoRequestJson(String idempotenciaKey) throws Exception {
		RegistrarConteoRequest request = new RegistrarConteoRequest(
				idempotenciaKey, "A1", "ART1", null, null, BigDecimal.TEN, BigDecimal.ONE, null);
		return objectMapper.writeValueAsString(request);
	}

	@Test
	void sinTokenConsultarHoyDevuelve401SesionNoValida() throws Exception {
		mockMvc.perform(get("/api/auditoria/jornadas/hoy"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.codigo").value("SESION_NO_VALIDA"));
	}

	@Test
	void hoyAntesDeConfirmarDevuelveIniciadaFalseSinFecha() throws Exception {
		mockMvc.perform(get("/api/auditoria/jornadas/hoy").header("Authorization", "Bearer " + tokenAmelendez))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.iniciada").value(false))
				.andExpect(jsonPath("$.iniciadaEn").value(nullValue()));
	}

	@Test
	void confirmarElInicioQuedaRegistradoEnLaBaseYHoyLoRefleja() throws Exception {
		mockMvc.perform(post("/api/auditoria/jornadas/iniciar").header("Authorization", "Bearer " + tokenAmelendez))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.iniciada").value(true))
				.andExpect(jsonPath("$.iniciadaEn").exists());

		assertThat(jornadaRepository.findByUsuarioIdAndFecha(idAmelendez, LocalDate.now())).isPresent();

		mockMvc.perform(get("/api/auditoria/jornadas/hoy").header("Authorization", "Bearer " + tokenAmelendez))
				.andExpect(jsonPath("$.iniciada").value(true));
	}

	@Test
	void confirmarElInicioDosVecesElMismoDiaNoCreaUnaSegundaFilaEnLaBase() throws Exception {
		mockMvc.perform(post("/api/auditoria/jornadas/iniciar").header("Authorization", "Bearer " + tokenAmelendez))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/auditoria/jornadas/iniciar").header("Authorization", "Bearer " + tokenAmelendez))
				.andExpect(status().isOk());

		long jornadasDeHoy = jornadaRepository.findAll().stream()
				.filter(j -> j.getUsuarioId().equals(idAmelendez) && j.getFecha().equals(LocalDate.now()))
				.count();
		assertThat(jornadasDeHoy).isEqualTo(1);
	}

	@Test
	void confirmarLaJornadaDeUnUsuarioNoAfectaElEstadoDeOtro() throws Exception {
		mockMvc.perform(post("/api/auditoria/jornadas/iniciar").header("Authorization", "Bearer " + tokenAmelendez))
				.andExpect(status().isOk());

		mockMvc.perform(get("/api/auditoria/jornadas/hoy").header("Authorization", "Bearer " + tokenArce))
				.andExpect(jsonPath("$.iniciada").value(false));
	}

	// HU-038 criterio 4, enganche real con HU-005 -- sin JornadaService mockeado.
	@Test
	void sinJornadaConfirmadaRegistrarUnConteoDevuelve409JornadaNoIniciada() throws Exception {
		mockMvc.perform(post("/api/auditoria/conteos")
						.header("Authorization", "Bearer " + tokenAmelendez)
						.contentType("application/json")
						.content(conteoRequestJson("idem-hu038-sin-jornada")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.codigo").value("JORNADA_NO_INICIADA"));
	}

	@Test
	void confirmarLaJornadaPrimeroPermiteRegistrarElConteoDespues() throws Exception {
		mockMvc.perform(post("/api/auditoria/jornadas/iniciar").header("Authorization", "Bearer " + tokenAmelendez))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/auditoria/conteos")
						.header("Authorization", "Bearer " + tokenAmelendez)
						.contentType("application/json")
						.content(conteoRequestJson("idem-hu038-con-jornada")))
				.andExpect(status().isCreated());
	}
}
