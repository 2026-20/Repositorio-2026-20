package cr.co.capris.reactivos.auth;

import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Identificador del origen de la peticion en curso, tal como se guarda en la bitacora
 * de seguridad (HU-043 en el login, HU-045 en el cambio de contraseña).
 */
final class IdentificadorCliente {

	private IdentificadorCliente() {
	}

	static String deLaPeticionActual() {
		var atributos = RequestContextHolder.getRequestAttributes();

		if (atributos instanceof ServletRequestAttributes servletAttributes) {
			String ip = servletAttributes.getRequest().getRemoteAddr();
			return "ip:" + ip;
		}

		return "ip:no-disponible";
	}
}
