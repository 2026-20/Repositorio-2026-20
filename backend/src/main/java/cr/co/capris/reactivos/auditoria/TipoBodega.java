package cr.co.capris.reactivos.auditoria;

/**
 * Clasificacion de una "bodega" segun cai_bod.xml. Los 4 valores estan
 * confirmados directamente en los datos de prueba (no son una suposicion):
 * CLI son las 16 bodegas reales (hospitales/clinicas), y ENT/DEV/FAC son
 * buckets virtuales de movimiento (entrega, devolucion, factura) -- cada
 * contrato tiene uno de cada uno. Los mismos 3 codigos de movimiento
 * (ENT/DEV/FAC) se usan en MovimientoPendiente.tipoMovimiento.
 */
public enum TipoBodega {
	CLI,
	ENT,
	DEV,
	FAC
}
