package cr.co.capris.reactivos.auditoria.xml;

import java.util.Map;

/**
 * Una fila de {@code cai_bod.xml}: una bodega (real o un bucket virtual de
 * movimiento como ENT/DEV/FAC) asociada a un contrato. Confirmado contra los
 * datos de prueba: 22 filas, 16 bodegas reales (CC_TIP_BOD=CLI) + 6 buckets
 * virtuales (ENT/DEV/FAC, 2 de cada uno).
 */
public class BodegaXml {

	private final String codOrg;
	private final String codUsu;
	private final String numCon;
	private final String codIns;
	private final String codBod;
	private final String desBod;
	private final String tipBod;

	private BodegaXml(
			String codOrg, String codUsu, String numCon, String codIns,
			String codBod, String desBod, String tipBod) {
		this.codOrg = codOrg;
		this.codUsu = codUsu;
		this.numCon = numCon;
		this.codIns = codIns;
		this.codBod = codBod;
		this.desBod = desBod;
		this.tipBod = tipBod;
	}

	public static BodegaXml desdeFila(Map<String, String> fila) {
		return new BodegaXml(
				CamposXml.texto(fila, "CC_COD_ORG"),
				CamposXml.texto(fila, "CC_COD_USU"),
				CamposXml.texto(fila, "CC_NUM_CON"),
				CamposXml.texto(fila, "CC_COD_INS"),
				CamposXml.texto(fila, "CC_COD_BOD"),
				CamposXml.texto(fila, "CC_DES_BOD"),
				CamposXml.texto(fila, "CC_TIP_BOD"));
	}

	public String getCodOrg() {
		return codOrg;
	}

	public String getCodUsu() {
		return codUsu;
	}

	public String getNumCon() {
		return numCon;
	}

	public String getCodIns() {
		return codIns;
	}

	public String getCodBod() {
		return codBod;
	}

	public String getDesBod() {
		return desBod;
	}

	public String getTipBod() {
		return tipBod;
	}
}
