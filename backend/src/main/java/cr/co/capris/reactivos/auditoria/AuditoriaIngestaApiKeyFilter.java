package cr.co.capris.reactivos.auditoria;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * Autenticacion para /api/auditoria/ingesta/** -- no es un usuario con JWT
 * (ver JwtAuthenticationFilter), es el futuro servidor puente FTP que le
 * manda cada XML del ERP a este backend. Mismo mecanismo que ese filtro
 * (deja una Authentication en el SecurityContext si la credencial es
 * valida; si no, no hace nada y deja que authorizeHttpRequests rechace
 * mas adelante) pero con una API key fija en vez de un JWT.
 *
 * Solo actua sobre rutas bajo /api/auditoria/ingesta/ -- en cualquier otra
 * ruta no hace nada, para no gastar trabajo de mas en cada peticion.
 */
@Component
public class AuditoriaIngestaApiKeyFilter extends OncePerRequestFilter {

	static final String HEADER_API_KEY = "X-Internal-Api-Key";
	private static final String PREFIJO_RUTA = "/api/auditoria/ingesta/";

	private final String apiKeyEsperada;

	public AuditoriaIngestaApiKeyFilter(
			@Value("${app.auditoria.ingesta.api-key}") String apiKeyEsperada) {
		this.apiKeyEsperada = apiKeyEsperada;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		String ruta = request.getRequestURI().substring(request.getContextPath().length());
		if (ruta.startsWith(PREFIJO_RUTA)) {
			String apiKeyRecibida = request.getHeader(HEADER_API_KEY);
			// Comparacion en tiempo constante -- no dar ninguna ventaja de
			// temporizacion a quien intente adivinar la clave caracter por
			// caracter (mismo criterio de seguridad que el resto del proyecto).
			if (apiKeyRecibida != null && esIgual(apiKeyRecibida, apiKeyEsperada)) {
				SecurityContextHolder.getContext().setAuthentication(
						new UsernamePasswordAuthenticationToken(
								"sistema-ingesta-ftp", null, List.of(new SimpleGrantedAuthority("ROLE_SISTEMA_INGESTA"))));
			}
		}
		chain.doFilter(request, response);
	}

	private boolean esIgual(String recibida, String esperada) {
		return MessageDigest.isEqual(
				recibida.getBytes(StandardCharsets.UTF_8), esperada.getBytes(StandardCharsets.UTF_8));
	}
}
