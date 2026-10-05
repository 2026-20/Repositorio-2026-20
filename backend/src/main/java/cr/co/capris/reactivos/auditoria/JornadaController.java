package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/** HU-038. */
@RestController
public class JornadaController {

	private final JornadaService jornadaService;
	private final ContextoUsuarioActual contextoUsuarioActual;

	public JornadaController(JornadaService jornadaService, ContextoUsuarioActual contextoUsuarioActual) {
		this.jornadaService = jornadaService;
		this.contextoUsuarioActual = contextoUsuarioActual;
	}

	@PostMapping("/api/auditoria/jornadas/iniciar")
	public JornadaEstadoDTO iniciar() {
		Jornada jornada = jornadaService.iniciar(contextoUsuarioActual.getUsuarioId(), LocalDate.now());
		return new JornadaEstadoDTO(true, jornada.getIniciadaEn());
	}

	@GetMapping("/api/auditoria/jornadas/hoy")
	public JornadaEstadoDTO hoy() {
		return jornadaService.obtener(contextoUsuarioActual.getUsuarioId(), LocalDate.now())
				.map(jornada -> new JornadaEstadoDTO(true, jornada.getIniciadaEn()))
				.orElseGet(() -> new JornadaEstadoDTO(false, null));
	}
}
