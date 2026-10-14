package cr.co.capris.reactivos.seguridad;

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
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** HU-050: avisos de vencimiento proximo de contraseña (5/3/1 dias, criterios 1-3 y 5). */
@ExtendWith(MockitoExtension.class)
class AvisoCaducidadContrasenaServiceTest {

    // Mediodia UTC para que restar/sumar dias no cruce un cambio de fecha
    // por husos horarios al convertir a LocalDate.
    private static final Instant AHORA = Instant.parse("2026-11-10T12:00:00Z");

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private AvisoCaducidadEnviadoRepository avisoCaducidadEnviadoRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private BitacoraSeguridadService bitacoraSeguridadService;

    private AvisoCaducidadContrasenaService service;

    @BeforeEach
    void configurar() {
        Clock clock = Clock.fixed(AHORA, ZoneOffset.UTC);
        service = new AvisoCaducidadContrasenaService(
                usuarioRepository, avisoCaducidadEnviadoRepository, emailService, bitacoraSeguridadService, clock);
    }

    private Usuario usuarioConVigencia(OffsetDateTime expiraEn) {
        Usuario usuario = new Usuario(
                "Ana Fernández", "1-1111-1111", "ana@capris.cr", "afernandez", "hash",
                EstadoUsuario.ACTIVO, new Rol("Usuario de Campo"), new Empresa("CAPRIS Médica"), null);
        ReflectionTestUtils.setField(usuario, "id", 10L);
        usuario.setPasswordExpiraEn(expiraEn);
        return usuario;
    }

    @Test
    void mandaElAvisoDeCincoDiasCuandoFaltanExactamenteCinco() {
        Usuario usuario = usuarioConVigencia(OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC).plusDays(5));
        when(usuarioRepository.findAllByEstado(EstadoUsuario.ACTIVO)).thenReturn(List.of(usuario));

        service.enviarAvisosPendientes();

        verify(emailService).enviarAvisoCaducidadContrasena(
                eq("ana@capris.cr"), eq("Ana Fernández"), eq(usuario.getPasswordExpiraEn()), eq(5));
        verify(avisoCaducidadEnviadoRepository).save(any());
        verify(bitacoraSeguridadService).registrar(
                eq("afernandez"), eq(10L), eq(TipoEventoSeguridad.AVISO_CADUCIDAD_ENVIADO), anyString());
    }

    @Test
    void mandaElAvisoDeTresDiasCuandoFaltanExactamenteTres() {
        Usuario usuario = usuarioConVigencia(OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC).plusDays(3));
        when(usuarioRepository.findAllByEstado(EstadoUsuario.ACTIVO)).thenReturn(List.of(usuario));

        service.enviarAvisosPendientes();

        verify(emailService).enviarAvisoCaducidadContrasena(any(), any(), any(), eq(3));
    }

    @Test
    void mandaElAvisoDeUnDiaCuandoFaltaExactamenteUno() {
        Usuario usuario = usuarioConVigencia(OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC).plusDays(1));
        when(usuarioRepository.findAllByEstado(EstadoUsuario.ACTIVO)).thenReturn(List.of(usuario));

        service.enviarAvisosPendientes();

        verify(emailService).enviarAvisoCaducidadContrasena(any(), any(), any(), eq(1));
    }

    @Test
    void noMandaNadaCuandoFaltanDiasQueNoSonNingunUmbral() {
        Usuario usuario = usuarioConVigencia(OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC).plusDays(10));
        when(usuarioRepository.findAllByEstado(EstadoUsuario.ACTIVO)).thenReturn(List.of(usuario));

        service.enviarAvisosPendientes();

        verify(emailService, never()).enviarAvisoCaducidadContrasena(any(), any(), any(), any(Integer.class));
    }

    @Test
    void noMandaNadaSiYaSeEnvioEseAvisoParaEsaVigencia() {
        Usuario usuario = usuarioConVigencia(OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC).plusDays(5));
        when(usuarioRepository.findAllByEstado(EstadoUsuario.ACTIVO)).thenReturn(List.of(usuario));
        when(avisoCaducidadEnviadoRepository.existsByUsuarioIdAndTipoAvisoAndPasswordExpiraEn(
                10L, TipoAvisoCaducidad.CINCO_DIAS, usuario.getPasswordExpiraEn()))
                .thenReturn(true);

        service.enviarAvisosPendientes();

        verify(emailService, never()).enviarAvisoCaducidadContrasena(any(), any(), any(), any(Integer.class));
        verify(avisoCaducidadEnviadoRepository, never()).save(any());
    }

    @Test
    void ignoraUsuariosSinFechaDeVencimiento() {
        Usuario usuario = usuarioConVigencia(null);
        when(usuarioRepository.findAllByEstado(EstadoUsuario.ACTIVO)).thenReturn(List.of(usuario));

        service.enviarAvisosPendientes();

        verify(emailService, never()).enviarAvisoCaducidadContrasena(any(), any(), any(), any(Integer.class));
    }

    @Test
    void siElEnvioFallaRegistraElFalloEnBitacoraYNoGuardaElAvisoComoEnviado() {
        Usuario usuario = usuarioConVigencia(OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC).plusDays(1));
        when(usuarioRepository.findAllByEstado(EstadoUsuario.ACTIVO)).thenReturn(List.of(usuario));
        doThrow(new RuntimeException("proveedor caido"))
                .when(emailService).enviarAvisoCaducidadContrasena(any(), any(), any(), any(Integer.class));

        service.enviarAvisosPendientes();

        verify(avisoCaducidadEnviadoRepository, never()).save(any());
        verify(bitacoraSeguridadService).registrar(
                eq("afernandez"), eq(10L), eq(TipoEventoSeguridad.AVISO_CADUCIDAD_ENVIADO),
                org.mockito.ArgumentMatchers.contains("Fallo"));
    }

    @Test
    void unUsuarioQuePasaPorVariosUmbralesALaVezNoEnviaMasDeUnoPorDia() {
        // En este dia, solo 1 de los 3 umbrales (5/3/1) puede coincidir
        // exactamente -- confirma que no se mandan avisos de mas.
        Usuario usuario = usuarioConVigencia(OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC).plusDays(3));
        when(usuarioRepository.findAllByEstado(EstadoUsuario.ACTIVO)).thenReturn(List.of(usuario));

        service.enviarAvisosPendientes();

        verify(emailService, times(1)).enviarAvisoCaducidadContrasena(any(), any(), any(), any(Integer.class));
    }
}
