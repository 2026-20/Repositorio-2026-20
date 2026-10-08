package cr.co.capris.reactivos.auditoria;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BodegaConsultaControllerTest {

	@Mock
	private BodegaRepository bodegaRepository;

	@Mock
	private DetalleBodegaRepository detalleBodegaRepository;

	@Mock
	private LoteBodegaRepository loteBodegaRepository;

	private BodegaConsultaController controller;

	@BeforeEach
	void setUp() {
		controller = new BodegaConsultaController(bodegaRepository, detalleBodegaRepository, loteBodegaRepository);
	}

	private Bodega building() {
		return new Bodega("MED", "WMOLINA", "NUM-CON-1", "INS", "B-1", "Bodega uno", TipoBodega.CLI);
	}

	private DetalleBodega buildingDetalle() {
		return new DetalleBodega(
				"MED", "WMOLINA", "B-1", "cliente", "ART-1", "Articulo uno",
				new BigDecimal("11.0000"), true, "CLI", "NUM-CON-1", "INS", new BigDecimal("2.0000"));
	}

	private LoteBodega buildingLote() {
		return new LoteBodega(
				"MED", "WMOLINA", "B-1", "cliente", "ART-1", "LOTE-1",
				LocalDate.of(2027, 6, 30), new BigDecimal("11.0000"));
	}

	@Test
	void listarMapeaCadaBodegaAUnaBodegaResumen() {
		when(bodegaRepository.findAll()).thenReturn(List.of(building()));

		List<BodegaResumenDTO> resultado = controller.listar();

		assertThat(resultado).hasSize(1);
		assertThat(resultado.get(0).codBod()).isEqualTo("B-1");
		assertThat(resultado.get(0).desBod()).isEqualTo("Bodega uno");
		assertThat(resultado.get(0).numCon()).isEqualTo("NUM-CON-1");
		assertThat(resultado.get(0).tipoBod()).isEqualTo(TipoBodega.CLI);
	}

	@Test
	void listarConRepositorioVacioDevuelveListaVacia() {
		when(bodegaRepository.findAll()).thenReturn(List.of());

		assertThat(controller.listar()).isEmpty();
	}

	@Test
	void detalleMapeaLaCantidadTeoricaYElIndicadorDeLote() {
		when(detalleBodegaRepository.findAllByCodBod("B-1")).thenReturn(List.of(buildingDetalle()));

		List<DetalleBodegaResumenDTO> resultado = controller.detalle("B-1");

		assertThat(resultado).hasSize(1);
		assertThat(resultado.get(0).codArt()).isEqualTo("ART-1");
		assertThat(resultado.get(0).cantidadTeorica()).isEqualByComparingTo("11.0000");
		assertThat(resultado.get(0).indicadorLote()).isTrue();
	}

	@Test
	void detalleDeBodegaDesconocidaDevuelveListaVacia() {
		when(detalleBodegaRepository.findAllByCodBod("B-NO-EXISTE")).thenReturn(List.of());

		assertThat(controller.detalle("B-NO-EXISTE")).isEmpty();
	}

	@Test
	void lotesMapeaElVencimientoYLaCantidad() {
		when(loteBodegaRepository.findAllByCodBod("B-1")).thenReturn(List.of(buildingLote()));

		List<LoteBodegaResumenDTO> resultado = controller.lotes("B-1");

		assertThat(resultado).hasSize(1);
		assertThat(resultado.get(0).numLote()).isEqualTo("LOTE-1");
		assertThat(resultado.get(0).fechaVencimiento()).isEqualTo(LocalDate.of(2027, 6, 30));
		assertThat(resultado.get(0).cantidad()).isEqualByComparingTo("11.0000");
	}

	@Test
	void lotesDeBodegaDesconocidaDevuelveListaVacia() {
		when(loteBodegaRepository.findAllByCodBod("B-NO-EXISTE")).thenReturn(List.of());

		assertThat(controller.lotes("B-NO-EXISTE")).isEmpty();
	}
}