package cr.co.capris.reactivos.seguridad;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;

public interface AvisoCaducidadEnviadoRepository extends JpaRepository<AvisoCaducidadEnviado, Long> {

	// HU-050 criterio 5: idempotencia -- si ya existe un aviso para este
	// usuario, tipo y vigencia exacta, no se reenvia.
	boolean existsByUsuarioIdAndTipoAvisoAndPasswordExpiraEn(
			Long usuarioId, TipoAvisoCaducidad tipoAviso, OffsetDateTime passwordExpiraEn);
}
