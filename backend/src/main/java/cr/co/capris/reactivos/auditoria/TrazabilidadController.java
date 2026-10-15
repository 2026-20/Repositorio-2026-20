package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.seguridad.SesionNoValidaException;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * HU-031. Sin PUT ni DELETE a proposito (criterio 5: nadie debe poder
 * modificar ni borrar un registro de trazabilidad) -- el unico verbo de
 * escritura es POST para sincronizar lo que el cliente genero offline.
 *
 * Sin filtro especial de rol: cualquier usuario autenticado puede
 * sincronizar su propia trazabilidad (POST) y consultarla (GET) -- un
 * Administrador ve la de toda su empresa, un Usuario de Campo solo la
 * propia (ver TrazabilidadService).
 */
@RestController
@RequestMapping("/api/auditoria/trazabilidad")
public class TrazabilidadController {

	private final TrazabilidadService trazabilidadService;
	private final UsuarioRepository usuarioRepository;
	private final ContextoUsuarioActual contextoUsuarioActual;

	public TrazabilidadController(
			TrazabilidadService trazabilidadService,
			UsuarioRepository usuarioRepository,
			ContextoUsuarioActual contextoUsuarioActual) {
		this.trazabilidadService = trazabilidadService;
		this.usuarioRepository = usuarioRepository;
		this.contextoUsuarioActual = contextoUsuarioActual;
	}

	@PostMapping
	public ResponseEntity<RegistroTrazabilidadResumenDTO> registrar(@Valid @RequestBody RegistrarTrazabilidadRequest request) {
		Long usuarioId = exigirUsuarioId();
		Long empresaId = exigirEmpresaId();

		RegistroTrazabilidad registro = trazabilidadService.registrar(
				request.idIdempotencia(),
				request.tipoAccion(),
				usuarioId,
				empresaId,
				request.codBod(),
				request.resultado(),
				request.detalle(),
				request.fecha());

		return ResponseEntity.status(HttpStatus.CREATED).body(aDto(registro));
	}

	/** HU-031 criterio 4: solo lectura. Administrador ve toda la empresa; Usuario de Campo, solo lo propio. */
	@GetMapping
	public List<RegistroTrazabilidadResumenDTO> listar() {
		Long usuarioId = exigirUsuarioId();
		Long empresaId = exigirEmpresaId();

		List<RegistroTrazabilidad> registros = "Administrador".equals(contextoUsuarioActual.getRol())
				? trazabilidadService.listarPorEmpresa(empresaId)
				: trazabilidadService.listarPorEmpresaYUsuario(empresaId, usuarioId);

		return registros.stream().map(this::aDto).toList();
	}

	private RegistroTrazabilidadResumenDTO aDto(RegistroTrazabilidad registro) {
		String usuarioNombre = usuarioRepository.findById(registro.getUsuarioId())
				.map(Usuario::getNombreCompleto)
				.orElse(null);
		return RegistroTrazabilidadResumenDTO.desde(registro, usuarioNombre);
	}

	private Long exigirUsuarioId() {
		Long usuarioId = contextoUsuarioActual.getUsuarioId();
		if (usuarioId == null) {
			throw new SesionNoValidaException("No hay sesion activa");
		}
		return usuarioId;
	}

	private Long exigirEmpresaId() {
		Long empresaId = contextoUsuarioActual.getEmpresaId();
		if (empresaId == null) {
			throw new SesionNoValidaException("No hay sesion activa");
		}
		return empresaId;
	}
}
