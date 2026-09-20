package cr.co.capris.reactivos.seguridad;

import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CambioContrasenaServiceTest {

    @Mock private UsuarioRepository usuarioRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private BitacoraSeguridadService bitacoraSeguridadService;
    @Mock private Usuario usuario;

    private CambioContrasenaService service;

    private void construirServicioSinValidadorHU042() {
        service = new CambioContrasenaService(
                usuarioRepository, passwordEncoder, bitacoraSeguridadService, Optional.empty());
    }

    @Test
    void primerIngresoActualizaEstadoYRegistraBitacora() {
        construirServicioSinValidadorHU042();
        when(passwordEncoder.encode("Nueva123!")).thenReturn("hash-nuevo");
        when(usuario.getUsername()).thenReturn("nuevo");
        when(usuario.getId()).thenReturn(20L);

        service.cambiarEnPrimerIngreso(usuario, "Nueva123!");

        verify(usuario).setPasswordHash("hash-nuevo");
        verify(usuario).setEstado(EstadoUsuario.ACTIVO);
        verify(usuario).setPasswordTemporalExpiraEn(null);
        verify(bitacoraSeguridadService).registrar(
                "nuevo", 20L, TipoEventoSeguridad.CONTRASENA_CAMBIADA, "Cambio obligatorio de primer ingreso (HU-044)");
    }

    @Test
    void cambioVoluntarioRechazaSiLaContrasenaActualNoCoincide() {
        construirServicioSinValidadorHU042();
        when(usuario.getPasswordHash()).thenReturn("hash-actual");
        when(passwordEncoder.matches("incorrecta", "hash-actual")).thenReturn(false);

        assertThatThrownBy(() -> service.cambiarVoluntariamente(usuario, "incorrecta", "Nueva123!"))
                .isInstanceOf(CredencialesInvalidasException.class);
    }

    @Test
    void cambioVoluntarioRechazaSiLaNuevaEsIgualALaActual() {
        construirServicioSinValidadorHU042();
        when(usuario.getPasswordHash()).thenReturn("hash-actual");
        when(passwordEncoder.matches("Actual123!", "hash-actual")).thenReturn(true);
        when(passwordEncoder.matches("Actual123!", "hash-actual")).thenReturn(true);

        assertThatThrownBy(() -> service.cambiarVoluntariamente(usuario, "Actual123!", "Actual123!"))
                .isInstanceOf(ContrasenaNoValidaException.class);
    }
}
