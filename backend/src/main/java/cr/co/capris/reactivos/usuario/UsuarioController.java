package cr.co.capris.reactivos.usuario;

import cr.co.capris.reactivos.seguridad.AccesoNoAutorizadoException;
import cr.co.capris.reactivos.seguridad.BitacoraSeguridadService;
import cr.co.capris.reactivos.seguridad.BloqueoCuentaService;
import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.seguridad.SesionNoValidaException;
import cr.co.capris.reactivos.seguridad.TipoEventoSeguridad;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Listado/detalle de solo lectura, el alta de HU-047 y la baja logica de HU-048.
 */
@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

	private final UsuarioRepository usuarioRepository;
	private final BitacoraSeguridadService bitacoraSeguridadService;
	private final ContextoUsuarioActual contextoUsuarioActual;
	private final BloqueoCuentaService bloqueoCuentaService;
	private final AltaUsuarioService altaUsuarioService;

	public UsuarioController(
			UsuarioRepository usuarioRepository,
			BitacoraSeguridadService bitacoraSeguridadService,
			ContextoUsuarioActual contextoUsuarioActual,
			BloqueoCuentaService bloqueoCuentaService,
			AltaUsuarioService altaUsuarioService) {
		this.usuarioRepository = usuarioRepository;
		this.bitacoraSeguridadService = bitacoraSeguridadService;
		this.contextoUsuarioActual = contextoUsuarioActual;
		this.bloqueoCuentaService = bloqueoCuentaService;
		this.altaUsuarioService = altaUsuarioService;
	}

	@PostMapping
	public ResponseEntity<UsuarioResumenDTO> crear(@Valid @RequestBody CrearUsuarioRequest request) {
		Usuario usuario = altaUsuarioService.crear(request);
		return ResponseEntity.status(HttpStatus.CREATED).body(UsuarioResumenDTO.from(usuario));
	}

	@GetMapping
	public List<UsuarioResumenDTO> listar() {
		Long empresaId = exigirEmpresaId();
		return usuarioRepository.findAllByEmpresaId(empresaId).stream()
				.map(UsuarioResumenDTO::from).toList();
	}

	@GetMapping("/{id}")
	public UsuarioResumenDTO detalle(@PathVariable Long id) {
		Long empresaId = exigirEmpresaId();
		return usuarioRepository.findByIdAndEmpresaId(id, empresaId)
				.map(UsuarioResumenDTO::from)
				.orElseThrow(() -> new AccesoNoAutorizadoException("No autorizado"));
	}

	private Long exigirEmpresaId() {
		Long empresaId = contextoUsuarioActual.getEmpresaId();
		if (empresaId == null) {
			throw new SesionNoValidaException("No hay sesion activa");
		}
		return empresaId;
	}
	/**
	 * HU-048: baja logica. Idempotente a proposito -- si ya estaba INACTIVO no
	 * cambia nada ni duplica el registro de bitacora, para que un doble clic del
	 * administrador no genere ruido en la auditoria.
	 * No implementa el criterio de aceptacion 3 (propagar el bloqueo a la cola de
	 * sincronizacion de dispositivos offline) -- esa cola todavia no existe en el
	 * proyecto (depende de HU-003 y del resto del modulo de sincronizacion).
	 **/
	@PostMapping("/{id}/inactivar")
	public UsuarioResumenDTO inactivar(@PathVariable Long id, @RequestBody(required = false) InactivarUsuarioRequest request) {
		Long empresaId = exigirEmpresaId();
		Usuario usuario = buscarOFallar(id, empresaId);

		if (usuario.getEstado() == EstadoUsuario.INACTIVO) {
			return UsuarioResumenDTO.from(usuario);
		}

		usuario.setEstado(EstadoUsuario.INACTIVO);
		usuario.setSesionesInvalidadasDesde(OffsetDateTime.now());
		usuarioRepository.save(usuario);

		String motivo = request != null ? request.motivo() : null;
		String adminId = String.valueOf(contextoUsuarioActual.getUsuarioId());
		String detalle = "Inactivado por usuario id=%s. Motivo: %s".formatted(adminId, motivo != null ? motivo : "no indicado");

		bitacoraSeguridadService.registrar(usuario.getUsername(), usuario.getId(), TipoEventoSeguridad.USUARIO_INACTIVADO, detalle);

		return UsuarioResumenDTO.from(usuario);
	}

	@PostMapping("/{id}/desbloquear")
	public UsuarioResumenDTO desbloquear(@PathVariable Long id) {
		Long empresaId = exigirEmpresaId();
		Usuario usuario = buscarOFallar(id, empresaId);
		bloqueoCuentaService.desbloquearManualmente(usuario, contextoUsuarioActual.getUsuarioId());
		return UsuarioResumenDTO.from(usuario);
	}

	private Usuario buscarOFallar(Long id, Long empresaId) {
		return usuarioRepository.findByIdAndEmpresaId(id, empresaId).orElseThrow(() -> new AccesoNoAutorizadoException("No autorizado"));
	}
}
