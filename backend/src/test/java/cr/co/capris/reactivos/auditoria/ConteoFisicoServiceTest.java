package cr.co.capris.reactivos.auditoria;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Idempotencia para sincronizacion offline -- ver javadoc de ConteoFisico. */
@ExtendWith(MockitoExtension.class)
class ConteoFisicoServiceTest {

    @Mock
    private ConteoFisicoRepository conteoFisicoRepository;

    @Mock
    private JornadaService jornadaService;

    private ConteoFisicoService service;

    @BeforeEach
    void configurar() {
        service = new ConteoFisicoService(conteoFisicoRepository, jornadaService);
        // La mayoria de los tests no les interesa la jornada -- se deja
        // "iniciada" por defecto (lenient porque el test de idempotencia
        // nunca llega a consultarla, ver orden en ConteoFisicoService.registrar()).
        lenient().when(jornadaService.estaIniciada(any(), any())).thenReturn(true);
    }

    private RegistrarConteoRequest request() {
        return new RegistrarConteoRequest(
                "idem-abc", "A1", "ART1", null, "12555", BigDecimal.TEN, new BigDecimal("8"), null);
    }

    @Test
    void unIdempotenciaKeyNuevoSeGuarda() {
        when(conteoFisicoRepository.findByIdempotenciaKey("idem-abc")).thenReturn(Optional.empty());
        when(conteoFisicoRepository.save(any())).thenAnswer(invocacion -> invocacion.getArgument(0));

        ConteoFisico guardado = service.registrar(request(), 99L);

        assertThat(guardado.getUsuarioId()).isEqualTo(99L);
        verify(conteoFisicoRepository).save(any());
    }

    @Test
    void reenviarElMismoIdempotenciaKeyNoDuplicaElGuardado() {
        ConteoFisico yaExistente = new ConteoFisico(
                "idem-abc", "A1", "ART1", null, "12555",
                BigDecimal.TEN, new BigDecimal("8"), 99L, null, java.time.OffsetDateTime.now());
        when(conteoFisicoRepository.findByIdempotenciaKey("idem-abc")).thenReturn(Optional.of(yaExistente));

        ConteoFisico resultado = service.registrar(request(), 99L);

        assertThat(resultado).isSameAs(yaExistente);
        verify(conteoFisicoRepository, never()).save(any());
    }

    @Test
    void sinJornadaIniciadaUnConteoNuevoSeRechaza() {
        when(conteoFisicoRepository.findByIdempotenciaKey("idem-abc")).thenReturn(Optional.empty());
        when(jornadaService.estaIniciada(99L, LocalDate.now())).thenReturn(false);

        assertThatThrownBy(() -> service.registrar(request(), 99L))
                .isInstanceOf(JornadaNoIniciadaException.class);
        verify(conteoFisicoRepository, never()).save(any());
    }

    @Test
    void reenviarUnIdempotenciaKeyYaGuardadoFuncionaAunSinJornadaIniciadaHoy() {
        // Un reintento de sync de algo ya aceptado (quiza un dia distinto)
        // no debe fallar por la jornada -- ver orden en registrar().
        ConteoFisico yaExistente = new ConteoFisico(
                "idem-abc", "A1", "ART1", null, "12555",
                BigDecimal.TEN, new BigDecimal("8"), 99L, null, java.time.OffsetDateTime.now());
        when(conteoFisicoRepository.findByIdempotenciaKey("idem-abc")).thenReturn(Optional.of(yaExistente));

        ConteoFisico resultado = service.registrar(request(), 99L);

        assertThat(resultado).isSameAs(yaExistente);
    }
}
