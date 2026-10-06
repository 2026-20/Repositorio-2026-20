package cr.co.capris.reactivos.auditoria.xml;

import java.util.Map;

/**
 * Una fila de {@code cai_est_vis.xml}: estado de la visita de auditoria de una
 * bodega. En los datos de prueba las 16 filas vienen en CE_ESTADO="PEND" --
 * no se conoce el set completo de valores posibles, por eso se deja como
 * String y no como enum (ver ResultadoVisita.estado en la entidad).
 *
 * SUPUESTO (no confirmado con el ERP, ver estudio de auditoria 2026-10):
 * descripcionAjusteResultado y aprobacionTipo1..4 llegan vacios en el 100%
 * de las filas de prueba. Se asume que son los campos que la auditoria
 * debe completar y devolver en el XML de salida -- si el formato de salida
 * resulta ser distinto, el cambio queda acotado a AuditoriaXmlMapper y al
 * (futuro) exportador, no a esta clase ni a la entidad.
 */
public class EstadoVisitaXml {

	private final String codOrg;
	private final String codUsu;
	private final String estado;
	private final String desEstado;
	private final String codBod;
	private final String licPub;
	private final String codIns;
	private final String codCli;
	private final String numCon;
	private final String objCon;
	private final String descripcionAjusteResultado;
	private final String aprobacionTipo1;
	private final String aprobacionTipo2;
	private final String aprobacionTipo3;
	private final String aprobacionTipo4;

	private EstadoVisitaXml(
			String codOrg, String codUsu, String estado, String desEstado, String codBod,
			String licPub, String codIns, String codCli, String numCon, String objCon,
			String descripcionAjusteResultado, String aprobacionTipo1, String aprobacionTipo2,
			String aprobacionTipo3, String aprobacionTipo4) {
		this.codOrg = codOrg;
		this.codUsu = codUsu;
		this.estado = estado;
		this.desEstado = desEstado;
		this.codBod = codBod;
		this.licPub = licPub;
		this.codIns = codIns;
		this.codCli = codCli;
		this.numCon = numCon;
		this.objCon = objCon;
		this.descripcionAjusteResultado = descripcionAjusteResultado;
		this.aprobacionTipo1 = aprobacionTipo1;
		this.aprobacionTipo2 = aprobacionTipo2;
		this.aprobacionTipo3 = aprobacionTipo3;
		this.aprobacionTipo4 = aprobacionTipo4;
	}

	public static EstadoVisitaXml desdeFila(Map<String, String> fila) {
		return new EstadoVisitaXml(
				CamposXml.texto(fila, "CE_COD_ORG"),
				CamposXml.texto(fila, "CE_COD_USU"),
				CamposXml.texto(fila, "CE_ESTADO"),
				CamposXml.texto(fila, "CE_DES_EST"),
				CamposXml.texto(fila, "CE_COD_BOD"),
				CamposXml.texto(fila, "CE_LIC_PUB"),
				CamposXml.texto(fila, "CE_COD_INS"),
				CamposXml.texto(fila, "CE_COD_CLI"),
				CamposXml.texto(fila, "CE_NUM_CON"),
				CamposXml.texto(fila, "CE_OBJ_CON"),
				CamposXml.texto(fila, "CE_DES_ARI"),
				CamposXml.texto(fila, "CE_APR_TI1"),
				CamposXml.texto(fila, "CE_APR_TI2"),
				CamposXml.texto(fila, "CE_APR_TI3"),
				CamposXml.texto(fila, "CE_APR_TI4"));
	}

	public String getCodOrg() {
		return codOrg;
	}

	public String getCodUsu() {
		return codUsu;
	}

	public String getEstado() {
		return estado;
	}

	public String getDesEstado() {
		return desEstado;
	}

	public String getCodBod() {
		return codBod;
	}

	public String getLicPub() {
		return licPub;
	}

	public String getCodIns() {
		return codIns;
	}

	public String getCodCli() {
		return codCli;
	}

	public String getNumCon() {
		return numCon;
	}

	public String getObjCon() {
		return objCon;
	}

	public String getDescripcionAjusteResultado() {
		return descripcionAjusteResultado;
	}

	public String getAprobacionTipo1() {
		return aprobacionTipo1;
	}

	public String getAprobacionTipo2() {
		return aprobacionTipo2;
	}

	public String getAprobacionTipo3() {
		return aprobacionTipo3;
	}

	public String getAprobacionTipo4() {
		return aprobacionTipo4;
	}
}
