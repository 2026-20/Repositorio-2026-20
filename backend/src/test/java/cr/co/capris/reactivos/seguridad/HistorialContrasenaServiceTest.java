package cr.co.capris.reactivos.seguridad;

import cr.co.capris.reactivos.usuario.Usuario;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * HU-044/045/046: ninguna de las HU que cambian contraseña debe permitir
 * reutilizar la actual ni ninguna de las ultimas 5.
 */
@ExtendWith(MockitoExtension.class)
class HistorialContrasenaServiceTest {

    @Mock
    private HistorialContrasenaRepository historialContrasenaRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private Usuario usuario;

    private HistorialContrasenaService service;

    @BeforeEach
    void setUp() {
        service = new HistorialContrasenaService(historialContrasenaRepository, passwordEncoder);
    }

    @Test
    void fueUsadaRecientementeEsTrueCuandoCoincideConLaContrasenaActual() {
        when(usuario.getPasswordHash()).thenReturn("hash-actual");
        when(passwordEncoder.matches("Nueva123!", "hash-actual")).thenReturn(true);

        assertThat(service.fueUsadaRecientemente(usuario, "Nueva123!")).isTrue();

        verify(historialContrasenaRepository, org.mockito.Mockito.never())
                .findTop5ByUsuario_IdOrderByCreadoEnDesc(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void fueUsadaRecientementeEsTrueCuandoCoincideConUnaDeLasUltimasCinco() {
        when(usuario.getId()).thenReturn(10L);
        when(usuario.getPasswordHash()).thenReturn("hash-actual");
        when(passwordEncoder.matches("Nueva123!", "hash-actual")).thenReturn(false);

        HistorialContrasena anterior = new HistorialContrasena(usuario, "hash-viejo", null);
        when(historialContrasenaRepository.findTop5ByUsuario_IdOrderByCreadoEnDesc(10L))
                .thenReturn(List.of(anterior));
        when(passwordEncoder.matches("Nueva123!", "hash-viejo")).thenReturn(true);

        assertThat(service.fueUsadaRecientemente(usuario, "Nueva123!")).isTrue();
    }

    @Test
    void fueUsadaRecientementeEsFalseCuandoLaContrasenaEsRealmenteNueva() {
        when(usuario.getId()).thenReturn(10L);
        when(usuario.getPasswordHash()).thenReturn("hash-actual");
        when(passwordEncoder.matches("Nueva123!", "hash-actual")).thenReturn(false);
        when(historialContrasenaRepository.findTop5ByUsuario_IdOrderByCreadoEnDesc(10L))
                .thenReturn(List.of());

        assertThat(service.fueUsadaRecientemente(usuario, "Nueva123!")).isFalse();
    }

    @Test
    void registrarContrasenaReemplazadaGuardaElHashActualAntesDeSobreescribirlo() {
        when(usuario.getPasswordHash()).thenReturn("hash-a-conservar");

        service.registrarContrasenaReemplazada(usuario);

        ArgumentCaptor<HistorialContrasena> captor = ArgumentCaptor.forClass(HistorialContrasena.class);
        verify(historialContrasenaRepository).save(captor.capture());
        assertThat(captor.getValue().getUsuario()).isEqualTo(usuario);
        assertThat(captor.getValue().getPasswordHash()).isEqualTo("hash-a-conservar");
    }
}
