package cr.co.capris.reactivos.auditoria;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

import cr.co.capris.reactivos.auditoria.xml.BodegaXml;
import cr.co.capris.reactivos.auditoria.xml.EstadoVisitaXml;
import cr.co.capris.reactivos.auditoria.xml.MovimientoPendienteXml;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * No necesita Docker/Testcontainers -- los repositorios se mockean, asi
 * que esto prueba la logica de tolerancia-por-fila/log/upsert del
 * servicio, no el esquema real contra Postgres (eso lo cubriria un futuro
 * *IT.java, no escrito todavia -- no se pudo correr aqui por falta de
 * Docker en este entorno).
 *
 * AuditoriaFilaTransaccional se usa real (sin proxy de Spring, @Transactional
 * no hace nada fuera de un ApplicationContext) -- en un test asi, eso
 * equivale a ejecutar el Runnable directo, que es justo lo que se quiere
 * probar aqui.
 */
@ExtendWith(MockitoExtension.class)
class AuditoriaIngestaServiceTest {

    @Mock
    private AuditoriaXmlParser parser;

    @Mock
    private BodegaRepository bodegaRepository;

    @Mock
    private ResultadoVisitaRepository resultadoVisitaRepository;

    @Mock
    private DetalleBodegaRepository detalleBodegaRepository;

    @Mock
    private LoteBodegaRepository loteBodegaRepository;

    @Mock
    private MovimientoPendienteRepository movimientoPendienteRepository;

    @Mock
    private LoteMovimientoRepository loteMovimientoRepository;

    private InputStream entradaCualquiera;

    private AuditoriaIngestaService service;

    private Logger logger;
    private ListAppender<ILoggingEvent> appender;

    @BeforeEach
    void configurar() {
        entradaCualquiera = InputStream.nullInputStream();
        service = new AuditoriaIngestaService(
                parser,
                new AuditoriaXmlMapper(),
                new AuditoriaFilaTransaccional(),
                bodegaRepository,
                resultadoVisitaRepository,
                detalleBodegaRepository,
                loteBodegaRepository,
                movimientoPendienteRepository,
                loteMovimientoRepository);

        logger = (Logger) LoggerFactory.getLogger(AuditoriaIngestaService.class);
        appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void limpiar() {
        logger.detachAppender(appender);
    }

    private BodegaXml bodega(String codBod, String tipBod) {
        return BodegaXml.desdeFila(Map.of(
                "CC_COD_ORG", "MED",
                "CC_COD_USU", "WMOLINA",
                "CC_NUM_CON", "12555",
                "CC_COD_INS", "2-88-63-0165",
                "CC_COD_BOD", codBod,
                "CC_DES_BOD", "bodega de prueba",
                "CC_TIP_BOD", tipBod));
    }

    @Test
    void unaFilaConTipoDeBodegaDesconocidoSeDescartaYSeLogueaPeroLasDemasSeGuardan() {
        // "TRANSITO" no existe en TipoBodega -- AuditoriaXmlMapper.aEntidad()
        // lo rechaza con IllegalArgumentException (ver TipoBodega).
        when(parser.leerBodegas(any(), eq("cai_bod.xml")))
                .thenReturn(List.of(bodega("A1", "CLI"), bodega("A2", "TRANSITO"), bodega("A3", "ENT")));
        when(bodegaRepository.findByNumConAndCodBodAndTipoBod(any(), any(), any())).thenReturn(Optional.empty());

        ResultadoIngesta resultado = service.ingestarBodegas(entradaCualquiera, "cai_bod.xml");

        assertThat(resultado.filasGuardadas()).isEqualTo(2);
        assertThat(resultado.filasDescartadas()).isEqualTo(1);
        verify(bodegaRepository, never()).save(argThatCodBodEs("A2"));

        assertThat(appender.list)
                .anySatisfy(evento -> assertThat(evento.getFormattedMessage())
                        .contains("cai_bod.xml")
                        .contains("fila #2")
                        .contains("IllegalArgumentException"))
                .anySatisfy(evento -> assertThat(evento.getFormattedMessage())
                        .contains("1 de 3 filas descartadas"));
    }

    @Test
    void siYaExisteUnaBodegaConLaMismaClaveSeBorraYSeReemplaza() {
        Bodega existente = new Bodega("MED", "WMOLINA", "12555", "2-88-63-0165", "A1", "vieja", TipoBodega.CLI);
        when(parser.leerBodegas(any(), any())).thenReturn(List.of(bodega("A1", "CLI")));
        when(bodegaRepository.findByNumConAndCodBodAndTipoBod("12555", "A1", TipoBodega.CLI))
                .thenReturn(Optional.of(existente));

        service.ingestarBodegas(entradaCualquiera, "cai_bod.xml");

        verify(bodegaRepository).delete(existente);
        verify(bodegaRepository).save(any(Bodega.class));
    }

    @Test
    void reingestarElEstadoDeVisitaPreservaElResultadoYaRegistrado() {
        ResultadoVisita existente = new ResultadoVisita(
                "MED", "WMOLINA", "PEND", "PENDIENTE", "A1", "lic", "ins", "cli", "12555", "obj");
        existente.setAprobacionTipo1("ya revisado por un administrador");

        EstadoVisitaXml nuevoSnapshot = EstadoVisitaXml.desdeFila(Map.of(
                "CE_COD_ORG", "MED", "CE_COD_USU", "WMOLINA", "CE_ESTADO", "PEND",
                "CE_DES_EST", "PENDIENTE", "CE_COD_BOD", "A1", "CE_LIC_PUB", "lic",
                "CE_COD_INS", "ins", "CE_COD_CLI", "cli", "CE_NUM_CON", "12555", "CE_OBJ_CON", "obj"));

        when(parser.leerEstadosVisita(any(), any())).thenReturn(List.of(nuevoSnapshot));
        when(resultadoVisitaRepository.findByNumConAndCodBod("12555", "A1")).thenReturn(Optional.of(existente));

        service.ingestarEstadosVisita(entradaCualquiera, "cai_est_vis.xml");

        // Se reusa la MISMA instancia (no se reemplaza por una nueva vacia).
        verify(resultadoVisitaRepository).save(existente);
        assertThat(existente.getAprobacionTipo1()).isEqualTo("ya revisado por un administrador");
    }

    @Test
    void reingestarLosMovimientosDeUnaVisitaBorraLosViejosAntesDeInsertarLosNuevos() {
        MovimientoPendiente movimientoViejo = new MovimientoPendiente(
                new IdentificadorVisita("MED", "WMOLINA", "A2070000", LocalDate.parse("2026-07-24"),
                        LocalTime.parse("16:40"), 1),
                "MED", "WMOLINA", "M1", BigDecimal.ONE, "A1", "FAC", "FAC", false, "12555", "ins");

        MovimientoPendienteXml filaNueva = MovimientoPendienteXml.desdeFila(Map.of(
                "CM_COD_ORG", "MED", "CM_COD_USU", "WMOLINA", "CM_COD_ART", "M2",
                "CM_NUM_ART", "3", "CM_BOD_ORI", "A1", "CM_BOD_DES", "FAC",
                "CM_TIP_MOV", "FAC", "CM_IND_LOT", "N", "CM_NUM_CON", "12555", "CM_COD_INS", "ins"));

        String nombreArchivo = "med_wmolina_A2070000_20260724_cai_det_mov_2026-07-24_1640_1.xml";
        when(parser.leerMovimientosPendientes(any(), eq(nombreArchivo))).thenReturn(List.of(filaNueva));
        when(movimientoPendienteRepository
                .findAllByCodBodVisitaAndFechaVisitaAndHoraVisitaAndSecuenciaVisita(
                        "A2070000", LocalDate.parse("2026-07-24"), LocalTime.parse("16:40"), 1))
                .thenReturn(List.of(movimientoViejo));

        service.ingestarMovimientosPendientes(entradaCualquiera, nombreArchivo);

        verify(movimientoPendienteRepository).deleteAll(List.of(movimientoViejo));
        verify(movimientoPendienteRepository).save(any(MovimientoPendiente.class));
    }

    private Bodega argThatCodBodEs(String codBod) {
        return org.mockito.ArgumentMatchers.argThat(b -> b != null && codBod.equals(b.getCodBod()));
    }
}
