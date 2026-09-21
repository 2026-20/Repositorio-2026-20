package cr.co.capris.reactivos.seguridad;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TokenRecuperacionRepository extends JpaRepository<TokenRecuperacion, Long> {

	Optional<TokenRecuperacion> findByToken(String token);

	List<TokenRecuperacion> findByUsuarioIdAndUsadoFalse(Long usuarioId);

	Optional<TokenRecuperacion> findFirstByUsuarioIdAndUsadoFalseOrderByCreadoEnDesc(Long usuarioId);
}
