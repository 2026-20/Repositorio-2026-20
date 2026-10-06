package cr.co.capris.reactivos.auditoria;

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
 * Deliberadamente NO resuelto aqui (para quien implemente las HUs que
 * siguen):
 *   - HU-025/026 (guardar avance parcial / reanudar): esto asume que cada
 *     ConteoFisico que llega ya esta "terminado" del lado del cliente. El
 *     borrador mientras el usuario cuenta vive en el almacenamiento local
 *     de la PWA (wa-sqlite/OPFS), no aqui.
 *   - HU-007 (corregir conteo ya registrado): hoy no hay "actualizar" --
 *     solo registrar(). Si se corrige, es decision de quien implemente esa
 *     HU si se actualiza el mismo registro o se crea uno nuevo con
 *     trazabilidad del cambio.
 *   - HU-040/041 (validar y enviar al ERP): esto solo persiste el conteo
 *     localmente, no arma ni envia nada al ERP.
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
}
