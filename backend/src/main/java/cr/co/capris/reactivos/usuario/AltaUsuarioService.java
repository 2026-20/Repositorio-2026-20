package cr.co.capris.reactivos.usuario;

import cr.co.capris.reactivos.auth.GeneradorContrasenaTemporal;
import cr.co.capris.reactivos.seguridad.AccesoNoAutorizadoException;
import cr.co.capris.reactivos.seguridad.BitacoraSeguridadService;
import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.seguridad.EmailService;
import cr.co.capris.reactivos.seguridad.SesionNoValidaException;
import cr.co.capris.reactivos.seguridad.TipoEventoSeguridad;
import cr.co.capris.reactivos.seguridad.UsuarioDuplicadoException;
import cr.co.capris.reactivos.seguridad.UsuarioNoEncontradoException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Alta de usuario. No agrega el usuario a ninguna cola de
 * sincronizacion de dispositivos offline -- esa cola todavia no existe en el
 * proyecto (depende de HU-003 y del resto del modulo de sincronizacion), igual
 * que la baja logica de HU-048 (ver UsuarioController.inactivar()).
 */
@Service
public class AltaUsuarioService {

	private static final Logger log = LoggerFactory.getLogger(AltaUsuarioService.class);
	private static final int VIGENCIA_PASSWORD_TEMPORAL_HORAS = 24;
	private final UsuarioRepository usuarioRepository;
	private final RolRepository rolRepository;
	private final EmpresaRepository empresaRepository;
	private final PasswordEncoder passwordEncoder;
	private final GeneradorContrasenaTemporal generadorContrasenaTemporal;
	private final EmailService emailService;
	private final BitacoraSeguridadService bitacoraSeguridadService;
	private final ContextoUsuarioActual contextoUsuarioActual;

	public AltaUsuarioService(
			UsuarioRepository usuarioRepository,
			RolRepository rolRepository,
			EmpresaRepository empresaRepository,
			PasswordEncoder passwordEncoder,
			GeneradorContrasenaTemporal generadorContrasenaTemporal,
			EmailService emailService,
			BitacoraSeguridadService bitacoraSeguridadService,
			ContextoUsuarioActual contextoUsuarioActual) {
		this.usuarioRepository = usuarioRepository;
		this.rolRepository = rolRepository;
		this.empresaRepository = empresaRepository;
		this.passwordEncoder = passwordEncoder;
		this.generadorContrasenaTemporal = generadorContrasenaTemporal;
		this.emailService = emailService;
		this.bitacoraSeguridadService = bitacoraSeguridadService;
		this.contextoUsuarioActual = contextoUsuarioActual;
	}

	@Transactional
	public Usuario crear(CrearUsuarioRequest request) {
		validarDuplicados(request);

		// Aislamiento multiempresa (HU-023): el usuario nuevo siempre queda en la
		// empresa del administrador autenticado, nunca en la que mande el cliente en
		// el request. Un empresaId que no coincida se trata igual que en
		// detalle()/inactivar() -- 403 generico, sin distinguir si esa empresa existe.
		Long empresaId = exigirEmpresaId();
		if (request.empresaId() != null && !request.empresaId().equals(empresaId)) {
			throw new AccesoNoAutorizadoException("No autorizado");
		}

		Rol rol = rolRepository.findById(request.rolId())
				.orElseThrow(() -> new UsuarioNoEncontradoException("El rol indicado no existe"));
		Empresa empresa = empresaRepository.findById(empresaId)
				.orElseThrow(() -> new UsuarioNoEncontradoException("La empresa indicada no existe"));

		String passwordTemporal = generadorContrasenaTemporal.generar();

		Usuario usuario = new Usuario(
				request.nombreCompleto(),
				request.cedula(),
				request.correo(),
				request.username(),
				passwordEncoder.encode(passwordTemporal),
				EstadoUsuario.PENDIENTE_PRIMER_INGRESO,
				rol,
				empresa,
				OffsetDateTime.now().plusHours(VIGENCIA_PASSWORD_TEMPORAL_HORAS));

		usuarioRepository.save(usuario);

		bitacoraSeguridadService.registrar(
				usuario.getUsername(), usuario.getId(), TipoEventoSeguridad.USUARIO_CREADO,
				"Usuario creado con rol '%s' en empresa '%s'".formatted(rol.getNombre(), empresa.getNombre()));

		// El correo es una notificacion, no la fuente de verdad del alta -- si el envio
		// falla (SMTP caido, correo invalido, etc.) el usuario ya quedo creado en la BD
		// y un administrador puede reenviarle las credenciales por otro medio, asi que
		// no tiene sentido revertir la transaccion completa por un problema de correo.
		try {
			emailService.enviarCredencialesIniciales(
					usuario.getCorreo(), usuario.getNombreCompleto(), usuario.getUsername(), passwordTemporal);
		} catch (Exception ex) {
			log.error("No se pudo enviar el correo de credenciales iniciales a {}", usuario.getCorreo(), ex);
			bitacoraSeguridadService.registrar(
					usuario.getUsername(), usuario.getId(), TipoEventoSeguridad.USUARIO_CREADO,
					"Fallo el envio del correo de credenciales iniciales: " + ex.getMessage());
		}

		return usuario;
	}

	private Long exigirEmpresaId() {
		Long empresaId = contextoUsuarioActual.getEmpresaId();
		if (empresaId == null) {
			throw new SesionNoValidaException("No hay sesion activa");
		}
		return empresaId;
	}

	private void validarDuplicados(CrearUsuarioRequest request) {
		if (usuarioRepository.existsByCedula(request.cedula())) {
			throw new UsuarioDuplicadoException("Ya existe un usuario con esa cedula");
		}
		if (usuarioRepository.existsByCorreo(request.correo())) {
			throw new UsuarioDuplicadoException("Ya existe un usuario con ese correo");
		}
		if (usuarioRepository.existsByUsername(request.username())) {
			throw new UsuarioDuplicadoException("Ya existe un usuario con ese username");
		}
	}
}
