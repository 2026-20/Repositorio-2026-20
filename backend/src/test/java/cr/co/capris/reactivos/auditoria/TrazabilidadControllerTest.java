package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.seguridad.SesionNoValidaException;
import cr.co.capris.reactivos.usuario.Empresa;
import cr.co.capris.reactivos.usuario.Rol;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TrazabilidadControllerTest {

    private static final Long EMPRESA_ID = 1L;
    private static final Long USUARIO_ID = 10L;

    @Mock
    private TrazabilidadService trazabilidadService;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private ContextoUsuarioActual contextoUsuarioActual;

    private TrazabilidadController controller;

    @BeforeEach
    void setUp() {
        controller = new TrazabilidadController(trazabilidadService, usuarioRepository, contextoUsuarioActual);
    }

    private Usuario usuarioDePrueba(String nombreCompleto) {
        Usuario usuario = new Usuario(
                nombreCompleto, "1-1111-1111", "persona@capris.cr", "persona", "hash",
                cr.co.capris.reactivos.usuario.EstadoUsuario.ACTIVO,
                new Rol("Usuario de Campo"), new Empresa("CAPRIS Médica"), null);
        ReflectionTestUtils.setField(usuario, "id", USUARIO_ID);
        return usuario;
    }

    // --- registrar ---

    @Test
    void registrarDelegaEnElServicioConElUsuarioYEmpresaDelContexto() {
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(USUARIO_ID);
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);

        OffsetDateTime fecha = OffsetDateTime.now().minusHours(1);
        RegistrarTrazabilidadRequest request = new RegistrarTrazabilidadRequest(
                "idem-abc", TipoAccionTrazabilidad.CONTEO_REGISTRADO, "A1",
                ResultadoAccionTrazabilidad.EXITOSO, "detalle", fecha);

        RegistroTrazabilidad guardado = new RegistroTrazabilidad(
                "idem-abc", TipoAccionTrazabilidad.CONTEO_REGISTRADO, USUARIO_ID, EMPRESA_ID, "A1",
                ResultadoAccionTrazabilidad.EXITOSO, "detalle", fecha);
        when(trazabilidadService.registrar(
                "idem-abc", TipoAccionTrazabilidad.CONTEO_REGISTRADO, USUARIO_ID, EMPRESA_ID, "A1",
                ResultadoAccionTrazabilidad.EXITOSO, "detalle", fecha))
                .thenReturn(guardado);
        when(usuarioRepository.findById(USUARIO_ID)).thenReturn(Optional.of(usuarioDePrueba("Ana Fernández")));

        ResponseEntity<RegistroTrazabilidadResumenDTO> respuesta = controller.registrar(request);

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(respuesta.getBody().usuarioNombre()).isEqualTo("Ana Fernández");
        assertThat(respuesta.getBody().codBod()).isEqualTo("A1");
    }

    @Test
    void registrarSinSesionActivaLanzaSesionNoValida() {
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(null);

        RegistrarTrazabilidadRequest request = new RegistrarTrazabilidadRequest(
                "idem-abc", TipoAccionTrazabilidad.INICIO_SESION, null,
                ResultadoAccionTrazabilidad.EXITOSO, null, OffsetDateTime.now());

        assertThatThrownBy(() -> controller.registrar(request))
                .isInstanceOf(SesionNoValidaException.class);
    }

    // --- listar ---

    @Test
    void listarComoAdministradorDevuelveElDeTodaLaEmpresa() {
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(USUARIO_ID);
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(contextoUsuarioActual.getRol()).thenReturn("Administrador");

        RegistroTrazabilidad registro = new RegistroTrazabilidad(
                "idem-1", TipoAccionTrazabilidad.INICIO_SESION, USUARIO_ID, EMPRESA_ID, null,
                ResultadoAccionTrazabilidad.EXITOSO, null, OffsetDateTime.now());
        when(trazabilidadService.listarPorEmpresa(EMPRESA_ID)).thenReturn(List.of(registro));
        when(usuarioRepository.findById(USUARIO_ID)).thenReturn(Optional.of(usuarioDePrueba("Ana Fernández")));

        List<RegistroTrazabilidadResumenDTO> resultado = controller.listar();

        assertThat(resultado).hasSize(1);
        verify(trazabilidadService).listarPorEmpresa(EMPRESA_ID);
    }

    @Test
    void listarComoUsuarioDeCampoDevuelveSoloLoPropio() {
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(USUARIO_ID);
        when(contextoUsuarioActual.getEmpresaId()).thenReturn(EMPRESA_ID);
        when(contextoUsuarioActual.getRol()).thenReturn("Usuario de Campo");
        when(trazabilidadService.listarPorEmpresaYUsuario(EMPRESA_ID, USUARIO_ID)).thenReturn(List.of());

        List<RegistroTrazabilidadResumenDTO> resultado = controller.listar();

        assertThat(resultado).isEmpty();
        verify(trazabilidadService).listarPorEmpresaYUsuario(EMPRESA_ID, USUARIO_ID);
    }
}
