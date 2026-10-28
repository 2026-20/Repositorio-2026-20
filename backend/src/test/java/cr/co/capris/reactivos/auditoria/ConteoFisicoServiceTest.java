package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.seguridad.AccesoNoAutorizadoException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

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

    // --- corregir (HU-007) ---

    private ConteoFisico conteoExistente() {
        ConteoFisico conteo = new ConteoFisico(
                "idem-abc", "A1", "ART1", null, "12555",
                BigDecimal.TEN, new BigDecimal("8"), 99L, null, java.time.OffsetDateTime.now());
        ReflectionTestUtils.setField(conteo, "id", 5L);
        return conteo;
    }

    @Test
    void corregirUnConteoExistenteDelMismoUsuarioLoActualiza() {
        ConteoFisico existente = conteoExistente();
        when(conteoFisicoRepository.findById(5L)).thenReturn(Optional.of(existente));
        when(conteoFisicoRepository.save(any())).thenAnswer(invocacion -> invocacion.getArgument(0));

        ConteoFisico resultado = service.corregir(5L, new CorregirConteoRequest(new BigDecimal("9"), "nota"), 99L);

        assertThat(resultado.getCantidadFisica()).isEqualByComparingTo("9");
        assertThat(resultado.isCorregido()).isTrue();
        verify(conteoFisicoRepository).save(existente);
    }

    @Test
    void corregirUnConteoQueNoExisteLanza404() {
        when(conteoFisicoRepository.findById(5L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.corregir(5L, new CorregirConteoRequest(BigDecimal.ONE, null), 99L))
                .isInstanceOf(ConteoFisicoNoEncontradoException.class);
    }

    @Test
    void corregirElConteoDeOtroUsuarioSeRechaza() {
        when(conteoFisicoRepository.findById(5L)).thenReturn(Optional.of(conteoExistente()));

        assertThatThrownBy(() -> service.corregir(5L, new CorregirConteoRequest(BigDecimal.ONE, null), 1L))
                .isInstanceOf(AccesoNoAutorizadoException.class);
        verify(conteoFisicoRepository, never()).save(any());
    }

    @Test
    void corregirUnConteoYaTransmitidoSeRechaza() {
        ConteoFisico existente = conteoExistente();
        ReflectionTestUtils.setField(existente, "transmitido", true);
        when(conteoFisicoRepository.findById(5L)).thenReturn(Optional.of(existente));

        assertThatThrownBy(() -> service.corregir(5L, new CorregirConteoRequest(BigDecimal.ONE, null), 99L))
                .isInstanceOf(ConteoYaTransmitidoException.class);
        verify(conteoFisicoRepository, never()).save(any());
    }
}
