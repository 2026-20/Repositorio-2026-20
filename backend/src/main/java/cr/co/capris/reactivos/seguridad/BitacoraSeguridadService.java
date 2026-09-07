package cr.co.capris.reactivos.seguridad;

import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

/**
 * Punto unico de escritura a la bitacora de seguridad. Deliberadamente no decide
 * CUANDO registrar cada evento -- eso lo decide cada HU (HU-043 en login fallido,
 * HU-047 en alta de usuario, HU-048 en baja logica, etc.), esto solo evita que cada
 * quien reimplemente el guardado del registro a su manera.
 */
@Service
public class BitacoraSeguridadService {

	private final BitacoraSeguridadRepository bitacoraSeguridadRepository;

	public BitacoraSeguridadService(BitacoraSeguridadRepository bitacoraSeguridadRepository) {
		this.bitacoraSeguridadRepository = bitacoraSeguridadRepository;
	}

	public void registrar(String username, Long usuarioId, TipoEventoSeguridad tipoEvento, String detalle) {
		bitacoraSeguridadRepository.save(
				new BitacoraSeguridad(username, usuarioId, tipoEvento, detalle, OffsetDateTime.now()));
	}
}
