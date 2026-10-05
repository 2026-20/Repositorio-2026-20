package cr.co.capris.reactivos.auditoria.xml;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/** Conversiones compartidas al leer una fila cruda (Map tag -&gt; texto). */
final class CamposXml {

	private CamposXml() {
	}

	static String texto(Map<String, String> fila, String tag) {
		return fila.get(tag);
	}

	static BigDecimal decimal(Map<String, String> fila, String tag) {
		String valor = fila.get(tag);
		// Los decimales del ERP vienen a veces sin cero inicial (".25", ".75")
		// -- BigDecimal los acepta igual, ver AuditoriaXmlParserTest.
		return (valor == null || valor.isBlank()) ? null : new BigDecimal(valor);
	}

	static LocalDate fecha(Map<String, String> fila, String tag) {
		String valor = fila.get(tag);
		return (valor == null || valor.isBlank()) ? null : LocalDate.parse(valor);
	}
}
