package cr.co.capris.reactivos.auditoria.xml;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Lee el patron {@code <ROWSET><ROW>tag1<...>tag2<...></ROW>...</ROWSET>}
 * compartido por los 6 XML que manda el ERP (ver estudio de auditoria
 * 2026-10), con StAX puro -- sin ninguna libreria externa de mapeo
 * XML-a-objeto.
 *
 * Se descarto jackson-dataformat-xml: no tiene version compatible con
 * Jackson 3 (el que usa Spring Boot 4.1.1 para todo lo demas en este
 * proyecto -- confirmado con "mvn dependency:tree"), asi que agregarla
 * trae una segunda pila completa de Jackson 2.x en paralelo solo para
 * leer estos 6 archivos. (Nota honesta: en el camino se sospecho tambien
 * de un bug de esa libreria perdiendo filas en cai_det_mov/cai_lot_mov --
 * resulto ser una confusion propia, el numero "esperado" con el que se
 * comparaba estaba mal, no la libreria; ver el commit/PR de este cambio.
 * El motivo real y verificado para no usarla es solo el de Jackson 3.)
 * Dado que cada ROW es plano (tags hijos sin sub-hijos, texto directo),
 * un lector StAX explicito con javax.xml.stream del JDK es mas codigo
 * pero sin depender de ninguna libreria externa ni de su compatibilidad
 * de version -- ver AuditoriaXmlParserTest, que corre esto contra los 6
 * archivos reales y verifica cada conteo.
 *
 * Asume que ningun tag hijo de ROW tiene a su vez hijos propios -- cierto
 * en los 6 archivos de prueba. Si el ERP alguna vez manda un ROW con
 * estructura anidada, este lector lo aplanaria mal (se queda con el ultimo
 * valor de texto visto bajo el tag de primer nivel que este abierto).
 *
 * Tolerancia por fila: si una fila individual trae un valor que no se
 * puede convertir (un numero con formato raro, una fecha invalida, etc. --
 * lo que tire constructorDeFila), esa fila se descarta y se loguea, pero
 * el resto del archivo se sigue procesando. Antes de esto, una sola fila
 * mala tiraba abajo el archivo completo -- ver conversacion del
 * 2026-10-05: se probo explicitamente con una fila con "N/D" en un campo
 * numerico en medio de filas validas, y se perdian todas. Un XML
 * estructuralmente mal formado (tags sin cerrar, etc.) SI sigue
 * reventando el archivo completo -- eso es un problema de transporte, no
 * de un dato puntual, y no hay forma segura de "saltarlo" fila por fila.
 */
public final class AuditoriaRowReader {

	private static final Logger log = LoggerFactory.getLogger(AuditoriaRowReader.class);

	private AuditoriaRowReader() {
	}

	/** Cierra "entrada" al terminar -- el llamador no tiene que acordarse. */
	public static <T> List<T> leer(
			InputStream entrada, String origen, Function<Map<String, String>, T> constructorDeFila) {
		List<T> filas = new ArrayList<>();
		int totalFilas = 0;
		int filasDescartadas = 0;

		XMLInputFactory fabrica = XMLInputFactory.newInstance();
		// No hace falta resolver DTD ni entidades externas para este formato --
		// desactivarlo de paso cierra una via clasica de XXE.
		fabrica.setProperty(XMLInputFactory.SUPPORT_DTD, false);
		fabrica.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);

		try (InputStream entradaCerrable = entrada) {
			XMLStreamReader lector = fabrica.createXMLStreamReader(entradaCerrable);
			try {
				while (lector.hasNext()) {
					int evento = lector.next();
					if (evento == XMLStreamConstants.START_ELEMENT && "ROW".equals(lector.getLocalName())) {
						totalFilas++;
						Map<String, String> campos = leerFila(lector);
						try {
							filas.add(constructorDeFila.apply(campos));
						} catch (RuntimeException e) {
							filasDescartadas++;
							log.warn(
									"{}: fila #{} descartada, no se pudo convertir ({}: {}). Campos: {}",
									origen, totalFilas, e.getClass().getSimpleName(), e.getMessage(), campos);
						}
					}
				}
			} finally {
				lector.close();
			}
		} catch (XMLStreamException e) {
			throw new IllegalArgumentException("XML de auditoria mal formado: " + origen, e);
		} catch (IOException e) {
			throw new IllegalStateException("No se pudo cerrar el XML de auditoria: " + origen, e);
		}

		if (filasDescartadas > 0) {
			log.warn("{}: {} de {} filas descartadas por errores de formato (ver detalle arriba).",
					origen, filasDescartadas, totalFilas);
		}
		return filas;
	}

	/**
	 * Al entrar, el cursor esta justo despues del START_ELEMENT de ROW; al
	 * salir, en su END_ELEMENT. El texto en blanco entre tags hijos
	 * (indentacion) se ignora porque solo se acumula texto mientras hay un
	 * tag hijo abierto (tagActual != null).
	 */
	private static Map<String, String> leerFila(XMLStreamReader lector) throws XMLStreamException {
		Map<String, String> campos = new LinkedHashMap<>();
		String tagActual = null;
		StringBuilder texto = new StringBuilder();

		while (lector.hasNext()) {
			int evento = lector.next();
			switch (evento) {
				case XMLStreamConstants.START_ELEMENT:
					tagActual = lector.getLocalName();
					texto.setLength(0);
					break;
				case XMLStreamConstants.CHARACTERS:
				case XMLStreamConstants.CDATA:
					if (tagActual != null) {
						texto.append(lector.getText());
					}
					break;
				case XMLStreamConstants.END_ELEMENT:
					String tagQueCierra = lector.getLocalName();
					if ("ROW".equals(tagQueCierra)) {
						return campos;
					}
					if (tagActual != null && tagActual.equals(tagQueCierra)) {
						campos.put(tagActual, texto.toString());
						tagActual = null;
					}
					break;
				default:
					break;
			}
		}
		return campos;
	}
}
