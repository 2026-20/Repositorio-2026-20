package cr.co.capris.reactivos.auditoria.xml;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/**
 * Una fila de {@code cai_lot_bod.xml}: desglose por lote y fecha de
 * vencimiento de un articulo en una bodega. Solo aparecen aqui los
 * articulos con CD_IND_LOT="S" en DetalleBodegaXml -- la suma de
 * CL_NUM_ART de todos los lotes de un mismo (bodega, articulo) debe calzar
 * exactamente con CD_NUM_ART (confirmado contra los datos de prueba, ver
 * javadoc de DetalleBodegaXml).
 */
public class LoteBodegaXml {

	private final String codOrg;
	private final String codUsu;
	private final String codBod;
	private final String bodCliente;
	private final String codArt;
	private final String numLote;
	private final LocalDate fechaVencimiento;
	private final BigDecimal cantidad;

	private LoteBodegaXml(
			String codOrg, String codUsu, String codBod, String bodCliente, String codArt,
			String numLote, LocalDate fechaVencimiento, BigDecimal cantidad) {
		this.codOrg = codOrg;
		this.codUsu = codUsu;
		this.codBod = codBod;
		this.bodCliente = bodCliente;
		this.codArt = codArt;
		this.numLote = numLote;
		this.fechaVencimiento = fechaVencimiento;
		this.cantidad = cantidad;
	}

	public static LoteBodegaXml desdeFila(Map<String, String> fila) {
		return new LoteBodegaXml(
				CamposXml.texto(fila, "CL_COD_ORG"),
				CamposXml.texto(fila, "CL_COD_USU"),
				CamposXml.texto(fila, "CL_COD_BOD"),
				CamposXml.texto(fila, "CL_BOD_CLI"),
				CamposXml.texto(fila, "CL_COD_ART"),
				CamposXml.texto(fila, "CL_NUM_LOT"),
				CamposXml.fecha(fila, "CL_FEC_VEN"),
				CamposXml.decimal(fila, "CL_NUM_ART"));
	}

	public String getCodOrg() {
		return codOrg;
	}

	public String getCodUsu() {
		return codUsu;
	}

	public String getCodBod() {
		return codBod;
	}

	public String getBodCliente() {
		return bodCliente;
	}

	public String getCodArt() {
		return codArt;
	}

	public String getNumLote() {
		return numLote;
	}

	public LocalDate getFechaVencimiento() {
		return fechaVencimiento;
	}

	public BigDecimal getCantidad() {
		return cantidad;
	}
}
