package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.seguridad.CambioContrasenaService;
import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.seguridad.UsuarioNoEncontradoException;
import cr.co.capris.reactivos.usuario.Empresa;
import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Rol;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * HU-044 (cambio obligatorio de primer ingreso) y HU-045 (cambio voluntario),
 * ambos con JWT valido -- el controlador resuelve el usuario del contexto y
 * decide que flujo aplica segun su estado; la logica de negocio vive en
 * CambioContrasenaService.
 */
@ExtendWith(MockitoExtension.class)
class CambioContrasenaControllerTest {

    private static final Long USUARIO_ID = 10L;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private ContextoUsuarioActual contextoUsuarioActual;

    @Mock
    private CambioContrasenaService cambioContrasenaService;

    private CambioContrasenaController controller;

    @BeforeEach
    void setUp() {
        controller = new CambioContrasenaController(usuarioRepository, contextoUsuarioActual, cambioContrasenaService);
    }

    private Usuario usuarioConEstado(EstadoUsuario estado) {
        return new Usuario(
                "William Molina", "1-2222-2222", "wmolina@caprismedica.co.cr", "wmolina",
                "hash", estado, new Rol("Administrador"), new Empresa("CAPRIS Médica"), null);
    }

    // --- primer ingreso (HU-044) ---

    @Test
    void cambiarEnPrimerIngresoConUsuarioPendienteDelegaEnElServicio() {
        Usuario usuario = usuarioConEstado(EstadoUsuario.PENDIENTE_PRIMER_INGRESO);
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(USUARIO_ID);
        when(usuarioRepository.findById(USUARIO_ID)).thenReturn(Optional.of(usuario));

        controller.cambiarEnPrimerIngreso(new CambioPasswordPrimerIngresoRequest("Nueva123!"));

        verify(cambioContrasenaService).cambiarEnPrimerIngreso(usuario, "Nueva123!");
    }

    @Test
    void cambiarEnPrimerIngresoConUsuarioQueYaNoEstaPendienteResponde409() {
        Usuario usuario = usuarioConEstado(EstadoUsuario.ACTIVO);
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(USUARIO_ID);
        when(usuarioRepository.findById(USUARIO_ID)).thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> controller.cambiarEnPrimerIngreso(new CambioPasswordPrimerIngresoRequest("Nueva123!")))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void cambiarEnPrimerIngresoSinTokenValidoResponde401() {
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(null);

        assertThatThrownBy(() -> controller.cambiarEnPrimerIngreso(new CambioPasswordPrimerIngresoRequest("Nueva123!")))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void cambiarEnPrimerIngresoConUsuarioInexistenteLanzaUsuarioNoEncontrado() {
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(USUARIO_ID);
        when(usuarioRepository.findById(USUARIO_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.cambiarEnPrimerIngreso(new CambioPasswordPrimerIngresoRequest("Nueva123!")))
                .isInstanceOf(UsuarioNoEncontradoException.class);
    }

    // --- cambio voluntario (HU-045) ---

    @Test
    void cambiarVoluntariamenteConUsuarioActivoDelegaEnElServicio() {
        Usuario usuario = usuarioConEstado(EstadoUsuario.ACTIVO);
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(USUARIO_ID);
        when(usuarioRepository.findById(USUARIO_ID)).thenReturn(Optional.of(usuario));

        controller.cambiarVoluntariamente(new CambioPasswordVoluntarioRequest("Actual123!", "Nueva123!"));

        verify(cambioContrasenaService)
                .cambiarVoluntariamente(usuario, "Actual123!", "Nueva123!", "ip:no-disponible");
    }

    @Test
    void cambiarVoluntariamenteConUsuarioNoActivoResponde409() {
        Usuario usuario = usuarioConEstado(EstadoUsuario.PENDIENTE_PRIMER_INGRESO);
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(USUARIO_ID);
        when(usuarioRepository.findById(USUARIO_ID)).thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> controller.cambiarVoluntariamente(
                new CambioPasswordVoluntarioRequest("Actual123!", "Nueva123!")))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }
}
