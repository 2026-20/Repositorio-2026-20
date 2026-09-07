package cr.co.capris.reactivos.seguridad;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TokenRecuperacionRepository extends JpaRepository<TokenRecuperacion, Long> {

	Optional<TokenRecuperacion> findByToken(String token);
}
