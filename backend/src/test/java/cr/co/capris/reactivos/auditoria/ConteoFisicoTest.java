package cr.co.capris.reactivos.auditoria;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** HU-005 criterios 2 y 3. */
class ConteoFisicoTest {

    @Test
    void unaCantidadFisicaNegativaSeRechaza() {
        assertThatThrownBy(() -> new ConteoFisico(
                "idem-1", "A1", "ART1", null, "12555",
                BigDecimal.TEN, new BigDecimal("-1"), 1L, null, OffsetDateTime.now()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unaCantidadFisicaEnCeroEsValida() {
        ConteoFisico conteo = new ConteoFisico(
                "idem-2", "A1", "ART1", null, "12555",
                BigDecimal.TEN, BigDecimal.ZERO, 1L, null, OffsetDateTime.now());

        assertThat(conteo.getCantidadFisica()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void laDiferenciaEsLaTeoricaMenosLaFisica() {
        ConteoFisico conteo = new ConteoFisico(
                "idem-3", "A1", "ART1", null, "12555",
                new BigDecimal("11"), new BigDecimal("8"), 1L, null, OffsetDateTime.now());

        assertThat(conteo.getDiferencia()).isEqualByComparingTo("3");
    }
}
