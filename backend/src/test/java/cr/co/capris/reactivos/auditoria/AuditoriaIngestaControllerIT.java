package cr.co.capris.reactivos.auditoria;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.file.Files;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Entrada servidor-a-servidor para el futuro servidor puente FTP (paso 1 de
 * ese trabajo, ver AuditoriaIngestaApiKeyFilter y AuditoriaIngestaController).
 * No se prueba el servidor puente en si (todavia no existe) -- esto prueba
 * que el backend ya puede recibir el XML tal cual y lo autentica por API
 * key en vez de JWT de usuario. Requiere Docker; corre con "mvn verify".
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class AuditoriaIngestaControllerIT {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private BodegaRepository bodegaRepository;

	@Value("${app.auditoria.ingesta.api-key}")
	private String apiKey;

	private byte[] fixture(String nombreArchivo) throws Exception {
		return Files.readAllBytes(
				new ClassPathResource("auditoria/xmls/" + nombreArchivo).getFile().toPath());
	}

	@Test
	void sinApiKeySeRechazaComoSesionNoValida() throws Exception {
		mockMvc.perform(post("/api/auditoria/ingesta/bodegas")
						.header("X-Nombre-Archivo", "cai_bod.xml")
						.contentType(MediaType.APPLICATION_XML)
						.content(fixture("med_wmolina_cai_bod.xml")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.codigo").value("SESION_NO_VALIDA"));
	}

	@Test
	void conApiKeyInvalidaSeRechazaComoSesionNoValida() throws Exception {
		mockMvc.perform(post("/api/auditoria/ingesta/bodegas")
						.header("X-Internal-Api-Key", "esta-no-es-la-clave")
						.header("X-Nombre-Archivo", "cai_bod.xml")
						.contentType(MediaType.APPLICATION_XML)
						.content(fixture("med_wmolina_cai_bod.xml")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.codigo").value("SESION_NO_VALIDA"));
	}

	@Test
	void conApiKeyValidaIngestaElArchivoDeBodegasCompleto() throws Exception {
		long antes = bodegaRepository.count();

		mockMvc.perform(post("/api/auditoria/ingesta/bodegas")
						.header("X-Internal-Api-Key", apiKey)
						.header("X-Nombre-Archivo", "cai_bod.xml")
						.contentType(MediaType.APPLICATION_XML)
						.content(fixture("med_wmolina_cai_bod.xml")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.filasGuardadas").value(22))
				.andExpect(jsonPath("$.filasDescartadas").value(0));

		// Idempotente (upsert por clave natural, ver AuditoriaIngestaService):
		// no debe duplicar si se reenvia el mismo archivo.
		assertThat(bodegaRepository.count()).isEqualTo(antes + 22);
	}

	@Test
	void unXmlMalFormadoResponde400SolicitudInvalida() throws Exception {
		mockMvc.perform(post("/api/auditoria/ingesta/bodegas")
						.header("X-Internal-Api-Key", apiKey)
						.header("X-Nombre-Archivo", "roto.xml")
						.contentType(MediaType.APPLICATION_XML)
						.content("<ROWSET><ROW><CC_COD_BOD>A1<CC_COD_BOD></ROW>".getBytes()))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.codigo").value("SOLICITUD_INVALIDA"));
	}

	@Test
	void unNombreDeArchivoQueNoCalzaParaMovimientosResponde400() throws Exception {
		mockMvc.perform(post("/api/auditoria/ingesta/movimientos-pendientes")
						.header("X-Internal-Api-Key", apiKey)
						.header("X-Nombre-Archivo", "archivo_sin_el_patron_esperado.xml")
						.contentType(MediaType.APPLICATION_XML)
						.content(fixture("med_wmolina_A2070000_20260724_cai_det_mov_2026-07-24_1640_1.xml")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.codigo").value("SOLICITUD_INVALIDA"));
	}
}
