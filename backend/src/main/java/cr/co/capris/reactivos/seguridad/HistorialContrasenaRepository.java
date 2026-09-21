package cr.co.capris.reactivos.seguridad;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HistorialContrasenaRepository extends JpaRepository<HistorialContrasena, Long> {

	List<HistorialContrasena> findTop5ByUsuario_IdOrderByCreadoEnDesc(Long usuarioId);
}
