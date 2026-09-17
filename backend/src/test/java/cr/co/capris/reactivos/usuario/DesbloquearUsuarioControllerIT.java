package cr.co.capris.reactivos.usuario;

import cr.co.capris.reactivos.auth.JwtService;
import cr.co.capris.reactivos.seguridad.BitacoraSeguridadRepository;
import cr.co.capris.reactivos.seguridad.TipoEventoSeguridad;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HU-043: desbloqueo manual de una cuenta bloqueada por intentos fallidos.
 *
 * HU-023: desbloquear tambien respeta el aislamiento multiempresa, con el mismo
 * patron que inactivar/detalle -- un id de otra empresa responde 403 ACCESO_NO_AUTORIZADO,
 * nunca 404 (no confirma ni niega que el usuario exista).
 *
 * Solo un Administrador puede desbloquear -- SecurityConfig lo exige a nivel de filtro.
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class DesbloquearUsuarioControllerIT {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private UsuarioRepository usuarioRepository;

	@Autowired
	private BitacoraSeguridadRepository bitacoraSeguridadRepository;

	@Autowired
	private JwtService jwtService;

	private String tokenAdministrador() {
		Usuario admin = usuarioRepository.findByUsername("wmolina").orElseThrow();
		return jwtService.generar(admin.getId(), admin.getEmpresa().getId(), admin.getRol().getNombre());
	}

	private String tokenUsuarioDeCampo() {
		Usuario usuario = usuarioRepository.findByUsername("pruebadiagnostika").orElseThrow();
		return jwtService.generar(usuario.getId(), usuario.getEmpresa().getId(), usuario.getRol().getNombre());
	}

	@Test
	void desbloquearUnUsuarioBloqueadoLoDejaActivoYReiniciaIntentos() throws Exception {
		Usuario amelendez = usuarioRepository.findByUsername("amelendez").orElseThrow();
		amelendez.setIntentosFallidos(4);
		amelendez.setBloqueadoHasta(OffsetDateTime.now().plusMinutes(7));
		usuarioRepository.save(amelendez);

		long registrosBitacoraAntes = bitacoraSeguridadRepository.count();

		mockMvc.perform(post("/api/usuarios/{id}/desbloquear", amelendez.getId())
						.header("Authorization", "Bearer " + tokenAdministrador()))
				.andExpect(status().isOk());

		Usuario actualizado = usuarioRepository.findById(amelendez.getId()).orElseThrow();
		assertThat(actualizado.getIntentosFallidos()).isZero();
		assertThat(actualizado.getBloqueadoHasta()).isNull();
		assertThat(bitacoraSeguridadRepository.count()).isEqualTo(registrosBitacoraAntes + 1);
		assertThat(bitacoraSeguridadRepository.findAll())
				.anyMatch(registro -> registro.getTipoEvento() == TipoEventoSeguridad.CUENTA_DESBLOQUEADA);
	}

	@Test
	void desbloquearUnUsuarioInexistenteDevuelve403AccesoNoAutorizado() throws Exception {
		mockMvc.perform(post("/api/usuarios/{id}/desbloquear", 999_999)
						.header("Authorization", "Bearer " + tokenAdministrador()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.codigo").value("ACCESO_NO_AUTORIZADO"));
	}

	@Test
	void desbloquearUnUsuarioDeOtraEmpresaDevuelve403AccesoNoAutorizado() throws Exception {
		Usuario usuarioDiagnostika = usuarioRepository.findByUsername("pruebadiagnostika").orElseThrow();
		usuarioDiagnostika.setIntentosFallidos(4);
		usuarioDiagnostika.setBloqueadoHasta(OffsetDateTime.now().plusMinutes(7));
		usuarioRepository.save(usuarioDiagnostika);

		mockMvc.perform(post("/api/usuarios/{id}/desbloquear", usuarioDiagnostika.getId())
						.header("Authorization", "Bearer " + tokenAdministrador()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.codigo").value("ACCESO_NO_AUTORIZADO"));

		// un admin de otra empresa no pudo desbloquearlo -- sigue bloqueado tal cual quedo.
		Usuario sinCambios = usuarioRepository.findById(usuarioDiagnostika.getId()).orElseThrow();
		assertThat(sinCambios.getBloqueadoHasta()).isNotNull();
		assertThat(sinCambios.getIntentosFallidos()).isEqualTo(4);
	}

	@Test
	void desbloquearComoUsuarioDeCampoDevuelve403AccesoNoAutorizado() throws Exception {
		Long idAdmin = usuarioRepository.findByUsername("wmolina").orElseThrow().getId();

		mockMvc.perform(post("/api/usuarios/{id}/desbloquear", idAdmin)
						.header("Authorization", "Bearer " + tokenUsuarioDeCampo()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.codigo").value("ACCESO_NO_AUTORIZADO"));
	}
}
