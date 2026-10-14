package cr.co.capris.reactivos.auditoria;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Punto unico de escritura de la trazabilidad de acciones (HU-031). Igual
 * que BitacoraSeguridadService, deliberadamente no decide CUANDO trazar
 * cada accion -- eso lo decide quien la dispara (AutenticacionController en
 * el login, ConteoFisicoService en el registro de un conteo, etc.), esto
 * solo evita que cada quien reimplemente el guardado a su manera.
 */
@Service
public class TrazabilidadService {

	private final RegistroTrazabilidadRepository registroTrazabilidadRepository;

	public TrazabilidadService(RegistroTrazabilidadRepository registroTrazabilidadRepository) {
		this.registroTrazabilidadRepository = registroTrazabilidadRepository;
	}

	/**
	 * Para acciones que el propio backend dispara (ej. HU-031: inicio de
	 * sesion) -- no hay idIdempotencia de un cliente offline, asi que se
	 * genera uno nuevo en cada llamada.
	 */
	@Transactional
	public RegistroTrazabilidad registrar(
			TipoAccionTrazabilidad tipoAccion,
			Long usuarioId,
			Long empresaId,
			String codBod,
			ResultadoAccionTrazabilidad resultado,
			String detalle) {
		return registrar(
				java.util.UUID.randomUUID().toString(),
				tipoAccion, usuarioId, empresaId, codBod, resultado, detalle, OffsetDateTime.now());
	}

	/**
	 * Para acciones que el cliente genero offline y esta sincronizando (ej.
	 * un conteo registrado en campo) -- idempotente: si idIdempotencia ya
	 * existe (reintento de una sincronizacion que se cayo a medio camino),
	 * devuelve el registro existente en vez de duplicarlo.
	 */
	@Transactional
	public RegistroTrazabilidad registrar(
			String idIdempotencia,
			TipoAccionTrazabilidad tipoAccion,
			Long usuarioId,
			Long empresaId,
			String codBod,
			ResultadoAccionTrazabilidad resultado,
			String detalle,
			OffsetDateTime fecha) {
		Optional<RegistroTrazabilidad> existente = registroTrazabilidadRepository.findByIdIdempotencia(idIdempotencia);
		if (existente.isPresent()) {
			return existente.get();
		}

		return registroTrazabilidadRepository.save(new RegistroTrazabilidad(
				idIdempotencia, tipoAccion, usuarioId, empresaId, codBod, resultado, detalle, fecha));
	}

	/** HU-031 criterio 4: un Administrador ve el log completo de su empresa. */
	public List<RegistroTrazabilidad> listarPorEmpresa(Long empresaId) {
		return registroTrazabilidadRepository.findAllByEmpresaIdOrderByFechaDesc(empresaId);
	}

	/** HU-031 criterio 4: un Usuario de Campo ve solo su propia actividad. */
	public List<RegistroTrazabilidad> listarPorEmpresaYUsuario(Long empresaId, Long usuarioId) {
		return registroTrazabilidadRepository.findAllByEmpresaIdAndUsuarioIdOrderByFechaDesc(empresaId, usuarioId);
	}
}
