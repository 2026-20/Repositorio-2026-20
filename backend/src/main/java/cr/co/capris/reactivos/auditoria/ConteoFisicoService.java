package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.seguridad.AccesoNoAutorizadoException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * HU-005. La idempotencia es lo unico que esta capa resuelve de verdad --
 * el resto (validar cantidad >= 0) ya lo cubren RegistrarConteoRequest +
 * el constructor de ConteoFisico (doble control a proposito, igual que
 * ContrasenaNoValidaException en el paquete seguridad).
 *
 * HU-038 criterio 4: no se acepta un conteo si el usuario no confirmo el
 * inicio de jornada hoy (ver JornadaService).
 *
 * HU-007: corregir() actualiza el MISMO registro (no crea uno nuevo) -- ver
 * javadoc de ConteoFisico.corregir() sobre por que, a diferencia de
 * BitacoraSeguridad/RegistroTrazabilidad, este si se muta. Solo el usuario
 * que registro el conteo puede corregirlo.
 *
 * Deliberadamente NO resuelto aqui (para quien implemente las HUs que
 * siguen):
 *   - HU-025/026 (guardar avance parcial / reanudar): esto asume que cada
 *     ConteoFisico que llega ya esta "terminado" del lado del cliente. El
 *     borrador mientras el usuario cuenta vive en el almacenamiento local
 *     de la PWA (wa-sqlite/OPFS), no aqui.
 *   - HU-040/041 (validar y enviar al ERP): esto solo persiste el conteo
 *     localmente, no arma ni envia nada al ERP -- por eso ConteoFisico.transmitido
 *     siempre queda en false hoy (ver su javadoc).
 */
@Service
public class ConteoFisicoService {

	private final ConteoFisicoRepository conteoFisicoRepository;
	private final JornadaService jornadaService;

	public ConteoFisicoService(ConteoFisicoRepository conteoFisicoRepository, JornadaService jornadaService) {
		this.conteoFisicoRepository = conteoFisicoRepository;
		this.jornadaService = jornadaService;
	}

	@Transactional
	public ConteoFisico registrar(RegistrarConteoRequest request, Long usuarioId) {
		// Idempotente primero: un reintento de algo que YA se guardo (sync
		// que se cayo a medio camino, quiza un dia despues) nunca debe
		// fallar por la jornada -- el chequeo de jornada solo aplica a
		// conteos genuinamente nuevos.
		Optional<ConteoFisico> existente = conteoFisicoRepository.findByIdempotenciaKey(request.idempotenciaKey());
		if (existente.isPresent()) {
			return existente.get();
		}

		if (!jornadaService.estaIniciada(usuarioId, LocalDate.now())) {
			throw new JornadaNoIniciadaException(
					"No se puede registrar el conteo sin confirmar antes el inicio de jornada");
		}

		return conteoFisicoRepository.save(new ConteoFisico(
				request.idempotenciaKey(),
				request.codBod(),
				request.codArt(),
				request.numLote(),
				request.numCon(),
				request.cantidadTeorica(),
				request.cantidadFisica(),
				usuarioId,
				request.observaciones(),
				OffsetDateTime.now()));
	}

	// HU-007: corrige un conteo ya registrado. No existe (404), pertenece a
	// otro usuario (403, criterio implicito de "mi" conteo), o ya esta
	// transmitido (409, criterio 3 -- ver ConteoFisico.corregir()) son los
	// tres motivos de rechazo; la validacion de cantidad (criterio 4) la
	// aplica el propio metodo corregir() de la entidad.
	@Transactional
	public ConteoFisico corregir(Long id, CorregirConteoRequest request, Long usuarioId) {
		ConteoFisico conteo = conteoFisicoRepository.findById(id)
				.orElseThrow(() -> new ConteoFisicoNoEncontradoException("No existe el conteo solicitado"));

		if (!conteo.getUsuarioId().equals(usuarioId)) {
			throw new AccesoNoAutorizadoException("No autorizado para corregir este conteo");
		}

		conteo.corregir(request.cantidadFisica(), request.observaciones());
		return conteoFisicoRepository.save(conteo);
	}
}
