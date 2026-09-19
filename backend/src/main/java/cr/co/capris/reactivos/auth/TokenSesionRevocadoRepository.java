package cr.co.capris.reactivos.auth;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TokenSesionRevocadoRepository
        extends JpaRepository<TokenSesionRevocado, String> {
}
