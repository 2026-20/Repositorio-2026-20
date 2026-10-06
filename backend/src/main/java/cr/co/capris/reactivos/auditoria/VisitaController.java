package cr.co.capris.reactivos.auditoria;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * HU-024 (consultar) / HU-008 (resumen de avance se arma del lado del
 * frontend combinando esto con /api/auditoria/conteos) / HU-037 (asignar,
 * stopgap manual -- ver SUPUESTO en Bodega sobre codUsu: el ERP todavia no
 * manda la asignacion real de rutas en ningun XML de este modulo).
 *
 * NO cubierto todavia (para quien implemente HU-024/HU-008/HU-037 a fondo):
 *   - Filtro por ruta o laboratorio (HU-024 criterio 3) -- solo hay filtro
 *     por asignadoAUsuarioId (+fecha opcional) y por estadoApp.
 *   - "Confirmacion antes de reemplazar contexto" (HU-004 criterio 3) --
 *     eso es logica de UI/sesion, no de este endpoint.
 *   - Sin filtro de empresa -- ver SUPUESTO en Bodega.empresaId.
 *   - Reemplazar esta asignacion manual por la real del ERP cuando se
 *     confirme el formato -- el cambio deberia quedar acotado a como
 *     AuditoriaIngestaService llena asignadoAUsuarioId/fechaAsignada, sin
 *     tocar el resto (GET/estado siguen igual).
 */
@RestController
@RequestMapping("/api/auditoria/visitas")
public class VisitaController {

	private final ResultadoVisitaRepository resultadoVisitaRepository;

	public VisitaController(ResultadoVisitaRepository resultadoVisitaRepository) {
		this.resultadoVisitaRepository = resultadoVisitaRepository;
	}

	@GetMapping
	public List<VisitaResumenDTO> listar(
			@RequestParam(required = false) Long asignadoAUsuarioId,
			@RequestParam(required = false) LocalDate fecha,
			@RequestParam(required = false) EstadoVisitaApp estadoApp) {
		List<ResultadoVisita> visitas;
		if (asignadoAUsuarioId != null && fecha != null) {
			// HU-037 criterio 4: "la ruta del dia".
			visitas = resultadoVisitaRepository.findAllByAsignadoAUsuarioIdAndFechaAsignada(asignadoAUsuarioId, fecha);
		} else if (asignadoAUsuarioId != null) {
			visitas = resultadoVisitaRepository.findAllByAsignadoAUsuarioId(asignadoAUsuarioId);
		} else if (estadoApp != null) {
			visitas = resultadoVisitaRepository.findAllByEstadoApp(estadoApp);
		} else {
			visitas = resultadoVisitaRepository.findAll();
		}
		return visitas.stream().map(VisitaResumenDTO::desde).toList();
	}

	/** HU-024/HU-008: mover una visita entre Pendiente/En progreso/Finalizada. */
	@PatchMapping("/{numCon}/{codBod}/estado")
	public ResponseEntity<VisitaResumenDTO> cambiarEstado(
			@PathVariable String numCon,
			@PathVariable String codBod,
			@Valid @RequestBody CambiarEstadoVisitaRequest request) {
		Optional<ResultadoVisita> visita = resultadoVisitaRepository.findByNumConAndCodBod(numCon, codBod);
		if (visita.isEmpty()) {
			return ResponseEntity.notFound().build();
		}
		visita.get().setEstadoApp(request.estadoApp());
		resultadoVisitaRepository.save(visita.get());
		return ResponseEntity.ok(VisitaResumenDTO.desde(visita.get()));
	}

	/**
	 * HU-037 (stopgap manual): un Administrador asigna esta visita a un
	 * Usuario de Campo para una fecha (hoy por defecto). Restringido a
	 * Administrador en SecurityConfig, igual que el resto de altas/bajas de
	 * usuario.
	 */
	@PatchMapping("/{numCon}/{codBod}/asignacion")
	public ResponseEntity<VisitaResumenDTO> asignar(
			@PathVariable String numCon,
			@PathVariable String codBod,
			@Valid @RequestBody AsignarVisitaRequest request) {
		Optional<ResultadoVisita> visita = resultadoVisitaRepository.findByNumConAndCodBod(numCon, codBod);
		if (visita.isEmpty()) {
			return ResponseEntity.notFound().build();
		}
		LocalDate fecha = request.fecha() != null ? request.fecha() : LocalDate.now();
		visita.get().asignar(request.usuarioId(), fecha);
		resultadoVisitaRepository.save(visita.get());
		return ResponseEntity.ok(VisitaResumenDTO.desde(visita.get()));
	}
}
