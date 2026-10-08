package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.usuario.UsuarioRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * HU-037: ResultadoVisitaRepository.findRutaPendiente contra Postgres real
 * (migraciones Flyway reales). Lo que un mock no puede probar: que el JOIN
 * sin FK con Bodega filtrando CLI no duplica filas cuando el mismo cod_bod
 * existe tambien como ENT/DEV, que excluye FINALIZADA sin filtrar por fecha,
 * y el orden.
 *
 * asignado_a_usuario_id tiene FK a usuario (V10), por eso se usan los
 * usuarios semilla (ver UsuarioRepositoryIT). @DataJpaTest revierte cada
 * prueba, asi que no hay estado compartido entre ellas.
 *
 * Requiere Docker; se ejecuta con "mvn verify", no con "mvn test".
 */
@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class RutaPendienteQueryIT {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private ResultadoVisitaRepository resultadoVisitaRepository;

	@Autowired
	private BodegaRepository bodegaRepository;

	@Autowired
	private UsuarioRepository usuarioRepository;

	private Long andreyId;
	private Long adrianId;

	private final LocalDate hoy = LocalDate.now();

	@BeforeEach
	void setUp() {
		andreyId = usuarioRepository.findByUsername("amelendez").orElseThrow().getId();
		adrianId = usuarioRepository.findByUsername("arcea").orElseThrow().getId();
	}

	private void bodega(String numCon, String codBod, String desBod, TipoBodega tipo) {
		bodegaRepository.save(new Bodega("MED", "WMOLINA", numCon, "INS1", codBod, desBod, tipo));
	}

	private void visita(String numCon, String codBod, Long usuarioId, LocalDate fecha, EstadoVisitaApp estadoApp) {
		ResultadoVisita visita = new ResultadoVisita(
				"MED", "WMOLINA", "PEND", "Pendiente", codBod, null, "INS1", null, numCon, "Reactivos");
		visita.asignar(usuarioId, fecha);
		visita.setEstadoApp(estadoApp);
		resultadoVisitaRepository.save(visita);
	}

	@Test
	void mismoCodBodComoCliYComoBucketVirtualDevuelveUnaSolaParadaConLaDescripcionCli() {
		bodega("C-001", "MEPRIN", "Hospital Mexico", TipoBodega.CLI);
		bodega("C-001", "MEPRIN", "Bucket entrega", TipoBodega.ENT);
		bodega("C-001", "MEPRIN", "Bucket devolucion", TipoBodega.DEV);
		visita("C-001", "MEPRIN", andreyId, hoy, EstadoVisitaApp.PENDIENTE);

		List<ParadaRutaDTO> ruta = resultadoVisitaRepository.findRutaPendiente(andreyId);

		assertThat(ruta).hasSize(1);
		assertThat(ruta.get(0).desBod()).isEqualTo("Hospital Mexico");
		assertThat(ruta.get(0).estadoErp()).isEqualTo("PEND");
		assertThat(ruta.get(0).objCon()).isEqualTo("Reactivos");
	}

	@Test
	void visitaQueSoloExisteComoBucketVirtualNoApareceEnLaRuta() {
		bodega("C-001", "FACT01", "Bucket factura", TipoBodega.FAC);
		visita("C-001", "FACT01", andreyId, hoy, EstadoVisitaApp.PENDIENTE);

		assertThat(resultadoVisitaRepository.findRutaPendiente(andreyId)).isEmpty();
	}

	@Test
	void excluyeFinalizadasPeroMantieneAtrasadasYFuturasSinFiltrarPorFecha() {
		bodega("C-001", "B1", "Clinica Atrasada", TipoBodega.CLI);
		bodega("C-001", "B2", "Clinica En Progreso Futura", TipoBodega.CLI);
		bodega("C-001", "B3", "Clinica Finalizada", TipoBodega.CLI);
		visita("C-001", "B1", andreyId, hoy.minusDays(7), EstadoVisitaApp.PENDIENTE);
		visita("C-001", "B2", andreyId, hoy.plusDays(2), EstadoVisitaApp.EN_PROGRESO);
		visita("C-001", "B3", andreyId, hoy, EstadoVisitaApp.FINALIZADA);

		assertThat(resultadoVisitaRepository.findRutaPendiente(andreyId))
				.extracting(ParadaRutaDTO::codBod)
				.containsExactly("B1", "B2");
	}

	@Test
	void soloDevuelveLoAsignadoAEseUsuario() {
		bodega("C-001", "B1", "Clinica de Andrey", TipoBodega.CLI);
		bodega("C-001", "B2", "Clinica de Adrian", TipoBodega.CLI);
		visita("C-001", "B1", andreyId, hoy, EstadoVisitaApp.PENDIENTE);
		visita("C-001", "B2", adrianId, hoy, EstadoVisitaApp.PENDIENTE);

		assertThat(resultadoVisitaRepository.findRutaPendiente(andreyId))
				.extracting(ParadaRutaDTO::codBod)
				.containsExactly("B1");
	}

	@Test
	void ordenaPorFechaLuegoDescripcionLuegoCodigo() {
		bodega("C-001", "Z9", "Alfa", TipoBodega.CLI);
		bodega("C-001", "A1", "Beta", TipoBodega.CLI);
		bodega("C-002", "A0", "Beta", TipoBodega.CLI);
		bodega("C-001", "M5", "Omega de ayer", TipoBodega.CLI);
		visita("C-001", "Z9", andreyId, hoy, EstadoVisitaApp.PENDIENTE);
		visita("C-001", "A1", andreyId, hoy, EstadoVisitaApp.PENDIENTE);
		visita("C-002", "A0", andreyId, hoy, EstadoVisitaApp.PENDIENTE);
		visita("C-001", "M5", andreyId, hoy.minusDays(1), EstadoVisitaApp.PENDIENTE);

		assertThat(resultadoVisitaRepository.findRutaPendiente(andreyId))
				.extracting(ParadaRutaDTO::codBod)
				.containsExactly("M5", "Z9", "A0", "A1");
	}

	@Test
	void usuarioSinAsignacionesDevuelveListaVacia() {
		assertThat(resultadoVisitaRepository.findRutaPendiente(andreyId)).isEmpty();
	}
}
