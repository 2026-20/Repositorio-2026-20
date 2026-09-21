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

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private static final String RUTA_CAMBIO_PRIMER_INGRESO = "/api/auth/primer-ingreso/cambiar-password";
	private static final String RUTA_LOGOUT = "/api/auth/logout";

	private final JwtService jwtService;
	private final ContextoUsuarioActualImpl contextoUsuarioActual;
	private final UsuarioRepository usuarioRepository;
	private final TokenSesionRevocadoService tokenSesionRevocadoService;

	public JwtAuthenticationFilter(
			JwtService jwtService,
			ContextoUsuarioActualImpl contextoUsuarioActual,
			UsuarioRepository usuarioRepository,
			TokenSesionRevocadoService tokenSesionRevocadoService
	) {
		this.jwtService = jwtService;
		this.contextoUsuarioActual = contextoUsuarioActual;
		this.usuarioRepository = usuarioRepository;
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
				Claims claims =
						jwtService.validarYObtenerClaims(
								header.substring(7)
						);

				String jti = claims.getId();

				if (jti == null ||
						tokenSesionRevocadoService.estaRevocado(jti)) {

					SecurityContextHolder.clearContext();
					chain.doFilter(request, response);
					return;
				}

				Long usuarioId =
						Long.valueOf(claims.getSubject());

				Optional<Usuario> usuario =
						usuarioRepository.findById(usuarioId);

				OffsetDateTime emitidoEn =
						claims.getIssuedAt()
								.toInstant()
								.atOffset(ZoneOffset.UTC);

				boolean valida =
						usuario.isPresent()
								&& sesionSigueValida(
								usuario.get().getEstado(),
								usuario.get().getSesionesInvalidadasDesde(),
								emitidoEn
						)
								&& !primerIngresoPendienteFueraDeRutaPermitida(
								usuario.get().getEstado(),
								request.getMethod(),
								rutaSinContexto(request)
						);

				if (valida) {
					contextoUsuarioActual.establecer(
							usuarioId,
							claims.get("empresaId", Long.class),
							claims.get("rol", String.class)
					);

					UsernamePasswordAuthenticationToken autenticacion =
							new UsernamePasswordAuthenticationToken(
									claims.getSubject(),
									null,
									List.of(
											new SimpleGrantedAuthority(
													"ROLE_" +
															claims.get(
																	"rol",
																	String.class
															)
											)
									)
							);

					SecurityContextHolder
							.getContext()
							.setAuthentication(autenticacion);

				} else {
					SecurityContextHolder.clearContext();
				}

			} catch (JwtException | IllegalArgumentException ex) {
				SecurityContextHolder.clearContext();
			}
		}

		chain.doFilter(request, response);
	}

	boolean sesionSigueValida(
			EstadoUsuario estado,
			OffsetDateTime invalidadasDesde,
			OffsetDateTime tokenEmitidoEn
	) {
		if (estado == EstadoUsuario.INACTIVO) {
			return false;
		}

		return invalidadasDesde == null
				|| tokenEmitidoEn.isAfter(invalidadasDesde);
	}

	/**
	 * HU-044: mientras el usuario siga PENDIENTE_PRIMER_INGRESO su token solo sirve para
	 * cambiar la contraseña o cerrar sesion, sin importar el rol. El frontend ya lo lleva
	 * a esa pantalla, pero el limite real es este: sin esto bastaria llamar a la API
	 * directamente para seguir usando la contraseña temporal indefinidamente.
	 * Cualquier variante de la ruta que no coincida exacta queda rechazada (falla cerrado).
	 */
	boolean primerIngresoPendienteFueraDeRutaPermitida(EstadoUsuario estado, String metodo, String ruta) {
		if (estado != EstadoUsuario.PENDIENTE_PRIMER_INGRESO) {
			return false;
		}

		boolean permitida = "POST".equals(metodo)
				&& (RUTA_CAMBIO_PRIMER_INGRESO.equals(ruta) || RUTA_LOGOUT.equals(ruta));

		return !permitida;
	}

	private String rutaSinContexto(HttpServletRequest request) {
		return request.getRequestURI().substring(request.getContextPath().length());
	}
}