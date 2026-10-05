package cr.co.capris.reactivos.auditoria;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * SUPUESTO (no confirmado con el ERP, ver estudio de auditoria 2026-10): los
 * archivos cai_det_mov/cai_lot_mov no traen un ID de visita dentro del XML
 * -- se asume que el nombre de archivo es la unica forma de identificar a
 * cual bodega y momento de visita pertenecen, con el formato visto en los
 * datos de prueba:
 *
 * <pre>med_wmolina_A2070000_20260724_cai_det_mov_2026-07-24_1640_1.xml</pre>
 *
 * org_usuario_bodega_fechaCorta_cai_{det|lot}_mov_fecha_hora_secuencia.xml
 *
 * Si un archivo no calza con este patron, se prefiere fallar fuerte aqui
 * (y quedar en el log) a procesarlo adivinando a que bodega/visita
 * pertenece.
 */
public record IdentificadorVisita(
		String codOrg,
		String codUsu,
		String codBod,
		LocalDate fecha,
		LocalTime hora,
		int secuencia) {

	private static final Pattern PATRON = Pattern.compile(
			"^([a-zA-Z]+)_([a-zA-Z0-9]+)_([A-Za-z0-9]+)_\\d{8}_cai_(?:det|lot)_mov_"
					+ "(\\d{4}-\\d{2}-\\d{2})_(\\d{4})_(\\d+)\\.xml$");

	private static final DateTimeFormatter FORMATO_HORA = DateTimeFormatter.ofPattern("HHmm");

	public static IdentificadorVisita desdeNombreArchivo(String nombreArchivo) {
		Matcher coincidencia = PATRON.matcher(nombreArchivo);
		if (!coincidencia.matches()) {
			throw new IllegalArgumentException(
					"El nombre de archivo no calza con el patron esperado de visita "
							+ "(org_usuario_bodega_fecha_cai_{det|lot}_mov_fecha_hora_secuencia.xml): "
							+ nombreArchivo);
		}
		return new IdentificadorVisita(
				coincidencia.group(1).toUpperCase(),
				coincidencia.group(2).toUpperCase(),
				coincidencia.group(3),
				LocalDate.parse(coincidencia.group(4)),
				LocalTime.parse(coincidencia.group(5), FORMATO_HORA),
				Integer.parseInt(coincidencia.group(6)));
	}
}
