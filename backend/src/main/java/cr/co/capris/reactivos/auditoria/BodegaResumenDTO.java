package cr.co.capris.reactivos.auditoria;

/** HU-004 (seleccion de contexto). */
public record BodegaResumenDTO(String codBod, String desBod, String numCon, TipoBodega tipoBod) {

	public static BodegaResumenDTO desde(Bodega bodega) {
		return new BodegaResumenDTO(bodega.getCodBod(), bodega.getDesBod(), bodega.getNumCon(), bodega.getTipoBod());
	}
}
