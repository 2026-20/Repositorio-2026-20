package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.seguridad.CredencialesInvalidasException;
import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import cr.co.capris.reactivos.seguridad.BloqueoCuentaService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

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

	// Hash BCrypt de una cadena que no es contraseña de nadie -- se usa para que
	// passwordEncoder.matches(...) tarde lo mismo cuando el usuario no existe que
	// cuando si existe. Sin esto, un username inexistente responde en milisegundos
	// (nunca llega a BCrypt) y uno real tarda decenas de ms -- una diferencia facil
	// de medir para enumerar usernames validos sin que el mensaje de error lo diga.
	private static final String HASH_SENUELO = "$2a$10$uxSRyCPxQT6DLKACxaK7.OhwBoPNoydC2jcLtzSoSTDh.RCk/fIVu";

	private final UsuarioRepository usuarioRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;
	private final BloqueoCuentaService bloqueoCuentaService;

	public AutenticacionController(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder,
			JwtService jwtService, BloqueoCuentaService bloqueoCuentaService) {
		this.usuarioRepository = usuarioRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
		this.bloqueoCuentaService = bloqueoCuentaService;
	}

	@PostMapping("/login")
	public LoginResponse login(@RequestBody LoginRequest request) {
		Usuario usuario = usuarioRepository.findByUsername(request.username()).orElse(null);

		// Se corre siempre, exista o no el usuario -- ver comentario de HASH_SENUELO.
		String hashParaComparar = usuario != null ? usuario.getPasswordHash() : HASH_SENUELO;
		boolean contrasenaCorrecta = passwordEncoder.matches(request.contrasena(), hashParaComparar);

		if (usuario == null) {
			bloqueoCuentaService.registrarIntentoUsuarioInexistente(request.username(), obtenerIdentificadorCliente());
			throw new CredencialesInvalidasException(MENSAJE_CREDENCIALES_INVALIDAS);
		}

		bloqueoCuentaService.verificarBloqueo(usuario);

		if (usuario.getEstado() == EstadoUsuario.INACTIVO) {
			throw new CredencialesInvalidasException(MENSAJE_CREDENCIALES_INVALIDAS);
		}

		if (!usuario.getEmpresa().getId().equals(request.empresaId())) {
			throw new CredencialesInvalidasException(MENSAJE_CREDENCIALES_INVALIDAS);
		}

		if (!contrasenaCorrecta) {
			bloqueoCuentaService.registrarIntentoFallido(usuario, obtenerIdentificadorCliente());
			throw new CredencialesInvalidasException(MENSAJE_CREDENCIALES_INVALIDAS);
		}

		if (usuario.getEstado() == EstadoUsuario.PENDIENTE_PRIMER_INGRESO
				&& usuario.getPasswordTemporalExpiraEn() != null
				&& usuario.getPasswordTemporalExpiraEn().isBefore(OffsetDateTime.now())) {
			// TODO (HU-044): mensaje especifico de clave temporal vencida en vez del generico.
			throw new CredencialesInvalidasException(MENSAJE_CREDENCIALES_INVALIDAS);
		}

		bloqueoCuentaService.reiniciarIntentosTrasLoginExitoso(usuario);

		String token = jwtService.generar(usuario.getId(), usuario.getEmpresa().getId(), usuario.getRol().getNombre());

		return new LoginResponse(
				token,
				usuario.getId(),
				usuario.getNombreCompleto(),
				usuario.getRol().getNombre(),
				usuario.getEstado() == EstadoUsuario.PENDIENTE_PRIMER_INGRESO);
	}

	private String obtenerIdentificadorCliente() {
		var atributos = RequestContextHolder.getRequestAttributes();

		if (atributos instanceof ServletRequestAttributes servletAttributes) {
			String ip = servletAttributes.getRequest().getRemoteAddr();
			return "ip:" + ip;
		}

		return "ip:no-disponible";
	}
}
