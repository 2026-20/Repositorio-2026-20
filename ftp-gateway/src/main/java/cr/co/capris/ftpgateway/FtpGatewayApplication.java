package cr.co.capris.ftpgateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Servidor puente entre el FTP del ERP y el backend de reactivos -- ver
 * docs locales del proyecto ("SERVIDOR_PUENTE_FTP.md"). Su unico trabajo:
 * vigilar una carpeta FTP, y por cada XML nuevo que aparezca, reenviarlo
 * tal cual a /api/auditoria/ingesta/** del backend (ver FtpIngestaConfig).
 *
 * No toma ninguna decision de negocio sobre el contenido del XML -- esa
 * logica (parseo, tolerancia por fila, persistencia) ya existe en el
 * backend y no se duplica aqui.
 */
@SpringBootApplication
public class FtpGatewayApplication {

	public static void main(String[] args) {
		SpringApplication.run(FtpGatewayApplication.class, args);
	}
}
