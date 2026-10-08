package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.auth.JwtService;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HU-003/HU-004/HU-005: los endpoints de consulta de BodegaConsultaController
 * (GET /api/auditoria/bodegas, /{codBod}/detalle y /{codBod}/lotes), que son
 * los que alimentan la descarga offline de catalogos maestros de la PWA.
 *
 * Las filas se siembran directo en los repositorios (no via la ingesta XML,
 * que ya cubre AuditoriaIngestaControllerIT) porque aqui lo que se prueba es
 * el contrato de lectura de la PWA: que exija JWT, que devuelva la bodega con
 * su detalle/lotes y que una bodega desconocida devuelva lista vacia (la PWA
 * no distingue "no existe" de "no tiene nada" al cachear).
 *
 * El token se genera con JwtService directamente (usuario semilla wmolina),
 * igual que en UsuarioControllerIT -- el login de HU-001 no es lo que se
 * prueba aca.
 *
 * Requiere Docker; corre con "mvn verify".
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class BodegaConsultaControllerIT {

	// Codigos unicos por test para que un test no contamine las aserciones de
	// otro (todos comparten el mismo contenedor) -- se limpian en @AfterEach.
	private static final String BOD_LISTA_1 = "B-LISTA-1";
	private static final String BOD_LISTA_2 = "B-LISTA-2";
	private static final String BOD_DETALLE = "B-DETALLE-1";
	private static final String BOD_LOTES = "B-LOTES-1";
	private static final List<String> CODS_DE_PRUEBA = List.of(BOD_LISTA_1, BOD_LISTA_2, BOD_DETALLE, BOD_LOTES);

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private BodegaRepository bodegaRepository;

	@Autowired
	private DetalleBodegaRepository detalleBodegaRepository;

	@Autowired
	private LoteBodegaRepository loteBodegaRepository;

	@Autowired
	private JwtService jwtService;

	private String token;

	@BeforeAll
	void prepararToken() {
		// Es un token de un usuario real (solo le da validez ante el
		// JwtAuthenticationFilter); la empresa no importa porque estos
		// endpoints todavia no filtran por ella (ver SUPUESTO en Bodega).
		token = jwtService.generar(1L, 1L, "Administrador");
	}

	@AfterEach
	void limpiarDatosDePrueba() {
		CODS_DE_PRUEBA.forEach(codBod -> {
			detalleBodegaRepository.deleteAll(detalleBodegaRepository.findAllByCodBod(codBod));
			loteBodegaRepository.deleteAll(loteBodegaRepository.findAllByCodBod(codBod));
			bodegaRepository.findAll().stream()
					.filter(bodega -> bodega.getCodBod().equals(codBod))
					.forEach(bodegaRepository::delete);
		});
	}

	private Bodega guardarBodega(String codBod, String desBod) {
		return bodegaRepository.save(new Bodega(
				"MED", "WMOLINA", "NUM-CON-TEST", "INS", codBod, desBod, TipoBodega.CLI));
	}

	private void guardarDetalle(String codBod, String codArt, String desArt, BigDecimal cantidadTeorica, boolean indicadorLote) {
		detalleBodegaRepository.save(new DetalleBodega(
				"MED", "WMOLINA", codBod, "cliente", codArt, desArt,
				cantidadTeorica, indicadorLote, "CLI", "NUM-CON-TEST", "INS", new BigDecimal("2.0000")));
	}

	private void guardarLote(String codBod, String codArt, String numLote, LocalDate vencimiento, BigDecimal cantidad) {
		loteBodegaRepository.save(new LoteBodega(
				"MED", "WMOLINA", codBod, "cliente", codArt, numLote, vencimiento, cantidad));
	}

	@Test
	void peticionSinTokenDevuelve401ConSesionNoValida() throws Exception {
		mockMvc.perform(get("/api/auditoria/bodegas"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.codigo").value("SESION_NO_VALIDA"));
	}

	@Test
	void listarDevuelveTodasLasBodegasIngeridas() throws Exception {
		guardarBodega(BOD_LISTA_1, "Bodega de lista uno");
		guardarBodega(BOD_LISTA_2, "Bodega de lista dos");

		assertThat(bodegaRepository.findAll()).hasSize(2);

		mockMvc.perform(get("/api/auditoria/bodegas")
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[*].codBod").value(containsInAnyOrder(BOD_LISTA_1, BOD_LISTA_2)))
				.andExpect(jsonPath("$[*].desBod").value(hasItems("Bodega de lista uno", "Bodega de lista dos")))
				.andExpect(jsonPath("$[*].tipoBod").value(hasItem("CLI")));
	}

	@Test
	void detalleDevuelveLosArticulosTeoricosDeEsaBodega() throws Exception {
		guardarBodega(BOD_DETALLE, "Bodega con detalle");
		guardarDetalle(BOD_DETALLE, "ART-1", "Articulo uno", new BigDecimal("11.0000"), true);
		guardarDetalle(BOD_DETALLE, "ART-2", "Articulo dos", new BigDecimal("3.5000"), false);

		mockMvc.perform(get("/api/auditoria/bodegas/" + BOD_DETALLE + "/detalle")
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[*].codArt").value(containsInAnyOrder("ART-1", "ART-2")))
				.andExpect(jsonPath("$[*].cantidadTeorica").value(hasItem(closeTo(11.0, 0.001))))
				.andExpect(jsonPath("$[*].indicadorLote").value(hasItems(true, false)));
	}

	@Test
	void detalleDeBodegaSinDatosDevuelveListaVacia() throws Exception {
		mockMvc.perform(get("/api/auditoria/bodegas/B-NO-EXISTE/detalle")
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void lotesDevuelveLosLotesYVencimientosDeEsaBodega() throws Exception {
		guardarBodega(BOD_LOTES, "Bodega con lotes");
		guardarLote(BOD_LOTES, "ART-1", "LOTE-1", LocalDate.of(2027, 6, 30), new BigDecimal("11.0000"));
		guardarLote(BOD_LOTES, "ART-1", "LOTE-2", LocalDate.of(2028, 1, 15), new BigDecimal("2.0000"));

		mockMvc.perform(get("/api/auditoria/bodegas/" + BOD_LOTES + "/lotes")
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[*].numLote").value(containsInAnyOrder("LOTE-1", "LOTE-2")))
				.andExpect(jsonPath("$[*].fechaVencimiento").value(hasItems("2027-06-30", "2028-01-15")));
	}

	@Test
	void lotesDeBodegaSinDatosDevuelveListaVacia() throws Exception {
		mockMvc.perform(get("/api/auditoria/bodegas/B-NO-EXISTE/lotes")
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
	}
}