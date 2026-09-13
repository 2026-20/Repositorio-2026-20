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
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

/**
 * Lee el header "Authorization: Bearer <token>" en cada peticion y, si es valido,
 * rellena ContextoUsuarioActualImpl y el SecurityContext de Spring Security (asi
 * SecurityConfig puede exigir sesion con authorizeHttpRequests). Si el token falta
 * o no es valido, simplemente deja la peticion sin autenticar -- SecurityConfig es
 * quien decide si esa ruta la rechaza o no.
 *
 * HU-048: ademas de validar la firma/vigencia del JWT, consulta el usuario en cada
 * peticion para respetar la baja logica -- un token firmado correctamente y sin
 * vencer igual se trata como invalido (no se autentica) si el usuario fue
 * inactivado despues de que ese token se emitio, o si el usuario ya no esta
 * ACTIVO/PENDIENTE_PRIMER_INGRESO. Es asi como la revocacion de HU-048 realmente
 * cierra la sesion: la siguiente peticion con ese token cae en authorizeHttpRequests
 * como no autenticada. Es una consulta extra por peticion; aceptable dado el
 * volumen esperado del proyecto (bajo -- personal de campo de una sola empresa).
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

				Optional<Usuario> usuario = usuarioRepository.findById(usuarioId);
				OffsetDateTime emitidoEn = claims.getIssuedAt().toInstant().atOffset(ZoneOffset.UTC);

				boolean valida = usuario.isPresent()
						&& sesionSigueValida(usuario.get().getEstado(), usuario.get().getSesionesInvalidadasDesde(), emitidoEn);

				if (valida) {
					contextoUsuarioActual.establecer(
							usuarioId,
							claims.get("empresaId", Long.class),
							claims.get("rol", String.class));

					UsernamePasswordAuthenticationToken autenticacion =
							new UsernamePasswordAuthenticationToken(
									claims.getSubject(),
									null,
									List.of(new SimpleGrantedAuthority("ROLE_" + claims.get("rol", String.class)))
							);

					SecurityContextHolder.getContext().setAuthentication(autenticacion);
				}
				// Si el usuario no existe, esta INACTIVO, o el token se emitio antes de
				// una revocacion (HU-048): no se autentica -- SecurityConfig rechaza la
				// peticion en authorizeHttpRequests si la ruta exige sesion.
			} catch (JwtException | IllegalArgumentException ex) {
				// Token invalido, vencido o alterado.
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
