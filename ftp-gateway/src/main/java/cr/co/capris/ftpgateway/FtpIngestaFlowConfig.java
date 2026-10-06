package cr.co.capris.ftpgateway;

import org.apache.commons.net.ftp.FTPFile;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.dsl.IntegrationFlow;
import org.springframework.integration.dsl.Pollers;
import org.springframework.integration.file.remote.session.SessionFactory;
import org.springframework.integration.ftp.filters.FtpPersistentAcceptOnceFileListFilter;
import org.springframework.integration.ftp.inbound.FtpStreamingMessageSource;
import org.springframework.integration.ftp.session.FtpRemoteFileTemplate;
import org.springframework.integration.metadata.SimpleMetadataStore;

import java.io.InputStream;
import java.time.Duration;

/**
 * El flujo en si: cada N segundos revisa la carpeta remota del FTP, y por
 * cada archivo que no se haya visto antes, lo manda a
 * ReenviadorAlBackend.reenviar(...).
 *
 * FtpStreamingMessageSource no descarga el archivo a disco local primero
 * -- lo entrega como InputStream directo desde el FTP, mas simple para
 * este caso (solo hay que reenviarlo, no hace falta guardarlo aparte).
 *
 * SimpleMetadataStore (en memoria) para la deduplicacion: si el servidor
 * puente se reinicia, "olvida" que archivos ya vio y podria reenviar
 * alguno de vuelta -- no es un problema porque AuditoriaIngestaService ya
 * es idempotente por clave natural (ver ese proyecto), asi que un
 * reenvio no duplica nada en la base, solo hace trabajo de mas. Si esto
 * resulta ser un problema real en produccion, cambiar a un
 * PropertiesPersistingMetadataStore (persiste en un archivo) es un
 * cambio acotado a esta clase.
 */
@Configuration
public class FtpIngestaFlowConfig {

	@Bean
	public IntegrationFlow ftpIngestaFlow(
			SessionFactory<FTPFile> ftpSessionFactory,
			ReenviadorAlBackend reenviador,
			@Value("${app.ftp.directorio-remoto}") String directorioRemoto,
			@Value("${app.ftp.intervalo-polling-segundos:30}") long intervaloPollingSegundos) {

		FtpStreamingMessageSource fuente = new FtpStreamingMessageSource(new FtpRemoteFileTemplate(ftpSessionFactory));
		fuente.setRemoteDirectory(directorioRemoto);
		fuente.setFilter(new FtpPersistentAcceptOnceFileListFilter(new SimpleMetadataStore(), "ftp-ingesta-"));

		return IntegrationFlow.from(
						fuente, endpoint -> endpoint.poller(Pollers.fixedDelay(Duration.ofSeconds(intervaloPollingSegundos))))
				.<InputStream>handle((payload, headers) -> {
					reenviador.reenviar(org.springframework.messaging.support.MessageBuilder
							.withPayload(payload)
							.copyHeaders(headers)
							.build());
					return null;
				})
				.get();
	}
}
