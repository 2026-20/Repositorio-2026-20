package cr.co.capris.reactivos.config;

import cr.co.capris.reactivos.auditoria.AuditoriaIngestaApiKeyFilter;
import cr.co.capris.reactivos.auth.JwtAuthenticationFilter;
import cr.co.capris.reactivos.seguridad.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.http.SessionCreationPolicy;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;

/**
 * El JWT ya se emite y se lee en cada peticion (ver paquete auth/). Desde HU-001,
 * /api/auth/login y /api/empresas son las unicas rutas publicas; el resto exige un
 * JWT valido (JwtAuthenticationFilter deja el request sin autenticar si falta, esta
 * vencido, o el usuario fue inactivado -- ver HU-048).
 *
 * /api/auditoria/ingesta/** es la unica excepcion a "todo es JWT de usuario":
 * esa es la entrada del futuro servidor puente FTP, que no es un usuario --
 * se autentica con una API key (ver AuditoriaIngestaApiKeyFilter).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

	private final JwtAuthenticationFilter jwtAuthenticationFilter;
	private final AuditoriaIngestaApiKeyFilter auditoriaIngestaApiKeyFilter;
	private final ObjectMapper objectMapper;

	public SecurityConfig(
			JwtAuthenticationFilter jwtAuthenticationFilter,
			AuditoriaIngestaApiKeyFilter auditoriaIngestaApiKeyFilter,
			ObjectMapper objectMapper) {
		this.jwtAuthenticationFilter = jwtAuthenticationFilter;
		this.auditoriaIngestaApiKeyFilter = auditoriaIngestaApiKeyFilter;
		this.objectMapper = objectMapper;
	}

	@Bean
	public PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		http
				.csrf(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)

				.sessionManagement(session ->
						session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
				)

				.exceptionHandling(exception ->
						exception
								.authenticationEntryPoint(this::responderSesionNoValida)
								.accessDeniedHandler(this::responderAccesoNoAutorizado)
				)

				.authorizeHttpRequests(auth -> auth
						// El preflight CORS (OPTIONS) no lleva el JWT, hay que dejarlo pasar.
						.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
						// El dispatch a /error ocurre cuando algo falla ANTES del controller
						// (p. ej. un body inválido). Si /error queda protegido, ese fallo se
						// camufla como un 401 SESION_NO_VALIDA en vez del 400 real.
						.requestMatchers("/error").permitAll()
						.requestMatchers(
								"/api/auth/login",
								"/api/empresas"
						).permitAll()
.requestMatchers("/api/auth/recuperacion/**").permitAll()
						.requestMatchers(
								HttpMethod.POST,
								"/api/usuarios",
								"/api/usuarios/*/inactivar",
								"/api/usuarios/*/reactivar",
								"/api/usuarios/*/desbloquear"
						).hasRole("Administrador")
						// HU-037 (stopgap manual, ver SUPUESTO en Bodega sobre codUsu):
						// solo un Administrador asigna bodegas a un Usuario de Campo.
						.requestMatchers(
								HttpMethod.PATCH,
								"/api/auditoria/visitas/*/*/asignacion"
						).hasRole("Administrador")
						// Entrada servidor-a-servidor para el futuro servidor puente FTP --
						// no es un usuario, se autentica por API key (ver
						// AuditoriaIngestaApiKeyFilter), nunca con un rol de usuario normal.
						.requestMatchers(
								HttpMethod.POST,
								"/api/auditoria/ingesta/**"
						).hasRole("SISTEMA_INGESTA")
						.anyRequest().authenticated()
				)

				.addFilterBefore(
						jwtAuthenticationFilter,
						UsernamePasswordAuthenticationFilter.class
				)
				.addFilterBefore(
						auditoriaIngestaApiKeyFilter,
						UsernamePasswordAuthenticationFilter.class
				);

		return http.build();
	}

	private void responderSesionNoValida(
			HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
			throws IOException {
		response.setStatus(HttpStatus.UNAUTHORIZED.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		objectMapper.writeValue(response.getWriter(), ErrorResponse.de("SESION_NO_VALIDA", "No hay sesion activa"));
	}

	private void responderAccesoNoAutorizado(
			HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException)
			throws IOException {
		response.setStatus(HttpStatus.FORBIDDEN.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		objectMapper.writeValue(response.getWriter(), ErrorResponse.de("ACCESO_NO_AUTORIZADO", "No autorizado"));
	}
}
