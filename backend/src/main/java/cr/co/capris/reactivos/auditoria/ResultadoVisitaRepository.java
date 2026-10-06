package cr.co.capris.reactivos.auditoria;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ResultadoVisitaRepository extends JpaRepository<ResultadoVisita, Long> {

	Optional<ResultadoVisita> findByNumConAndCodBod(String numCon, String codBod);

	// HU-024: "visitas pendientes asignadas a mi usuario" -- filtro por ruta
	// o laboratorio de la HU todavia no esta cubierto, ver javadoc del
	// controller.
	List<ResultadoVisita> findAllByAsignadoAUsuarioId(Long asignadoAUsuarioId);

	// HU-037 criterio 4 ("ruta del dia").
	List<ResultadoVisita> findAllByAsignadoAUsuarioIdAndFechaAsignada(Long asignadoAUsuarioId, LocalDate fechaAsignada);

	List<ResultadoVisita> findAllByEstadoApp(EstadoVisitaApp estadoApp);
}
