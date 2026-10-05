package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.auditoria.xml.BodegaXml;
import cr.co.capris.reactivos.auditoria.xml.DetalleBodegaXml;
import cr.co.capris.reactivos.auditoria.xml.EstadoVisitaXml;
import cr.co.capris.reactivos.auditoria.xml.LoteBodegaXml;
import cr.co.capris.reactivos.auditoria.xml.LoteMovimientoXml;
import cr.co.capris.reactivos.auditoria.xml.MovimientoPendienteXml;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

import cr.co.capris.reactivos.auditoria.xml.AuditoriaRowReader;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Corre el parser contra los 6 XML de prueba reales (archivos de una
 * auditoria pasada, ver estudio de auditoria 2026-10 -- no son datos
 * inventados). Los numeros de este test (cantidad de filas, el caso de
 * reconciliacion, etc.) salen de analizar esos archivos, no de una
 * expectativa arbitraria.
 */
class AuditoriaXmlParserTest {

    private static final String DIRECTORIO = "auditoria/xmls/";

    private final AuditoriaXmlParser parser = new AuditoriaXmlParser();

    private Logger logger;
    private ListAppender<ILoggingEvent> appender;

    @BeforeEach
    void capturarLogs() {
        logger = (Logger) LoggerFactory.getLogger(AuditoriaRowReader.class);
        appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void dejarDeCapturarLogs() {
        logger.detachAppender(appender);
    }

    private InputStream recurso(String nombreArchivo) {
        InputStream in = getClass().getClassLoader().getResourceAsStream(DIRECTORIO + nombreArchivo);
        assertThat(in).as("fixture %s debe existir en src/test/resources/%s", nombreArchivo, DIRECTORIO)
                .isNotNull();
        return in;
    }

    private InputStream xmlCrudo(String xml) {
        return new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void leeLas22FilasDeBodegasConLos4TiposConfirmados() throws IOException {
        List<BodegaXml> bodegas = parser.leerBodegas(recurso("med_wmolina_cai_bod.xml"), "cai_bod.xml");

        assertThat(bodegas).hasSize(22);
        assertThat(bodegas).extracting(BodegaXml::getTipBod)
                .containsOnly("CLI", "ENT", "DEV", "FAC");
        assertThat(bodegas).filteredOn(b -> "CLI".equals(b.getTipBod())).hasSize(16);
    }

    @Test
    void mapeaCadaTipoDeBodegaAlEnumSinReventar() throws IOException {
        List<BodegaXml> bodegas = parser.leerBodegas(recurso("med_wmolina_cai_bod.xml"), "cai_bod.xml");
        AuditoriaXmlMapper mapper = new AuditoriaXmlMapper();

        for (BodegaXml xml : bodegas) {
            Bodega entidad = mapper.aEntidad(xml);
            assertThat(entidad.getTipoBod()).isNotNull();
        }
    }

    @Test
    void leeLas16FilasDeEstadoDeVisitaTodasPendientes() throws IOException {
        List<EstadoVisitaXml> estados =
                parser.leerEstadosVisita(recurso("med_wmolina_cai_est_vis.xml"), "cai_est_vis.xml");

        assertThat(estados).hasSize(16);
        assertThat(estados).extracting(EstadoVisitaXml::getEstado).containsOnly("PEND");
        // Ver SUPUESTO en EstadoVisitaXml: en los datos de prueba estos 5 campos
        // siempre llegan vacios/null.
        assertThat(estados).allSatisfy(e -> {
            assertThat(e.getAprobacionTipo1()).isNullOrEmpty();
            assertThat(e.getDescripcionAjusteResultado()).isNullOrEmpty();
        });
    }

    @Test
    void leeLas1962FilasDeDetalleBodegaConDecimalesSinCeroInicial() throws IOException {
        List<DetalleBodegaXml> detalle =
                parser.leerDetalleBodega(recurso("med_wmolina_cai_det_bod.xml"), "cai_det_bod.xml");

        assertThat(detalle).hasSize(1962);
        assertThat(detalle).filteredOn(d -> "S".equals(d.getIndicadorLote())).hasSize(1649);
        assertThat(detalle).filteredOn(d -> "N".equals(d.getIndicadorLote())).hasSize(313);
    }

    @Test
    void leeLas1691FilasDeLoteBodegaYParseaCantidadesSinCeroInicial() throws IOException {
        List<LoteBodegaXml> lotes = parser.leerLoteBodega(recurso("med_wmolina_cai_lot_bod.xml"), "cai_lot_bod.xml");

        assertThat(lotes).hasSize(1691);
        // Bodega A2060000, articulo M01088, lote 2600 -- CL_NUM_ART viene como
        // ".25" en el XML (sin el cero inicial). Si esto alguna vez se rompe,
        // es porque cambio la config del XmlMapper, no porque el dato este mal.
        LoteBodegaXml primerLote = lotes.get(0);
        assertThat(primerLote.getCodArt()).isEqualTo("M01088");
        assertThat(primerLote.getNumLote()).isEqualTo("2600");
        assertThat(primerLote.getCantidad()).isEqualByComparingTo("0.25");
    }

    @Test
    void laCantidadTeoricaDeDetalleBodegaCalzaConLaSumaDeSusLotes() throws IOException {
        List<DetalleBodegaXml> detalle =
                parser.leerDetalleBodega(recurso("med_wmolina_cai_det_bod.xml"), "cai_det_bod.xml");
        List<LoteBodegaXml> lotes = parser.leerLoteBodega(recurso("med_wmolina_cai_lot_bod.xml"), "cai_lot_bod.xml");

        Map<String, BigDecimal> sumaLotesPorArticulo = new HashMap<>();
        for (LoteBodegaXml lote : lotes) {
            String clave = lote.getCodBod() + "|" + lote.getCodArt();
            sumaLotesPorArticulo.merge(clave, lote.getCantidad(), BigDecimal::add);
        }

        // Confirmado contra los 1649 articulos con indicador de lote "S": sin
        // excepciones. Si este test falla, es una regresion real en el parseo,
        // no un dato de prueba inconsistente -- ya se verifico manualmente.
        long revisados = 0;
        for (DetalleBodegaXml fila : detalle) {
            if (!"S".equals(fila.getIndicadorLote())) {
                continue;
            }
            String clave = fila.getCodBod() + "|" + fila.getCodArt();
            BigDecimal sumaLotes = sumaLotesPorArticulo.getOrDefault(clave, BigDecimal.ZERO);
            assertThat(fila.getCantidadTeorica())
                    .as("cantidad teorica de %s", clave)
                    .isEqualByComparingTo(sumaLotes);
            revisados++;
        }
        assertThat(revisados).isEqualTo(1649);
    }

    @Test
    void leeLas12FilasDeMovimientosPendientesDeLaVisitaDeEjemplo() throws IOException {
        // OJO: son 12 filas ROW, no 135 -- 135 es la cantidad de LINEAS del
        // archivo (este XML viene indentado, ~11 lineas por fila). Confirmado
        // con ElementTree (python) de forma independiente a este parser.
        List<MovimientoPendienteXml> movimientos = parser.leerMovimientosPendientes(
                recurso("med_wmolina_A2070000_20260724_cai_det_mov_2026-07-24_1640_1.xml"), "cai_det_mov.xml");

        assertThat(movimientos).hasSize(12);
        assertThat(movimientos).extracting(MovimientoPendienteXml::getTipoMovimiento).containsOnly("FAC");
    }

    @Test
    void leeLas13FilasDeLotesDeMovimientoDeLaVisitaDeEjemplo() throws IOException {
        // Mismo caso que el test anterior: 120 es la cantidad de lineas del
        // archivo, no de filas ROW.
        List<LoteMovimientoXml> lotesMovimiento = parser.leerLotesMovimiento(
                recurso("med_wmolina_A2070000_20260724_cai_lot_mov_2026-07-24_1640_2.xml"), "cai_lot_mov.xml");

        assertThat(lotesMovimiento).hasSize(13);
    }

    @Test
    void unTagDesconocidoDelErpSeIgnoraSinReventar() {
        // El ERP podria agregar un campo nuevo que todavia no conocemos --
        // no deberia romper el parseo de los campos que si entendemos.
        String xml = "<ROWSET><ROW><CC_COD_ORG>MED</CC_COD_ORG>"
                + "<CC_TAG_NUEVO_DEL_ERP>algo</CC_TAG_NUEVO_DEL_ERP>"
                + "<CC_TIP_BOD>CLI</CC_TIP_BOD></ROW></ROWSET>";

        List<BodegaXml> bodegas = parser.leerBodegas(xmlCrudo(xml), "prueba");

        assertThat(bodegas).hasSize(1);
        assertThat(bodegas.get(0).getTipBod()).isEqualTo("CLI");
    }

    @Test
    void unaFilaConValorInvalidoSeDescartaYSeLogueaPeroLasDemasSobreviven() {
        // Antes de agregar tolerancia por fila, esto perdia las 3 filas
        // (el NumberFormatException de la fila del medio tiraba todo el
        // archivo) -- ver conversacion del 2026-10-05.
        String xml = "<ROWSET>"
                + "<ROW><CD_COD_BOD>A1</CD_COD_BOD><CD_COD_ART>BUENA1</CD_COD_ART>"
                + "<CD_NUM_ART>5</CD_NUM_ART><CD_IND_LOT>N</CD_IND_LOT></ROW>"
                + "<ROW><CD_COD_BOD>A1</CD_COD_BOD><CD_COD_ART>MALA</CD_COD_ART>"
                + "<CD_NUM_ART>N/D</CD_NUM_ART><CD_IND_LOT>N</CD_IND_LOT></ROW>"
                + "<ROW><CD_COD_BOD>A1</CD_COD_BOD><CD_COD_ART>BUENA2</CD_COD_ART>"
                + "<CD_NUM_ART>7</CD_NUM_ART><CD_IND_LOT>N</CD_IND_LOT></ROW>"
                + "</ROWSET>";

        List<DetalleBodegaXml> detalle = parser.leerDetalleBodega(xmlCrudo(xml), "prueba_tolerancia.xml");

        assertThat(detalle).extracting(DetalleBodegaXml::getCodArt).containsExactly("BUENA1", "BUENA2");

        // Se logueo la fila descartada (con el nombre del archivo y el motivo)
        // y el resumen final (1 de 3 descartada).
        assertThat(appender.list)
                .anySatisfy(evento -> assertThat(evento.getFormattedMessage())
                        .contains("prueba_tolerancia.xml")
                        .contains("MALA") // viene en el mapa de campos crudos logueado
                        .contains("NumberFormatException"))
                .anySatisfy(evento -> assertThat(evento.getFormattedMessage())
                        .contains("1 de 3 filas descartadas"));
    }

    @Test
    void elIdentificadorDeVisitaSeExtraeDelNombreDeAmbosArchivosDeMovimiento() {
        IdentificadorVisita deDetMov = IdentificadorVisita.desdeNombreArchivo(
                "med_wmolina_A2070000_20260724_cai_det_mov_2026-07-24_1640_1.xml");
        IdentificadorVisita deLotMov = IdentificadorVisita.desdeNombreArchivo(
                "med_wmolina_A2070000_20260724_cai_lot_mov_2026-07-24_1640_2.xml");

        assertThat(deDetMov.codBod()).isEqualTo("A2070000");
        assertThat(deDetMov.fecha().toString()).isEqualTo("2026-07-24");
        assertThat(deDetMov.hora().toString()).isEqualTo("16:40");
        assertThat(deDetMov.secuencia()).isEqualTo(1);

        // Misma visita, distinto archivo (det vs lot) y distinta secuencia (2).
        assertThat(deLotMov.codBod()).isEqualTo(deDetMov.codBod());
        assertThat(deLotMov.fecha()).isEqualTo(deDetMov.fecha());
        assertThat(deLotMov.hora()).isEqualTo(deDetMov.hora());
        assertThat(deLotMov.secuencia()).isEqualTo(2);
    }

    @Test
    void unNombreDeArchivoQueNoCalzaConElPatronFallaFuerteEnVezDeAdivinar() {
        assertThatThrownBy(() -> IdentificadorVisita.desdeNombreArchivo("archivo_inesperado.xml"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
