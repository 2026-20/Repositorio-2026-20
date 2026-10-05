package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * HU-005 (registrar) / HU-008 (resumen de avance, consulta basica -- el
 * resumen "en tiempo real sin recargar" que pide el criterio 2 de esa HU
 * es trabajo de frontend una vez tiene esta lista, no de este endpoint).
 *
 * Sin filtro de empresa todavia -- ver SUPUESTO en Bodega.empresaId
 * (HU-004 pendiente de resolver el mapeo cod_org -> empresa).
 */
@RestController
@RequestMapping("/api/auditoria/conteos")
public class ConteoFisicoController {

	private final ConteoFisicoService conteoFisicoService;
	private final ConteoFisicoRepository conteoFisicoRepository;
	private final UsuarioRepository usuarioRepository;
	private final ContextoUsuarioActual contextoUsuarioActual;

	public ConteoFisicoController(
			ConteoFisicoService conteoFisicoService,
			ConteoFisicoRepository conteoFisicoRepository,
			UsuarioRepository usuarioRepository,
			ContextoUsuarioActual contextoUsuarioActual) {
		this.conteoFisicoService = conteoFisicoService;
		this.conteoFisicoRepository = conteoFisicoRepository;
		this.usuarioRepository = usuarioRepository;
		this.contextoUsuarioActual = contextoUsuarioActual;
	}

	@PostMapping
	public ResponseEntity<ConteoFisicoResumenDTO> registrar(@Valid @RequestBody RegistrarConteoRequest request) {
		ConteoFisico conteo = conteoFisicoService.registrar(request, contextoUsuarioActual.getUsuarioId());
		return ResponseEntity.status(HttpStatus.CREATED).body(aDto(conteo));
	}

	/** HU-008: lista de conteos ya registrados en una bodega. */
	@GetMapping
	public List<ConteoFisicoResumenDTO> porBodega(@RequestParam String codBod) {
		return conteoFisicoRepository.findAllByCodBod(codBod).stream()
				.map(this::aDto)
				.toList();
	}

	private ConteoFisicoResumenDTO aDto(ConteoFisico conteo) {
		String usuarioNombre = usuarioRepository.findById(conteo.getUsuarioId())
				.map(Usuario::getNombreCompleto)
				.orElse(null);
		return ConteoFisicoResumenDTO.desde(conteo, usuarioNombre);
	}
}
