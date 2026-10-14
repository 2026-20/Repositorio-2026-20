package cr.co.capris.reactivos.seguridad;

import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;

/**
 * HU-050: recorre los usuarios activos y manda el aviso de vencimiento
 * proximo (5/3/1 dias) a quien le corresponda ese dia exacto -- pensado
 * para correr una vez al dia (ver AvisoCaducidadContrasenaScheduler).
 *
 * "Exactamente" 5/3/1 dias es literal (criterios 1-3): si el job no corre
 * ese dia puntual (el servicio estuvo caido, por ejemplo), ese aviso en
 * particular no se reenvia despues -- es una simplificacion deliberada,
 * igual de valida que agregar una ventana de "ponerse al dia" pero mucho
 * mas simple y facil de probar; si el equipo prefiere lo segundo, es un
 * cambio acotado a este metodo.
 */
@Service
public class AvisoCaducidadContrasenaService {

	private static final Logger log = LoggerFactory.getLogger(AvisoCaducidadContrasenaService.class);

	private final UsuarioRepository usuarioRepository;
	private final AvisoCaducidadEnviadoRepository avisoCaducidadEnviadoRepository;
	private final EmailService emailService;
	private final BitacoraSeguridadService bitacoraSeguridadService;
	private final Clock clock;

	@Autowired
	public AvisoCaducidadContrasenaService(
			UsuarioRepository usuarioRepository,
			AvisoCaducidadEnviadoRepository avisoCaducidadEnviadoRepository,
			EmailService emailService,
			BitacoraSeguridadService bitacoraSeguridadService) {
		this(usuarioRepository, avisoCaducidadEnviadoRepository, emailService, bitacoraSeguridadService,
				Clock.systemUTC());
	}

	AvisoCaducidadContrasenaService(
			UsuarioRepository usuarioRepository,
			AvisoCaducidadEnviadoRepository avisoCaducidadEnviadoRepository,
			EmailService emailService,
			BitacoraSeguridadService bitacoraSeguridadService,
			Clock clock) {
		this.usuarioRepository = usuarioRepository;
		this.avisoCaducidadEnviadoRepository = avisoCaducidadEnviadoRepository;
		this.emailService = emailService;
		this.bitacoraSeguridadService = bitacoraSeguridadService;
		this.clock = clock;
	}

	public void enviarAvisosPendientes() {
		for (Usuario usuario : usuarioRepository.findAllByEstado(EstadoUsuario.ACTIVO)) {
			OffsetDateTime expiraEn = usuario.getPasswordExpiraEn();
			if (expiraEn == null) {
				continue;
			}

			long diasRestantes = ChronoUnit.DAYS.between(LocalDate.now(clock), expiraEn.toLocalDate());

			for (TipoAvisoCaducidad tipo : TipoAvisoCaducidad.values()) {
				if (diasRestantes == tipo.getDias()) {
					enviarSiNoSeHaEnviadoAntes(usuario, tipo, expiraEn);
				}
			}
		}
	}

	private void enviarSiNoSeHaEnviadoAntes(Usuario usuario, TipoAvisoCaducidad tipo, OffsetDateTime expiraEn) {
		// Criterio 5: no reenviar el mismo aviso para la misma vigencia.
		if (avisoCaducidadEnviadoRepository.existsByUsuarioIdAndTipoAvisoAndPasswordExpiraEn(
				usuario.getId(), tipo, expiraEn)) {
			return;
		}

		try {
			emailService.enviarAvisoCaducidadContrasena(
					usuario.getCorreo(), usuario.getNombreCompleto(), expiraEn, tipo.getDias());

			avisoCaducidadEnviadoRepository.save(
					new AvisoCaducidadEnviado(usuario.getId(), tipo, expiraEn, OffsetDateTime.now(clock)));

			bitacoraSeguridadService.registrar(usuario.getUsername(), usuario.getId(),
					TipoEventoSeguridad.AVISO_CADUCIDAD_ENVIADO,
					"Aviso de vencimiento de contraseña enviado (" + tipo.getDias() + " dias restantes)");
		} catch (Exception ex) {
			// Igual que AltaUsuarioService con el correo de credenciales: un
			// proveedor de correo caido no debe tumbar el resto del recorrido
			// (los demas usuarios siguen recibiendo su aviso normalmente).
			log.error("No se pudo enviar el aviso de caducidad ({}) a {}", tipo, usuario.getCorreo(), ex);
			bitacoraSeguridadService.registrar(usuario.getUsername(), usuario.getId(),
					TipoEventoSeguridad.AVISO_CADUCIDAD_ENVIADO,
					"Fallo el envio del aviso de caducidad (" + tipo.getDias() + " dias): " + ex.getMessage());
		}
	}
}
