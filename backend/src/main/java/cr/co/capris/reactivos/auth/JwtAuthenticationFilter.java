package cr.co.capris.reactivos.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private final JwtService jwtService;
	private final ContextoUsuarioActualImpl contextoUsuarioActual;
	private final TokenSesionRevocadoService tokenSesionRevocadoService;

	public JwtAuthenticationFilter(
			JwtService jwtService,
			ContextoUsuarioActualImpl contextoUsuarioActual,
			TokenSesionRevocadoService tokenSesionRevocadoService
	) {
		this.jwtService = jwtService;
		this.contextoUsuarioActual = contextoUsuarioActual;
		this.tokenSesionRevocadoService = tokenSesionRevocadoService;
	}

	@Override
	protected void doFilterInternal(
			HttpServletRequest request,
			HttpServletResponse response,
			FilterChain chain
	) throws ServletException, IOException {

		String header = request.getHeader("Authorization");

		if (header != null && header.startsWith("Bearer ")) {
			try {
				String token = header.substring(7);

				Claims claims =
						jwtService.validarYObtenerClaims(token);

				String jti = claims.getId();

				if (jti == null ||
						tokenSesionRevocadoService.estaRevocado(jti)) {
					SecurityContextHolder.clearContext();
					chain.doFilter(request, response);
					return;
				}

				contextoUsuarioActual.establecer(
						Long.valueOf(claims.getSubject()),
						claims.get("empresaId", Long.class),
						claims.get("rol", String.class)
				);

				String rol = claims.get("rol", String.class);

				UsernamePasswordAuthenticationToken autenticacion =
						new UsernamePasswordAuthenticationToken(
								claims.getSubject(),
								null,
								List.of(
										new SimpleGrantedAuthority(
												"ROLE_" + rol
										)
								)
						);

				SecurityContextHolder
						.getContext()
						.setAuthentication(autenticacion);

			} catch (JwtException | IllegalArgumentException ex) {
				SecurityContextHolder.clearContext();
			}
		}

		chain.doFilter(request, response);
	}
}