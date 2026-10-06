package cr.co.capris.reactivos.auditoria;

import java.math.BigDecimal;
import java.time.LocalDate;

/** HU-005 (lotes y vencimientos que la PWA cachea para contar offline). */
public record LoteBodegaResumenDTO(String codArt, String numLote, LocalDate fechaVencimiento, BigDecimal cantidad) {

	public static LoteBodegaResumenDTO desde(LoteBodega lote) {
		return new LoteBodegaResumenDTO(
				lote.getCodArt(), lote.getNumLote(), lote.getFechaVencimiento(), lote.getCantidad());
	}
}
