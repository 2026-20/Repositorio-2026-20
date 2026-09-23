package cr.co.capris.reactivos.usuario;

import cr.co.capris.reactivos.auth.GeneradorContrasenaTemporal;
import cr.co.capris.reactivos.seguridad.AccesoNoAutorizadoException;
import cr.co.capris.reactivos.seguridad.BitacoraSeguridadService;
import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.seguridad.EmailService;
import cr.co.capris.reactivos.seguridad.SesionNoValidaException;
import cr.co.capris.reactivos.seguridad.TipoEventoSeguridad;
import cr.co.capris.reactivos.seguridad.UsuarioDuplicadoException;
import cr.co.capris.reactivos.seguridad.UsuarioNoEncontradoException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * HU-047: alta de usuario. Cubre el aislamiento multiempresa (HU-023) que
 * AltaUsuarioService.crear() aplica sobre el empresaId del request, y el envio de
 * credenciales iniciales via EmailService (HU-046), incluyendo el camino en que ese
 * envio falla.
 */
@ExtendWith(MockitoExtension.class)
class AltaUsuarioServiceTest {

    private static final Long EMPRESA_ID = 1L;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private RolRepository rolRepository;

    @Mock
    private EmpresaRepository empresaRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private GeneradorContrasenaTemporal generadorContrasenaTemporal;

    @Mock
    private EmailService emailService;

    @Mock
    private BitacoraSeguridadService bitacoraSeguridadService;

    @Mock
    private ContextoUsuarioActual contextoUsuarioActual;

    private AltaUsuarioService altaUsuarioService;

    @BeforeEach
    void setUp() {
        altaUsuarioService = new AltaUsuarioService(
                usuarioRepository, rolRepository, empresaRepository, passwordEncoder,
                generadorContrasenaTemporal, emailService, bitacoraSeguridadService, contextoUsuarioActual);
    }

    private CrearUsuarioRequest requestValido(Long empresaId) {
        return new CrearUsuarioRequest(
                "Ana Fernández Rojas", "1-1111-1111", "ana.fernandez@caprismedica.co.cr",
                "afernandez", 2L, empresaId);
    }

    private void mockearSinDuplicados() {
        when(usuarioRepository.existsByCedula(anyString())).thenReturn(false);
        when(usuarioRepository.existsByCorreo(anyString())).thenReturn(false);
        when(usuarioRepository.existsByUsername(anyString())).thenReturn(false);
    }

    private void mockearRolYEmpresa() {
        when(rolRepository.findById(2L)).thenReturn(Optional.of(new Rol("Usuario de Campo")));
        when(empresaRepository.findById(EMPRESA_ID)).thenReturn(Optional.of(new Empresa("CAPRIS Médica")));
    }

    @Test
    void creaUsuarioConLaEmpresaDelContextoCuandoElRequestNoMandaEmpresaId() {
        mockearSinDuplicados();
        mockearRolYEmpresa();
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(generadorContrasenaTemporal.generar()).thenReturn("Temp0ral!23x");
        when(passwordEncoder.encode("Temp0ral!23x")).thenReturn("hash-bcrypt");

        Usuario creado = altaUsuarioService.crear(requestValido(null));

        assertThat(creado.getNombreCompleto()).isEqualTo("Ana Fernández Rojas");
        assertThat(creado.getUsername()).isEqualTo("afernandez");
        assertThat(creado.getPasswordHash()).isEqualTo("hash-bcrypt");
        assertThat(creado.getEstado()).isEqualTo(EstadoUsuario.PENDIENTE_PRIMER_INGRESO);
        assertThat(creado.getEmpresa().getNombre()).isEqualTo("CAPRIS Médica");

        verify(usuarioRepository).save(creado);
        verify(emailService).enviarCredencialesIniciales(
                "ana.fernandez@caprismedica.co.cr", "Ana Fernández Rojas", "afernandez", "Temp0ral!23x");
    }

    @Test
    void creaUsuarioCuandoElRequestMandaLaMismaEmpresaDelContexto() {
        mockearSinDuplicados();
        mockearRolYEmpresa();
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(generadorContrasenaTemporal.generar()).thenReturn("Temp0ral!23x");
        when(passwordEncoder.encode(anyString())).thenReturn("hash-bcrypt");

        Usuario creado = altaUsuarioService.crear(requestValido(EMPRESA_ID));

        verify(usuarioRepository).save(creado);
    }

    @Test
    void rechazaElAltaCuandoElRequestMandaUnaEmpresaDistintaALaDelContexto() {
        mockearSinDuplicados();
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);

        assertThatThrownBy(() -> altaUsuarioService.crear(requestValido(99L)))
                .isInstanceOf(AccesoNoAutorizadoException.class)
                .hasMessage("No autorizado");

        verifyNoInteractions(rolRepository, empresaRepository, emailService);
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    void rechazaElAltaSinSesionActiva() {
        mockearSinDuplicados();
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(null);

        assertThatThrownBy(() -> altaUsuarioService.crear(requestValido(null)))
                .isInstanceOf(SesionNoValidaException.class)
                .hasMessage("No hay sesion activa");

        verifyNoInteractions(rolRepository, empresaRepository, emailService);
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    void rechazaElAltaCuandoLaCedulaYaExiste() {
        when(usuarioRepository.existsByCedula("1-1111-1111")).thenReturn(true);

        assertThatThrownBy(() -> altaUsuarioService.crear(requestValido(null)))
                .isInstanceOf(UsuarioDuplicadoException.class)
                .hasMessage("Ya existe un usuario con esa cedula");

        verifyNoInteractions(contextoUsuarioActual, rolRepository, empresaRepository, emailService);
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    void rechazaElAltaCuandoElCorreoYaExiste() {
        when(usuarioRepository.existsByCedula(anyString())).thenReturn(false);
        when(usuarioRepository.existsByCorreo("ana.fernandez@caprismedica.co.cr")).thenReturn(true);

        assertThatThrownBy(() -> altaUsuarioService.crear(requestValido(null)))
                .isInstanceOf(UsuarioDuplicadoException.class)
                .hasMessage("Ya existe un usuario con ese correo");

        verify(usuarioRepository, never()).save(any());
    }

    @Test
    void rechazaElAltaCuandoElUsernameYaExiste() {
        when(usuarioRepository.existsByCedula(anyString())).thenReturn(false);
        when(usuarioRepository.existsByCorreo(anyString())).thenReturn(false);
        when(usuarioRepository.existsByUsername("afernandez")).thenReturn(true);

        assertThatThrownBy(() -> altaUsuarioService.crear(requestValido(null)))
                .isInstanceOf(UsuarioDuplicadoException.class)
                .hasMessage("Ya existe un usuario con ese username");

        verify(usuarioRepository, never()).save(any());
    }

    @Test
    void rechazaElAltaCuandoElRolNoExiste() {
        mockearSinDuplicados();
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(rolRepository.findById(2L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> altaUsuarioService.crear(requestValido(null)))
                .isInstanceOf(UsuarioNoEncontradoException.class)
                .hasMessage("El rol indicado no existe");

        verify(usuarioRepository, never()).save(any());
        verifyNoInteractions(emailService);
    }

    @Test
    void rechazaElAltaCuandoLaEmpresaNoExiste() {
        mockearSinDuplicados();
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(rolRepository.findById(2L)).thenReturn(Optional.of(new Rol("Usuario de Campo")));
        when(empresaRepository.findById(EMPRESA_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> altaUsuarioService.crear(requestValido(null)))
                .isInstanceOf(UsuarioNoEncontradoException.class)
                .hasMessage("La empresa indicada no existe");

        verify(usuarioRepository, never()).save(any());
        verifyNoInteractions(emailService);
    }

    @Test
    void elUsuarioQuedaCreadoAunqueFalleElEnvioDelCorreoDeCredenciales() {
        mockearSinDuplicados();
        mockearRolYEmpresa();
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(generadorContrasenaTemporal.generar()).thenReturn("Temp0ral!23x");
        when(passwordEncoder.encode(anyString())).thenReturn("hash-bcrypt");
        doThrow(new RuntimeException("SMTP caido"))
                .when(emailService).enviarCredencialesIniciales(anyString(), anyString(), anyString(), anyString());

        Usuario creado = altaUsuarioService.crear(requestValido(null));

        assertThat(creado).isNotNull();
        verify(usuarioRepository).save(creado);

        ArgumentCaptor<String> detalle = ArgumentCaptor.forClass(String.class);
        verify(bitacoraSeguridadService, times(2)).registrar(
                eq("afernandez"), any(), eq(TipoEventoSeguridad.USUARIO_CREADO), detalle.capture());
        assertThat(detalle.getAllValues().get(1)).contains("Fallo el envio del correo de credenciales iniciales");
    }

    @Test
    void generaLaContrasenaTemporalYLaCodificaAntesDeGuardarElUsuario() {
        mockearSinDuplicados();
        mockearRolYEmpresa();
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(generadorContrasenaTemporal.generar()).thenReturn("Temp0ral!23x");
        when(passwordEncoder.encode("Temp0ral!23x")).thenReturn("hash-bcrypt");

        altaUsuarioService.crear(requestValido(null));

        verify(generadorContrasenaTemporal).generar();
        verify(passwordEncoder).encode("Temp0ral!23x");
    }
}
