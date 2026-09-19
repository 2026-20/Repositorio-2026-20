package cr.co.capris.reactivos.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

/**
 * Emite y valida los JWT que usan el resto de las HUs de seguridad para saber
 * "quien es el usuario actual" (ver ContextoUsuarioActual). Esto es la parte minima
 * de HU-001 que se dejo avanzada -- el resto de HU-001 (mensajes de cada criterio de
 * aceptacion, lista de empresas para el selector, etc.) sigue pendiente.
 */
@Service
public class JwtService {

	private final SecretKey key;
	private final long expiracionMinutos;
	private final long expiracionRecuperacionMinutos;

	@Autowired
	public JwtService(
			@Value("${app.jwt.secret}") String secret,
			@Value("${app.jwt.expiracion-minutos:480}") long expiracionMinutos,
			@Value("${app.jwt.recuperacion.expiracion-minutos:10}") long expiracionRecuperacionMinutos) {
		this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
		this.expiracionMinutos = expiracionMinutos;
		this.expiracionRecuperacionMinutos = expiracionRecuperacionMinutos;
	}

	/** Variante para pruebas unitarias que no necesitan configurar la sesión temporal. */
	JwtService(String secret, long expiracionMinutos) {
		this(secret, expiracionMinutos, 10);
	}

	public String generar(Long usuarioId, Long empresaId, String rol) {
		Instant ahora = Instant.now();
		return Jwts.builder()
				.subject(String.valueOf(usuarioId))
				.claim("empresaId", empresaId)
				.claim("rol", rol)
				.issuedAt(Date.from(ahora))
				.expiration(Date.from(ahora.plus(expiracionMinutos, ChronoUnit.MINUTES)))
				.signWith(key)
				.compact();
	}

	public String generarTokenRecuperacion(Long usuarioId) {
		Instant ahora = Instant.now();
		return Jwts.builder()
				.subject(String.valueOf(usuarioId))
				.claim("proposito", "recuperacion_password")
				.issuedAt(Date.from(ahora))
				.expiration(Date.from(ahora.plus(expiracionRecuperacionMinutos, ChronoUnit.MINUTES)))
				.signWith(key)
				.compact();
	}

	public Long validarTokenRecuperacionYObtenerUsuarioId(String token) {
		Claims claims = validarYObtenerClaims(token);
		String proposito = claims.get("proposito", String.class);
		if (!"recuperacion_password".equals(proposito)) {
			throw new IllegalArgumentException("El token no es un token de recuperación de contraseña");
		}
		return Long.valueOf(claims.getSubject());
	}

	/** Lanza io.jsonwebtoken.JwtException si el token es invalido, esta vencido o fue alterado. */
	public Claims validarYObtenerClaims(String token) {
		return Jwts.parser()
				.verifyWith(key)
				.build()
				.parseSignedClaims(token)
				.getPayload();
	}
}
