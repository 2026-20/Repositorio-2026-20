package cr.co.capris.reactivos.auditoria;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Solo lectura: datos de referencia que vienen del ERP (ver paquete .xml y
 * AuditoriaIngestaService), para que HU-004 pueda listar el contexto
 * (bodegas/contratos) y HU-005 pueda cargar lo que hay que contar. Pensado
 * para que la PWA lo descargue y lo cachee localmente antes de salir a
 * campo (ver decision offline-first, wa-sqlite/OPFS) -- este endpoint no
 * sabe nada de sincronizacion ni de cache, solo devuelve el estado actual.
 *
 * Sin filtro de empresa todavia -- ver SUPUESTO en Bodega.empresaId.
 */
@RestController
@RequestMapping("/api/auditoria/bodegas")
public class BodegaConsultaController {

	private final BodegaRepository bodegaRepository;
	private final DetalleBodegaRepository detalleBodegaRepository;
	private final LoteBodegaRepository loteBodegaRepository;

	public BodegaConsultaController(
			BodegaRepository bodegaRepository,
			DetalleBodegaRepository detalleBodegaRepository,
			LoteBodegaRepository loteBodegaRepository) {
		this.bodegaRepository = bodegaRepository;
		this.detalleBodegaRepository = detalleBodegaRepository;
		this.loteBodegaRepository = loteBodegaRepository;
	}

	@GetMapping
	public List<BodegaResumenDTO> listar() {
		return bodegaRepository.findAll().stream().map(BodegaResumenDTO::desde).toList();
	}

	/** HU-005: catalogo de articulos esperados en la bodega, con su cantidad teorica. */
	@GetMapping("/{codBod}/detalle")
	public List<DetalleBodegaResumenDTO> detalle(@PathVariable String codBod) {
		return detalleBodegaRepository.findAllByCodBod(codBod).stream()
				.map(DetalleBodegaResumenDTO::desde)
				.toList();
	}

	/** HU-005: lotes y vencimientos de la bodega (solo articulos con indicador de lote). */
	@GetMapping("/{codBod}/lotes")
	public List<LoteBodegaResumenDTO> lotes(@PathVariable String codBod) {
		return loteBodegaRepository.findAllByCodBod(codBod).stream()
				.map(LoteBodegaResumenDTO::desde)
				.toList();
	}
}
