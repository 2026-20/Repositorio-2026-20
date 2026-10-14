package cr.co.capris.reactivos.auditoria;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Idempotencia para sincronizacion offline -- ver javadoc de RegistroTrazabilidad. */
@ExtendWith(MockitoExtension.class)
class TrazabilidadServiceTest {

    @Mock
    private RegistroTrazabilidadRepository registroTrazabilidadRepository;

    private TrazabilidadService service;

    @BeforeEach
    void configurar() {
        service = new TrazabilidadService(registroTrazabilidadRepository);
    }

    @Test
    void unIdIdempotenciaNuevoSeGuarda() {
        OffsetDateTime fecha = OffsetDateTime.now().minusHours(2);
        when(registroTrazabilidadRepository.findByIdIdempotencia("idem-abc")).thenReturn(Optional.empty());
        when(registroTrazabilidadRepository.save(any())).thenAnswer(invocacion -> invocacion.getArgument(0));

        RegistroTrazabilidad guardado = service.registrar(
                "idem-abc", TipoAccionTrazabilidad.CONTEO_REGISTRADO, 99L, 1L, "A1",
                ResultadoAccionTrazabilidad.EXITOSO, "detalle", fecha);

        assertThat(guardado.getUsuarioId()).isEqualTo(99L);
        assertThat(guardado.getEmpresaId()).isEqualTo(1L);
        assertThat(guardado.getCodBod()).isEqualTo("A1");
        assertThat(guardado.getFecha()).isEqualTo(fecha);
        verify(registroTrazabilidadRepository).save(any());
    }

    @Test
    void reenviarElMismoIdIdempotenciaNoDuplicaElGuardado() {
        RegistroTrazabilidad existente = new RegistroTrazabilidad(
                "idem-abc", TipoAccionTrazabilidad.CONTEO_REGISTRADO, 99L, 1L, "A1",
                ResultadoAccionTrazabilidad.EXITOSO, null, OffsetDateTime.now());
        when(registroTrazabilidadRepository.findByIdIdempotencia("idem-abc")).thenReturn(Optional.of(existente));

        RegistroTrazabilidad resultado = service.registrar(
                "idem-abc", TipoAccionTrazabilidad.CONTEO_REGISTRADO, 99L, 1L, "A1",
                ResultadoAccionTrazabilidad.EXITOSO, null, OffsetDateTime.now());

        assertThat(resultado).isSameAs(existente);
        verify(registroTrazabilidadRepository, never()).save(any());
    }

    @Test
    void registrarSinIdIdempotenciaLeGeneraUnoNuevoYUsaLaHoraActual() {
        OffsetDateTime antes = OffsetDateTime.now();
        when(registroTrazabilidadRepository.findByIdIdempotencia(any())).thenReturn(Optional.empty());
        when(registroTrazabilidadRepository.save(any())).thenAnswer(invocacion -> invocacion.getArgument(0));

        RegistroTrazabilidad guardado = service.registrar(
                TipoAccionTrazabilidad.INICIO_SESION, 10L, 1L, null, ResultadoAccionTrazabilidad.EXITOSO, null);

        assertThat(guardado.getIdIdempotencia()).isNotBlank();
        assertThat(guardado.getFecha()).isNotNull().isAfterOrEqualTo(antes);
        assertThat(guardado.getCodBod()).isNull();
    }

    @Test
    void listarPorEmpresaDelegaEnElRepositorioOrdenadoPorFecha() {
        RegistroTrazabilidad registro = new RegistroTrazabilidad(
                "idem-1", TipoAccionTrazabilidad.INICIO_SESION, 10L, 1L, null,
                ResultadoAccionTrazabilidad.EXITOSO, null, OffsetDateTime.now());
        when(registroTrazabilidadRepository.findAllByEmpresaIdOrderByFechaDesc(1L))
                .thenReturn(List.of(registro));

        List<RegistroTrazabilidad> resultado = service.listarPorEmpresa(1L);

        assertThat(resultado).containsExactly(registro);
    }

    @Test
    void listarPorEmpresaYUsuarioDelegaEnElRepositorio() {
        RegistroTrazabilidad registro = new RegistroTrazabilidad(
                "idem-1", TipoAccionTrazabilidad.CONTEO_REGISTRADO, 10L, 1L, "A1",
                ResultadoAccionTrazabilidad.EXITOSO, null, OffsetDateTime.now());
        when(registroTrazabilidadRepository.findAllByEmpresaIdAndUsuarioIdOrderByFechaDesc(1L, 10L))
                .thenReturn(List.of(registro));

        List<RegistroTrazabilidad> resultado = service.listarPorEmpresaYUsuario(1L, 10L);

        assertThat(resultado).containsExactly(registro);
    }
}
