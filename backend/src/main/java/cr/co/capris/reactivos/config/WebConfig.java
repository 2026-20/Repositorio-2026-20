package cr.co.capris.reactivos.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Permite que el frontend llame a la API. Por defecto deja pasar el frontend
 * de desarrollo (Vite, puerto 5173). Cuando exista un dominio real de
 * despliegue, se sobreescribe con la variable de entorno
 * APP_CORS_ALLOWED_ORIGINS (varios origenes separados por coma).
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

	private final String[] allowedOrigins;

	public WebConfig(@Value("${app.cors.allowed-origins:http://localhost:5173}") String allowedOrigins) {
		this.allowedOrigins = allowedOrigins.split(",");
	}

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/api/**")
				.allowedOrigins(allowedOrigins)
				.allowedMethods("GET", "POST", "PUT", "DELETE");
	}
}