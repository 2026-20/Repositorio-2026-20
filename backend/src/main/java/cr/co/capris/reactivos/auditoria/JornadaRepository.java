package cr.co.capris.reactivos.auditoria;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface JornadaRepository extends JpaRepository<Jornada, Long> {

	Optional<Jornada> findByUsuarioIdAndFecha(Long usuarioId, LocalDate fecha);
}
