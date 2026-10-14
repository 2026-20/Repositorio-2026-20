package cr.co.capris.reactivos.seguridad;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * HU-050: dispara AvisoCaducidadContrasenaService una vez al dia. Hora
 * configurable con app.aviso-caducidad.cron (default 7:00am, hora del
 * servidor) para poder correrlo en un horario distinto en produccion sin
 * tocar codigo.
 */
@Component
public class AvisoCaducidadContrasenaScheduler {

	private final AvisoCaducidadContrasenaService avisoCaducidadContrasenaService;

	public AvisoCaducidadContrasenaScheduler(AvisoCaducidadContrasenaService avisoCaducidadContrasenaService) {
		this.avisoCaducidadContrasenaService = avisoCaducidadContrasenaService;
	}

	@Scheduled(cron = "${app.aviso-caducidad.cron:0 0 7 * * *}")
	public void ejecutar() {
		avisoCaducidadContrasenaService.enviarAvisosPendientes();
	}
}
