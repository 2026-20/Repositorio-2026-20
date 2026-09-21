package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.seguridad.*;
import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unitarias con Mockito -- sin Spring context, sin base de datos real. Las
 * pruebas de extremo a extremo (con Testcontainers) van en
 * RecuperacionContrasenaControllerIT.
 */
@ExtendWith(MockitoExtension.class)
class RecuperacionContrasenaServiceTest {

	private static final int OTP_EXPIRACION_MINUTOS = 15;
	private static final int OTP_INTENTOS_MAXIMOS = 3;

	@Mock private UsuarioRepository usuarioRepository;
	@Mock private TokenRecuperacionRepository tokenRecuperacionRepository;
	@Mock private HistorialContrasenaService historialContrasenaService;
	@Mock private BitacoraSeguridadService bitacoraSeguridadService;
	@Mock private EmailService emailService;
	@Mock private PasswordEncoder passwordEncoder;
	@Mock private JwtService jwtService;
	@Mock private ValidadorPoliticaContrasena validadorPoliticaContrasena;

	private RecuperacionContrasenaService service;
	private Usuario usuario;

	@BeforeEach
	void configurar() {
		service = new RecuperacionContrasenaService(
				usuarioRepository, tokenRecuperacionRepository, historialContrasenaService,
				bitacoraSeguridadService, emailService, passwordEncoder, jwtService,
				validadorPoliticaContrasena, OTP_EXPIRACION_MINUTOS, OTP_INTENTOS_MAXIMOS, false);
		usuario = construirUsuario(1L, "persona@capris.cr", "persona.prueba", "hash-actual");
	}

	@Test
	void solicitarConCorreoExistenteGeneraYEnviaElOtp() {
		when(usuarioRepository.findByCorreo("persona@capris.cr")).thenReturn(Optional.of(usuario));
		when(tokenRecuperacionRepository.findByUsuarioIdAndUsadoFalse(1L)).thenReturn(List.of());
		when(passwordEncoder.encode(anyString())).thenReturn("otp-hasheado");

		service.solicitar("persona@capris.cr");

		verify(emailService).enviarOtpRecuperacion(
				eq("persona@capris.cr"), anyString(), anyString(), eq(OTP_EXPIRACION_MINUTOS));
		verify(tokenRecuperacionRepository).save(any(TokenRecuperacion.class));
		verify(bitacoraSeguridadService).registrar(anyString(), eq(1L),
				eq(TipoEventoSeguridad.CONTRASENA_RECUPERACION_SOLICITADA), anyString());
	}

	@Test
	void solicitarConCorreoInexistenteNoEnviaNadaYNoFalla() {
		when(usuarioRepository.findByCorreo("nadie@capris.cr")).thenReturn(Optional.empty());

		service.solicitar("nadie@capris.cr");

		verifyNoInteractions(emailService);
		verify(tokenRecuperacionRepository, never()).save(any());
	}

	@Test
	void solicitarConCorreoExistenteYAsincronoAutomaticoIgualmenteDespachaElEnvio() {
		RecuperacionContrasenaService asincrono = new RecuperacionContrasenaService(
				usuarioRepository, tokenRecuperacionRepository, historialContrasenaService,
				bitacoraSeguridadService, emailService, passwordEncoder, jwtService,
				validadorPoliticaContrasena, OTP_EXPIRACION_MINUTOS, OTP_INTENTOS_MAXIMOS, true);

		when(usuarioRepository.findByCorreo("persona@capris.cr")).thenReturn(Optional.of(usuario));
		when(tokenRecuperacionRepository.findByUsuarioIdAndUsadoFalse(1L)).thenReturn(List.of());
		when(passwordEncoder.encode(anyString())).thenReturn("otp-hasheado");

		asincrono.solicitar("persona@capris.cr");

		// El envío va en otro hilo: se espera la invocación con timeout en vez
		// de un verify sincrónico (que sería una carrera).
		verify(emailService, timeout(3000)).enviarOtpRecuperacion(
				eq("persona@capris.cr"), anyString(), anyString(), eq(OTP_EXPIRACION_MINUTOS));
	}

	@Test
	void solicitarConAsincronoNoPropagaElErrorDelEnvio() {
		RecuperacionContrasenaService asincrono = new RecuperacionContrasenaService(
				usuarioRepository, tokenRecuperacionRepository, historialContrasenaService,
				bitacoraSeguridadService, emailService, passwordEncoder, jwtService,
				validadorPoliticaContrasena, OTP_EXPIRACION_MINUTOS, OTP_INTENTOS_MAXIMOS, true);

		when(usuarioRepository.findByCorreo("persona@capris.cr")).thenReturn(Optional.of(usuario));
		when(tokenRecuperacionRepository.findByUsuarioIdAndUsadoFalse(1L)).thenReturn(List.of());
		when(passwordEncoder.encode(anyString())).thenReturn("otp-hasheado");
		doThrow(new EnvioCorreoFallidoException("SendGrid caído"))
				.when(emailService).enviarOtpRecuperacion(anyString(), anyString(), anyString(), anyInt());

		asincrono.solicitar("persona@capris.cr");

		// El envío es fire-and-forget, pero el test debe esperar a que el hilo
		// del CompletableFuture haya llamado al mock; si no, Mockito marca el
		// doThrow como "unused stub" y el test es una carrera.
		verify(emailService, timeout(3000)).enviarOtpRecuperacion(
				anyString(), anyString(), anyString(), anyInt());

		verify(bitacoraSeguridadService).registrar(anyString(), eq(1L),
				eq(TipoEventoSeguridad.CONTRASENA_RECUPERACION_SOLICITADA), anyString());
	}

	@Test
	void solicitarConCuentaInactivaNoEnviaNadaYNoFalla() {
		Usuario inactivo = construirUsuario(2L, "inactivo@capris.cr", "inactivo", "hash");
		ReflectionTestUtils.setField(inactivo, "estado", EstadoUsuario.INACTIVO);
		when(usuarioRepository.findByCorreo("inactivo@capris.cr")).thenReturn(Optional.of(inactivo));

		service.solicitar("inactivo@capris.cr");

		verifyNoInteractions(emailService);
	}

	@Test
	void validarOtpCorrectoDevuelveTokenDeSesionTemporal() {
		TokenRecuperacion token = new TokenRecuperacion(usuario, "otp-hasheado",
				OffsetDateTime.now(), OffsetDateTime.now().plusMinutes(10));
		when(usuarioRepository.findByCorreo("persona@capris.cr")).thenReturn(Optional.of(usuario));
		when(tokenRecuperacionRepository.findFirstByUsuarioIdAndUsadoFalseOrderByCreadoEnDesc(1L))
				.thenReturn(Optional.of(token));
		when(passwordEncoder.matches("123456", "otp-hasheado")).thenReturn(true);
		when(jwtService.generarTokenRecuperacion(1L)).thenReturn("token-temporal-jwt");

		String resultado = service.validarOtp("persona@capris.cr", "123456");

		assertThat(resultado).isEqualTo("token-temporal-jwt");
		assertThat(token.isUsado()).isTrue();
	}

	@Test
	void validarOtpVencidoLanzaExpiradoYLoInvalida() {
		TokenRecuperacion token = new TokenRecuperacion(usuario, "otp-hasheado",
				OffsetDateTime.now().minusMinutes(20), OffsetDateTime.now().minusMinutes(5));
		when(usuarioRepository.findByCorreo("persona@capris.cr")).thenReturn(Optional.of(usuario));
		when(tokenRecuperacionRepository.findFirstByUsuarioIdAndUsadoFalseOrderByCreadoEnDesc(1L))
				.thenReturn(Optional.of(token));

		assertThatThrownBy(() -> service.validarOtp("persona@capris.cr", "123456"))
				.isInstanceOf(TokenRecuperacionExpiradoException.class);
		assertThat(token.isUsado()).isTrue();
	}

	@Test
	void tresIntentosFallidosConsecutivosBloqueanElToken() {
		TokenRecuperacion token = new TokenRecuperacion(usuario, "otp-hasheado",
				OffsetDateTime.now(), OffsetDateTime.now().plusMinutes(10));
		when(usuarioRepository.findByCorreo("persona@capris.cr")).thenReturn(Optional.of(usuario));
		when(tokenRecuperacionRepository.findFirstByUsuarioIdAndUsadoFalseOrderByCreadoEnDesc(1L))
				.thenReturn(Optional.of(token));
		when(passwordEncoder.matches(anyString(), eq("otp-hasheado"))).thenReturn(false);

		assertThatThrownBy(() -> service.validarOtp("persona@capris.cr", "000000"))
				.isInstanceOf(TokenRecuperacionInvalidoException.class);
		assertThatThrownBy(() -> service.validarOtp("persona@capris.cr", "111111"))
				.isInstanceOf(TokenRecuperacionInvalidoException.class);
		assertThatThrownBy(() -> service.validarOtp("persona@capris.cr", "222222"))
				.isInstanceOf(TokenRecuperacionBloqueadoException.class);

		assertThat(token.isUsado()).isTrue();
		assertThat(token.getIntentosFallidos()).isEqualTo(3);
	}

	@Test
	void establecerNuevaContrasenaRechazaSiViolaLaPolitica() {
		when(jwtService.validarTokenRecuperacionYObtenerUsuarioId("token-temporal")).thenReturn(1L);
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(usuario));
		when(validadorPoliticaContrasena.validar("debil")).thenReturn(List.of("Debe tener al menos 8 caracteres"));

		assertThatThrownBy(() -> service.establecerNuevaContrasena("token-temporal", "debil"))
				.isInstanceOf(ContrasenaNoValidaException.class);
		verify(usuarioRepository, never()).save(any());
	}

	@Test
	void establecerNuevaContrasenaRechazaSiFueUsadaRecientemente() {
		when(jwtService.validarTokenRecuperacionYObtenerUsuarioId("token-temporal")).thenReturn(1L);
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(usuario));
		when(validadorPoliticaContrasena.validar("Capris2026!")).thenReturn(List.of());
		when(historialContrasenaService.fueUsadaRecientemente(usuario, "Capris2026!")).thenReturn(true);

		assertThatThrownBy(() -> service.establecerNuevaContrasena("token-temporal", "Capris2026!"))
				.isInstanceOf(ContrasenaNoValidaException.class);
		verify(usuarioRepository, never()).save(any());
	}

	@Test
	void establecerNuevaContrasenaExitosaActualizaElHashYElHistorial() {
		when(jwtService.validarTokenRecuperacionYObtenerUsuarioId("token-temporal")).thenReturn(1L);
		when(usuarioRepository.findById(1L)).thenReturn(Optional.of(usuario));
		when(validadorPoliticaContrasena.validar("Capris2027!")).thenReturn(List.of());
		when(historialContrasenaService.fueUsadaRecientemente(usuario, "Capris2027!")).thenReturn(false);
		when(passwordEncoder.encode("Capris2027!")).thenReturn("nuevo-hash");

		service.establecerNuevaContrasena("token-temporal", "Capris2027!");

		verify(historialContrasenaService).registrarContrasenaReemplazada(usuario);
		assertThat(usuario.getPasswordHash()).isEqualTo("nuevo-hash");
		verify(usuarioRepository).save(usuario);
		verify(jwtService).revocarTokenRecuperacion("token-temporal");
		verify(bitacoraSeguridadService).registrar(anyString(), eq(1L),
				eq(TipoEventoSeguridad.CONTRASENA_CAMBIADA), anyString());
	}

	/**
	 * Usuario no tiene constructor público con parámetros (a propósito, ver esa
	 * clase) -- se construye por reflexión para esta prueba unitaria. Si el
	 * equipo termina agregando un constructor/builder público a Usuario (por
	 * ejemplo para HU-047, alta de usuarios), este helper se puede simplificar.
	 */
	private static Usuario construirUsuario(Long id, String correo, String username, String passwordHashActual) {
		try {
			var constructor = Usuario.class.getDeclaredConstructor();
			constructor.setAccessible(true);
			Usuario usuario = constructor.newInstance();
			ReflectionTestUtils.setField(usuario, "id", id);
			ReflectionTestUtils.setField(usuario, "correo", correo);
			ReflectionTestUtils.setField(usuario, "username", username);
			ReflectionTestUtils.setField(usuario, "nombreCompleto", "Persona de Prueba");
			ReflectionTestUtils.setField(usuario, "passwordHash", passwordHashActual);
			ReflectionTestUtils.setField(usuario, "estado", EstadoUsuario.ACTIVO);
			return usuario;
		} catch (ReflectiveOperationException ex) {
			throw new RuntimeException(ex);
		}
	}
}
