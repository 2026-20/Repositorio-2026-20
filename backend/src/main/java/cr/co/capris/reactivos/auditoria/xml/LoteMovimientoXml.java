package cr.co.capris.reactivos.auditoria.xml;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Una fila de {@code cai_lot_mov.xml}: el desglose por lote de un
 * MovimientoPendienteXml, para articulos con indicadorLote="S". Mismo
 * prefijo "CL_" que LoteBodegaXml pero son tags distintos (CL_BOD_ORI,
 * CL_BOD_DES, CL_TIP_MOV en vez de CL_COD_BOD/CL_BOD_CLI/CL_FEC_VEN) --
 * por eso es una clase separada y no se reusa LoteBodegaXml.
 */
public class LoteMovimientoXml {

	private final String codOrg;
	private final String codUsu;
	private final String codArt;
	private final String numLote;
	private final BigDecimal cantidad;
	private final String bodegaOrigen;
	private final String bodegaDestino;
	private final String tipoMovimiento;

	private LoteMovimientoXml(
			String codOrg, String codUsu, String codArt, String numLote, BigDecimal cantidad,
			String bodegaOrigen, String bodegaDestino, String tipoMovimiento) {
		this.codOrg = codOrg;
		this.codUsu = codUsu;
		this.codArt = codArt;
		this.numLote = numLote;
		this.cantidad = cantidad;
		this.bodegaOrigen = bodegaOrigen;
		this.bodegaDestino = bodegaDestino;
		this.tipoMovimiento = tipoMovimiento;
	}

	public static LoteMovimientoXml desdeFila(Map<String, String> fila) {
		return new LoteMovimientoXml(
				CamposXml.texto(fila, "CL_COD_ORG"),
				CamposXml.texto(fila, "CL_COD_USU"),
				CamposXml.texto(fila, "CL_COD_ART"),
				CamposXml.texto(fila, "CL_NUM_LOT"),
				CamposXml.decimal(fila, "CL_NUM_ART"),
				CamposXml.texto(fila, "CL_BOD_ORI"),
				CamposXml.texto(fila, "CL_BOD_DES"),
				CamposXml.texto(fila, "CL_TIP_MOV"));
	}

	public String getCodOrg() {
		return codOrg;
	}

	public String getCodUsu() {
		return codUsu;
	}

	public String getCodArt() {
		return codArt;
	}

	public String getNumLote() {
		return numLote;
	}

	public BigDecimal getCantidad() {
		return cantidad;
	}

	public String getBodegaOrigen() {
		return bodegaOrigen;
	}

	public String getBodegaDestino() {
		return bodegaDestino;
	}

	public String getTipoMovimiento() {
		return tipoMovimiento;
	}
}
