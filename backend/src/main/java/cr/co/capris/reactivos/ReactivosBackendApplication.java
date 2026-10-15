package cr.co.capris.reactivos;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

// HU-050: habilita @Scheduled (ver AvisoCaducidadContrasenaScheduler).
@EnableScheduling
@SpringBootApplication
public class ReactivosBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(ReactivosBackendApplication.class, args);
	}

}
