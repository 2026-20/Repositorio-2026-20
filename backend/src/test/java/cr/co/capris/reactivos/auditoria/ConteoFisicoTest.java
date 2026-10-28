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

    // HU-030 criterio 1: diferencia = fisica - teorica (no al reves).
    @Test
    void laDiferenciaEsLaFisicaMenosLaTeorica() {
        ConteoFisico conteo = new ConteoFisico(
                "idem-3", "A1", "ART1", null, "12555",
                new BigDecimal("11"), new BigDecimal("8"), 1L, null, OffsetDateTime.now());

        assertThat(conteo.getDiferencia()).isEqualByComparingTo("-3");
    }

    // HU-030 criterio 2: fisica < teorica -> faltante, diferencia negativa.
    @Test
    void siLaFisicaEsMenorQueLaTeoricaElTipoEsFaltante() {
        ConteoFisico conteo = new ConteoFisico(
                "idem-4", "A1", "ART1", null, "12555",
                new BigDecimal("10"), new BigDecimal("7"), 1L, null, OffsetDateTime.now());

        assertThat(conteo.getDiferencia()).isEqualByComparingTo("-3");
        assertThat(conteo.getTipoDiferencia()).isEqualTo(TipoDiferencia.FALTANTE);
    }

    // HU-030 criterio 3: fisica > teorica -> sobrante, diferencia positiva.
    @Test
    void siLaFisicaEsMayorQueLaTeoricaElTipoEsSobrante() {
        ConteoFisico conteo = new ConteoFisico(
                "idem-5", "A1", "ART1", null, "12555",
                new BigDecimal("10"), new BigDecimal("13"), 1L, null, OffsetDateTime.now());

        assertThat(conteo.getDiferencia()).isEqualByComparingTo("3");
        assertThat(conteo.getTipoDiferencia()).isEqualTo(TipoDiferencia.SOBRANTE);
    }

    // HU-030 criterio 4: fisica == teorica -> sin diferencia.
    @Test
    void siLaFisicaEsIgualALaTeoricaElTipoEsSinDiferencia() {
        ConteoFisico conteo = new ConteoFisico(
                "idem-6", "A1", "ART1", null, "12555",
                new BigDecimal("10"), new BigDecimal("10"), 1L, null, OffsetDateTime.now());

        assertThat(conteo.getDiferencia()).isEqualByComparingTo("0");
        assertThat(conteo.getTipoDiferencia()).isEqualTo(TipoDiferencia.SIN_DIFERENCIA);
    }

    // HU-007 criterio 2: corregir actualiza el MISMO registro y lo marca.
    @Test
    void corregirActualizaLaCantidadYLasObservacionesYQuedaMarcadoComoCorregido() {
        ConteoFisico conteo = new ConteoFisico(
                "idem-7", "A1", "ART1", null, "12555",
                BigDecimal.TEN, new BigDecimal("8"), 1L, "observacion original", OffsetDateTime.now());

        conteo.corregir(new BigDecimal("9"), "observacion corregida");

        assertThat(conteo.getCantidadFisica()).isEqualByComparingTo("9");
        assertThat(conteo.getObservaciones()).isEqualTo("observacion corregida");
        assertThat(conteo.isCorregido()).isTrue();
    }

    // HU-007 criterio 4: misma validacion que un registro nuevo.
    @Test
    void corregirConUnaCantidadNegativaSeRechazaYNoQuedaMarcadoComoCorregido() {
        ConteoFisico conteo = new ConteoFisico(
                "idem-8", "A1", "ART1", null, "12555",
                BigDecimal.TEN, new BigDecimal("8"), 1L, null, OffsetDateTime.now());

        assertThatThrownBy(() -> conteo.corregir(new BigDecimal("-1"), null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(conteo.getCantidadFisica()).isEqualByComparingTo("8");
        assertThat(conteo.isCorregido()).isFalse();
    }

    // HU-007 criterio 3.
    @Test
    void corregirUnConteoYaTransmitidoSeRechaza() {
        ConteoFisico conteo = new ConteoFisico(
                "idem-9", "A1", "ART1", null, "12555",
                BigDecimal.TEN, new BigDecimal("8"), 1L, null, OffsetDateTime.now());
        org.springframework.test.util.ReflectionTestUtils.setField(conteo, "transmitido", true);

        assertThatThrownBy(() -> conteo.corregir(new BigDecimal("9"), null))
                .isInstanceOf(ConteoYaTransmitidoException.class);
        assertThat(conteo.getCantidadFisica()).isEqualByComparingTo("8");
    }
}
