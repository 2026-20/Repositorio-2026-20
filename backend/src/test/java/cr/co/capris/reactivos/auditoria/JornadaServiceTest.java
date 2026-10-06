package cr.co.capris.reactivos.auditoria;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JornadaServiceTest {

    @Mock
    private JornadaRepository jornadaRepository;

    @Test
    void confirmarElInicioDosVecesElMismoDiaNoCreaUnaSegundaFila() {
        Jornada yaIniciada = new Jornada(1L, LocalDate.now(), OffsetDateTime.now());
        when(jornadaRepository.findByUsuarioIdAndFecha(1L, LocalDate.now())).thenReturn(Optional.of(yaIniciada));

        Jornada resultado = new JornadaService(jornadaRepository).iniciar(1L, LocalDate.now());

        assertThat(resultado).isSameAs(yaIniciada);
        verify(jornadaRepository, never()).save(any());
    }

    @Test
    void sinJornadaParaHoyEstaIniciadaEsFalse() {
        when(jornadaRepository.findByUsuarioIdAndFecha(1L, LocalDate.now())).thenReturn(Optional.empty());

        assertThat(new JornadaService(jornadaRepository).estaIniciada(1L, LocalDate.now())).isFalse();
    }
}
