package cr.co.capris.reactivos.auditoria;

import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Corre las migraciones reales de Flyway (incluida V9, ver
 * db/migration) contra un Postgres real, e ingesta los 6 archivos de
 * prueba reales de una auditoria pasada (ver estudio de auditoria
 * 2026-10 y AuditoriaXmlParserTest) de punta a punta: XML -> parser ->
 * mapper -> entidad -> base de datos.
 *
 * A diferencia de AuditoriaIngestaServiceTest (con Mockito, sin Docker),
 * esto prueba cosas que un mock no puede probar de verdad:
 *   - que el schema de V9 acepta los datos reales sin reventar por tipo
 *     o tamaño de columna,
 *   - que la tolerancia por fila (AuditoriaFilaTransaccional, REQUIRES_NEW)
 *     funciona contra una base real: una fila que falla no deja a medias
 *     ni revierte las filas ya confirmadas antes en la misma corrida,
 *   - que reingestar el mismo archivo no duplica filas (upsert) y que
 *     reingestar cai_est_vis no borra un resultado de auditoria ya
 *     guardado.
 *
 * Requiere Docker; corre con "mvn verify", no con "mvn test". Puede
 * tardar mas que otros *IT.java: ingesta cai_det_bod.xml (1962 filas) y
 * cai_lot_bod.xml (1691 filas), y cada fila es su propio commit a
 * proposito (ver AuditoriaFilaTransaccional).
 *
 * Los metodos corren en orden explicito (@Order) porque el container de
 * Postgres se comparte entre todos -- no hay rollback automatico entre
 * tests. El orden importa para los asserts de conteo total de la primera
 * prueba (tienen que correr sobre una base recien creada); las demas son
 * idempotentes sin importar el orden (upsert por clave natural), pero se
 * ordenan igual para que la intencion de cada una quede clara.
 */
@Testcontainers
@SpringBootTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AuditoriaIngestaServiceIT {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	private static final String DIRECTORIO = "auditoria/xmls/";

	@Autowired
	private AuditoriaIngestaService service;

	@Autowired
	private BodegaRepository bodegaRepository;

	@Autowired
	private ResultadoVisitaRepository resultadoVisitaRepository;

	@Autowired
	private DetalleBodegaRepository detalleBodegaRepository;

	@Autowired
	private LoteBodegaRepository loteBodegaRepository;

	@Autowired
	private MovimientoPendienteRepository movimientoPendienteRepository;

	@Autowired
	private LoteMovimientoRepository loteMovimientoRepository;

	private InputStream recurso(String nombreArchivo) {
		InputStream in = getClass().getClassLoader().getResourceAsStream(DIRECTORIO + nombreArchivo);
		assertThat(in).as("fixture %s debe existir en src/test/resources/%s", nombreArchivo, DIRECTORIO)
				.isNotNull();
		return in;
	}

	private InputStream xmlCrudo(String xml) {
		return new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8));
	}

	@Test
	@Order(1)
	void ingestaLos6ArchivosDePruebaRealesSinDescartarNingunaFila() {
		ResultadoIngesta bodegas = service.ingestarBodegas(recurso("med_wmolina_cai_bod.xml"), "cai_bod.xml");
		ResultadoIngesta estados =
				service.ingestarEstadosVisita(recurso("med_wmolina_cai_est_vis.xml"), "cai_est_vis.xml");
		ResultadoIngesta detalle =
				service.ingestarDetalleBodega(recurso("med_wmolina_cai_det_bod.xml"), "cai_det_bod.xml");
		ResultadoIngesta lotes =
				service.ingestarLoteBodega(recurso("med_wmolina_cai_lot_bod.xml"), "cai_lot_bod.xml");
		ResultadoIngesta movimientos = service.ingestarMovimientosPendientes(
				recurso("med_wmolina_A2070000_20260724_cai_det_mov_2026-07-24_1640_1.xml"),
				"med_wmolina_A2070000_20260724_cai_det_mov_2026-07-24_1640_1.xml");
		ResultadoIngesta lotesMovimiento = service.ingestarLotesMovimiento(
				recurso("med_wmolina_A2070000_20260724_cai_lot_mov_2026-07-24_1640_2.xml"),
				"med_wmolina_A2070000_20260724_cai_lot_mov_2026-07-24_1640_2.xml");

		// Mismos numeros que AuditoriaXmlParserTest -- confirmados contra los
		// datos de prueba reales, ver su javadoc.
		assertThat(bodegas).isEqualTo(new ResultadoIngesta(22, 0));
		assertThat(estados).isEqualTo(new ResultadoIngesta(16, 0));
		assertThat(detalle).isEqualTo(new ResultadoIngesta(1962, 0));
		assertThat(lotes).isEqualTo(new ResultadoIngesta(1691, 0));
		assertThat(movimientos).isEqualTo(new ResultadoIngesta(12, 0));
		assertThat(lotesMovimiento).isEqualTo(new ResultadoIngesta(13, 0));

		assertThat(bodegaRepository.count()).isEqualTo(22);
		assertThat(resultadoVisitaRepository.count()).isEqualTo(16);
		assertThat(detalleBodegaRepository.count()).isEqualTo(1962);
		assertThat(loteBodegaRepository.count()).isEqualTo(1691);
		assertThat(movimientoPendienteRepository.count()).isEqualTo(12);
		assertThat(loteMovimientoRepository.count()).isEqualTo(13);
	}

	@Test
	@Order(2)
	void laCantidadTeoricaGuardadaEnLaBaseCalzaConLaSumaDeSusLotesGuardados() {
		service.ingestarDetalleBodega(recurso("med_wmolina_cai_det_bod.xml"), "cai_det_bod.xml");
		service.ingestarLoteBodega(recurso("med_wmolina_cai_lot_bod.xml"), "cai_lot_bod.xml");

		Map<String, BigDecimal> sumaLotesPorArticulo = new HashMap<>();
		for (LoteBodega lote : loteBodegaRepository.findAll()) {
			String clave = lote.getCodBod() + "|" + lote.getCodArt();
			sumaLotesPorArticulo.merge(clave, lote.getCantidad(), BigDecimal::add);
		}

		long revisados = 0;
		for (DetalleBodega fila : detalleBodegaRepository.findAll()) {
			if (!fila.isIndicadorLote()) {
				continue;
			}
			String clave = fila.getCodBod() + "|" + fila.getCodArt();
			BigDecimal sumaLotes = sumaLotesPorArticulo.getOrDefault(clave, BigDecimal.ZERO);
			assertThat(fila.getCantidadTeorica())
					.as("cantidad teorica de %s tal como quedo en la base", clave)
					.isEqualByComparingTo(sumaLotes);
			revisados++;
		}
		assertThat(revisados).isEqualTo(1649);
	}

	@Test
	@Order(3)
	void unaFilaMalaEnMedioNoRevierteLasFilasYaGuardadasEnLaMismaCorrida() {
		// Esto es justo lo que un test con Mockito no puede probar: que el
		// REQUIRES_NEW de AuditoriaFilaTransaccional hace que las filas 1 y 3
		// queden confirmadas en la base de verdad, aunque la fila 2 truene a
		// mitad de la corrida. El fallo tiene que ser de los que sobreviven
		// el parseo y truenan recien al MAPEAR a entidad (un TipoBodega
		// desconocido, ver AuditoriaXmlMapper) -- un valor con formato
		// invalido (ej. "N/D" en un campo numerico) ya lo descarta el
		// parser antes de llegar aqui (ver AuditoriaXmlParserTest), asi que
		// no sirve para probar esta capa.
		String xml = "<ROWSET>"
				+ "<ROW><CC_COD_ORG>MED</CC_COD_ORG><CC_COD_USU>WMOLINA</CC_COD_USU>"
				+ "<CC_NUM_CON>99999</CC_NUM_CON><CC_COD_INS>ins</CC_COD_INS>"
				+ "<CC_COD_BOD>ZZ1</CC_COD_BOD><CC_DES_BOD>buena1</CC_DES_BOD><CC_TIP_BOD>CLI</CC_TIP_BOD></ROW>"
				+ "<ROW><CC_COD_ORG>MED</CC_COD_ORG><CC_COD_USU>WMOLINA</CC_COD_USU>"
				+ "<CC_NUM_CON>99999</CC_NUM_CON><CC_COD_INS>ins</CC_COD_INS>"
				+ "<CC_COD_BOD>ZZ2</CC_COD_BOD><CC_DES_BOD>mala</CC_DES_BOD><CC_TIP_BOD>TRANSITO</CC_TIP_BOD></ROW>"
				+ "<ROW><CC_COD_ORG>MED</CC_COD_ORG><CC_COD_USU>WMOLINA</CC_COD_USU>"
				+ "<CC_NUM_CON>99999</CC_NUM_CON><CC_COD_INS>ins</CC_COD_INS>"
				+ "<CC_COD_BOD>ZZ3</CC_COD_BOD><CC_DES_BOD>buena2</CC_DES_BOD><CC_TIP_BOD>CLI</CC_TIP_BOD></ROW>"
				+ "</ROWSET>";

		ResultadoIngesta resultado = service.ingestarBodegas(xmlCrudo(xml), "prueba_tolerancia_real.xml");

		assertThat(resultado).isEqualTo(new ResultadoIngesta(2, 1));
		assertThat(bodegaRepository.findByNumConAndCodBodAndTipoBod("99999", "ZZ1", TipoBodega.CLI)).isPresent();
		assertThat(bodegaRepository.findByNumConAndCodBodAndTipoBod("99999", "ZZ3", TipoBodega.CLI)).isPresent();
		assertThat(bodegaRepository.findByNumConAndCodBodAndTipoBod("99999", "ZZ2", TipoBodega.CLI)).isEmpty();
	}

	@Test
	@Order(4)
	void reingestarCaiBodNoDuplicaFilasPorqueBorraYReemplazaPorClaveNatural() {
		// Conteo relativo (antes/despues), no un numero fijo: para cuando esta
		// prueba corre, cai_bod.xml ya se ingesto una vez en @Order(1) -- las
		// dos llamadas de aqui son AMBAS reingestas (upsert), asi que el
		// conteo no deberia moverse en ninguna de las dos. (La prueba de
		// @Order(3) ademas deja 2 filas de prueba, ZZ1/ZZ3, en esta misma
		// tabla a proposito -- correcto, no son parte de este archivo.)
		service.ingestarBodegas(recurso("med_wmolina_cai_bod.xml"), "cai_bod.xml");
		long despuesDeLaPrimera = bodegaRepository.count();

		service.ingestarBodegas(recurso("med_wmolina_cai_bod.xml"), "cai_bod.xml");
		assertThat(bodegaRepository.count()).isEqualTo(despuesDeLaPrimera);
	}

	@Test
	@Order(5)
	void reingestarElMismoArchivoDeMovimientosNoDuplicaLasFilasDeEsaVisita() {
		String archivo = "med_wmolina_A2070000_20260724_cai_det_mov_2026-07-24_1640_1.xml";
		service.ingestarMovimientosPendientes(recurso(archivo), archivo);
		service.ingestarMovimientosPendientes(recurso(archivo), archivo);

		assertThat(movimientoPendienteRepository.count()).isEqualTo(12);
	}

	@Test
	@Order(6)
	void reingestarElEstadoDeVisitaNoBorraUnResultadoDeAuditoriaYaRegistrado() {
		service.ingestarEstadosVisita(recurso("med_wmolina_cai_est_vis.xml"), "cai_est_vis.xml");

		// Simula que la app ya registro un resultado para la bodega A2060000
		// (primera fila de cai_est_vis.xml) antes de que llegue un nuevo
		// snapshot del ERP.
		Optional<ResultadoVisita> registrado = resultadoVisitaRepository.findByNumConAndCodBod(
				"0432025114200211-00-13585", "A2060000");
		assertThat(registrado).isPresent();
		registrado.get().setAprobacionTipo1("aprobado por un administrador");
		resultadoVisitaRepository.save(registrado.get());

		// El ERP reenvia el mismo snapshot (ej. otra visita que agrega, o un
		// reenvio de rutina).
		service.ingestarEstadosVisita(recurso("med_wmolina_cai_est_vis.xml"), "cai_est_vis.xml");

		Optional<ResultadoVisita> despuesDeReingestar = resultadoVisitaRepository.findByNumConAndCodBod(
				"0432025114200211-00-13585", "A2060000");
		assertThat(despuesDeReingestar).isPresent();
		assertThat(despuesDeReingestar.get().getAprobacionTipo1()).isEqualTo("aprobado por un administrador");
		// Y sigue siendo una sola fila para esa clave, no una duplicada.
		assertThat(resultadoVisitaRepository.count()).isEqualTo(16);
	}
}
