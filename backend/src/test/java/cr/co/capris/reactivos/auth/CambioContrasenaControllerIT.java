package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.seguridad.BitacoraSeguridadRepository;
import cr.co.capris.reactivos.seguridad.TipoEventoSeguridad;
import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class CambioContrasenaControllerIT {

	private static final String CONTRASENA_SEMILLA = "Capris2026!";

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

	// Cada prueba fija su propia precondicion (estado y contador de intentos) para no
	// depender de lo que dejo otra prueba que use el mismo usuario.
	private Usuario preparar(String username, EstadoUsuario estado) {
		Usuario usuario = usuarioRepository.findByUsername(username).orElseThrow();
		usuario.setEstado(estado);
		usuario.setIntentosFallidos(0);
		usuario.setBloqueadoHasta(null);
		return usuarioRepository.save(usuario);
	}

	private Usuario dejarPendientePrimerIngreso(String username) {
		return preparar(username, EstadoUsuario.PENDIENTE_PRIMER_INGRESO);
	}

	private long eventosDe(Long usuarioId, TipoEventoSeguridad tipo) {
		return bitacoraSeguridadRepository.findAll().stream()
				.filter(registro -> usuarioId.equals(registro.getUsuarioId()) && registro.getTipoEvento() == tipo)
				.count();
	}

	private String token(Usuario usuario) {
		return jwtService.generar(usuario.getId(), usuario.getEmpresa().getId(), usuario.getRol().getNombre());
	}

	private String cuerpoVoluntario(String actual, String nueva) {
		return "{\"contrasenaActual\":\"" + actual + "\",\"contrasenaNueva\":\"" + nueva + "\"}";
	}

	// ---- HU-044: el backend, no solo el frontend, obliga el cambio ----

	@Test
	void unUsuarioPendienteNoPuedeUsarNingunOtroEndpointConSuToken() throws Exception {
		// Administrador a proposito: el rol no debe darle acceso mientras siga pendiente.
		Usuario admin = dejarPendientePrimerIngreso("wmolina");
		String token = token(admin);

		mockMvc.perform(get("/api/usuarios").header("Authorization", "Bearer " + token))
				.andExpect(status().isUnauthorized());

		mockMvc.perform(post("/api/auth/cambiar-password")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoVoluntario(CONTRASENA_SEMILLA, "Otra123!x")))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void unUsuarioPendienteSiPuedeCambiarSuContrasenaYLuegoUsarElMismoToken() throws Exception {
		Usuario usuario = dejarPendientePrimerIngreso("amelendez");
		String token = token(usuario);

		mockMvc.perform(post("/api/auth/primer-ingreso/cambiar-password")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content("{\"contrasenaNueva\":\"NuevaClave2026!\"}"))
				.andExpect(status().isNoContent());

		assertThat(usuarioRepository.findById(usuario.getId()).orElseThrow().getEstado())
				.isEqualTo(EstadoUsuario.ACTIVO);

		// Ya activo, el mismo token deja de estar restringido (ruta accesible a cualquier rol autenticado).
		mockMvc.perform(post("/api/auth/cambiar-password")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoVoluntario("NuevaClave2026!", "OtraClave2026!")))
				.andExpect(status().isNoContent());
	}

	@Test
	void unUsuarioPendienteSiPuedeCerrarSesion() throws Exception {
		Usuario usuario = dejarPendientePrimerIngreso("arcea");

		mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token(usuario)))
				.andExpect(status().isNoContent());
	}

	// ---- HU-045: la contraseña actual incorrecta cuenta para el bloqueo y queda en bitacora ----

	@Test
	void cuatroContrasenasActualesIncorrectasBloqueanLaCuentaYQuedanEnBitacora() throws Exception {
		Usuario usuario = preparar("pruebadiagnostika", EstadoUsuario.ACTIVO);
		String token = token(usuario);

		for (int intento = 1; intento <= 3; intento++) {
			mockMvc.perform(post("/api/auth/cambiar-password")
							.header("Authorization", "Bearer " + token)
							.contentType("application/json")
							.content(cuerpoVoluntario("incorrecta", "NuevaClave2026!")))
					.andExpect(status().isUnauthorized());
		}

		mockMvc.perform(post("/api/auth/cambiar-password")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoVoluntario("incorrecta", "NuevaClave2026!")))
				.andExpect(status().isLocked())
				.andExpect(jsonPath("$.codigo").value("CUENTA_BLOQUEADA"));

		// Con la cuenta bloqueada, ni la contraseña correcta permite el cambio.
		mockMvc.perform(post("/api/auth/cambiar-password")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content(cuerpoVoluntario(CONTRASENA_SEMILLA, "NuevaClave2026!")))
				.andExpect(status().isLocked());

		assertThat(eventosDe(usuario.getId(), TipoEventoSeguridad.CAMBIO_CONTRASENA_FALLIDO)).isEqualTo(4);
		assertThat(eventosDe(usuario.getId(), TipoEventoSeguridad.CUENTA_BLOQUEADA)).isEqualTo(1);
	}

	@Test
	void cambioVoluntarioConContrasenaNuevaVaciaDevuelve400() throws Exception {
		Usuario usuario = preparar("pruebadiagnostika", EstadoUsuario.ACTIVO);

		mockMvc.perform(post("/api/auth/cambiar-password")
						.header("Authorization", "Bearer " + token(usuario))
						.contentType("application/json")
						.content(cuerpoVoluntario(CONTRASENA_SEMILLA, "")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.codigo").value("SOLICITUD_INVALIDA"));
	}

	@Test
	void primerIngresoConContrasenaNuevaVaciaDevuelve400() throws Exception {
		Usuario usuario = dejarPendientePrimerIngreso("pruebadiagnostika");
		String token = token(usuario);

		mockMvc.perform(post("/api/auth/primer-ingreso/cambiar-password")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content("{\"contrasenaNueva\":\"\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.codigo").value("SOLICITUD_INVALIDA"));

		mockMvc.perform(post("/api/auth/primer-ingreso/cambiar-password")
						.header("Authorization", "Bearer " + token)
						.contentType("application/json")
						.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.codigo").value("SOLICITUD_INVALIDA"));
	}
}
