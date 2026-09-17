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
 * HU-048: baja logica contra la semilla real. No cubre el criterio de aceptacion 3
 * (cola de sincronizacion hacia dispositivos offline) -- esa infraestructura todavia
 * no existe en el proyecto (depende de HU-003). Requiere Docker; corre con "mvn verify".
 *
 * HU-023: inactivar tambien respeta el aislamiento multiempresa -- un id que no existe
 * y un id que existe en otra empresa responden exactamente igual (403 ACCESO_NO_AUTORIZADO).
 *
 * Solo un Administrador puede inactivar -- SecurityConfig lo exige a nivel de filtro,
 * antes de que la peticion llegue al controller.
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class InactivarUsuarioControllerIT {

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

	@Test
	void inactivarUnUsuarioActivoLoMarcaInactivoYFijaLaRevocacionDeSesiones() throws Exception {
		// usuario distinto al de la prueba de idempotencia -- ambas pruebas comparten
		// la misma base (no hay rollback entre metodos en un @SpringBootTest), asi que
		// reusar el mismo username haria que el orden de ejecucion de JUnit afectara el resultado.
		Long id = usuarioRepository.findByUsername("amelendez").orElseThrow().getId();
		long registrosBitacoraAntes = bitacoraSeguridadRepository.count();

		mockMvc.perform(post("/api/usuarios/{id}/inactivar", id)
						.header("Authorization", "Bearer " + tokenAdministrador())
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(new InactivarUsuarioRequest("Renuncio a la empresa"))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("INACTIVO"));

		Usuario actualizado = usuarioRepository.findById(id).orElseThrow();
		assertThat(actualizado.getEstado()).isEqualTo(EstadoUsuario.INACTIVO);
		assertThat(actualizado.getSesionesInvalidadasDesde()).isNotNull();
		assertThat(bitacoraSeguridadRepository.count()).isEqualTo(registrosBitacoraAntes + 1);
	}

	@Test
	void inactivarUnUsuarioYaInactivoEsIdempotenteYNoDuplicaLaBitacora() throws Exception {
		Long id = usuarioRepository.findByUsername("arcea").orElseThrow().getId();
		String token = tokenAdministrador();

		// primera llamada: lo inactiva de verdad
		mockMvc.perform(post("/api/usuarios/{id}/inactivar", id)
						.header("Authorization", "Bearer " + token)
						.contentType("application/json").content("{}"))
				.andExpect(status().isOk());
		long registrosBitacoraDespuesDeLaPrimera = bitacoraSeguridadRepository.count();

		// segunda llamada: no deberia volver a registrar nada
		mockMvc.perform(post("/api/usuarios/{id}/inactivar", id)
						.header("Authorization", "Bearer " + token)
						.contentType("application/json").content("{}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("INACTIVO"));

		assertThat(bitacoraSeguridadRepository.count()).isEqualTo(registrosBitacoraDespuesDeLaPrimera);
	}

	@Test
	void inactivarUnUsuarioInexistenteDevuelve403AccesoNoAutorizado() throws Exception {
		mockMvc.perform(post("/api/usuarios/{id}/inactivar", 999_999)
						.header("Authorization", "Bearer " + tokenAdministrador())
						.contentType("application/json").content("{}"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.codigo").value("ACCESO_NO_AUTORIZADO"));
	}

	@Test
	void inactivarUnUsuarioDeOtraEmpresaDevuelve403AccesoNoAutorizado() throws Exception {
		Long idDiagnostika = usuarioRepository.findByUsername("pruebadiagnostika").orElseThrow().getId();

		mockMvc.perform(post("/api/usuarios/{id}/inactivar", idDiagnostika)
						.header("Authorization", "Bearer " + tokenAdministrador())
						.contentType("application/json").content("{}"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.codigo").value("ACCESO_NO_AUTORIZADO"));

		Usuario usuarioDiagnostika = usuarioRepository.findById(idDiagnostika).orElseThrow();
		assertThat(usuarioDiagnostika.getEstado()).isEqualTo(EstadoUsuario.ACTIVO);
	}

	@Test
	void inactivarComoUsuarioDeCampoDevuelve403AccesoNoAutorizado() throws Exception {
		Long idAdmin = usuarioRepository.findByUsername("wmolina").orElseThrow().getId();

		mockMvc.perform(post("/api/usuarios/{id}/inactivar", idAdmin)
						.header("Authorization", "Bearer " + tokenUsuarioDeCampo())
						.contentType("application/json").content("{}"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.codigo").value("ACCESO_NO_AUTORIZADO"));

		Usuario admin = usuarioRepository.findById(idAdmin).orElseThrow();
		assertThat(admin.getEstado()).isEqualTo(EstadoUsuario.ACTIVO);
	}
}
