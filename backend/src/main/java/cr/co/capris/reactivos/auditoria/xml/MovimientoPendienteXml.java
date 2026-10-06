package cr.co.capris.reactivos.auditoria.xml;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Una fila de {@code cai_det_mov.xml}: un movimiento PENDIENTE de aplicar
 * contra el sistema (facturacion/entrega/devolucion ya hecha en el cliente
 * pero que todavia no se refleja en CD_NUM_ART de DetalleBodegaXml). No es
 * un resultado de auditoria -- es informacion de contexto para que el
 * auditor no confunda esto con una diferencia real durante el conteo
 * fisico (ver estudio: en la muestra, 100% de las filas son CM_TIP_MOV="FAC",
 * y "FAC" esta descrito en BodegaXml como el bucket "FACTURA").
 *
 * A diferencia de BodegaXml/DetalleBodegaXml/LoteBodegaXml/EstadoVisitaXml
 * (que llegan en un solo archivo por ciclo), este archivo llega uno por
 * bodega+visita -- el nombre del archivo trae bodega, fecha, hora y una
 * secuencia (ej. "med_wmolina_A2070000_20260724_cai_det_mov_2026-07-24_1640_1.xml").
 * SUPUESTO: esa combinacion identifica la visita de forma unica -- no hay
 * un ID de visita dentro del XML mismo. Ver IdentificadorVisita.
 */
public class MovimientoPendienteXml {

	private final String codOrg;
	private final String codUsu;
	private final String codArt;
	private final BigDecimal cantidad;
	private final String bodegaOrigen;
	private final String bodegaDestino;
	private final String tipoMovimiento;
	private final String indicadorLote;
	private final String numCon;
	private final String codIns;

	private MovimientoPendienteXml(
			String codOrg, String codUsu, String codArt, BigDecimal cantidad, String bodegaOrigen,
			String bodegaDestino, String tipoMovimiento, String indicadorLote, String numCon, String codIns) {
		this.codOrg = codOrg;
		this.codUsu = codUsu;
		this.codArt = codArt;
		this.cantidad = cantidad;
		this.bodegaOrigen = bodegaOrigen;
		this.bodegaDestino = bodegaDestino;
		this.tipoMovimiento = tipoMovimiento;
		this.indicadorLote = indicadorLote;
		this.numCon = numCon;
		this.codIns = codIns;
	}

	public static MovimientoPendienteXml desdeFila(Map<String, String> fila) {
		return new MovimientoPendienteXml(
				CamposXml.texto(fila, "CM_COD_ORG"),
				CamposXml.texto(fila, "CM_COD_USU"),
				CamposXml.texto(fila, "CM_COD_ART"),
				CamposXml.decimal(fila, "CM_NUM_ART"),
				CamposXml.texto(fila, "CM_BOD_ORI"),
				CamposXml.texto(fila, "CM_BOD_DES"),
				CamposXml.texto(fila, "CM_TIP_MOV"),
				CamposXml.texto(fila, "CM_IND_LOT"),
				CamposXml.texto(fila, "CM_NUM_CON"),
				CamposXml.texto(fila, "CM_COD_INS"));
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

	public String getIndicadorLote() {
		return indicadorLote;
	}

	public String getNumCon() {
		return numCon;
	}

	public String getCodIns() {
		return codIns;
	}
}
