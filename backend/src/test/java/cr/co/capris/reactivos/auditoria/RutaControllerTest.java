package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.seguridad.SesionNoValidaException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** HU-037. La consulta en si se prueba contra Postgres real en RutaPendienteQueryIT. */
@ExtendWith(MockitoExtension.class)
class RutaControllerTest {

    @Mock
    private ResultadoVisitaRepository resultadoVisitaRepository;

    @Mock
    private ContextoUsuarioActual contextoUsuarioActual;

    private RutaController controller;

    @BeforeEach
    void setUp() {
        controller = new RutaController(resultadoVisitaRepository, contextoUsuarioActual);
    }

    @Test
    void devuelveLaRutaDelUsuarioDelToken() {
        ParadaRutaDTO parada = new ParadaRutaDTO(
                "HSJD", "Hospital San Juan de Dios", "C-001", "Reactivos", "PEND",
                EstadoVisitaApp.PENDIENTE, LocalDate.now());
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(7L);
        when(resultadoVisitaRepository.findRutaPendiente(7L)).thenReturn(List.of(parada));

        assertThat(controller.miRuta()).containsExactly(parada);
    }

    @Test
    void sinAsignacionesDevuelveListaVacia() {
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(7L);
        when(resultadoVisitaRepository.findRutaPendiente(7L)).thenReturn(List.of());

        assertThat(controller.miRuta()).isEmpty();
    }

    @Test
    void sinUsuarioEnElContextoLanzaSesionNoValidaSinConsultarLaBase() {
        when(contextoUsuarioActual.getUsuarioId()).thenReturn(null);

        assertThatThrownBy(() -> controller.miRuta()).isInstanceOf(SesionNoValidaException.class);
        verify(resultadoVisitaRepository, never()).findRutaPendiente(any());
    }
}
