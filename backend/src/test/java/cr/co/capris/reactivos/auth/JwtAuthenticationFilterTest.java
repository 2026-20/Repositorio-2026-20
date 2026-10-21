package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.usuario.EstadoUsuario;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Prueba la regla de HU-048 en aislamiento: un token sigue siendo valido solo si
 * el usuario no esta INACTIVO y fue emitido despues de la ultima revocacion.
 */
class JwtAuthenticationFilterTest {
	private final JwtAuthenticationFilter filtro =
			new JwtAuthenticationFilter(null, null, null, null, null);
	@Test
	void tokenValidoSiNuncaSeRevocoNadaYElUsuarioSigueActivo() {
		OffsetDateTime emitidoEn = OffsetDateTime.now();

		assertThat(filtro.sesionSigueValida(EstadoUsuario.ACTIVO, null, emitidoEn)).isTrue();
	}

	@Test
	void tokenInvalidoSiElUsuarioEstaInactivoAunqueElTokenSeaReciente() {
		OffsetDateTime emitidoEn = OffsetDateTime.now();

		assertThat(filtro.sesionSigueValida(EstadoUsuario.INACTIVO, null, emitidoEn)).isFalse();
	}

	@Test
	void tokenInvalidoSiSeEmitioAntesDeLaRevocacion() {
		OffsetDateTime revocadoEn = OffsetDateTime.now();
		OffsetDateTime emitidoAntes = revocadoEn.minusMinutes(5);

		assertThat(filtro.sesionSigueValida(EstadoUsuario.ACTIVO, revocadoEn, emitidoAntes)).isFalse();
	}

	@Test
	void tokenValidoSiSeEmitioDespuesDeUnaRevocacionPrevia() {
		OffsetDateTime revocadoEn = OffsetDateTime.now();
		OffsetDateTime emitidoDespues = revocadoEn.plusMinutes(5);

		assertThat(filtro.sesionSigueValida(EstadoUsuario.ACTIVO, revocadoEn, emitidoDespues)).isTrue();
	}

	// HU-044: un usuario PENDIENTE_PRIMER_INGRESO solo puede cambiar la contraseña o cerrar sesion.

	@Test
	void primerIngresoPendientePermiteElCambioDeContrasenaObligatorio() {
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO, "POST", "/api/auth/primer-ingreso/cambiar-password")).isFalse();
	}

	@Test
	void primerIngresoPendientePermiteCerrarSesion() {
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO, "POST", "/api/auth/logout")).isFalse();
	}

	@Test
	void primerIngresoPendienteBloqueaCualquierOtraRuta() {
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO, "GET", "/api/usuarios")).isTrue();
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO, "POST", "/api/auth/cambiar-password")).isTrue();
	}

	// El frontend consulta /api/usuarios/{id} y /api/usuarios/perfil para
	// verificar la sesion justo despues de loguearse, sin importar si hay un
	// cambio de contraseña pendiente -- sin esto, ese chequeo botaba al
	// usuario antes de que pudiera ver la pantalla de cambio obligatorio.
	@Test
	void primerIngresoPendientePermiteConsultarElPerfilPropio() {
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO, "GET", "/api/usuarios/perfil")).isFalse();
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO, "GET", "/api/usuarios/42")).isFalse();
	}

	// El resto del filtro falla cerrado ante cualquier variante (ver
	// primerIngresoPendienteBloqueaLasVariantesDeLasRutasPermitidas) -- esta
	// excepcion nueva tiene que seguir esa misma regla: un prefijo simple
	// (startsWith) dejaria pasar algo como ".../usuarios/../otra-ruta", que
	// "empieza con" /api/usuarios/ como string aunque no apunte ahi.
	@Test
	void primerIngresoPendienteBloqueaVariantesDeLaConsultaDeUsuarios() {
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO, "GET", "/api/usuarios/../otra-ruta")).isTrue();
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO, "GET", "/api/usuarios/42/algo-mas")).isTrue();
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO, "GET", "/api/usuarios/")).isTrue();
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO, "POST", "/api/usuarios/42")).isTrue();
	}

	@Test
	void primerIngresoPendienteBloqueaLasVariantesDeLasRutasPermitidas() {
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO, "GET", "/api/auth/primer-ingreso/cambiar-password")).isTrue();
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO, "POST", "/api/auth/logout/")).isTrue();
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO, "POST", "/api/auth/logout/../usuarios")).isTrue();
	}

	@Test
	void unUsuarioActivoNoQuedaRestringidoPorLaReglaDePrimerIngreso() {
		assertThat(filtro.primerIngresoPendienteFueraDeRutaPermitida(
				EstadoUsuario.ACTIVO, "GET", "/api/usuarios")).isFalse();
	}

	@Test
	void contrasenaVencidaPermiteCambiarLaContrasena() {
		assertThat(filtro.contrasenaVencidaFueraDeRutaPermitida(
				true, "POST", "/api/auth/cambiar-password")).isFalse();
	}

	@Test
	void contrasenaVencidaPermiteCerrarSesion() {
		assertThat(filtro.contrasenaVencidaFueraDeRutaPermitida(
						true, "POST", "/api/auth/logout")).isFalse();
	}

	@Test
	void contrasenaVencidaBloqueaCualquierOtraRuta() {
		assertThat(filtro.contrasenaVencidaFueraDeRutaPermitida(
						true, "GET", "/api/usuarios")).isTrue();
	}

	@Test
	void contrasenaVencidaPermiteConsultarElPerfilPropio() {
		assertThat(filtro.contrasenaVencidaFueraDeRutaPermitida(
				true, "GET", "/api/usuarios/perfil")).isFalse();
		assertThat(filtro.contrasenaVencidaFueraDeRutaPermitida(
				true, "GET", "/api/usuarios/42")).isFalse();
	}

	@Test
	void contrasenaVencidaBloqueaVariantesDeLaConsultaDeUsuarios() {
		assertThat(filtro.contrasenaVencidaFueraDeRutaPermitida(
				true, "GET", "/api/usuarios/../otra-ruta")).isTrue();
		assertThat(filtro.contrasenaVencidaFueraDeRutaPermitida(
				true, "GET", "/api/usuarios/42/algo-mas")).isTrue();
	}

	@Test
	void contrasenaVigenteNoQuedaRestringidaPorHu049() {
		assertThat(filtro.contrasenaVencidaFueraDeRutaPermitida(
						false, "GET", "/api/usuarios")).isFalse();
	}
}
