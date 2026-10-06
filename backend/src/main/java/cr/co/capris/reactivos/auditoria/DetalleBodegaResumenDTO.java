package cr.co.capris.reactivos.auditoria;

import java.math.BigDecimal;

/** HU-005 (referencia que la PWA cachea para contar offline). */
public record DetalleBodegaResumenDTO(
		String codArt,
		String desArt,
		BigDecimal cantidadTeorica,
		boolean indicadorLote,
		String numCon,
		BigDecimal cantidadMinima) {

	public static DetalleBodegaResumenDTO desde(DetalleBodega detalle) {
		return new DetalleBodegaResumenDTO(
				detalle.getCodArt(),
				detalle.getDesArt(),
				detalle.getCantidadTeorica(),
				detalle.isIndicadorLote(),
				detalle.getNumCon(),
				detalle.getCantidadMinima());
	}
}
