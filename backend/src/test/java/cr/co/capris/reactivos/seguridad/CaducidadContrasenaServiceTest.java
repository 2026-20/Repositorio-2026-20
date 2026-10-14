package cr.co.capris.reactivos.seguridad;

import cr.co.capris.reactivos.usuario.Usuario;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CaducidadContrasenaServiceTest {

    private static final Instant AHORA = Instant.parse("2026-10-12T12:00:00Z");

    @Mock
    private Usuario usuario;
    private CaducidadContrasenaService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(AHORA, ZoneOffset.UTC);
        service = new CaducidadContrasenaService(clock);
    }

    @Test
    void contrasenaSinFechaDeExpiracionNoEstaVencida() {
        when(usuario.getPasswordExpiraEn()).thenReturn(null);
        assertThat(service.estaVencida(usuario)).isFalse();
    }

    @Test
    void contrasenaConFechaFuturaNoEstaVencida() {
        when(usuario.getPasswordExpiraEn())
                .thenReturn(OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC).plusDays(1));
        assertThat(service.estaVencida(usuario)).isFalse();
    }

    @Test
    void contrasenaQueExpiraExactamenteAhoraEstaVencida() {
        when(usuario.getPasswordExpiraEn())
                .thenReturn(OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC));
        assertThat(service.estaVencida(usuario)).isTrue();
    }

    @Test
    void contrasenaConFechaPasadaEstaVencida() {
        when(usuario.getPasswordExpiraEn())
                .thenReturn(OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC).minusDays(1));
        assertThat(service.estaVencida(usuario)).isTrue();
    }

    @Test
    void reiniciarVigenciaEstableceExactamenteTreintaDias() {
        OffsetDateTime fechaEsperada = OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC).plusDays(30);
        service.reiniciarVigencia(usuario);
        verify(usuario).setPasswordExpiraEn(fechaEsperada);
    }
}
