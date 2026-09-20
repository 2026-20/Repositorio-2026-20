package cr.co.capris.reactivos.usuario;

import cr.co.capris.reactivos.auth.JwtService;
import cr.co.capris.reactivos.seguridad.BitacoraSeguridadRepository;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Reactivar no es un criterio de aceptacion de HU-048 (esa historia solo pide la baja
 * logica) -- se agrega para que la baja tenga una forma de deshacerse, consistente con
 * que sea "logica" y no un borrado. Sigue el mismo patron de aislamiento multiempresa y
 * de restriccion de rol que InactivarUsuarioControllerIT. Requiere Docker; corre con
 * "mvn verify".
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class ReactivarUsuarioControllerIT {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

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

	private void inactivar(Long id, String token) throws Exception {
		mockMvc.perform(post("/api/usuarios/{id}/inactivar", id)
						.header("Authorization", "Bearer " + token)
						.contentType("application/json").content("{}"))
				.andExpect(status().isOk());
	}

	@Test
	void reactivarUnUsuarioInactivoLoMarcaActivo() throws Exception {
		Long id = usuarioRepository.findByUsername("amelendez").orElseThrow().getId();
		String token = tokenAdministrador();
		inactivar(id, token);
		long registrosBitacoraAntes = bitacoraSeguridadRepository.count();

		mockMvc.perform(post("/api/usuarios/{id}/reactivar", id)
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("ACTIVO"));

		Usuario actualizado = usuarioRepository.findById(id).orElseThrow();
		assertThat(actualizado.getEstado()).isEqualTo(EstadoUsuario.ACTIVO);
		assertThat(bitacoraSeguridadRepository.count()).isEqualTo(registrosBitacoraAntes + 1);
	}

	@Test
	void reactivarUnUsuarioYaActivoEsIdempotenteYNoGeneraBitacora() throws Exception {
		Long id = usuarioRepository.findByUsername("arcea").orElseThrow().getId();
		String token = tokenAdministrador();
		long registrosBitacoraAntes = bitacoraSeguridadRepository.count();

		mockMvc.perform(post("/api/usuarios/{id}/reactivar", id)
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("ACTIVO"));

		assertThat(bitacoraSeguridadRepository.count()).isEqualTo(registrosBitacoraAntes);
	}

	@Test
	void reactivarUnUsuarioInexistenteDevuelve403AccesoNoAutorizado() throws Exception {
		mockMvc.perform(post("/api/usuarios/{id}/reactivar", 999_999)
						.header("Authorization", "Bearer " + tokenAdministrador()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.codigo").value("ACCESO_NO_AUTORIZADO"));
	}

	@Test
	void reactivarUnUsuarioDeOtraEmpresaDevuelve403AccesoNoAutorizado() throws Exception {
		Long idDiagnostika = usuarioRepository.findByUsername("pruebadiagnostika").orElseThrow().getId();

		mockMvc.perform(post("/api/usuarios/{id}/reactivar", idDiagnostika)
						.header("Authorization", "Bearer " + tokenAdministrador()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.codigo").value("ACCESO_NO_AUTORIZADO"));
	}

	@Test
	void reactivarComoUsuarioDeCampoDevuelve403AccesoNoAutorizado() throws Exception {
		Long idAdmin = usuarioRepository.findByUsername("wmolina").orElseThrow().getId();

		mockMvc.perform(post("/api/usuarios/{id}/reactivar", idAdmin)
						.header("Authorization", "Bearer " + tokenUsuarioDeCampo()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.codigo").value("ACCESO_NO_AUTORIZADO"));
	}
}
