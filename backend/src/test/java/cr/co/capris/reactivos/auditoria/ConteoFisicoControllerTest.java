package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.usuario.Empresa;
import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Rol;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * HU-005 (registrar) / HU-008 (listar por bodega, base). Mockea
 * ConteoFisicoService/Repository -- la idempotencia y el gate de jornada ya
 * los cubre ConteoFisicoServiceTest; esto prueba que el controller delega
 * bien y arma el DTO correcto, incluido el tipoDiferencia (HU-030).
 */
@ExtendWith(MockitoExtension.class)
class ConteoFisicoControllerTest {

	@Mock
	private ConteoFisicoService conteoFisicoService;

	@Mock
	private ConteoFisicoRepository conteoFisicoRepository;

	@Mock
	private UsuarioRepository usuarioRepository;

	@Mock
	private ContextoUsuarioActual contextoUsuarioActual;

	private ConteoFisicoController controller;

	@BeforeEach
	void setUp() {
		controller = new ConteoFisicoController(
				conteoFisicoService, conteoFisicoRepository, usuarioRepository, contextoUsuarioActual);
	}

	private RegistrarConteoRequest request() {
		return new RegistrarConteoRequest(
				"idem-abc", "MEPRIN", "ART1", null, "12555", BigDecimal.TEN, new BigDecimal("7"), null);
	}

	private ConteoFisico conteo(BigDecimal cantidadFisica) {
		return new ConteoFisico(
				"idem-abc", "MEPRIN", "ART1", null, "12555",
				BigDecimal.TEN, cantidadFisica, 42L, null, OffsetDateTime.now());
	}

	@Test
	void registrarDelegaEnElServicioConElUsuarioDelContextoYDevuelve201() {
		when(contextoUsuarioActual.getUsuarioId()).thenReturn(42L);
		when(conteoFisicoService.registrar(request(), 42L)).thenReturn(conteo(new BigDecimal("7")));
		when(usuarioRepository.findById(42L)).thenReturn(Optional.of(usuarioDePrueba()));

		ResponseEntity<ConteoFisicoResumenDTO> respuesta = controller.registrar(request());

		assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.CREATED);
		assertThat(respuesta.getBody().cantidadFisica()).isEqualByComparingTo("7");
		assertThat(respuesta.getBody().usuarioNombre()).isEqualTo("Andrey Meléndez Ovares");
		verify(conteoFisicoService).registrar(request(), 42L);
	}

	// HU-030: el DTO que arma el controller trae la diferencia con el signo
	// correcto (fisica - teorica) y su clasificacion.
	@Test
	void registrarDevuelveLaDiferenciaYElTipoCalculados() {
		when(contextoUsuarioActual.getUsuarioId()).thenReturn(42L);
		// fisica=7, teorica=10 -> diferencia=-3, FALTANTE.
		when(conteoFisicoService.registrar(any(), any())).thenReturn(conteo(new BigDecimal("7")));
		when(usuarioRepository.findById(42L)).thenReturn(Optional.of(usuarioDePrueba()));

		ConteoFisicoResumenDTO dto = controller.registrar(request()).getBody();

		assertThat(dto.diferencia()).isEqualByComparingTo("-3");
		assertThat(dto.tipoDiferencia()).isEqualTo(TipoDiferencia.FALTANTE);
	}

	@Test
	void porBodegaListaLosConteosDeEsaBodegaMapeadosADto() {
		when(conteoFisicoRepository.findAllByCodBod("MEPRIN")).thenReturn(List.of(conteo(new BigDecimal("10"))));
		when(usuarioRepository.findById(42L)).thenReturn(Optional.of(usuarioDePrueba()));

		List<ConteoFisicoResumenDTO> resultado = controller.porBodega("MEPRIN");

		assertThat(resultado).hasSize(1);
		assertThat(resultado.get(0).codBod()).isEqualTo("MEPRIN");
		assertThat(resultado.get(0).tipoDiferencia()).isEqualTo(TipoDiferencia.SIN_DIFERENCIA);
	}

	@Test
	void porBodegaSinConteosDevuelveListaVacia() {
		when(conteoFisicoRepository.findAllByCodBod("SINCONTEOS")).thenReturn(List.of());

		List<ConteoFisicoResumenDTO> resultado = controller.porBodega("SINCONTEOS");

		assertThat(resultado).isEmpty();
	}

	// HU-007: delega en el servicio con el usuario del contexto y arma el DTO.
	@Test
	void corregirDelegaEnElServicioConElUsuarioDelContextoYDevuelve200() {
		when(contextoUsuarioActual.getUsuarioId()).thenReturn(42L);
		CorregirConteoRequest request = new CorregirConteoRequest(new BigDecimal("9"), "nota");
		ConteoFisico corregido = conteo(new BigDecimal("9"));
		ReflectionTestUtils.setField(corregido, "corregido", true);
		when(conteoFisicoService.corregir(5L, request, 42L)).thenReturn(corregido);
		when(usuarioRepository.findById(42L)).thenReturn(Optional.of(usuarioDePrueba()));

		ResponseEntity<ConteoFisicoResumenDTO> respuesta = controller.corregir(5L, request);

		assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(respuesta.getBody().cantidadFisica()).isEqualByComparingTo("9");
		assertThat(respuesta.getBody().corregido()).isTrue();
		verify(conteoFisicoService).corregir(5L, request, 42L);
	}

	private Usuario usuarioDePrueba() {
		Usuario usuario = new Usuario(
				"Andrey Meléndez Ovares", "1-1111-1111", "andrey@capris.cr", "amelendez", "hash",
				EstadoUsuario.ACTIVO, new Rol("Usuario de Campo"), new Empresa("CAPRIS Médica"), null);
		ReflectionTestUtils.setField(usuario, "id", 42L);
		return usuario;
	}
}
