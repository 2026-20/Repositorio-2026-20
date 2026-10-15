package cr.co.capris.reactivos.auditoria;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RegistroTrazabilidadRepository extends JpaRepository<RegistroTrazabilidad, Long> {

	// Clave de idempotencia para sincronizacion offline -- ver javadoc de RegistroTrazabilidad.
	Optional<RegistroTrazabilidad> findByIdIdempotencia(String idIdempotencia);

	// HU-031 criterio 4: un Administrador ve el log completo de su empresa.
	List<RegistroTrazabilidad> findAllByEmpresaIdOrderByFechaDesc(Long empresaId);

	// HU-031 criterio 4: un Usuario de Campo ve solo su propia actividad.
	List<RegistroTrazabilidad> findAllByEmpresaIdAndUsuarioIdOrderByFechaDesc(Long empresaId, Long usuarioId);
}
