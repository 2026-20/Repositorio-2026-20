package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
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
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

/**
 * Lee el header "Authorization: Bearer <token>" en cada peticion. Si el JWT es
 * valido, rellena ContextoUsuarioActualImpl y el SecurityContext de Spring Security
 * (para que SecurityConfig pueda exigir sesion). Si falta o no es valido, deja la
 * peticion sin autenticar -- cada ruta decide si eso la rechaza.
 *
 * HU-048: ademas valida que el usuario siga activo y que el token no sea anterior
 * a una revocacion (ver sesionSigueValida). Asi la baja logica cierra la sesion de
 * verdad: la siguiente peticion con ese token queda sin autenticar.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private final JwtService jwtService;
	private final ContextoUsuarioActualImpl contextoUsuarioActual;
	private final UsuarioRepository usuarioRepository;

	public JwtAuthenticationFilter(
			JwtService jwtService,
			ContextoUsuarioActualImpl contextoUsuarioActual,
			UsuarioRepository usuarioRepository) {
		this.jwtService = jwtService;
		this.contextoUsuarioActual = contextoUsuarioActual;
		this.usuarioRepository = usuarioRepository;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		String header = request.getHeader("Authorization");

		if (header != null && header.startsWith("Bearer ")) {
			try {
				Claims claims = jwtService.validarYObtenerClaims(header.substring(7));
				Long usuarioId = Long.valueOf(claims.getSubject());
				String proposito = claims.get("proposito", String.class);

				// Token de recuperación: no autenticar como sesión normal
				if ("recuperacion_password".equals(proposito)) {
					chain.doFilter(request, response);
					return;
				}

				Optional<Usuario> usuario = usuarioRepository.findById(usuarioId);
				OffsetDateTime emitidoEn = claims.getIssuedAt().toInstant().atOffset(ZoneOffset.UTC);

				boolean valida = usuario.isPresent()
						&& sesionSigueValida(usuario.get().getEstado(), usuario.get().getSesionesInvalidadasDesde(), emitidoEn);

				if (valida) {
					contextoUsuarioActual.establecer(
							usuarioId,
							claims.get("empresaId", Long.class),
							claims.get("rol", String.class));

					UsernamePasswordAuthenticationToken autenticacion = new UsernamePasswordAuthenticationToken(
							claims.getSubject(),
							null,
							List.of(new SimpleGrantedAuthority("ROLE_" + claims.get("rol", String.class))));

					SecurityContextHolder.getContext().setAuthentication(autenticacion);
				}
			} catch (JwtException | IllegalArgumentException ex) {
				// Token invalido, vencido o alterado -- se ignora, queda sin autenticar.
			}
		}

		chain.doFilter(request, response);
	}

	boolean sesionSigueValida(EstadoUsuario estado, OffsetDateTime invalidadasDesde, OffsetDateTime tokenEmitidoEn) {
		if (estado == EstadoUsuario.INACTIVO) {
			return false;
		}
		return invalidadasDesde == null || tokenEmitidoEn.isAfter(invalidadasDesde);
	}
}
