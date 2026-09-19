package cr.co.capris.reactivos.seguridad;

import cr.co.capris.reactivos.usuario.Usuario;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Infraestructura compartida (mismo patrón que BitacoraSeguridadService) para
 * que cualquier HU que cambie la contraseña de un usuario (HU-044, HU-045,
 * HU-046) pueda impedir que se reutilice una contraseña reciente, sin que cada
 * quien reimplemente esta lógica por su lado.
 *
 * Cuántas contraseñas atrás se revisan es una decisión de producto, no
 * técnica -- se dejó en 5 aquí; ajustar si el equipo define otro número en la
 * política de seguridad real.
 */
@Service
public class HistorialContrasenaService {

	private final HistorialContrasenaRepository historialContrasenaRepository;
	private final PasswordEncoder passwordEncoder;

	public HistorialContrasenaService(HistorialContrasenaRepository historialContrasenaRepository,
                                      PasswordEncoder passwordEncoder) {
		this.historialContrasenaRepository = historialContrasenaRepository;
		this.passwordEncoder = passwordEncoder;
	}

	/** true si nuevaContrasenaEnTextoPlano coincide con la actual o con alguna de las últimas 5. */
	public boolean fueUsadaRecientemente(Usuario usuario, String nuevaContrasenaEnTextoPlano) {
		if (passwordEncoder.matches(nuevaContrasenaEnTextoPlano, usuario.getPasswordHash())) {
			return true;
		}
		List<HistorialContrasena> ultimas = historialContrasenaRepository
				.findTop5ByUsuario_IdOrderByCreadoEnDesc(usuario.getId());
		return ultimas.stream()
				.anyMatch(h -> passwordEncoder.matches(nuevaContrasenaEnTextoPlano, h.getPasswordHash()));
	}

	/** Guarda el hash que está a punto de reemplazarse, antes de sobreescribirlo. */
	public void registrarContrasenaReemplazada(Usuario usuario) {
		historialContrasenaRepository.save(
				new HistorialContrasena(usuario, usuario.getPasswordHash(), OffsetDateTime.now()));
	}
}
