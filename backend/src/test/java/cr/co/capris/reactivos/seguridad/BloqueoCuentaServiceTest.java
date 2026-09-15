package cr.co.capris.reactivos.seguridad;

import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BloqueoCuentaServiceTest {

    private static final Instant AHORA = Instant.parse("2026-09-15T15:00:00Z");

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private BitacoraSeguridadService bitacoraSeguridadService;

    @Mock
    private Usuario usuario;

    private BloqueoCuentaService bloqueoCuentaService;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(AHORA, ZoneOffset.UTC);
        bloqueoCuentaService = new BloqueoCuentaService(usuarioRepository, bitacoraSeguridadService, clock);
    }

    @Test
    void primerIntentoFallidoIncrementaContadorAUno() {

        when(usuario.getIntentosFallidos()).thenReturn(0);
        when(usuario.getUsername()).thenReturn("wmolina");
        when(usuario.getId()).thenReturn(10L);

        bloqueoCuentaService.registrarIntentoFallido(usuario, "ip:127.0.0.1");

        verify(usuario).setIntentosFallidos(1);
        verify(usuarioRepository).save(usuario);
        verify(usuario, never()).setBloqueadoHasta(any(OffsetDateTime.class));
        verify(bitacoraSeguridadService).registrar("wmolina", 10L, TipoEventoSeguridad.LOGIN_FALLIDO,
                        "numeroIntento=1; identificadorCliente=ip:127.0.0.1; bloqueoActivado=false");
    }

    @Test
    void segundoIntentoFallidoIncrementaContadorADos() {

        when(usuario.getIntentosFallidos()).thenReturn(1);
        when(usuario.getUsername()).thenReturn("wmolina");
        when(usuario.getId()).thenReturn(10L);

        bloqueoCuentaService.registrarIntentoFallido(usuario, "ip:127.0.0.1");

        verify(usuario).setIntentosFallidos(2);
        verify(usuarioRepository).save(usuario);
        verify(bitacoraSeguridadService).registrar(
                        "wmolina",
                        10L,
                        TipoEventoSeguridad.LOGIN_FALLIDO,
                        "numeroIntento=2; identificadorCliente=ip:127.0.0.1; bloqueoActivado=false");
        verify(usuario, never()).setBloqueadoHasta(any(OffsetDateTime.class));
    }

    @Test
    void tercerIntentoFallidoIncrementaContadorATres() {

        when(usuario.getIntentosFallidos()).thenReturn(2);
        when(usuario.getUsername()).thenReturn("wmolina");
        when(usuario.getId()).thenReturn(10L);

        bloqueoCuentaService.registrarIntentoFallido(usuario, "ip:127.0.0.1");

        verify(usuario).setIntentosFallidos(3);
        verify(usuarioRepository).save(usuario);
        verify(bitacoraSeguridadService).registrar(
                        "wmolina",
                        10L,
                        TipoEventoSeguridad.LOGIN_FALLIDO,
                        "numeroIntento=3; identificadorCliente=ip:127.0.0.1; bloqueoActivado=false");
        verify(usuario, never()).setBloqueadoHasta(any(OffsetDateTime.class));
    }

    @Test
    void cuartoIntentoFallidoBloqueaCuentaDuranteSieteMinutos() {

        when(usuario.getIntentosFallidos()).thenReturn(3);
        when(usuario.getUsername()).thenReturn("wmolina");
        when(usuario.getId()).thenReturn(10L);

        OffsetDateTime bloqueoEsperado = OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC).plusMinutes(7);

        assertThatThrownBy(() -> bloqueoCuentaService.registrarIntentoFallido(usuario, "ip:127.0.0.1"))
                .isInstanceOf(CuentaBloqueadaException.class)
                .hasMessage(BloqueoCuentaService.MENSAJE_BLOQUEO);

        verify(usuario).setIntentosFallidos(4);
        verify(usuario).setBloqueadoHasta(bloqueoEsperado);
        verify(usuarioRepository).save(usuario);
        verify(bitacoraSeguridadService).registrar(
                        "wmolina",
                        10L,
                        TipoEventoSeguridad.LOGIN_FALLIDO,
                        "numeroIntento=4; identificadorCliente=ip:127.0.0.1; bloqueoActivado=true");

        verify(bitacoraSeguridadService).registrar(
                        "wmolina",
                        10L,
                        TipoEventoSeguridad.CUENTA_BLOQUEADA,
                        "Bloqueo automático hasta %s; identificadorCliente=ip:127.0.0.1"
                                .formatted(bloqueoEsperado));
    }

    @Test
    void cuentaPermaneceBloqueadaAntesDeCumplirseSieteMinutos() {

        OffsetDateTime bloqueadoHasta = OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC).plusMinutes(7);

        when(usuario.getBloqueadoHasta()).thenReturn(bloqueadoHasta);

        assertThatThrownBy(() -> bloqueoCuentaService.verificarBloqueo(usuario))
                .isInstanceOf(CuentaBloqueadaException.class)
                .hasMessage(BloqueoCuentaService.MENSAJE_BLOQUEO);

        verify(usuarioRepository, never()).save(usuario);
    }

    @Test
    void alCumplirseExactamenteSieteMinutosSeDesbloqueaCuenta() {

        Instant sieteMinutosDespues = AHORA.plusSeconds(7 * 60);

        Clock clockSieteMinutosDespues = Clock.fixed(sieteMinutosDespues, ZoneOffset.UTC);

        BloqueoCuentaService service = new BloqueoCuentaService(usuarioRepository, bitacoraSeguridadService, clockSieteMinutosDespues);

        OffsetDateTime bloqueadoHasta = OffsetDateTime.ofInstant(sieteMinutosDespues, ZoneOffset.UTC);

        when(usuario.getBloqueadoHasta()).thenReturn(bloqueadoHasta);

        service.verificarBloqueo(usuario);

        verify(usuario).setIntentosFallidos(0);
        verify(usuario).setBloqueadoHasta(null);
        verify(usuarioRepository).save(usuario);
    }

    @Test
    void loginExitosoReiniciaIntentosFallidos() {

        when(usuario.getIntentosFallidos()).thenReturn(2);

        bloqueoCuentaService.reiniciarIntentosTrasLoginExitoso(usuario);

        verify(usuario).setIntentosFallidos(0);
        verify(usuario).setBloqueadoHasta(null);
        verify(usuarioRepository).save(usuario);
    }

    @Test
    void loginExitosoSinIntentosPreviosNoRealizaCambios() {

        when(usuario.getIntentosFallidos()).thenReturn(0);
        when(usuario.getBloqueadoHasta()).thenReturn(null);

        bloqueoCuentaService.reiniciarIntentosTrasLoginExitoso(usuario);

        verify(usuarioRepository, never()).save(usuario);
    }

    @Test
    void administradorPuedeDesbloquearCuentaManualmente() {

        when(usuario.getUsername()).thenReturn("wmolina");
        when(usuario.getId()).thenReturn(10L);

        bloqueoCuentaService.desbloquearManualmente(usuario, 99L);

        verify(usuario).setIntentosFallidos(0);
        verify(usuario).setBloqueadoHasta(null);
        verify(usuarioRepository).save(usuario);
        verify(bitacoraSeguridadService).registrar(
                        "wmolina",
                        10L,
                        TipoEventoSeguridad.CUENTA_DESBLOQUEADA,
                        "Desbloqueo manual realizado por administrador id=99");
    }
}