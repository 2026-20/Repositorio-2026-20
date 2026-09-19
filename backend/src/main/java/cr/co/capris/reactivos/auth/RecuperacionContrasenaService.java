package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.seguridad.*;
import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Lógica de negocio de HU-046. El controlador (RecuperacionContrasenaController)
 * se mantiene delgado a propósito -- ver .github/ESTRUCTURA.md, convención
 * "...Service para lógica de negocio".
 */
@Service
public class RecuperacionContrasenaService {

	private static final org.slf4j.Logger log =
			org.slf4j.LoggerFactory.getLogger(RecuperacionContrasenaService.class);

	private final UsuarioRepository usuarioRepository;
	private final TokenRecuperacionRepository tokenRecuperacionRepository;
	private final HistorialContrasenaService historialContrasenaService;
	private final BitacoraSeguridadService bitacoraSeguridadService;
	private final EmailService emailService;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;
	private final ValidadorPoliticaContrasena validadorPoliticaContrasena;

	private final int otpExpiracionMinutos;
	private final int otpIntentosMaximos;
	private final boolean emailAsincrono;

	public RecuperacionContrasenaService(
			UsuarioRepository usuarioRepository,
			TokenRecuperacionRepository tokenRecuperacionRepository,
			HistorialContrasenaService historialContrasenaService,
			BitacoraSeguridadService bitacoraSeguridadService,
			EmailService emailService,
			PasswordEncoder passwordEncoder,
			JwtService jwtService,
			ValidadorPoliticaContrasena validadorPoliticaContrasena,
			@Value("${app.email.otp.expiracion-minutos:15}") int otpExpiracionMinutos,
			@Value("${app.email.otp.intentos-maximos:3}") int otpIntentosMaximos,
			@Value("${app.email.asincrono:true}") boolean emailAsincrono) {
		this.usuarioRepository = usuarioRepository;
		this.tokenRecuperacionRepository = tokenRecuperacionRepository;
		this.historialContrasenaService = historialContrasenaService;
		this.bitacoraSeguridadService = bitacoraSeguridadService;
		this.emailService = emailService;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
		this.validadorPoliticaContrasena = validadorPoliticaContrasena;
		this.otpExpiracionMinutos = otpExpiracionMinutos;
		this.otpIntentosMaximos = otpIntentosMaximos;
		this.emailAsincrono = emailAsincrono;
	}

	/**
	 * Criterio 2: desde afuera se comporta exactamente igual exista o no el
	 * correo -- el controller SIEMPRE responde el mismo mensaje genérico. Esta
	 * clase es la única que sabe si de verdad se generó y envió un OTP.
	 * Tampoco se genera OTP para una cuenta INACTIVO -- mismo argumento: no
	 * revelar por temporización ni por efecto observable si una cuenta existe,
	 * está inactiva, o no existe.
	 */
	@Transactional
	public void solicitar(String correo) {
		usuarioRepository.findByCorreo(correo)
				.filter(usuario -> usuario.getEstado() != EstadoUsuario.INACTIVO)
				.ifPresent(usuario -> {
					// Que exista un solo OTP vigente por usuario a la vez.
					List<TokenRecuperacion> anteriores = tokenRecuperacionRepository
							.findByUsuarioIdAndUsadoFalse(usuario.getId());
					anteriores.forEach(t -> t.setUsado(true));
					tokenRecuperacionRepository.saveAll(anteriores);

					String otp = GeneradorOtp.generarSeisDigitos();
					OffsetDateTime ahora = OffsetDateTime.now();
					TokenRecuperacion token = new TokenRecuperacion(
							usuario,
							passwordEncoder.encode(otp), // el OTP nunca se guarda en texto plano
							ahora,
							ahora.plusMinutes(otpExpiracionMinutos));
					tokenRecuperacionRepository.save(token);

					// Criterio 2: el envío NO puede delatar por temporización si el
					// correo existe o no, así que por defecto va en segundo plano
					// (fire-and-forget). Cuando app.email.asincrono=false (solo en
					// pruebas de integración) se envía en el hilo actual para poder
					// capturar el OTP sin carreras.
					if (emailAsincrono) {
						enviarOtpEnSegundoPlano(usuario, otp);
					} else {
						emailService.enviarOtpRecuperacion(
								usuario.getCorreo(), usuario.getNombreCompleto(), otp, otpExpiracionMinutos);
					}

					bitacoraSeguridadService.registrar(usuario.getUsername(), usuario.getId(),
							TipoEventoSeguridad.CONTRASENA_RECUPERACION_SOLICITADA,
							"OTP de recuperación generado y enviado por correo");
				});
		// Si no existe el correo (o la cuenta está inactiva): no se hace nada --
		// ni se escribe en la bitácora, ni se lanza ninguna excepción. El
		// controller responde el mismo mensaje genérico en cualquier caso.
	}

	/**
	 * Envío fire-and-forget: este método NO debe tardar (la respuesta HTTP no
	 * debe esperar a SendGrid, criterio 2) ni propagar el error al hilo que
	 * atiende la petición -- cualquier fallo del proveedor se registra en el
	 * log y no rompe la llamada (el usuario igual recibe el mensaje genérico).
	 */
	private void enviarOtpEnSegundoPlano(Usuario usuario, String otp) {
		String correo = usuario.getCorreo();
		String nombreCompleto = usuario.getNombreCompleto();
		CompletableFuture.runAsync(() -> {
			try {
				emailService.enviarOtpRecuperacion(correo, nombreCompleto, otp, otpExpiracionMinutos);
			} catch (RuntimeException ex) {
				log.error("No se pudo enviar el OTP de recuperación a {}", correo, ex);
			}
		});
	}

	/**
	 * Criterios 3 y 5. Devuelve el token de sesión temporal (criterio 4) si el OTP es válido.
	 *
	 * IMPORTANTE: noRollbackFor -- los fallos de validación (OTP incorrecto, token
	 * vencido, tope de 3 intentos) deben PERSISTIR su efecto (contador de intentos,
	 * token marcado usado) aunque la petición termine en error. Sin esto, el rollback
	 * de la transacción desharía el incremento y el tope de 3 intentos jamás aplicaría.
	 */
	@Transactional(noRollbackFor = { TokenRecuperacionInvalidoException.class,
			TokenRecuperacionBloqueadoException.class, TokenRecuperacionExpiradoException.class })
	public String validarOtp(String correo, String otpIngresado) {
		Usuario usuario = usuarioRepository.findByCorreo(correo)
				.orElseThrow(() -> new TokenRecuperacionInvalidoException("Código incorrecto o vencido"));

		TokenRecuperacion token = tokenRecuperacionRepository
				.findFirstByUsuarioIdAndUsadoFalseOrderByCreadoEnDesc(usuario.getId())
				.orElseThrow(() -> new TokenRecuperacionInvalidoException("Código incorrecto o vencido"));

		if (token.getExpiraEn().isBefore(OffsetDateTime.now())) {
			token.setUsado(true);
			tokenRecuperacionRepository.save(token);
			throw new TokenRecuperacionExpiradoException("El código venció -- solicitá uno nuevo");
		}

		if (!passwordEncoder.matches(otpIngresado, token.getToken())) {
			token.incrementarIntentosFallidos();
			if (token.getIntentosFallidos() >= otpIntentosMaximos) {
				token.setUsado(true);
				tokenRecuperacionRepository.save(token);
				bitacoraSeguridadService.registrar(usuario.getUsername(), usuario.getId(),
						TipoEventoSeguridad.TOKEN_RECUPERACION_INVALIDADO,
						"Token de recuperación invalidado tras " + otpIntentosMaximos + " intentos fallidos");
				throw new TokenRecuperacionBloqueadoException(
						"Se superó el número de intentos permitidos -- solicitá un nuevo código");
			}
			tokenRecuperacionRepository.save(token);
			throw new TokenRecuperacionInvalidoException("Código incorrecto o vencido");
		}

		token.setUsado(true); // de un solo uso, aunque el paso final todavía no se completó
		tokenRecuperacionRepository.save(token);

		return jwtService.generarTokenRecuperacion(usuario.getId());
	}

	/** Criterio 4, segunda mitad: cambia la contraseña usando la sesión temporal. */
	@Transactional
	public void establecerNuevaContrasena(String tokenSesionTemporal, String nuevaContrasena) {
		Long usuarioId = jwtService.validarTokenRecuperacionYObtenerUsuarioId(tokenSesionTemporal);
		Usuario usuario = usuarioRepository.findById(usuarioId)
				.orElseThrow(() -> new UsuarioNoEncontradoException("Usuario no encontrado"));

		List<String> violaciones = new ArrayList<>(validadorPoliticaContrasena.validar(nuevaContrasena));
		if (historialContrasenaService.fueUsadaRecientemente(usuario, nuevaContrasena)) {
			violaciones.add("No podés reutilizar una contraseña usada recientemente");
		}
		if (!violaciones.isEmpty()) {
			throw new ContrasenaNoValidaException(violaciones);
		}

		historialContrasenaService.registrarContrasenaReemplazada(usuario);
		usuario.setPasswordHash(passwordEncoder.encode(nuevaContrasena));
		usuario.setIntentosFallidos(0);
		usuario.setBloqueadoHasta(null);
		usuarioRepository.save(usuario);

		// Criterio 4: la sesión temporal es de UN solo uso -- al completar el
		// cambio se revoca su jti; reutilizar el mismo JWT ya no debe servir.
		jwtService.revocarTokenRecuperacion(tokenSesionTemporal);

		bitacoraSeguridadService.registrar(usuario.getUsername(), usuario.getId(),
				TipoEventoSeguridad.CONTRASENA_CAMBIADA,
				"Contraseña restablecida vía recuperación por OTP");
	}
}
