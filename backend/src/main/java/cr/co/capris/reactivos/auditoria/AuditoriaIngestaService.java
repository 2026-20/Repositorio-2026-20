package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.auditoria.xml.BodegaXml;
import cr.co.capris.reactivos.auditoria.xml.DetalleBodegaXml;
import cr.co.capris.reactivos.auditoria.xml.EstadoVisitaXml;
import cr.co.capris.reactivos.auditoria.xml.LoteBodegaXml;
import cr.co.capris.reactivos.auditoria.xml.LoteMovimientoXml;
import cr.co.capris.reactivos.auditoria.xml.MovimientoPendienteXml;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.List;
import java.util.function.Consumer;

/**
 * Toma lo que ya separo AuditoriaXmlParser (que a su vez ya descarta y
 * loguea filas con errores de formato -- ver AuditoriaRowReader), lo
 * mapea a entidades con AuditoriaXmlMapper y lo guarda.
 *
 * Misma tolerancia por fila que el parseo, pero un nivel mas abajo: aqui
 * una fila puede sobrevivir el parseo (sus valores eran formato valido)
 * y aun asi fallar al mapearse (ej. un TipoBodega que no existe en el
 * enum, ver AuditoriaXmlMapper) o al guardarse en la base (ej. una
 * violacion de constraint que no se previo). En ambos casos se descarta
 * esa fila sola -- no el archivo completo -- se loguea igual que en
 * AuditoriaRowReader, y la ingesta sigue con las demas filas. El guardado
 * de cada fila corre en su propia transaccion (ver AuditoriaFilaTransaccional)
 * para que una fila que falle al guardarse no eche para atras las que ya
 * se guardaron antes en la misma corrida.
 *
 * Upsert por archivo (estas 6 tablas no tienen FK entre ellas -- ver
 * javadoc de Bodega):
 *   - Bodega / DetalleBodega / LoteBodega: por su clave natural, se borra
 *     la fila anterior (si existia) y se inserta la nueva -- son datos de
 *     snapshot del ERP, no hay nada que preservar de una ingesta a la
 *     siguiente. Importante: despues del delete() hace falta un flush()
 *     explicito antes del save() -- Hibernate manda los INSERT antes que
 *     los DELETE al confirmar la transaccion por defecto, asi que sin el
 *     flush el INSERT del upsert choca contra la fila vieja que todavia
 *     no se borro de verdad en la base (se encontro este bug corriendo
 *     AuditoriaIngestaServiceIT contra Postgres real -- un mock no lo
 *     detecta, porque no simula el orden real de flush de Hibernate).
 *   - ResultadoVisita: se actualizan los campos que vienen del ERP pero
 *     se preserva el resultado de auditoria ya registrado, si lo habia
 *     (ver ResultadoVisita.actualizarDatosDelErp) -- si no se hiciera
 *     esto, reingestar el snapshot mientras una visita ya tiene resultado
 *     lo borraria.
 *   - MovimientoPendiente / LoteMovimiento: antes de insertar las filas
 *     del archivo nuevo se borran todas las que ya existieran para esa
 *     misma visita (bodega+fecha+hora+secuencia, ver IdentificadorVisita),
 *     para que reingestar el mismo archivo no duplique filas.
 */
@Service
public class AuditoriaIngestaService {

	private static final Logger log = LoggerFactory.getLogger(AuditoriaIngestaService.class);

	private final AuditoriaXmlParser parser;
	private final AuditoriaXmlMapper mapper;
	private final AuditoriaFilaTransaccional filaTransaccional;
	private final BodegaRepository bodegaRepository;
	private final ResultadoVisitaRepository resultadoVisitaRepository;
	private final DetalleBodegaRepository detalleBodegaRepository;
	private final LoteBodegaRepository loteBodegaRepository;
	private final MovimientoPendienteRepository movimientoPendienteRepository;
	private final LoteMovimientoRepository loteMovimientoRepository;

	public AuditoriaIngestaService(
			AuditoriaXmlParser parser,
			AuditoriaXmlMapper mapper,
			AuditoriaFilaTransaccional filaTransaccional,
			BodegaRepository bodegaRepository,
			ResultadoVisitaRepository resultadoVisitaRepository,
			DetalleBodegaRepository detalleBodegaRepository,
			LoteBodegaRepository loteBodegaRepository,
			MovimientoPendienteRepository movimientoPendienteRepository,
			LoteMovimientoRepository loteMovimientoRepository) {
		this.parser = parser;
		this.mapper = mapper;
		this.filaTransaccional = filaTransaccional;
		this.bodegaRepository = bodegaRepository;
		this.resultadoVisitaRepository = resultadoVisitaRepository;
		this.detalleBodegaRepository = detalleBodegaRepository;
		this.loteBodegaRepository = loteBodegaRepository;
		this.movimientoPendienteRepository = movimientoPendienteRepository;
		this.loteMovimientoRepository = loteMovimientoRepository;
	}

	public ResultadoIngesta ingestarBodegas(InputStream entrada, String origen) {
		List<BodegaXml> filas = parser.leerBodegas(entrada, origen);
		return procesarFilas(filas, origen, xml -> {
			Bodega entidad = mapper.aEntidad(xml);
			bodegaRepository
					.findByNumConAndCodBodAndTipoBod(entidad.getNumCon(), entidad.getCodBod(), entidad.getTipoBod())
					.ifPresent(existente -> {
						bodegaRepository.delete(existente);
						// Sin este flush, Hibernate manda el INSERT antes que el
						// DELETE al confirmar la transaccion (ese es su orden por
						// defecto) y el upsert choca contra la fila vieja que
						// todavia no se borro de verdad en la base.
						bodegaRepository.flush();
					});
			bodegaRepository.save(entidad);
		});
	}

	public ResultadoIngesta ingestarEstadosVisita(InputStream entrada, String origen) {
		List<EstadoVisitaXml> filas = parser.leerEstadosVisita(entrada, origen);
		return procesarFilas(filas, origen, xml -> {
			ResultadoVisita nuevo = mapper.aEntidad(xml);
			resultadoVisitaRepository.findByNumConAndCodBod(nuevo.getNumCon(), nuevo.getCodBod())
					.ifPresentOrElse(
							existente -> {
								existente.actualizarDatosDelErp(nuevo);
								resultadoVisitaRepository.save(existente);
							},
							() -> resultadoVisitaRepository.save(nuevo));
		});
	}

	public ResultadoIngesta ingestarDetalleBodega(InputStream entrada, String origen) {
		List<DetalleBodegaXml> filas = parser.leerDetalleBodega(entrada, origen);
		return procesarFilas(filas, origen, xml -> {
			DetalleBodega entidad = mapper.aEntidad(xml);
			detalleBodegaRepository
					.findByCodBodAndCodArtAndNumCon(entidad.getCodBod(), entidad.getCodArt(), entidad.getNumCon())
					.ifPresent(existente -> {
						detalleBodegaRepository.delete(existente);
						// Mismo motivo que en ingestarBodegas: forzar el DELETE antes
						// del INSERT del upsert.
						detalleBodegaRepository.flush();
					});
			detalleBodegaRepository.save(entidad);
		});
	}

	public ResultadoIngesta ingestarLoteBodega(InputStream entrada, String origen) {
		List<LoteBodegaXml> filas = parser.leerLoteBodega(entrada, origen);
		return procesarFilas(filas, origen, xml -> {
			LoteBodega entidad = mapper.aEntidad(xml);
			loteBodegaRepository
					.findByCodBodAndCodArtAndNumLote(entidad.getCodBod(), entidad.getCodArt(), entidad.getNumLote())
					.ifPresent(existente -> {
						loteBodegaRepository.delete(existente);
						// Mismo motivo que en ingestarBodegas.
						loteBodegaRepository.flush();
					});
			loteBodegaRepository.save(entidad);
		});
	}

	/** "nombreArchivo" tiene que calzar con el patron de IdentificadorVisita -- ver su javadoc. */
	public ResultadoIngesta ingestarMovimientosPendientes(InputStream entrada, String nombreArchivo) {
		IdentificadorVisita visita = IdentificadorVisita.desdeNombreArchivo(nombreArchivo);
		List<MovimientoPendienteXml> filas = parser.leerMovimientosPendientes(entrada, nombreArchivo);

		filaTransaccional.ejecutar(() -> movimientoPendienteRepository.deleteAll(
				movimientoPendienteRepository.findAllByCodBodVisitaAndFechaVisitaAndHoraVisitaAndSecuenciaVisita(
						visita.codBod(), visita.fecha(), visita.hora(), visita.secuencia())));

		return procesarFilas(filas, nombreArchivo,
				xml -> movimientoPendienteRepository.save(mapper.aEntidad(xml, visita)));
	}

	/** Mismo contrato que ingestarMovimientosPendientes -- ver su javadoc. */
	public ResultadoIngesta ingestarLotesMovimiento(InputStream entrada, String nombreArchivo) {
		IdentificadorVisita visita = IdentificadorVisita.desdeNombreArchivo(nombreArchivo);
		List<LoteMovimientoXml> filas = parser.leerLotesMovimiento(entrada, nombreArchivo);

		filaTransaccional.ejecutar(() -> loteMovimientoRepository.deleteAll(
				loteMovimientoRepository.findAllByCodBodVisitaAndFechaVisitaAndHoraVisitaAndSecuenciaVisita(
						visita.codBod(), visita.fecha(), visita.hora(), visita.secuencia())));

		return procesarFilas(filas, nombreArchivo,
				xml -> loteMovimientoRepository.save(mapper.aEntidad(xml, visita)));
	}

	/**
	 * El indice de fila en los logs es la posicion dentro de la lista que ya
	 * devolvio el parser -- si el parser mismo descarto filas antes (ver
	 * AuditoriaRowReader), ese numero no es el numero de fila original del
	 * archivo. Se documenta asi en vez de intentar hacerlos calzar: cada capa
	 * loguea su propio progreso, y entre los dos logs (parseo + ingesta) se
	 * puede reconstruir que paso.
	 */
	private <T> ResultadoIngesta procesarFilas(List<T> filas, String origen, Consumer<T> procesarUnaFila) {
		int descartadas = 0;
		for (int i = 0; i < filas.size(); i++) {
			T fila = filas.get(i);
			int numeroFila = i + 1;
			try {
				filaTransaccional.ejecutar(() -> procesarUnaFila.accept(fila));
			} catch (RuntimeException e) {
				descartadas++;
				log.warn("{}: fila #{} descartada al mapear/guardar ({}: {}).",
						origen, numeroFila, e.getClass().getSimpleName(), e.getMessage());
			}
		}
		if (descartadas > 0) {
			log.warn("{}: {} de {} filas descartadas al mapear/guardar (ver detalle arriba).",
					origen, descartadas, filas.size());
		}
		return new ResultadoIngesta(filas.size() - descartadas, descartadas);
	}
}
