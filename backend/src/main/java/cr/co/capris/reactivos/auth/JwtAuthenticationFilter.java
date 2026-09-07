package cr.co.capris.reactivos.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Lee el header "Authorization: Bearer <token>" en cada peticion y, si es valido,
 * rellena ContextoUsuarioActualImpl para esa peticion. No rechaza la peticion si el
 * token falta o es invalido -- eso lo decide cada endpoint (hoy todos son publicos,
 * ver SecurityConfig). Simplemente deja el contexto vacio en ese caso.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private final JwtService jwtService;
	private final ContextoUsuarioActualImpl contextoUsuarioActual;

	public JwtAuthenticationFilter(JwtService jwtService, ContextoUsuarioActualImpl contextoUsuarioActual) {
		this.jwtService = jwtService;
		this.contextoUsuarioActual = contextoUsuarioActual;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		String header = request.getHeader("Authorization");

		if (header != null && header.startsWith("Bearer ")) {
			try {
				Claims claims = jwtService.validarYObtenerClaims(header.substring(7));
				contextoUsuarioActual.establecer(
						Long.valueOf(claims.getSubject()),
						claims.get("empresaId", Long.class),
						claims.get("rol", String.class));
			} catch (JwtException | IllegalArgumentException ex) {
				// Token invalido, vencido o alterado -- se ignora aqui. El contexto queda
				// vacio y el endpoint que lo requiera decide como reaccionar.
			}
		}

		chain.doFilter(request, response);
	}
}
