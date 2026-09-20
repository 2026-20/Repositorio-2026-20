package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.seguridad.CredencialesInvalidasException;
import cr.co.capris.reactivos.seguridad.CuentaBloqueadaException;
import cr.co.capris.reactivos.usuario.Empresa;
import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Rol;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import cr.co.capris.reactivos.seguridad.BloqueoCuentaService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;

@ExtendWith(MockitoExtension.class)
class AutenticacionControllerTest {
    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private Usuario usuario;

    @Mock
    private Empresa empresa;

    @Mock
    private Rol rol;

    @Mock
    private BloqueoCuentaService bloqueoCuentaService;

    private AutenticacionController controller;

    @BeforeEach
    void setUp() {
        controller = new AutenticacionController(
                usuarioRepository,
                passwordEncoder,
                jwtService,
                bloqueoCuentaService
        );
    }

    // Prueba de Usuario inexistente
    @Test
    void loginConUsuarioInexistenteLanzaCredencialesInvalidas() {

        LoginRequest request =
                new LoginRequest("noexiste", "Clave123!", 1L);
        when(usuarioRepository.findByUsername("noexiste"))
                .thenReturn(Optional.empty());
        assertThatThrownBy(() -> controller.login(request))
                .isInstanceOf(CredencialesInvalidasException.class);
        verify(bloqueoCuentaService)
                .registrarIntentoUsuarioInexistente(eq("noexiste"), anyString());
    }

    // Prueba de mitigacion de enumeracion de usuarios por tiempo de respuesta:
    // aunque el usuario no exista, passwordEncoder.matches(...) debe correr igual
    // (contra el hash senuelo), para que este camino no responda mas rapido que
    // uno con usuario real -- ver comentario de HASH_SENUELO en el controller.
    @Test
    void loginConUsuarioInexistenteCorrePasswordEncoderParaIgualarTiempos() {

        LoginRequest request =
                new LoginRequest("noexiste", "cualquiera", 1L);
        when(usuarioRepository.findByUsername("noexiste"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.login(request))
                .isInstanceOf(CredencialesInvalidasException.class);

        verify(passwordEncoder).matches(eq("cualquiera"), anyString());
    }

    // Mismo caso pero para el camino de empresa incorrecta -- tambien debe correr
    // passwordEncoder.matches(...) antes de rechazar, no solo el camino de usuario
    // inexistente.
    @Test
    void loginConEmpresaIncorrectaCorrePasswordEncoderParaIgualarTiempos() {

        LoginRequest request =
                new LoginRequest("wmolina", "cualquiera", 99L);
        when(usuarioRepository.findByUsername("wmolina"))
                .thenReturn(Optional.of(usuario));
        when(usuario.getEmpresa())
                .thenReturn(empresa);
        when(empresa.getId())
                .thenReturn(1L);
        when(usuario.getPasswordHash())
                .thenReturn("hash-prueba");

        assertThatThrownBy(() -> controller.login(request))
                .isInstanceOf(CredencialesInvalidasException.class);

        verify(passwordEncoder).matches("cualquiera", "hash-prueba");
    }

    //Prueba de usuario inactivo
    @Test
    void loginConUsuarioInactivoLanzaCredencialesInvalidas() {

        LoginRequest request =
                new LoginRequest("wmolina", "Capris2026!", 1L);
        when(usuarioRepository.findByUsername("wmolina"))
                .thenReturn(Optional.of(usuario));
        when(usuario.getEstado())
                .thenReturn(EstadoUsuario.INACTIVO);
        assertThatThrownBy(() -> controller.login(request))
                .isInstanceOf(CredencialesInvalidasException.class);
    }

    //Prueba empresa incorrecta
    @Test
    void loginConEmpresaIncorrectaLanzaCredencialesInvalidas() {

        LoginRequest request =
                new LoginRequest("wmolina", "Capris2026!", 99L);
        when(usuarioRepository.findByUsername("wmolina"))
                .thenReturn(Optional.of(usuario));
        when(usuario.getEstado())
                .thenReturn(EstadoUsuario.ACTIVO);
        when(usuario.getEmpresa())
                .thenReturn(empresa);
        when(empresa.getId())
                .thenReturn(1L);
        assertThatThrownBy(() -> controller.login(request))
                .isInstanceOf(CredencialesInvalidasException.class);
    }

    //Prueba Contraseña Incorrecta
    @Test
    void loginConContrasenaIncorrectaLanzaCredencialesInvalidas() {

        LoginRequest request =
                new LoginRequest("wmolina", "incorrecta", 1L);
        when(usuarioRepository.findByUsername("wmolina"))
                .thenReturn(Optional.of(usuario));
        when(usuario.getEstado())
                .thenReturn(EstadoUsuario.ACTIVO);
        when(usuario.getEmpresa())
                .thenReturn(empresa);
        when(empresa.getId())
                .thenReturn(1L);
        when(usuario.getPasswordHash())
                .thenReturn("hash-prueba");
        when(passwordEncoder.matches("incorrecta", "hash-prueba"))
                .thenReturn(false);
        assertThatThrownBy(() -> controller.login(request))
                .isInstanceOf(CredencialesInvalidasException.class);
        verify(bloqueoCuentaService).registrarIntentoFallido(eq(usuario), anyString());
    }

    //Prueba cuenta bloqueada
    @Test
    void loginConCuentaBloqueadaLanzaCuentaBloqueadaException() {

        LoginRequest request = new LoginRequest("wmolina", "Capris2026!", 1L);

        OffsetDateTime bloqueadoHasta = OffsetDateTime.now().plusMinutes(5);

        when(usuarioRepository.findByUsername("wmolina")).thenReturn(Optional.of(usuario));

        doThrow(
                new CuentaBloqueadaException(BloqueoCuentaService.MENSAJE_BLOQUEO, bloqueadoHasta)
        )
                .when(bloqueoCuentaService).verificarBloqueo(usuario);

        assertThatThrownBy(() ->
                controller.login(request)).isInstanceOf(CuentaBloqueadaException.class);
    }

    //Prueba de login exitoso
    @Test
    void loginCorrectoDevuelveTokenYDatosDelUsuario() {

        LoginRequest request =
                new LoginRequest("wmolina", "Capris2026!", 1L);
        when(usuarioRepository.findByUsername("wmolina"))
                .thenReturn(Optional.of(usuario));
        when(usuario.getEstado())
                .thenReturn(EstadoUsuario.ACTIVO);
        when(usuario.getEmpresa())
                .thenReturn(empresa);
        when(empresa.getId())
                .thenReturn(1L);
        when(usuario.getPasswordHash())
                .thenReturn("hash-prueba");
        when(passwordEncoder.matches("Capris2026!", "hash-prueba"))
                .thenReturn(true);
        when(usuario.getId())
                .thenReturn(10L);
        when(usuario.getNombreCompleto())
                .thenReturn("William Molina");
        when(usuario.getRol())
                .thenReturn(rol);
        when(rol.getNombre())
                .thenReturn("Administrador");
        when(jwtService.generar(10L, 1L, "Administrador"))
                .thenReturn("jwt-prueba");
        LoginResponse respuesta = controller.login(request);
        assertThat(respuesta.token())
                .isEqualTo("jwt-prueba");
        assertThat(respuesta.usuarioId())
                .isEqualTo(10L);
        assertThat(respuesta.nombreCompleto())
                .isEqualTo("William Molina");
        assertThat(respuesta.rol())
                .isEqualTo("Administrador");
        assertThat(respuesta.debeCambiarContrasena())
                .isFalse();
        verify(bloqueoCuentaService).reiniciarIntentosTrasLoginExitoso(usuario);
    }

    //Prueba contraseña temporal vencida
    @Test
    void loginConContrasenaTemporalVencidaLanzaCredencialesInvalidas() {

        LoginRequest request =
                new LoginRequest("nuevo", "Temporal123!", 1L);
        when(usuarioRepository.findByUsername("nuevo"))
                .thenReturn(Optional.of(usuario));
        when(usuario.getEstado())
                .thenReturn(EstadoUsuario.PENDIENTE_PRIMER_INGRESO);
        when(usuario.getEmpresa())
                .thenReturn(empresa);
        when(empresa.getId())
                .thenReturn(1L);
        when(usuario.getPasswordHash())
                .thenReturn("hash-prueba");
        when(passwordEncoder.matches("Temporal123!", "hash-prueba"))
                .thenReturn(true);
        when(usuario.getPasswordTemporalExpiraEn())
                .thenReturn(OffsetDateTime.now().minusHours(1));
        assertThatThrownBy(() -> controller.login(request))
                .isInstanceOf(CredencialesInvalidasException.class);
    }

    //Prueba primer ingreso valido
    @Test
    void primerIngresoVigenteIndicaQueDebeCambiarContrasena() {

        LoginRequest request =
                new LoginRequest("nuevo", "Temporal123!", 1L);
        when(usuarioRepository.findByUsername("nuevo"))
                .thenReturn(Optional.of(usuario));
        when(usuario.getEstado())
                .thenReturn(EstadoUsuario.PENDIENTE_PRIMER_INGRESO);
        when(usuario.getEmpresa())
                .thenReturn(empresa);
        when(empresa.getId())
                .thenReturn(1L);
        when(usuario.getPasswordHash())
                .thenReturn("hash-prueba");
        when(passwordEncoder.matches("Temporal123!", "hash-prueba"))
                .thenReturn(true);
        when(usuario.getPasswordTemporalExpiraEn())
                .thenReturn(OffsetDateTime.now().plusHours(10));
        when(usuario.getId())
                .thenReturn(20L);
        when(usuario.getNombreCompleto())
                .thenReturn("Usuario Nuevo");
        when(usuario.getRol())
                .thenReturn(rol);
        when(rol.getNombre())
                .thenReturn("Usuario de Campo");
        when(jwtService.generar(20L, 1L, "Usuario de Campo"))
                .thenReturn("jwt-prueba");
        LoginResponse respuesta = controller.login(request);
        assertThat(respuesta.debeCambiarContrasena())
                .isTrue();
        verify(bloqueoCuentaService).reiniciarIntentosTrasLoginExitoso(usuario);
    }
}
