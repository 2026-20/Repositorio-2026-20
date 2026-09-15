package cr.co.capris.reactivos.auth;

import io.jsonwebtoken.Claims;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Service
public class TokenSesionRevocadoService {

    private final TokenSesionRevocadoRepository repository;

    public TokenSesionRevocadoService(
            TokenSesionRevocadoRepository repository
    ) {
        this.repository = repository;
    }

    public void revocar(Claims claims) {
        String jti = claims.getId();

        if (jti == null || repository.existsById(jti)) {
            return;
        }

        Long usuarioId =
                Long.valueOf(claims.getSubject());

        OffsetDateTime expiraEn =
                claims.getExpiration()
                        .toInstant()
                        .atOffset(ZoneOffset.UTC);

        TokenSesionRevocado tokenRevocado =
                new TokenSesionRevocado(
                        jti,
                        usuarioId,
                        OffsetDateTime.now(ZoneOffset.UTC),
                        expiraEn
                );

        repository.save(tokenRevocado);
    }

    public boolean estaRevocado(String jti) {
        return jti != null &&
                repository.existsById(jti);
    }
}