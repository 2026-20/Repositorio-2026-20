package cr.co.capris.reactivos.usuario;

import cr.co.capris.reactivos.seguridad.AccesoNoAutorizadoException;
import cr.co.capris.reactivos.seguridad.BitacoraSeguridadService;
import cr.co.capris.reactivos.seguridad.BloqueoCuentaService;
import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.seguridad.SesionNoValidaException;
import cr.co.capris.reactivos.seguridad.TipoEventoSeguridad;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Listado/detalle filtrados por empresa (HU-023), alta (HU-047, delegada en
 * AltaUsuarioService) y baja logica/reactivacion/desbloqueo (HU-048).
 */
@ExtendWith(MockitoExtension.class)
class UsuarioControllerTest {

    private static final Long EMPRESA_ID = 1L;
    private static final Long ADMIN_ID = 99L;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private BitacoraSeguridadService bitacoraSeguridadService;

    @Mock
    private ContextoUsuarioActual contextoUsuarioActual;

    @Mock
    private BloqueoCuentaService bloqueoCuentaService;

    @Mock
    private AltaUsuarioService altaUsuarioService;

    private UsuarioController controller;

    @BeforeEach
    void setUp() {
        controller = new UsuarioController(
                usuarioRepository, bitacoraSeguridadService, contextoUsuarioActual, bloqueoCuentaService, altaUsuarioService);
    }

    private Usuario usuarioDePrueba(Long id, EstadoUsuario estado) {
        Usuario usuario = new Usuario(
                "Ana Fernández Rojas", "1-1111-1111", "ana.fernandez@caprismedica.co.cr", "afernandez",
                "hash", estado, new Rol("Usuario de Campo"), new Empresa("CAPRIS Médica"), null);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    // --- crear ---

    @Test
    void crearDelegaEnAltaUsuarioServiceYDevuelve201ConElUsuarioCreado() {
        Usuario creado = usuarioDePrueba(5L, EstadoUsuario.PENDIENTE_PRIMER_INGRESO);
        CrearUsuarioRequest request = new CrearUsuarioRequest(
                "Ana Fernández Rojas", "1-1111-1111", "ana.fernandez@caprismedica.co.cr", "afernandez", 2L, null);
        when(altaUsuarioService.crear(request)).thenReturn(creado);

        ResponseEntity<UsuarioResumenDTO> respuesta = controller.crear(request);

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(respuesta.getBody().username()).isEqualTo("afernandez");
    }

    // --- listar ---

    @Test
    void listarDevuelveSoloLosUsuariosDeLaEmpresaDelContexto() {
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        Usuario usuario = usuarioDePrueba(1L, EstadoUsuario.ACTIVO);
        when(usuarioRepository.findAllByEmpresaId(EMPRESA_ID)).thenReturn(List.of(usuario));

        List<UsuarioResumenDTO> resultado = controller.listar();

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).username()).isEqualTo("afernandez");
    }

    @Test
    void listarSinSesionActivaLanzaSesionNoValida() {
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(null);

        assertThatThrownBy(() -> controller.listar())
                .isInstanceOf(SesionNoValidaException.class);
    }

    // --- detalle ---

    @Test
    void detalleDevuelveElUsuarioCuandoPerteneceALaEmpresaDelContexto() {
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        Usuario usuario = usuarioDePrueba(1L, EstadoUsuario.ACTIVO);
        when(usuarioRepository.findByIdAndEmpresaId(1L, EMPRESA_ID)).thenReturn(Optional.of(usuario));

        UsuarioResumenDTO resultado = controller.detalle(1L);

        assertThat(resultado.username()).isEqualTo("afernandez");
    }

    @Test
    void detalleDeUnUsuarioDeOtraEmpresaLanzaAccesoNoAutorizado() {
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(usuarioRepository.findByIdAndEmpresaId(1L, EMPRESA_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.detalle(1L))
                .isInstanceOf(AccesoNoAutorizadoException.class)
                .hasMessage("No autorizado");
    }

    // --- inactivar ---

    @Test
    void inactivarUnUsuarioActivoLoPasaAInactivoYRegistraElMotivoEnBitacora() {
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(ADMIN_ID);
        Usuario usuario = usuarioDePrueba(1L, EstadoUsuario.ACTIVO);
        when(usuarioRepository.findByIdAndEmpresaId(1L, EMPRESA_ID)).thenReturn(Optional.of(usuario));

        UsuarioResumenDTO resultado = controller.inactivar(1L, new InactivarUsuarioRequest("Renuncia"));

        assertThat(resultado.estado()).isEqualTo("INACTIVO");
        assertThat(usuario.getSesionesInvalidadasDesde()).isNotNull();
        verify(usuarioRepository).save(usuario);
        verify(bitacoraSeguridadService).registrar(
                "afernandez", 1L, TipoEventoSeguridad.USUARIO_INACTIVADO,
                "Inactivado por usuario id=99. Motivo: Renuncia");
    }

    @Test
    void inactivarSinMotivoRegistraNoIndicadoEnBitacora() {
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(ADMIN_ID);
        Usuario usuario = usuarioDePrueba(1L, EstadoUsuario.ACTIVO);
        when(usuarioRepository.findByIdAndEmpresaId(1L, EMPRESA_ID)).thenReturn(Optional.of(usuario));

        controller.inactivar(1L, null);

        verify(bitacoraSeguridadService).registrar(
                "afernandez", 1L, TipoEventoSeguridad.USUARIO_INACTIVADO,
                "Inactivado por usuario id=99. Motivo: no indicado");
    }

    @Test
    void inactivarUnUsuarioYaInactivoEsIdempotenteYNoGeneraBitacora() {
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        Usuario usuario = usuarioDePrueba(1L, EstadoUsuario.INACTIVO);
        when(usuarioRepository.findByIdAndEmpresaId(1L, EMPRESA_ID)).thenReturn(Optional.of(usuario));

        controller.inactivar(1L, null);

        verify(usuarioRepository, never()).save(any());
        verify(bitacoraSeguridadService, never()).registrar(any(), any(), any(), any());
    }

    @Test
    void inactivarUnUsuarioDeOtraEmpresaLanzaAccesoNoAutorizado() {
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(usuarioRepository.findByIdAndEmpresaId(1L, EMPRESA_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.inactivar(1L, null))
                .isInstanceOf(AccesoNoAutorizadoException.class);
    }

    // --- reactivar ---

    @Test
    void reactivarUnUsuarioInactivoLoPasaAActivoYRegistraBitacora() {
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(ADMIN_ID);
        Usuario usuario = usuarioDePrueba(1L, EstadoUsuario.INACTIVO);
        when(usuarioRepository.findByIdAndEmpresaId(1L, EMPRESA_ID)).thenReturn(Optional.of(usuario));

        UsuarioResumenDTO resultado = controller.reactivar(1L);

        assertThat(resultado.estado()).isEqualTo("ACTIVO");
        verify(usuarioRepository).save(usuario);
        verify(bitacoraSeguridadService).registrar(
                "afernandez", 1L, TipoEventoSeguridad.USUARIO_REACTIVADO, "Reactivado por usuario id=99");
    }

    @Test
    void reactivarUnUsuarioYaActivoEsIdempotenteYNoGeneraBitacora() {
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        Usuario usuario = usuarioDePrueba(1L, EstadoUsuario.ACTIVO);
        when(usuarioRepository.findByIdAndEmpresaId(1L, EMPRESA_ID)).thenReturn(Optional.of(usuario));

        controller.reactivar(1L);

        verify(usuarioRepository, never()).save(any());
        verify(bitacoraSeguridadService, never()).registrar(any(), any(), any(), any());
    }

    // --- desbloquear ---

    @Test
    void desbloquearDelegaEnBloqueoCuentaServiceConElAdministradorActual() {
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(ADMIN_ID);
        Usuario usuario = usuarioDePrueba(1L, EstadoUsuario.ACTIVO);
        when(usuarioRepository.findByIdAndEmpresaId(1L, EMPRESA_ID)).thenReturn(Optional.of(usuario));

        controller.desbloquear(1L);

        verify(bloqueoCuentaService, times(1)).desbloquearManualmente(usuario, ADMIN_ID);
    }
}
