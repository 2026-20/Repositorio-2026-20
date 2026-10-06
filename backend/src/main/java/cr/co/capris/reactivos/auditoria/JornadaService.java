package cr.co.capris.reactivos.auditoria;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;

/** HU-038. */
@Service
public class JornadaService {

	private final JornadaRepository jornadaRepository;

	public JornadaService(JornadaRepository jornadaRepository) {
		this.jornadaRepository = jornadaRepository;
	}

	/** Idempotente: confirmar el inicio dos veces el mismo dia no crea una segunda fila. */
	@Transactional
	public Jornada iniciar(Long usuarioId, LocalDate fecha) {
		return jornadaRepository.findByUsuarioIdAndFecha(usuarioId, fecha)
				.orElseGet(() -> jornadaRepository.save(new Jornada(usuarioId, fecha, OffsetDateTime.now())));
	}

	public boolean estaIniciada(Long usuarioId, LocalDate fecha) {
		return jornadaRepository.findByUsuarioIdAndFecha(usuarioId, fecha).isPresent();
	}

	public Optional<Jornada> obtener(Long usuarioId, LocalDate fecha) {
		return jornadaRepository.findByUsuarioIdAndFecha(usuarioId, fecha);
	}
}
