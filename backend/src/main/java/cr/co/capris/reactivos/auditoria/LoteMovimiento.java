package cr.co.capris.reactivos.auditoria;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Una fila de cai_lot_mov.xml (ver LoteMovimientoXml para el DTO de
 * parseo): el desglose por lote de un MovimientoPendiente. Mismo supuesto
 * sobre el nombre de archivo que MovimientoPendiente -- ver
 * IdentificadorVisita.
 */
@Entity
@Table(name = "auditoria_lote_movimiento")
public class LoteMovimiento {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "cod_bod_visita", nullable = false)
	private String codBodVisita;

	@Column(name = "fecha_visita", nullable = false)
	private LocalDate fechaVisita;

	@Column(name = "hora_visita", nullable = false)
	private LocalTime horaVisita;

	@Column(name = "secuencia_visita", nullable = false)
	private int secuenciaVisita;

	@Column(name = "cod_org", nullable = false)
	private String codOrg;

	@Column(name = "cod_usu", nullable = false)
	private String codUsu;

	@Column(name = "cod_art", nullable = false)
	private String codArt;

	@Column(name = "num_lote", nullable = false)
	private String numLote;

	@Column(name = "cantidad", nullable = false, precision = 14, scale = 4)
	private BigDecimal cantidad;

	@Column(name = "bodega_origen")
	private String bodegaOrigen;

	@Column(name = "bodega_destino")
	private String bodegaDestino;

	@Column(name = "tipo_movimiento", nullable = false)
	private String tipoMovimiento;

	protected LoteMovimiento() {
		// requerido por JPA
	}

	public LoteMovimiento(
			IdentificadorVisita visita,
			String codOrg,
			String codUsu,
			String codArt,
			String numLote,
			BigDecimal cantidad,
			String bodegaOrigen,
			String bodegaDestino,
			String tipoMovimiento) {
		this.codBodVisita = visita.codBod();
		this.fechaVisita = visita.fecha();
		this.horaVisita = visita.hora();
		this.secuenciaVisita = visita.secuencia();
		this.codOrg = codOrg;
		this.codUsu = codUsu;
		this.codArt = codArt;
		this.numLote = numLote;
		this.cantidad = cantidad;
		this.bodegaOrigen = bodegaOrigen;
		this.bodegaDestino = bodegaDestino;
		this.tipoMovimiento = tipoMovimiento;
	}

	public Long getId() {
		return id;
	}

	public String getCodBodVisita() {
		return codBodVisita;
	}

	public LocalDate getFechaVisita() {
		return fechaVisita;
	}

	public LocalTime getHoraVisita() {
		return horaVisita;
	}

	public int getSecuenciaVisita() {
		return secuenciaVisita;
	}

	public String getCodOrg() {
		return codOrg;
	}

	public String getCodUsu() {
		return codUsu;
	}

	public String getCodArt() {
		return codArt;
	}

	public String getNumLote() {
		return numLote;
	}

	public BigDecimal getCantidad() {
		return cantidad;
	}

	public String getBodegaOrigen() {
		return bodegaOrigen;
	}

	public String getBodegaDestino() {
		return bodegaDestino;
	}

	public String getTipoMovimiento() {
		return tipoMovimiento;
	}
}
