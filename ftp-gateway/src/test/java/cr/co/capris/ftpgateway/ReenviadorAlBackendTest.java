package cr.co.capris.ftpgateway;

import org.junit.jupiter.api.Test;

import org.springframework.integration.IntegrationMessageHeaderAccessor;
import org.springframework.integration.file.FileHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;

import java.io.ByteArrayInputStream;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;

class ReenviadorAlBackendTest {

	private final ReenviadorAlBackend reenviador =
			new ReenviadorAlBackend("http://localhost:8080", "clave-de-prueba", 10, 30);

	/**
	 * FtpStreamingMessageSource deja la sesion FTP usada para leer el
	 * archivo en el header closeableResource -- si reenviar() no la
	 * cierra, cada archivo procesado deja una conexion FTP abierta para
	 * siempre (bug real, encontrado revisando AbstractRemoteFileStreaming
	 * MessageSource). Se prueba contra un backend inalcanzable para
	 * confirmar que la sesion se cierra incluso cuando el reenvio falla.
	 */
	@Test
	void cierraElStreamYLaSesionFtpAunqueFalleElReenvio() {
		ReenviadorAlBackend reenviadorConBackendInalcanzable =
				new ReenviadorAlBackend("http://localhost:1", "clave-de-prueba", 1, 1);

		InputStreamRastreable contenido = new InputStreamRastreable();
		CloseableRastreable sesionFtp = new CloseableRastreable();

		Message<InputStream> mensaje = MessageBuilder.withPayload((InputStream) contenido)
				.setHeader(FileHeaders.REMOTE_FILE, "med_wmolina_cai_bod.xml")
				.setHeader(IntegrationMessageHeaderAccessor.CLOSEABLE_RESOURCE, sesionFtp)
				.build();

		reenviadorConBackendInalcanzable.reenviar(mensaje);

		assertThat(contenido.cerrado).isTrue();
		assertThat(sesionFtp.cerrado).isTrue();
	}

	@Test
	void cierraLaSesionFtpAunqueElArchivoNoSeReconozca() {
		CloseableRastreable sesionFtp = new CloseableRastreable();

		Message<InputStream> mensaje = MessageBuilder.withPayload((InputStream) new ByteArrayInputStream(new byte[0]))
				.setHeader(FileHeaders.REMOTE_FILE, "archivo_random.xml")
				.setHeader(IntegrationMessageHeaderAccessor.CLOSEABLE_RESOURCE, sesionFtp)
				.build();

		reenviador.reenviar(mensaje);

		assertThat(sesionFtp.cerrado).isTrue();
	}

	@Test
	void reconoceDetalleBodega() {
		assertThat(reenviador.endpointPara("med_wmolina_cai_det_bod.xml")).isEqualTo("detalle-bodega");
	}

	@Test
	void reconoceLoteBodega() {
		assertThat(reenviador.endpointPara("med_wmolina_cai_lot_bod.xml")).isEqualTo("lote-bodega");
	}

	@Test
	void reconoceMovimientosPendientes() {
		assertThat(reenviador.endpointPara("med_wmolina_cai_det_mov.xml")).isEqualTo("movimientos-pendientes");
	}

	@Test
	void reconoceLotesMovimiento() {
		assertThat(reenviador.endpointPara("med_wmolina_cai_lot_mov.xml")).isEqualTo("lotes-movimiento");
	}

	@Test
	void reconoceEstadosVisita() {
		assertThat(reenviador.endpointPara("med_wmolina_cai_est_vis.xml")).isEqualTo("estados-visita");
	}

	@Test
	void reconoceBodegas() {
		assertThat(reenviador.endpointPara("med_wmolina_cai_bod.xml")).isEqualTo("bodegas");
	}

	@Test
	void devuelveNuloParaNombreNoReconocido() {
		assertThat(reenviador.endpointPara("archivo_random.xml")).isNull();
	}

	@Test
	void devuelveNuloParaNombreNulo() {
		assertThat(reenviador.endpointPara(null)).isNull();
	}

	private static class InputStreamRastreable extends ByteArrayInputStream {
		boolean cerrado = false;

		InputStreamRastreable() {
			super(new byte[0]);
		}

		@Override
		public void close() throws IOException {
			cerrado = true;
			super.close();
		}
	}

	private static class CloseableRastreable implements Closeable {
		boolean cerrado = false;

		@Override
		public void close() {
			cerrado = true;
		}
	}
}
