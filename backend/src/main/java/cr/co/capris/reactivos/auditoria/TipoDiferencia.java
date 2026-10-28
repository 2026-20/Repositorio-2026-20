package cr.co.capris.reactivos.auditoria;

/**
 * HU-030 criterios 2-4: clasificacion de la diferencia (fisica - teorica)
 * de un ConteoFisico. Derivada siempre del signo, nunca persistida (ver
 * javadoc de ConteoFisico.getDiferencia()).
 */
public enum TipoDiferencia {
	FALTANTE,
	SOBRANTE,
	SIN_DIFERENCIA
}
