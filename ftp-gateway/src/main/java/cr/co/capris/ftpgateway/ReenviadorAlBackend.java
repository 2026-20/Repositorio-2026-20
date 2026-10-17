package cr.co.capris.ftpgateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.integration.IntegrationMessageHeaderAccessor;
import org.springframework.integration.file.FileHeaders;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Component;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;

/**
 * Reenvia cada XML que baja del FTP a su endpoint correspondiente en
 * /api/auditoria/ingesta/** del backend (ver AuditoriaIngestaController
 * y AuditoriaIngestaApiKeyFilter en ese proyecto). No sabe nada de XML ni
 * de auditoria -- solo nombre de archivo -> endpoint, y reenviar el
 * cuerpo tal cual.
 */
@Component
public class ReenviadorAlBackend {

	private static final Logger log = LoggerFactory.getLogger(ReenviadorAlBackend.class);
	private static final String HEADER_API_KEY = "X-Internal-Api-Key";
	private static final String HEADER_NOMBRE_ARCHIVO = "X-Nombre-Archivo";

	private final RestClient restClient;
	private final String apiKey;

	public ReenviadorAlBackend(
			@Value("${app.backend.base-url}") String baseUrl,
			@Value("${app.backend.api-key}") String apiKey,
			@Value("${app.backend.timeout-conexion-segundos:10}") long timeoutConexionSegundos,
			@Value("${app.backend.timeout-lectura-segundos:30}") long timeoutLecturaSegundos) {
		// Sin estos timeouts, un backend caido o que no responde deja el
		// hilo de polling bloqueado para siempre en restClient.post() --
		// nunca se revisaria el FTP de nuevo.
		SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
		requestFactory.setConnectTimeout(Duration.ofSeconds(timeoutConexionSegundos));
		requestFactory.setReadTimeout(Duration.ofSeconds(timeoutLecturaSegundos));
		this.restClient = RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
		this.apiKey = apiKey;
	}

	/**
	 * Punto de entrada del flujo (ver FtpIngestaFlowConfig). El mensaje
	 * trae el archivo remoto como InputStream (FtpStreamingMessageSource
	 * no lo baja a disco local primero) y su nombre en el header
	 * FileHeaders.REMOTE_FILE.
	 *
	 * Si el reenvio falla, se loguea y no se relanza la excepcion a
	 * proposito: el filtro de "una sola vez" (ver FtpIngestaFlowConfig) ya
	 * marco este archivo como visto, asi que relanzar no lograria un
	 * reintento automatico limpio -- mejor que quede claro en el log para
	 * revisar a mano, que dejar que Spring Integration reintente de forma
	 * no controlada.
	 */
	public void reenviar(Message<InputStream> mensaje) {
		String nombreArchivo = (String) mensaje.getHeaders().get(FileHeaders.REMOTE_FILE);
		String endpoint = endpointPara(nombreArchivo);

		if (endpoint == null) {
			log.warn("{}: nombre de archivo no reconocido, no se sabe a que endpoint de ingesta mandarlo. Se omite.",
					nombreArchivo);
			cerrarSesionFtp(mensaje, nombreArchivo);
			return;
		}

		try (InputStream contenido = mensaje.getPayload()) {
			// El flujo real del FTP nunca asigna a un usuario de prueba --
			// eso es solo para el simulador (ver javadoc de reenviarManual).
			enviarHttp(contenido, nombreArchivo, endpoint, null);
			log.info("{}: reenviado correctamente a /api/auditoria/ingesta/{}", nombreArchivo, endpoint);
		} catch (RestClientException | IOException e) {
			log.error("{}: fallo al reenviar a /api/auditoria/ingesta/{}", nombreArchivo, endpoint, e);
		} finally {
			cerrarSesionFtp(mensaje, nombreArchivo);
		}
	}

	/**
	 * Resultado de un reenvio manual (ver reenviarManual/SimuladorIngestaController).
	 * A diferencia de reenviar(Message), aqui si interesa el detalle: quien
	 * usa el simulador quiere ver si el backend acepto el archivo y cuantas
	 * filas guardo/descarto, no solo un log.
	 */
	public record ResultadoReenvio(boolean exito, String endpoint, Integer statusBackend, String cuerpo) {
	}

	/**
	 * Mismo reenvio que el flujo real del FTP (mismo endpoint por nombre de
	 * archivo, mismos headers), pero para un disparo manual desde el
	 * simulador (ver SimuladorIngestaController) -- sin sesion FTP que
	 * cerrar, y devolviendo el detalle de la respuesta del backend en vez de
	 * solo loguearlo, para que quien prueba vea el resultado real.
	 *
	 * asignarAUsuario (opcional): se reenvia tal cual al backend como query
	 * param, solo tiene efecto si el archivo termina en /estados-visita
	 * (ver AuditoriaIngestaController en el backend).
	 */
	public ResultadoReenvio reenviarManual(InputStream contenido, String nombreArchivo, String asignarAUsuario) {
		String endpoint = endpointPara(nombreArchivo);
		if (endpoint == null) {
			return new ResultadoReenvio(false, null, null,
					"Nombre de archivo no reconocido -- no coincide con ninguno de los 6 tipos esperados "
							+ "(cai_bod, cai_est_vis, cai_det_bod, cai_lot_bod, cai_det_mov, cai_lot_mov).");
		}

		try {
			ResponseEntity<String> respuesta = enviarHttp(contenido, nombreArchivo, endpoint, asignarAUsuario);
			log.info("{}: reenviado manualmente (simulador) a /api/auditoria/ingesta/{}", nombreArchivo, endpoint);
			return new ResultadoReenvio(true, endpoint, respuesta.getStatusCode().value(), respuesta.getBody());
		} catch (RestClientResponseException e) {
			log.warn("{}: el backend rechazo el reenvio manual (simulador) a /api/auditoria/ingesta/{}", nombreArchivo,
					endpoint, e);
			return new ResultadoReenvio(false, endpoint, e.getStatusCode().value(), e.getResponseBodyAsString());
		} catch (RestClientException e) {
			log.error("{}: fallo al reenviar manualmente (simulador) a /api/auditoria/ingesta/{}", nombreArchivo,
					endpoint, e);
			return new ResultadoReenvio(false, endpoint, null, "No fue posible contactar al backend: " + e.getMessage());
		}
	}

	/**
	 * asignarAUsuario (opcional, solo usado por reenviarManual): el backend
	 * solo lee este query param en /estados-visita (ver
	 * AuditoriaIngestaController) -- mandarlo igual para los otros 5
	 * endpoints no causa error, Spring simplemente lo ignora si el metodo
	 * del controller no lo declara.
	 */
	private ResponseEntity<String> enviarHttp(
			InputStream contenido, String nombreArchivo, String endpoint, String asignarAUsuario) {
		RestClient.RequestBodySpec request = restClient.post()
				.uri(uriBuilder -> {
					var builder = uriBuilder.path("/api/auditoria/ingesta/{endpoint}");
					if (asignarAUsuario != null && !asignarAUsuario.isBlank()) {
						builder.queryParam("asignarAUsuario", asignarAUsuario);
					}
					return builder.build(endpoint);
				})
				.header(HEADER_API_KEY, apiKey)
				.header(HEADER_NOMBRE_ARCHIVO, nombreArchivo)
				.contentType(MediaType.APPLICATION_XML);
		return request
				.body(new InputStreamResource(contenido))
				.retrieve()
				.toEntity(String.class);
	}

	/**
	 * FtpStreamingMessageSource no descarga el archivo a disco -- lee
	 * directo del FTP, y la sesion/conexion usada para esa lectura queda
	 * abierta en el header "closeableResource" hasta que alguien la cierre
	 * (ver AbstractRemoteFileStreamingMessageSource). Si no se cierra aqui,
	 * cada archivo procesado deja una conexion FTP abierta para siempre.
	 */
	private void cerrarSesionFtp(Message<InputStream> mensaje, String nombreArchivo) {
		Object recurso = mensaje.getHeaders().get(IntegrationMessageHeaderAccessor.CLOSEABLE_RESOURCE);
		if (recurso instanceof Closeable closeable) {
			try {
				closeable.close();
			} catch (IOException e) {
				log.warn("{}: no se pudo cerrar la sesion FTP despues de procesarlo", nombreArchivo, e);
			}
		}
	}

	/**
	 * Nombre de archivo -> endpoint. El orden de los "cai_X_bod" antes de
	 * "cai_bod" es defensivo (verificado que no hace falta con los nombres
	 * reales del ERP, ninguno es substring de otro, pero no cuesta nada
	 * dejarlo asi por si el ERP cambia la convencion de nombres algun dia).
	 */
	String endpointPara(String nombreArchivo) {
		if (nombreArchivo == null) {
			return null;
		}
		if (nombreArchivo.contains("cai_det_mov")) {
			return "movimientos-pendientes";
		}
		if (nombreArchivo.contains("cai_lot_mov")) {
			return "lotes-movimiento";
		}
		if (nombreArchivo.contains("cai_det_bod")) {
			return "detalle-bodega";
		}
		if (nombreArchivo.contains("cai_lot_bod")) {
			return "lote-bodega";
		}
		if (nombreArchivo.contains("cai_est_vis")) {
			return "estados-visita";
		}
		if (nombreArchivo.contains("cai_bod")) {
			return "bodegas";
		}
		return null;
	}
}
