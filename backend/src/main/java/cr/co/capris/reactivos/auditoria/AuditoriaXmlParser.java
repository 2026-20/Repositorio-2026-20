package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.auditoria.xml.AuditoriaRowReader;
import cr.co.capris.reactivos.auditoria.xml.BodegaXml;
import cr.co.capris.reactivos.auditoria.xml.DetalleBodegaXml;
import cr.co.capris.reactivos.auditoria.xml.EstadoVisitaXml;
import cr.co.capris.reactivos.auditoria.xml.LoteBodegaXml;
import cr.co.capris.reactivos.auditoria.xml.LoteMovimientoXml;
import cr.co.capris.reactivos.auditoria.xml.MovimientoPendienteXml;

import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.List;

/**
 * Lee los 6 tipos de XML que manda el ERP (ver estudio de auditoria
 * 2026-10) y los convierte en los DTO del paquete .xml. No hace nada con
 * el origen del archivo (FTP, un test, lo que sea) -- recibe un
 * InputStream ya abierto, para no acoplar el parseo al transporte.
 *
 * El parseo en si (StAX, sin libreria externa, con tolerancia por fila y
 * log de lo descartado) vive en AuditoriaRowReader -- ver su javadoc para
 * el porque de esas decisiones.
 *
 * "origen" es solo para los logs (ej. el nombre del archivo) -- no cambia
 * el parseo. No es obligatorio que sea un nombre de archivo real; si no se
 * tiene uno a mano, cualquier etiqueta que ayude a identificar el lote en
 * los logs sirve.
 *
 * Nota sobre encoding (ver estudio): el ERP declara UTF-8 pero al menos un
 * archivo de prueba (cai_det_bod.xml) trae un caracter mal codificado
 * ("6??" en vez del original). StAX no revienta por esto -- simplemente
 * lee "?" como caracter literal -- asi que no hace falta manejo especial,
 * pero se deja esta nota para que no sorprenda si se ve en los datos reales.
 */
@Service
public class AuditoriaXmlParser {

	public List<BodegaXml> leerBodegas(InputStream entrada, String origen) {
		return AuditoriaRowReader.leer(entrada, origen, BodegaXml::desdeFila);
	}

	public List<EstadoVisitaXml> leerEstadosVisita(InputStream entrada, String origen) {
		return AuditoriaRowReader.leer(entrada, origen, EstadoVisitaXml::desdeFila);
	}

	public List<DetalleBodegaXml> leerDetalleBodega(InputStream entrada, String origen) {
		return AuditoriaRowReader.leer(entrada, origen, DetalleBodegaXml::desdeFila);
	}

	public List<LoteBodegaXml> leerLoteBodega(InputStream entrada, String origen) {
		return AuditoriaRowReader.leer(entrada, origen, LoteBodegaXml::desdeFila);
	}

	public List<MovimientoPendienteXml> leerMovimientosPendientes(InputStream entrada, String origen) {
		return AuditoriaRowReader.leer(entrada, origen, MovimientoPendienteXml::desdeFila);
	}

	public List<LoteMovimientoXml> leerLotesMovimiento(InputStream entrada, String origen) {
		return AuditoriaRowReader.leer(entrada, origen, LoteMovimientoXml::desdeFila);
	}
}
