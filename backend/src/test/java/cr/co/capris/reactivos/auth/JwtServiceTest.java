package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.seguridad.TokenRecuperacionInvalidoException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JwtServiceTest {

	private static final String SECRETO_PRUEBA = "secreto-de-prueba-de-al-menos-32-bytes-de-largo-1234567890";

	@Test
	void generaUnTokenYLoParseaDeVueltaConLosMismosClaims() {
		JwtService jwtService = new JwtService(SECRETO_PRUEBA, 480);

		String token = jwtService.generar(42L, 7L, "Administrador");
		Claims claims = jwtService.validarYObtenerClaims(token);

		assertThat(claims.getSubject()).isEqualTo("42");
		assertThat(claims.get("empresaId", Long.class)).isEqualTo(7L);
		assertThat(claims.get("rol", String.class)).isEqualTo("Administrador");
	}

	@Test
	void rechazaUnTokenYaVencido() {
		JwtService jwtServiceQueVenceInstantaneamente = new JwtService(SECRETO_PRUEBA, 0);
		String token = jwtServiceQueVenceInstantaneamente.generar(1L, 1L, "Usuario de Campo");

		assertThatThrownBy(() -> jwtServiceQueVenceInstantaneamente.validarYObtenerClaims(token))
				.isInstanceOf(ExpiredJwtException.class);
	}

	@Test
	void rechazaUnTokenFirmadoConOtroSecreto() {
		JwtService jwtServiceA = new JwtService(SECRETO_PRUEBA, 480);
		JwtService jwtServiceB = new JwtService("otro-secreto-completamente-distinto-de-32-bytes+", 480);

		String token = jwtServiceA.generar(1L, 1L, "Usuario de Campo");

		assertThatThrownBy(() -> jwtServiceB.validarYObtenerClaims(token))
				.isInstanceOf(io.jsonwebtoken.security.SignatureException.class);
	}

	@Test
	void elTokenDeRecuperacionIncluyeJtiYProposito() {
		JwtService jwtService = new JwtService(SECRETO_PRUEBA, 480);

		String token = jwtService.generarTokenRecuperacion(7L);

		Claims claims = jwtService.validarYObtenerClaims(token);
		assertThat(claims.get("proposito", String.class)).isEqualTo("recuperacion_password");
		assertThat(claims.getId()).isNotBlank();
		assertThat(claims.getSubject()).isEqualTo("7");
	}

	@Test
	void elTokenDeRecuperacionSirveParaObtenerElUsuario() {
		JwtService jwtService = new JwtService(SECRETO_PRUEBA, 480);

		String token = jwtService.generarTokenRecuperacion(7L);

		assertThat(jwtService.validarTokenRecuperacionYObtenerUsuarioId(token)).isEqualTo(7L);
	}

	@Test
	void rechazaUnTokenDeRecuperacionCuyoJtiFueRevocado() {
		TokenSesionRevocadoService revocados = mock(TokenSesionRevocadoService.class);
		JwtService jwtService = new JwtService(SECRETO_PRUEBA, 480, 10, revocados);
		String token = jwtService.generarTokenRecuperacion(7L);

		when(revocados.estaRevocado(anyString())).thenReturn(true);

		assertThatThrownBy(() -> jwtService.validarTokenRecuperacionYObtenerUsuarioId(token))
				.isInstanceOf(TokenRecuperacionInvalidoException.class);
	}

	@Test
	void revocarTokenRecuperacionRegistraElJtiEnLaTablaDeRevocados() {
		TokenSesionRevocadoService revocados = mock(TokenSesionRevocadoService.class);
		JwtService jwtService = new JwtService(SECRETO_PRUEBA, 480, 10, revocados);
		String token = jwtService.generarTokenRecuperacion(7L);

		jwtService.revocarTokenRecuperacion(token);

		verify(revocados).revocar(any(Claims.class));
	}
}
