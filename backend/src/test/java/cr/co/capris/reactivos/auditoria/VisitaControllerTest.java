package cr.co.capris.reactivos.auditoria;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * HU-024 (consultar visitas pendientes asignadas a mi usuario, criterios 1 a
 * 3) -- este controller tambien resuelve HU-008/HU-037 (ver su javadoc), pero
 * esta clase solo cubre los metodos que son de HU-024: listar() y
 * cambiarEstado(). asignar() es HU-037 y queda fuera a proposito.
 *
 * Mockea ResultadoVisitaRepository, asi que lo que prueba es que el
 * controller elige el metodo de repositorio correcto segun los filtros que
 * manda el cliente y que el mapeo a VisitaResumenDTO es fiel -- no la
 * consulta SQL real (eso, si alguna vez se agrega un filtro por bodega o
 * contrato, va a VisitaControllerIT contra Postgres real).
 */
@ExtendWith(MockitoExtension.class)
class VisitaControllerTest {

	@Mock
	private ResultadoVisitaRepository resultadoVisitaRepository;

	private VisitaController controller;

	@BeforeEach
	void setUp() {
		controller = new VisitaController(resultadoVisitaRepository);
	}

	private ResultadoVisita visita(String numCon, String codBod) {
		return new ResultadoVisita(
				"MED", "WMOLINA", "PEND", "Pendiente", codBod, null, "INS1", null, numCon, "Reactivos de laboratorio");
	}

	@Test
	void listarConUsuarioYFechaFiltraPorAmbosCriterios() {
		LocalDate fecha = LocalDate.now();
		ResultadoVisita visita = visita("C-001", "MEPRIN");
		visita.asignar(7L, fecha);
		when(resultadoVisitaRepository.findAllByAsignadoAUsuarioIdAndFechaAsignada(7L, fecha))
				.thenReturn(List.of(visita));

		List<VisitaResumenDTO> resultado = controller.listar(7L, fecha, null);

		assertThat(resultado).hasSize(1);
		assertThat(resultado.get(0).codBod()).isEqualTo("MEPRIN");
		verify(resultadoVisitaRepository, never()).findAllByAsignadoAUsuarioId(any());
		verify(resultadoVisitaRepository, never()).findAll();
	}

	@Test
	void listarSoloConUsuarioSinFechaFiltraPorElUsuarioAsignado() {
		ResultadoVisita visita = visita("C-001", "MEPRIN");
		visita.asignar(7L, LocalDate.now());
		when(resultadoVisitaRepository.findAllByAsignadoAUsuarioId(7L)).thenReturn(List.of(visita));

		List<VisitaResumenDTO> resultado = controller.listar(7L, null, null);

		assertThat(resultado).hasSize(1);
		assertThat(resultado.get(0).asignadoAUsuarioId()).isEqualTo(7L);
		verify(resultadoVisitaRepository, never()).findAllByAsignadoAUsuarioIdAndFechaAsignada(any(), any());
	}

	@Test
	void listarSoloConEstadoAppFiltraPorEseEstadoDeAvance() {
		ResultadoVisita enProgreso = visita("C-001", "MEPRIN");
		enProgreso.setEstadoApp(EstadoVisitaApp.EN_PROGRESO);
		when(resultadoVisitaRepository.findAllByEstadoApp(EstadoVisitaApp.EN_PROGRESO))
				.thenReturn(List.of(enProgreso));

		List<VisitaResumenDTO> resultado = controller.listar(null, null, EstadoVisitaApp.EN_PROGRESO);

		assertThat(resultado).extracting(VisitaResumenDTO::estadoApp).containsExactly(EstadoVisitaApp.EN_PROGRESO);
	}

	@Test
	void listarSinNingunFiltroDevuelveTodasLasVisitas() {
		when(resultadoVisitaRepository.findAll()).thenReturn(List.of(visita("C-001", "MEPRIN"), visita("C-001", "HMEX")));

		List<VisitaResumenDTO> resultado = controller.listar(null, null, null);

		assertThat(resultado).hasSize(2);
	}

	// HU-024 criterio 2: "si no hay visitas pendientes, el sistema indica que
	// no hay visitas pendientes registradas" -- a nivel de API eso es una
	// lista vacia con 200 (no un error), que es lo que la pantalla usa para
	// mostrar el mensaje.
	@Test
	void listarSinVisitasPendientesParaElUsuarioDevuelveListaVacia() {
		when(resultadoVisitaRepository.findAllByAsignadoAUsuarioId(99L)).thenReturn(List.of());

		List<VisitaResumenDTO> resultado = controller.listar(99L, null, null);

		assertThat(resultado).isEmpty();
	}

	@Test
	void listarMapeaTodosLosCamposDeLaVisitaAlDtoDeRespuesta() {
		LocalDate fecha = LocalDate.now();
		ResultadoVisita visita = visita("C-001", "MEPRIN");
		visita.asignar(7L, fecha);
		visita.setEstadoApp(EstadoVisitaApp.EN_PROGRESO);
		when(resultadoVisitaRepository.findAll()).thenReturn(List.of(visita));

		VisitaResumenDTO dto = controller.listar(null, null, null).get(0);

		assertThat(dto.codBod()).isEqualTo("MEPRIN");
		assertThat(dto.numCon()).isEqualTo("C-001");
		assertThat(dto.objCon()).isEqualTo("Reactivos de laboratorio");
		assertThat(dto.estadoErp()).isEqualTo("PEND");
		assertThat(dto.estadoApp()).isEqualTo(EstadoVisitaApp.EN_PROGRESO);
		assertThat(dto.asignadoAUsuarioId()).isEqualTo(7L);
		assertThat(dto.fechaAsignada()).isEqualTo(fecha);
	}

	@Test
	void cambiarEstadoDeUnaVisitaExistenteLaActualizaYLaPersiste() {
		ResultadoVisita visita = visita("C-001", "MEPRIN");
		when(resultadoVisitaRepository.findByNumConAndCodBod("C-001", "MEPRIN")).thenReturn(Optional.of(visita));

		ResponseEntity<VisitaResumenDTO> respuesta =
				controller.cambiarEstado("C-001", "MEPRIN", new CambiarEstadoVisitaRequest(EstadoVisitaApp.EN_PROGRESO));

		assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(respuesta.getBody().estadoApp()).isEqualTo(EstadoVisitaApp.EN_PROGRESO);

		ArgumentCaptor<ResultadoVisita> guardada = ArgumentCaptor.forClass(ResultadoVisita.class);
		verify(resultadoVisitaRepository).save(guardada.capture());
		assertThat(guardada.getValue().getEstadoApp()).isEqualTo(EstadoVisitaApp.EN_PROGRESO);
	}

	@Test
	void cambiarEstadoDeUnaVisitaInexistenteDevuelve404SinGuardarNada() {
		when(resultadoVisitaRepository.findByNumConAndCodBod("C-999", "NOEXISTE")).thenReturn(Optional.empty());

		ResponseEntity<VisitaResumenDTO> respuesta =
				controller.cambiarEstado("C-999", "NOEXISTE", new CambiarEstadoVisitaRequest(EstadoVisitaApp.FINALIZADA));

		assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
		verify(resultadoVisitaRepository, never()).save(any());
	}
}
