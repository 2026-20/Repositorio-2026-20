package cr.co.capris.ftpgateway;

import org.junit.jupiter.api.Test;

import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;

class SimuladorIngestaControllerTest {

	private final ReenviadorAlBackend reenviador =
			new ReenviadorAlBackend("http://localhost:1", "clave-de-prueba", 1, 1);

	private final SimuladorIngestaController controller = new SimuladorIngestaController(reenviador);

	@Test
	void sirveLaPaginaDelSimulador() {
		var pagina = controller.formulario();

		assertThat(pagina.exists()).isTrue();
	}

	// El nombre de archivo que decide el endpoint es el del campo editable
	// del formulario, NO el nombre original del archivo subido -- es a
	// proposito (ver index.html): para probar movimientos-pendientes/
	// lotes-movimiento hace falta poder escribir un nombre que calce el
	// patron de IdentificadorVisita, aunque el archivo local se llame
	// distinto.
	@Test
	void usaElNombreEditadoEnElFormularioNoElNombreOriginalDelArchivo() throws Exception {
		var archivo = new MockMultipartFile(
				"archivo", "cualquier-nombre-local.xml", "application/xml", "<ROWSET></ROWSET>".getBytes());

		var resultado = controller.ingestar(archivo, "med_wmolina_cai_det_bod.xml");

		assertThat(resultado.endpoint()).isEqualTo("detalle-bodega");
	}

	@Test
	void propagaElResultadoDeReenviarManualTalCual() throws Exception {
		var archivo = new MockMultipartFile(
				"archivo", "original.xml", "application/xml", "<ROWSET></ROWSET>".getBytes());

		var resultado = controller.ingestar(archivo, "archivo_random.xml");

		assertThat(resultado.exito()).isFalse();
		assertThat(resultado.cuerpo()).contains("no reconocido");
	}
}
