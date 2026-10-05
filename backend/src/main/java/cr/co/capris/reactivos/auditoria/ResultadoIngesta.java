package cr.co.capris.reactivos.auditoria;

/** Resumen de una corrida de AuditoriaIngestaService contra un archivo. */
public record ResultadoIngesta(int filasGuardadas, int filasDescartadas) {
}
