package cr.co.capris.reactivos.auditoria;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ejecuta una accion de guardado en su propia transaccion nueva
 * (REQUIRES_NEW), para que si una fila falla al guardarse en la base (no
 * solo al mapearse de XML a entidad), eso no afecte las filas ya
 * guardadas en la misma corrida ni bloquee las que faltan -- ver
 * AuditoriaIngestaService.
 *
 * Tiene que ser un bean aparte, no un metodo mas de AuditoriaIngestaService:
 * @Transactional solo se aplica a traves del proxy de Spring, y una
 * llamada de un metodo a otro DENTRO de la misma clase no pasa por ese
 * proxy -- la nueva transaccion nunca se abriria.
 *
 * Costo real de esto: cada fila termina siendo su propio commit -- para un
 * archivo de ~2000 filas (cai_det_bod.xml) son hasta 2000 transacciones
 * separadas en vez de una sola. Se acepta ese costo a proposito: esto es
 * un job de ingesta por lotes desde FTP, no un camino caliente, y lo que
 * se gana es que una fila mala no tire las ~1999 filas buenas junto con
 * ella.
 */
@Component
public class AuditoriaFilaTransaccional {

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void ejecutar(Runnable accionDeGuardado) {
		accionDeGuardado.run();
	}
}
