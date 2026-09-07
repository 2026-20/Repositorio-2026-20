package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.seguridad.CredencialesInvalidasException;
import cr.co.capris.reactivos.seguridad.CuentaBloqueadaException;
import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

/**
 * Version minima de HU-001: valida credenciales y emite el JWT que el resto de las
 * HUs de seguridad necesitan para funcionar. Deliberadamente NO cubre todavia:
 * - el listado de empresas para el selector del login (criterio de aceptacion 1),
 * - mensajes de error especificos por criterio (hoy todos devuelven el mismo genérico),
 * - integracion con HU-036/037/038 (validar activo en el ERP, cargar rutas, iniciar jornada).
 * Eso queda pendiente para completar HU-001.
 */
@RestController
@RequestMapping("/api/auth")
public class AutenticacionController {

	private static final String MENSAJE_CREDENCIALES_INVALIDAS = "Usuario, contraseña o empresa no válidos";

	private final UsuarioRepository usuarioRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;

	public AutenticacionController(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder,
			JwtService jwtService) {
		this.usuarioRepository = usuarioRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
	}

	@PostMapping("/login")
	public LoginResponse login(@RequestBody LoginRequest request) {
		Usuario usuario = usuarioRepository.findByUsername(request.username())
				.orElseThrow(() -> new CredencialesInvalidasException(MENSAJE_CREDENCIALES_INVALIDAS));

		if (usuario.getBloqueadoHasta() != null && usuario.getBloqueadoHasta().isAfter(OffsetDateTime.now())) {
			// HU-043 es quien fija bloqueadoHasta; el login solo lo respeta.
			throw new CuentaBloqueadaException(
					"Cuenta bloqueada temporalmente por intentos fallidos", usuario.getBloqueadoHasta());
		}

		if (usuario.getEstado() == EstadoUsuario.INACTIVO) {
			throw new CredencialesInvalidasException(MENSAJE_CREDENCIALES_INVALIDAS);
		}

		if (!usuario.getEmpresa().getId().equals(request.empresaId())) {
			throw new CredencialesInvalidasException(MENSAJE_CREDENCIALES_INVALIDAS);
		}

		if (!passwordEncoder.matches(request.contrasena(), usuario.getPasswordHash())) {
			// TODO (HU-043): incrementar usuario.intentosFallidos aqui; al llegar a 4,
			// fijar bloqueadoHasta = ahora + 7 minutos y registrar en la bitacora.
			throw new CredencialesInvalidasException(MENSAJE_CREDENCIALES_INVALIDAS);
		}

		if (usuario.getEstado() == EstadoUsuario.PENDIENTE_PRIMER_INGRESO
				&& usuario.getPasswordTemporalExpiraEn() != null
				&& usuario.getPasswordTemporalExpiraEn().isBefore(OffsetDateTime.now())) {
			// TODO (HU-044): mensaje especifico de clave temporal vencida en vez del generico.
			throw new CredencialesInvalidasException(MENSAJE_CREDENCIALES_INVALIDAS);
		}

		// TODO (HU-043): reiniciar usuario.intentosFallidos a 0 aqui, en login exitoso.

		String token = jwtService.generar(usuario.getId(), usuario.getEmpresa().getId(), usuario.getRol().getNombre());

		return new LoginResponse(
				token,
				usuario.getId(),
				usuario.getNombreCompleto(),
				usuario.getRol().getNombre(),
				usuario.getEstado() == EstadoUsuario.PENDIENTE_PRIMER_INGRESO);
	}
}
