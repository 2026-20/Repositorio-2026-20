package cr.co.capris.reactivos.auditoria;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface LoteMovimientoRepository extends JpaRepository<LoteMovimiento, Long> {

	List<LoteMovimiento> findAllByCodBodVisitaAndFechaVisitaAndHoraVisitaAndSecuenciaVisita(
			String codBodVisita, LocalDate fechaVisita, LocalTime horaVisita, int secuenciaVisita);
}
