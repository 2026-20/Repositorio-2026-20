package cr.co.capris.reactivos.auditoria.xml;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Una fila de {@code cai_det_bod.xml}: cantidad TEORICA en sistema de un
 * articulo en una bodega (la cifra contra la que se compara el conteo
 * fisico). Confirmado contra los datos de prueba: cuando CD_IND_LOT="S",
 * CD_NUM_ART es exactamente la suma de los lotes de ese mismo articulo+bodega
 * en cai_lot_bod.xml (ver LoteBodegaXml) -- verificado fila por fila, sin
 * excepciones, sobre las 1962 filas de la muestra.
 */
public class DetalleBodegaXml {

	private final String codOrg;
	private final String codUsu;
	private final String codBod;
	private final String bodCliente;
	private final String codArt;
	private final String desArt;
	private final BigDecimal cantidadTeorica;
	private final String indicadorLote;
	private final String tipBod;
	private final String numCon;
	private final String codIns;
	private final BigDecimal cantidadMinima;

	private DetalleBodegaXml(
			String codOrg, String codUsu, String codBod, String bodCliente, String codArt,
			String desArt, BigDecimal cantidadTeorica, String indicadorLote, String tipBod,
			String numCon, String codIns, BigDecimal cantidadMinima) {
		this.codOrg = codOrg;
		this.codUsu = codUsu;
		this.codBod = codBod;
		this.bodCliente = bodCliente;
		this.codArt = codArt;
		this.desArt = desArt;
		this.cantidadTeorica = cantidadTeorica;
		this.indicadorLote = indicadorLote;
		this.tipBod = tipBod;
		this.numCon = numCon;
		this.codIns = codIns;
		this.cantidadMinima = cantidadMinima;
	}

	public static DetalleBodegaXml desdeFila(Map<String, String> fila) {
		return new DetalleBodegaXml(
				CamposXml.texto(fila, "CD_COD_ORG"),
				CamposXml.texto(fila, "CD_COD_USU"),
				CamposXml.texto(fila, "CD_COD_BOD"),
				CamposXml.texto(fila, "CD_BOD_CLI"),
				CamposXml.texto(fila, "CD_COD_ART"),
				CamposXml.texto(fila, "CD_DES_ART"),
				CamposXml.decimal(fila, "CD_NUM_ART"),
				CamposXml.texto(fila, "CD_IND_LOT"),
				CamposXml.texto(fila, "CD_TIP_BOD"),
				CamposXml.texto(fila, "CD_NUM_CON"),
				CamposXml.texto(fila, "CD_COD_INS"),
				// Nombre de tag real del ERP, confirmado en los datos de prueba
				// (no es un typo nuestro): CD_NUN_MIN, no CD_NUM_MIN.
				CamposXml.decimal(fila, "CD_NUN_MIN"));
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

	public String getDesArt() {
		return desArt;
	}

	public BigDecimal getCantidadTeorica() {
		return cantidadTeorica;
	}

	public String getIndicadorLote() {
		return indicadorLote;
	}

	public String getTipBod() {
		return tipBod;
	}

	public String getNumCon() {
		return numCon;
	}

	public String getCodIns() {
		return codIns;
	}

	public BigDecimal getCantidadMinima() {
		return cantidadMinima;
	}
}
