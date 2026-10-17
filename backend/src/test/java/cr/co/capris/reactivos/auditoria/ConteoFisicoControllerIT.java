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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HU-005 de extremo a extremo contra Postgres real (migraciones Flyway
 * reales), sobre la semilla V1-V6 (amelendez). Mismo patron que
 * VisitaControllerIT: token via JwtService directo, no login real.
 *
 * Requiere Docker; se ejecuta con "mvn verify", no con "mvn test".
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ConteoFisicoControllerIT {

	private static final String COD_BOD = "HU005-TEST";

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ConteoFisicoRepository conteoFisicoRepository;

	@Autowired
	private JornadaRepository jornadaRepository;

	@Autowired
	private UsuarioRepository usuarioRepository;

	@Autowired
	private JwtService jwtService;

	private String token;
	private String tokenArce;
	private Long idAmelendez;

	@BeforeAll
	void prepararTokenYJornada() {
		Usuario amelendez = usuarioRepository.findByUsername("amelendez").orElseThrow();
		idAmelendez = amelendez.getId();
		token = jwtService.generar(amelendez.getId(), amelendez.getEmpresa().getId(), amelendez.getRol().getNombre());

		Usuario arce = usuarioRepository.findByUsername("arcea").orElseThrow();
		tokenArce = jwtService.generar(arce.getId(), arce.getEmpresa().getId(), arce.getRol().getNombre());

		// HU-038 criterio 4 (gate de ConteoFisicoService): sin esto, registrar
		// un conteo nuevo se rechaza con JornadaNoIniciadaException.
		jornadaRepository.findByUsuarioIdAndFecha(idAmelendez, LocalDate.now())
				.orElseGet(() -> jornadaRepository.save(
						new Jornada(idAmelendez, LocalDate.now(), java.time.OffsetDateTime.now())));
	}

	private Long idPorIdempotencia(String idIdempotencia) {
		return conteoFisicoRepository.findByIdempotenciaKey(idIdempotencia).orElseThrow().getId();
	}

	@AfterEach
	void limpiarConteosDePrueba() {
		conteoFisicoRepository.findAll().stream()
				.filter(conteo -> conteo.getCodBod().equals(COD_BOD))
				.forEach(conteoFisicoRepository::delete);
	}

	private String cuerpoDeRequest(String idIdempotencia, String cantidadFisica) {
		return """
				{
				  "idempotenciaKey": "%s",
				  "codBod": "%s",
				  "codArt": "ART1",
				  "numLote": null,
				  "numCon": "12555",
				  "cantidadTeorica": 10,
				  "cantidadFisica": %s,
				  "observaciones": null
				}
				"""
				.formatted(idIdempotencia, COD_BOD, cantidadFisica);
	}

	@Test
	void sinTokenRegistrarDevuelve401SesionNoValida() throws Exception {
		mockMvc.perform(post("/api/auditoria/conteos")
						.contentType("application/json")
						.content(cuerpoDeRequest("it-sin-token", "5")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.codigo").value("SESION_NO_VALIDA"));
	}

	// HU-005 criterios 1-3: registrar un conteo nuevo persiste la cantidad
	// teorica/fisica que llegaron del cliente y calcula la diferencia.
	@Test
	void registrarUnConteoNuevoLoPersisteYDevuelveLaDiferencia() throws Exception {
		mockMvc.perform(post("/api/auditoria/conteos")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-nuevo", "7")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.cantidadFisica").value(7))
				.andExpect(jsonPath("$.diferencia").value(-3))
				.andExpect(jsonPath("$.tipoDiferencia").value("FALTANTE"));
	}

	// HU-005 criterio 4 / idempotencia offline-first: reenviar la misma
	// clave de idempotencia (ej. reintento de sincronizacion) no duplica.
	@Test
	void reenviarLaMismaClaveDeIdempotenciaNoDuplicaElRegistro() throws Exception {
		mockMvc.perform(post("/api/auditoria/conteos")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-reintento", "4")))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/auditoria/conteos")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-reintento", "4")))
				.andExpect(status().isCreated());

		long cantidad = conteoFisicoRepository.findAll().stream()
				.filter(c -> c.getCodBod().equals(COD_BOD) && c.getIdempotenciaKey().equals("it-reintento"))
				.count();
		org.assertj.core.api.Assertions.assertThat(cantidad).isEqualTo(1);
	}

	@Test
	void unaCantidadFisicaNegativaSeRechazaConBadRequest() throws Exception {
		mockMvc.perform(post("/api/auditoria/conteos")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-negativo", "-1")))
				.andExpect(status().isBadRequest());
	}

	@Test
	void porBodegaListaLosConteosYaRegistradosEnEsaBodega() throws Exception {
		mockMvc.perform(post("/api/auditoria/conteos")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-listar", "10")))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/auditoria/conteos")
						.param("codBod", COD_BOD)
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[*].idempotenciaKey", org.hamcrest.Matchers.hasItem("it-listar")));
	}

	private String cuerpoDeCorreccion(String cantidadFisica, String observaciones) {
		return """
				{ "cantidadFisica": %s, "observaciones": %s }
				"""
				.formatted(cantidadFisica, observaciones == null ? "null" : "\"" + observaciones + "\"");
	}

	// HU-007 criterios 2 y 4.
	@Test
	void corregirUnConteoPropioLoActualizaYLoMarcaComoCorregido() throws Exception {
		mockMvc.perform(post("/api/auditoria/conteos")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-corregir", "5")))
				.andExpect(status().isCreated());
		Long id = idPorIdempotencia("it-corregir");

		mockMvc.perform(put("/api/auditoria/conteos/{id}", id)
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoDeCorreccion("6", "ajuste tras recontar")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cantidadFisica").value(6))
				.andExpect(jsonPath("$.observaciones").value("ajuste tras recontar"))
				.andExpect(jsonPath("$.corregido").value(true));
	}

	@Test
	void corregirUnConteoQueNoExisteDevuelve404() throws Exception {
		mockMvc.perform(put("/api/auditoria/conteos/{id}", 999999L)
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoDeCorreccion("1", null)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.codigo").value("CONTEO_NO_ENCONTRADO"));
	}

	// HU-007: solo quien registro el conteo puede corregirlo.
	@Test
	void corregirElConteoDeOtroUsuarioDevuelve403() throws Exception {
		mockMvc.perform(post("/api/auditoria/conteos")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-de-amelendez", "5")))
				.andExpect(status().isCreated());
		Long id = idPorIdempotencia("it-de-amelendez");

		mockMvc.perform(put("/api/auditoria/conteos/{id}", id)
						.header("Authorization", "Bearer " + tokenArce)
						.contentType("application/json")
						.content(cuerpoDeCorreccion("1", null)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.codigo").value("ACCESO_NO_AUTORIZADO"));
	}

	// HU-007 criterio 3.
	@Test
	void corregirUnConteoYaTransmitidoDevuelve409() throws Exception {
		mockMvc.perform(post("/api/auditoria/conteos")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-transmitido", "5")))
				.andExpect(status().isCreated());
		ConteoFisico conteo = conteoFisicoRepository.findByIdempotenciaKey("it-transmitido").orElseThrow();
		org.springframework.test.util.ReflectionTestUtils.setField(conteo, "transmitido", true);
		conteoFisicoRepository.save(conteo);

		mockMvc.perform(put("/api/auditoria/conteos/{id}", conteo.getId())
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoDeCorreccion("1", null)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.codigo").value("CONTEO_YA_TRANSMITIDO"));
	}

	@Test
	void corregirConUnaCantidadNegativaSeRechazaConBadRequest() throws Exception {
		mockMvc.perform(post("/api/auditoria/conteos")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoDeRequest("it-corregir-negativo", "5")))
				.andExpect(status().isCreated());
		Long id = idPorIdempotencia("it-corregir-negativo");

		mockMvc.perform(put("/api/auditoria/conteos/{id}", id)
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoDeCorreccion("-1", null)))
				.andExpect(status().isBadRequest());
	}
}
