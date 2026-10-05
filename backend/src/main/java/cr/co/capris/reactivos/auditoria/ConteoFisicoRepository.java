package cr.co.capris.reactivos.auditoria;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConteoFisicoRepository extends JpaRepository<ConteoFisico, Long> {

	// Clave de idempotencia para sincronizacion offline -- ver javadoc de ConteoFisico.
	Optional<ConteoFisico> findByIdempotenciaKey(String idempotenciaKey);

	// HU-008 (resumen de avance por bodega).
	List<ConteoFisico> findAllByCodBod(String codBod);
}
