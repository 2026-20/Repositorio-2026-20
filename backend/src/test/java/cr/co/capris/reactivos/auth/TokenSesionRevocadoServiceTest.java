package cr.co.capris.reactivos.auth;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenSesionRevocadoServiceTest {

    @Mock
    private TokenSesionRevocadoRepository repository;

    @Mock
    private Claims claims;

    private TokenSesionRevocadoService service;

    @BeforeEach
    void setUp() {
        service = new TokenSesionRevocadoService(repository);
    }

    @Test
    void revocarGuardaElTokenCuandoNoEstabaRevocado() {
        when(claims.getId()).thenReturn("jti-prueba");
        when(claims.getSubject()).thenReturn("3");
        when(claims.getExpiration())
                .thenReturn(Date.from(
                        Instant.now().plusSeconds(3600)
                ));

        when(repository.existsById("jti-prueba"))
                .thenReturn(false);

        service.revocar(claims);

        verify(repository).save(any(TokenSesionRevocado.class));
    }

    @Test
    void revocarNoDuplicaUnTokenYaRevocado() {
        when(claims.getId()).thenReturn("jti-prueba");

        when(repository.existsById("jti-prueba"))
                .thenReturn(true);

        service.revocar(claims);

        verify(repository, never())
                .save(any(TokenSesionRevocado.class));
    }

    @Test
    void estaRevocadoDevuelveTrueSiExiste() {
        when(repository.existsById("jti-prueba"))
                .thenReturn(true);

        boolean resultado =
                service.estaRevocado("jti-prueba");

        assertThat(resultado).isTrue();
    }

    @Test
    void estaRevocadoDevuelveFalseSiJtiEsNull() {
        boolean resultado =
                service.estaRevocado(null);

        assertThat(resultado).isFalse();

        verifyNoInteractions(repository);
    }
}