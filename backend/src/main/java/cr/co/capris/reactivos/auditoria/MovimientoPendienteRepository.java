package cr.co.capris.reactivos.auditoria;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface MovimientoPendienteRepository extends JpaRepository<MovimientoPendiente, Long> {

	// Los 4 campos juntos identifican la visita -- ver IdentificadorVisita.
	List<MovimientoPendiente> findAllByCodBodVisitaAndFechaVisitaAndHoraVisitaAndSecuenciaVisita(
			String codBodVisita, LocalDate fechaVisita, LocalTime horaVisita, int secuenciaVisita);
}
