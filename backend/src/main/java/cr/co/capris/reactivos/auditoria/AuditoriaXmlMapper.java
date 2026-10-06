package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.auditoria.xml.BodegaXml;
import cr.co.capris.reactivos.auditoria.xml.DetalleBodegaXml;
import cr.co.capris.reactivos.auditoria.xml.EstadoVisitaXml;
import cr.co.capris.reactivos.auditoria.xml.LoteBodegaXml;
import cr.co.capris.reactivos.auditoria.xml.LoteMovimientoXml;
import cr.co.capris.reactivos.auditoria.xml.MovimientoPendienteXml;

import org.springframework.stereotype.Component;

/**
 * Convierte los DTO de parseo (paquete .xml, un espejo 1:1 de las etiquetas
 * del ERP) a las entidades de dominio de este paquete. Separado del parser
 * (AuditoriaXmlParser) para que el mapeo de campos -- y los supuestos que
 * trae, ver javadoc de cada entidad -- se pueda revisar y corregir sin
 * tocar la lectura del XML en si.
 */
@Component
public class AuditoriaXmlMapper {

	/** "S" -&gt; true, cualquier otra cosa (incluido null) -&gt; false. */
	private boolean aBoolean(String indicadorSN) {
		return "S".equalsIgnoreCase(indicadorSN);
	}

	public Bodega aEntidad(BodegaXml xml) {
		return new Bodega(
				xml.getCodOrg(),
				xml.getCodUsu(),
				xml.getNumCon(),
				xml.getCodIns(),
				xml.getCodBod(),
				xml.getDesBod(),
				TipoBodega.valueOf(xml.getTipBod()));
	}

	public ResultadoVisita aEntidad(EstadoVisitaXml xml) {
		ResultadoVisita resultado = new ResultadoVisita(
				xml.getCodOrg(),
				xml.getCodUsu(),
				xml.getEstado(),
				xml.getDesEstado(),
				xml.getCodBod(),
				xml.getLicPub(),
				xml.getCodIns(),
				xml.getCodCli(),
				xml.getNumCon(),
				xml.getObjCon());
		// Estos campos llegan vacios del ERP (ver SUPUESTO en EstadoVisitaXml) --
		// se copian igual por si en algun archivo real ya vienen con datos.
		resultado.setDescripcionAjusteResultado(xml.getDescripcionAjusteResultado());
		resultado.setAprobacionTipo1(xml.getAprobacionTipo1());
		resultado.setAprobacionTipo2(xml.getAprobacionTipo2());
		resultado.setAprobacionTipo3(xml.getAprobacionTipo3());
		resultado.setAprobacionTipo4(xml.getAprobacionTipo4());
		return resultado;
	}

	public DetalleBodega aEntidad(DetalleBodegaXml xml) {
		return new DetalleBodega(
				xml.getCodOrg(),
				xml.getCodUsu(),
				xml.getCodBod(),
				xml.getBodCliente(),
				xml.getCodArt(),
				xml.getDesArt(),
				xml.getCantidadTeorica(),
				aBoolean(xml.getIndicadorLote()),
				xml.getTipBod(),
				xml.getNumCon(),
				xml.getCodIns(),
				xml.getCantidadMinima());
	}

	public LoteBodega aEntidad(LoteBodegaXml xml) {
		return new LoteBodega(
				xml.getCodOrg(),
				xml.getCodUsu(),
				xml.getCodBod(),
				xml.getBodCliente(),
				xml.getCodArt(),
				xml.getNumLote(),
				xml.getFechaVencimiento(),
				xml.getCantidad());
	}

	public MovimientoPendiente aEntidad(MovimientoPendienteXml xml, IdentificadorVisita visita) {
		return new MovimientoPendiente(
				visita,
				xml.getCodOrg(),
				xml.getCodUsu(),
				xml.getCodArt(),
				xml.getCantidad(),
				xml.getBodegaOrigen(),
				xml.getBodegaDestino(),
				xml.getTipoMovimiento(),
				aBoolean(xml.getIndicadorLote()),
				xml.getNumCon(),
				xml.getCodIns());
	}

	public LoteMovimiento aEntidad(LoteMovimientoXml xml, IdentificadorVisita visita) {
		return new LoteMovimiento(
				visita,
				xml.getCodOrg(),
				xml.getCodUsu(),
				xml.getCodArt(),
				xml.getNumLote(),
				xml.getCantidad(),
				xml.getBodegaOrigen(),
				xml.getBodegaDestino(),
				xml.getTipoMovimiento());
	}
}
