package cr.co.capris.reactivos.seguridad;

import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CambioContrasenaServiceTest {

    private static final String CLIENTE = "ip:127.0.0.1";

    @Mock private UsuarioRepository usuarioRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private BitacoraSeguridadService bitacoraSeguridadService;
    @Mock private ValidadorPoliticaContrasena validadorPoliticaContrasena;
    @Mock private BloqueoCuentaService bloqueoCuentaService;
    @Mock private Usuario usuario;

    private CambioContrasenaService service;

    @BeforeEach
    void setUp() {
        service = new CambioContrasenaService(
                usuarioRepository, passwordEncoder, bitacoraSeguridadService,
                validadorPoliticaContrasena, bloqueoCuentaService);
    }

    private void usuarioConIdentidad() {
        when(usuario.getUsername()).thenReturn("nuevo");
        when(usuario.getId()).thenReturn(20L);
    }

    // ---- HU-044 ----

    @Test
    void primerIngresoActualizaEstadoYRegistraBitacora() {
        usuarioConIdentidad();
        when(validadorPoliticaContrasena.validar("Nueva123!")).thenReturn(List.of());
        when(passwordEncoder.encode("Nueva123!")).thenReturn("hash-nuevo");

        service.cambiarEnPrimerIngreso(usuario, "Nueva123!");

        verify(usuario).setPasswordHash("hash-nuevo");
        verify(usuario).setEstado(EstadoUsuario.ACTIVO);
        verify(usuario).setPasswordTemporalExpiraEn(null);
        verify(usuarioRepository).save(usuario);
        verify(bitacoraSeguridadService).registrar(
                "nuevo", 20L, TipoEventoSeguridad.CONTRASENA_CAMBIADA, "Cambio obligatorio de primer ingreso (HU-044)");
    }

    @Test
    void primerIngresoRechazaUnaContrasenaQueNoCumpleLaPoliticaYNoGuardaNada() {
        when(validadorPoliticaContrasena.validar("corta")).thenReturn(List.of("Muy corta"));

        assertThatThrownBy(() -> service.cambiarEnPrimerIngreso(usuario, "corta"))
                .isInstanceOf(ContrasenaNoValidaException.class);

        verify(usuario, never()).setEstado(any(EstadoUsuario.class));
        verify(usuario, never()).setPasswordTemporalExpiraEn(any(OffsetDateTime.class));
        verifyNoInteractions(usuarioRepository, bitacoraSeguridadService);
    }

    // ---- HU-045 ----

    @Test
    void cambioVoluntarioCorrectoGuardaElHashYRegistraBitacora() {
        usuarioConIdentidad();
        when(usuario.getPasswordHash()).thenReturn("hash-actual");
        when(passwordEncoder.matches("Actual123!", "hash-actual")).thenReturn(true);
        when(passwordEncoder.matches("Nueva123!", "hash-actual")).thenReturn(false);
        when(validadorPoliticaContrasena.validar("Nueva123!")).thenReturn(List.of());
        when(passwordEncoder.encode("Nueva123!")).thenReturn("hash-nuevo");

        service.cambiarVoluntariamente(usuario, "Actual123!", "Nueva123!", CLIENTE);

        verify(usuario).setPasswordHash("hash-nuevo");
        verify(usuarioRepository).save(usuario);
        verify(bitacoraSeguridadService).registrar(
                "nuevo", 20L, TipoEventoSeguridad.CONTRASENA_CAMBIADA, "Cambio voluntario de contraseña (HU-045)");
    }

    @Test
    void cambioVoluntarioVerificaPrimeroSiLaCuentaEstaBloqueada() {
        doThrow(new CuentaBloqueadaException("bloqueada", OffsetDateTime.now().plusMinutes(7)))
                .when(bloqueoCuentaService).verificarBloqueo(usuario);

        assertThatThrownBy(() -> service.cambiarVoluntariamente(usuario, "Actual123!", "Nueva123!", CLIENTE))
                .isInstanceOf(CuentaBloqueadaException.class);

        verifyNoInteractions(passwordEncoder, usuarioRepository, bitacoraSeguridadService);
    }

    @Test
    void contrasenaActualIncorrectaCuentaParaElBloqueoYSeRegistraComoCambioFallido() {
        when(usuario.getPasswordHash()).thenReturn("hash-actual");
        when(passwordEncoder.matches("incorrecta", "hash-actual")).thenReturn(false);

        assertThatThrownBy(() -> service.cambiarVoluntariamente(usuario, "incorrecta", "Nueva123!", CLIENTE))
                .isInstanceOf(CredencialesInvalidasException.class);

        verify(bloqueoCuentaService).registrarIntentoFallido(
                usuario, CLIENTE, TipoEventoSeguridad.CAMBIO_CONTRASENA_FALLIDO);
        verify(bloqueoCuentaService, never()).reiniciarIntentosTrasLoginExitoso(any());
        verify(usuario, never()).setPasswordHash(anyString());
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    void elIntentoQueActivaElBloqueoPropagaCuentaBloqueadaEnLugarDeCredencialesInvalidas() {
        when(usuario.getPasswordHash()).thenReturn("hash-actual");
        when(passwordEncoder.matches("incorrecta", "hash-actual")).thenReturn(false);
        doThrow(new CuentaBloqueadaException("bloqueada", OffsetDateTime.now().plusMinutes(7)))
                .when(bloqueoCuentaService)
                .registrarIntentoFallido(usuario, CLIENTE, TipoEventoSeguridad.CAMBIO_CONTRASENA_FALLIDO);

        assertThatThrownBy(() -> service.cambiarVoluntariamente(usuario, "incorrecta", "Nueva123!", CLIENTE))
                .isInstanceOf(CuentaBloqueadaException.class);
    }

    @Test
    void contrasenaActualCorrectaReiniciaLosIntentosFallidosPrevios() {
        usuarioConIdentidad();
        when(usuario.getPasswordHash()).thenReturn("hash-actual");
        when(passwordEncoder.matches("Actual123!", "hash-actual")).thenReturn(true);
        when(passwordEncoder.matches("Nueva123!", "hash-actual")).thenReturn(false);
        when(validadorPoliticaContrasena.validar("Nueva123!")).thenReturn(List.of());
        when(passwordEncoder.encode("Nueva123!")).thenReturn("hash-nuevo");

        service.cambiarVoluntariamente(usuario, "Actual123!", "Nueva123!", CLIENTE);

        InOrder orden = inOrder(bloqueoCuentaService, usuarioRepository);
        orden.verify(bloqueoCuentaService).verificarBloqueo(usuario);
        orden.verify(bloqueoCuentaService).reiniciarIntentosTrasLoginExitoso(usuario);
        orden.verify(usuarioRepository).save(usuario);
    }

    @Test
    void cambioVoluntarioRechazaSiLaNuevaEsIgualALaActualYLoRegistraEnBitacora() {
        usuarioConIdentidad();
        when(usuario.getPasswordHash()).thenReturn("hash-actual");
        when(passwordEncoder.matches("Actual123!", "hash-actual")).thenReturn(true);

        assertThatThrownBy(() -> service.cambiarVoluntariamente(usuario, "Actual123!", "Actual123!", CLIENTE))
                .isInstanceOf(ContrasenaNoValidaException.class);

        verify(bitacoraSeguridadService).registrar(
                eq("nuevo"), eq(20L), eq(TipoEventoSeguridad.CAMBIO_CONTRASENA_FALLIDO), anyString());
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    void cambioVoluntarioRechazaUnaNuevaQueNoCumpleLaPoliticaYLoRegistraEnBitacora() {
        usuarioConIdentidad();
        when(usuario.getPasswordHash()).thenReturn("hash-actual");
        when(passwordEncoder.matches("Actual123!", "hash-actual")).thenReturn(true);
        when(passwordEncoder.matches("corta", "hash-actual")).thenReturn(false);
        when(validadorPoliticaContrasena.validar("corta")).thenReturn(List.of("Muy corta"));

        assertThatThrownBy(() -> service.cambiarVoluntariamente(usuario, "Actual123!", "corta", CLIENTE))
                .isInstanceOf(ContrasenaNoValidaException.class)
                .satisfies(ex -> assertThat(((ContrasenaNoValidaException) ex).getViolaciones())
                        .containsExactly("Muy corta"));

        verify(bitacoraSeguridadService).registrar(
                eq("nuevo"), eq(20L), eq(TipoEventoSeguridad.CAMBIO_CONTRASENA_FALLIDO), anyString());
        verify(usuarioRepository, never()).save(any());
    }
}
