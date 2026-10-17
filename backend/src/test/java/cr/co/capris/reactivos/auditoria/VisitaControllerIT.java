package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.auth.JwtService;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;

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

import java.time.LocalDate;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HU-024 de extremo a extremo contra Postgres real (migraciones Flyway
 * reales), sobre la semilla V1-V6 (amelendez/arcea -- mismo patron de token
 * via JwtService que BodegaConsultaControllerIT/JornadaControllerIT, el
 * login de HU-001 no es lo que se prueba aca).
 *
 * Las filas de ResultadoVisita se siembran directo por el repositorio (no
 * via la ingesta XML, que ya cubre AuditoriaIngestaControllerIT): aqui lo que
 * se prueba es el contrato de lectura/actualizacion de HU-024 -- que exija
 * JWT, que el filtro de listar() elija bien segun los parametros, y que
 * cambiarEstado() persista contra la base real.
 *
 * NO cubierto a proposito (gap real documentado en el javadoc de
 * VisitaController, no es un olvido de esta prueba):
 *   - Aislamiento por empresa activa (criterio 1) -- el endpoint no filtra
 *     por empresa todavia, ver "Sin filtro de empresa" en VisitaController.
 *   - Filtro por contrato/licitacion o bodega (criterio 3) -- listar() solo
 *     acepta asignadoAUsuarioId, fecha y estadoApp como parametros; no hay
 *     parametro de contrato ni de bodega en el endpoint actual.
 * Estos dos puntos quedan para cuando se implemente el filtro real (ver
 * HU-024: Frontend #146, todavia en Backlog).
 *
 * Requiere Docker; se ejecuta con "mvn verify", no con "mvn test".
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class VisitaControllerIT {

	// Prefijo unico por clase de prueba para no chocar con datos de otras
	// ITs que corren contra el mismo contenedor -- se limpia en @AfterEach.
	private static final String NUM_CON = "HU024-TEST";

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ResultadoVisitaRepository resultadoVisitaRepository;

	@Autowired
	private UsuarioRepository usuarioRepository;

	@Autowired
	private JwtService jwtService;

	private String token;
	private Long idAmelendez;
	private Long idArce;

	@BeforeAll
	void prepararTokens() {
		Usuario amelendez = usuarioRepository.findByUsername("amelendez").orElseThrow();
		idAmelendez = amelendez.getId();
		token = jwtService.generar(amelendez.getId(), amelendez.getEmpresa().getId(), amelendez.getRol().getNombre());

		idArce = usuarioRepository.findByUsername("arcea").orElseThrow().getId();
	}

	@AfterEach
	void limpiarVisitasDePrueba() {
		resultadoVisitaRepository.findAll().stream()
				.filter(visita -> visita.getNumCon().equals(NUM_CON))
				.forEach(resultadoVisitaRepository::delete);
	}

	private ResultadoVisita sembrarVisita(String codBod, Long asignadoA, LocalDate fecha, EstadoVisitaApp estadoApp) {
		ResultadoVisita visita = new ResultadoVisita(
				"MED", "WMOLINA", "PEND", "Pendiente", codBod, null, "INS1", null, NUM_CON, "Reactivos de laboratorio");
		if (asignadoA != null) {
			visita.asignar(asignadoA, fecha);
		}
		visita.setEstadoApp(estadoApp);
		return resultadoVisitaRepository.save(visita);
	}

	@Test
	void sinTokenListarVisitasDevuelve401SesionNoValida() throws Exception {
		mockMvc.perform(get("/api/auditoria/visitas"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.codigo").value("SESION_NO_VALIDA"));
	}

	// Criterio 1: solo las visitas asignadas a ese usuario, con su estado de avance.
	@Test
	void listarPorUsuarioAsignadoDevuelveSoloSusVisitasConElEstadoDeAvance() throws Exception {
		sembrarVisita("MEPRIN", idAmelendez, LocalDate.now(), EstadoVisitaApp.PENDIENTE);
		sembrarVisita("HMEX", idArce, LocalDate.now(), EstadoVisitaApp.PENDIENTE);

		mockMvc.perform(get("/api/auditoria/visitas")
						.param("asignadoAUsuarioId", String.valueOf(idAmelendez))
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].codBod").value("MEPRIN"))
				.andExpect(jsonPath("$[0].estadoApp").value("PENDIENTE"));
	}

	// Criterio 2: sin visitas pendientes para el usuario, lista vacia (200).
	@Test
	void listarParaUnUsuarioSinVisitasAsignadasDevuelveListaVacia() throws Exception {
		mockMvc.perform(get("/api/auditoria/visitas")
						.param("asignadoAUsuarioId", String.valueOf(idArce))
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
	}

	// Criterio 3 (parcial -- filtro soportado hoy: fecha + usuario; ver nota
	// de clase sobre contrato/bodega, todavia no implementados).
	@Test
	void listarPorUsuarioYFechaDevuelveSoloLasAsignadasEseDia() throws Exception {
		sembrarVisita("MEPRIN", idAmelendez, LocalDate.now(), EstadoVisitaApp.PENDIENTE);
		sembrarVisita("HMEX", idAmelendez, LocalDate.now().minusDays(3), EstadoVisitaApp.PENDIENTE);

		mockMvc.perform(get("/api/auditoria/visitas")
						.param("asignadoAUsuarioId", String.valueOf(idAmelendez))
						.param("fecha", LocalDate.now().toString())
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].codBod").value("MEPRIN"));
	}

	@Test
	void listarFiltradoPorEstadoAppDevuelveSoloLasVisitasEnEseEstado() throws Exception {
		sembrarVisita("MEPRIN", idAmelendez, LocalDate.now(), EstadoVisitaApp.EN_PROGRESO);
		sembrarVisita("HMEX", idAmelendez, LocalDate.now(), EstadoVisitaApp.PENDIENTE);

		mockMvc.perform(get("/api/auditoria/visitas")
						.param("estadoApp", "EN_PROGRESO")
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[*].codBod", org.hamcrest.Matchers.hasItem("MEPRIN")))
				.andExpect(jsonPath("$[*].codBod", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("HMEX"))));
	}

	@Test
	void cambiarEstadoDeUnaVisitaExistentePersisteElNuevoEstadoEnLaBase() throws Exception {
		sembrarVisita("MEPRIN", idAmelendez, LocalDate.now(), EstadoVisitaApp.PENDIENTE);

		mockMvc.perform(patch("/api/auditoria/visitas/{numCon}/{codBod}/estado", NUM_CON, "MEPRIN")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content("{\"estadoApp\":\"EN_PROGRESO\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estadoApp").value("EN_PROGRESO"));

		mockMvc.perform(get("/api/auditoria/visitas")
						.param("asignadoAUsuarioId", String.valueOf(idAmelendez))
						.header("Authorization", "Bearer " + token))
				.andExpect(jsonPath("$[0].estadoApp").value("EN_PROGRESO"));
	}

	@Test
	void cambiarEstadoDeUnaVisitaQueNoExisteDevuelve404() throws Exception {
		mockMvc.perform(patch("/api/auditoria/visitas/{numCon}/{codBod}/estado", "NO-EXISTE", "NO-EXISTE")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content("{\"estadoApp\":\"FINALIZADA\"}"))
				.andExpect(status().isNotFound());
	}
}
