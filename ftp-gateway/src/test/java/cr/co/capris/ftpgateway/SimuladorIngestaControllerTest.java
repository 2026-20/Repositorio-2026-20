package cr.co.capris.ftpgateway;

import org.junit.jupiter.api.Test;

import org.springframework.mock.web.MockMultipartFile;

import tools.jackson.databind.ObjectMapper;

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

		var resultado = controller.ingestar(archivo, "med_wmolina_cai_det_bod.xml", null);

		assertThat(resultado.endpoint()).isEqualTo("detalle-bodega");
	}

	@Test
	void propagaElResultadoDeReenviarManualTalCual() throws Exception {
		var archivo = new MockMultipartFile(
				"archivo", "original.xml", "application/xml", "<ROWSET></ROWSET>".getBytes());

		var resultado = controller.ingestar(archivo, "archivo_random.xml", null);

		assertThat(resultado.exito()).isFalse();
		assertThat(resultado.cuerpo()).contains("no reconocido");
	}

	// asignarAUsuario: el campo es opcional en el formulario (ver
	// index.html) -- el controller tiene que aceptar que no venga.
	@Test
	void funcionaSinAsignarAUsuario() throws Exception {
		var archivo = new MockMultipartFile(
				"archivo", "original.xml", "application/xml", "<ROWSET></ROWSET>".getBytes());

		var resultado = controller.ingestar(archivo, "med_wmolina_cai_bod.xml", null);

		assertThat(resultado.endpoint()).isEqualTo("bodegas");
	}

	// ingestarDatosDePrueba (carga rapida, ver index.html): sin backend real
	// alcanzable, los 4 reenvios fallan por conexion -- pero deben intentarse
	// los 4 (uno por archivo empacado en datos-prueba/), no detenerse en el
	// primero.
	@Test
	void ingestaRapidaIntentaLos4ArchivosEmpacados() throws Exception {
		var resultado = controller.ingestarDatosDePrueba("amelendez");

		assertThat(resultado.resultados()).hasSize(4);
		assertThat(resultado.resultados()).extracting("endpoint")
				.containsExactly("bodegas", "detalle-bodega", "lote-bodega", "estados-visita");
		assertThat(resultado.exito()).isFalse();
	}

	@Test
	void ingestaRapidaSinUsuarioNoIntentaNingunReenvio() throws Exception {
		var resultado = controller.ingestarDatosDePrueba("   ");

		assertThat(resultado.resultados()).hasSize(1);
		assertThat(resultado.resultados().get(0).exito()).isFalse();
		assertThat(resultado.resultados().get(0).cuerpo()).contains("usuario");
		assertThat(resultado.exito()).isFalse();
	}

	// exito() en ResultadoIngestaRapida no es un componente del record --
	// sin @JsonProperty, Jackson lo omite del JSON (no sigue la convencion
	// getX/isX) y el frontend (que lee cuerpo.exito) siempre veria
	// "undefined" ahi. Prueba contra el ObjectMapper real, no contra el
	// record en memoria, porque el bug es especificamente de serializacion.
	@Test
	void elCampoExitoQuedaEnElJsonDeIngestaRapida() throws Exception {
		var resultado = new SimuladorIngestaController.ResultadoIngestaRapida(
				java.util.List.of(new ReenviadorAlBackend.ResultadoReenvio(true, "bodegas", 200, "ok")));

		String json = new ObjectMapper().writeValueAsString(resultado);

		assertThat(json).contains("\"exito\":true");
	}
}
