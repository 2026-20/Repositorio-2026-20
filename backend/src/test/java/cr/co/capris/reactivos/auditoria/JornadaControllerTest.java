package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * HU-038. La idempotencia de confirmar dos veces el mismo dia ya se prueba
 * en JornadaServiceTest, y el criterio 4 (bloquear el conteo) en
 * ConteoFisicoServiceTest -- esto solo prueba que el controller mapea
 * correctamente el resultado del service al DTO de respuesta. El flujo
 * completo contra Postgres real (incluido el enganche con HU-005) esta en
 * JornadaControllerIT.
 */
@ExtendWith(MockitoExtension.class)
class JornadaControllerTest {

	@Mock
	private JornadaService jornadaService;

	@Mock
	private ContextoUsuarioActual contextoUsuarioActual;

	private JornadaController controller;

	@BeforeEach
	void setUp() {
		controller = new JornadaController(jornadaService, contextoUsuarioActual);
	}

	@Test
	void iniciarDevuelveIniciadaTrueConLaFechaHoraQueDevuelveElServicio() {
		OffsetDateTime iniciadaEn = OffsetDateTime.now();
		when(contextoUsuarioActual.getUsuarioId()).thenReturn(7L);
		when(jornadaService.iniciar(7L, LocalDate.now())).thenReturn(new Jornada(7L, LocalDate.now(), iniciadaEn));

		JornadaEstadoDTO resultado = controller.iniciar();

		assertThat(resultado.iniciada()).isTrue();
		assertThat(resultado.iniciadaEn()).isEqualTo(iniciadaEn);
	}

	@Test
	void hoyConJornadaYaConfirmadaDevuelveIniciadaTrueConSuFechaHora() {
		OffsetDateTime iniciadaEn = OffsetDateTime.now();
		when(contextoUsuarioActual.getUsuarioId()).thenReturn(7L);
		when(jornadaService.obtener(7L, LocalDate.now()))
				.thenReturn(Optional.of(new Jornada(7L, LocalDate.now(), iniciadaEn)));

		JornadaEstadoDTO resultado = controller.hoy();

		assertThat(resultado.iniciada()).isTrue();
		assertThat(resultado.iniciadaEn()).isEqualTo(iniciadaEn);
	}

	@Test
	void hoySinJornadaConfirmadaDevuelveIniciadaFalseSinFecha() {
		when(contextoUsuarioActual.getUsuarioId()).thenReturn(7L);
		when(jornadaService.obtener(7L, LocalDate.now())).thenReturn(Optional.empty());

		JornadaEstadoDTO resultado = controller.hoy();

		assertThat(resultado.iniciada()).isFalse();
		assertThat(resultado.iniciadaEn()).isNull();
	}
}
