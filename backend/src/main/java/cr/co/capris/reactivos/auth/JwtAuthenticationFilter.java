package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import cr.co.capris.reactivos.seguridad.CaducidadContrasenaService;

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
	private static final String RUTA_CAMBIO_CONTRASENA = "/api/auth/cambiar-password";
	private static final String RUTA_USUARIOS_PERFIL = "/api/usuarios/perfil";
	private static final String PREFIJO_RUTA_USUARIOS = "/api/usuarios/";

	private final JwtService jwtService;
	private final ContextoUsuarioActualImpl contextoUsuarioActual;
	private final UsuarioRepository usuarioRepository;
	private final TokenSesionRevocadoService tokenSesionRevocadoService;
	private final CaducidadContrasenaService caducidadContrasenaService;

	public JwtAuthenticationFilter(
			JwtService jwtService,
			ContextoUsuarioActualImpl contextoUsuarioActual,
			UsuarioRepository usuarioRepository,
			TokenSesionRevocadoService tokenSesionRevocadoService,
			CaducidadContrasenaService caducidadContrasenaService
	) {
		this.jwtService = jwtService;
		this.contextoUsuarioActual = contextoUsuarioActual;
		this.usuarioRepository = usuarioRepository;
		this.tokenSesionRevocadoService = tokenSesionRevocadoService;
		this.caducidadContrasenaService = caducidadContrasenaService;
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

				String proposito =
						claims.get("proposito", String.class);

				// Token de recuperación: no autentica una sesión normal, el
				// controlador valida su validez/revocación por su cuenta.
				if ("recuperacion_password".equals(proposito)) {
					chain.doFilter(request, response);
					return;
				}

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

				boolean contrasenaVencida =
						usuario.isPresent()
								&& usuario.get().getEstado() == EstadoUsuario.ACTIVO
								&& caducidadContrasenaService.estaVencida(usuario.get());

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
						)
								&& !contrasenaVencidaFueraDeRutaPermitida(
								contrasenaVencida,
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

		boolean permitida = ("POST".equals(metodo)
				&& (RUTA_CAMBIO_PRIMER_INGRESO.equals(ruta) || RUTA_LOGOUT.equals(ruta)))
				|| rutaDeConsultaDeSesionPermitida(metodo, ruta);

		return !permitida;
	}

	boolean contrasenaVencidaFueraDeRutaPermitida(boolean contrasenaVencida, String metodo, String ruta) {
		if (!contrasenaVencida) {return false;}

		boolean permitida = ("POST".equals(metodo)
						&& (RUTA_CAMBIO_CONTRASENA.equals(ruta)
						|| RUTA_LOGOUT.equals(ruta)))
				|| rutaDeConsultaDeSesionPermitida(metodo, ruta);

		return !permitida;
	}

	/**
	 * El frontend verifica la sesion con GET /api/usuarios/{id} (y /perfil) justo
	 * despues de iniciar sesion, sin importar si hay un cambio de contraseña
	 * pendiente -- sin esta excepcion ese GET era rechazado y el filtro lo trataba
	 * como sesion invalida, cerrando la sesion antes de que la pantalla de cambio
	 * de contraseña pudiera mostrarse.
	 *
	 * Match exacto para /perfil, y para /api/usuarios/{id} se exige que el resto
	 * de la ruta sea solo digitos -- NO un startsWith() plano. Un prefijo simple
	 * dejaria pasar algo como "/api/usuarios/../otra-ruta" (el string si "empieza
	 * con" el prefijo aunque apunte a otro lado), justo el tipo de variante que
	 * el resto de este filtro rechaza a proposito (ver el javadoc de
	 * primerIngresoPendienteFueraDeRutaPermitida: "falla cerrado").
	 */
	private boolean rutaDeConsultaDeSesionPermitida(String metodo, String ruta) {
		if (!"GET".equals(metodo)) {
			return false;
		}
		if (RUTA_USUARIOS_PERFIL.equals(ruta)) {
			return true;
		}
		return esRutaDeUsuarioPorId(ruta);
	}

	private boolean esRutaDeUsuarioPorId(String ruta) {
		if (!ruta.startsWith(PREFIJO_RUTA_USUARIOS)) {
			return false;
		}
		String resto = ruta.substring(PREFIJO_RUTA_USUARIOS.length());
		return !resto.isEmpty() && resto.chars().allMatch(Character::isDigit);
	}

	private String rutaSinContexto(HttpServletRequest request) {
		return request.getRequestURI().substring(request.getContextPath().length());
	}
}