package cr.co.capris.reactivos.usuario;

import cr.co.capris.reactivos.seguridad.BitacoraSeguridadService;
import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.seguridad.TipoEventoSeguridad;
import cr.co.capris.reactivos.seguridad.UsuarioNoEncontradoException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Listado/detalle de solo lectura, mas la baja logica de HU-048. El alta real
 * (HU-047, con envio de OTP por correo) se agrega cuando se aborde esa HU.
 */
@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

	private final UsuarioRepository usuarioRepository;
	private final BitacoraSeguridadService bitacoraSeguridadService;
	private final ContextoUsuarioActual contextoUsuarioActual;

	public UsuarioController(
			UsuarioRepository usuarioRepository,
			BitacoraSeguridadService bitacoraSeguridadService,
			ContextoUsuarioActual contextoUsuarioActual) {
		this.usuarioRepository = usuarioRepository;
		this.bitacoraSeguridadService = bitacoraSeguridadService;
		this.contextoUsuarioActual = contextoUsuarioActual;
	}

	@GetMapping
	public List<UsuarioResumenDTO> listar() {
		return usuarioRepository.findAll().stream()
				.map(UsuarioResumenDTO::from)
				.toList();
	}

	@GetMapping("/{id}")
	public UsuarioResumenDTO detalle(@PathVariable Long id) {
		return UsuarioResumenDTO.from(buscarOFallar(id));
	}

	/**
	 * HU-048: baja logica. Idempotente a proposito -- si ya estaba INACTIVO no
	 * cambia nada ni duplica el registro de bitacora, para que un doble clic del
	 * administrador no genere ruido en la auditoria.
	 *
	 * No implementa el criterio de aceptacion 3 (propagar el bloqueo a la cola de
	 * sincronizacion de dispositivos offline) -- esa cola todavia no existe en el
	 * proyecto (depende de HU-003 y del resto del modulo de sincronizacion).
	 */
	@PostMapping("/{id}/inactivar")
	public UsuarioResumenDTO inactivar(@PathVariable Long id, @RequestBody(required = false) InactivarUsuarioRequest request) {
		Usuario usuario = buscarOFallar(id);

		if (usuario.getEstado() == EstadoUsuario.INACTIVO) {
			return UsuarioResumenDTO.from(usuario);
		}

		usuario.setEstado(EstadoUsuario.INACTIVO);
		usuario.setSesionesInvalidadasDesde(OffsetDateTime.now());
		usuarioRepository.save(usuario);

		String motivo = request != null ? request.motivo() : null;
		String adminId = contextoUsuarioActual.getUsuarioId() != null
				? String.valueOf(contextoUsuarioActual.getUsuarioId())
				: "desconocido (endpoint aun no exige sesion, ver SecurityConfig)";
		String detalle = "Inactivado por usuario id=%s. Motivo: %s".formatted(adminId, motivo != null ? motivo : "no indicado");

		bitacoraSeguridadService.registrar(
				usuario.getUsername(), usuario.getId(), TipoEventoSeguridad.USUARIO_INACTIVADO, detalle);

		return UsuarioResumenDTO.from(usuario);
	}

	private Usuario buscarOFallar(Long id) {
		return usuarioRepository.findById(id)
				.orElseThrow(() -> new UsuarioNoEncontradoException("No existe un usuario con id " + id));
	}
}
