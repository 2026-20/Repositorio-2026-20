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
 * Una fila de cai_det_mov.xml (ver MovimientoPendienteXml para el DTO de
 * parseo): un movimiento pendiente de aplicar contra el sistema para una
 * bodega y visita especificas. codBodVisita/fechaVisita/horaVisita/
 * secuenciaVisita NO vienen en el XML -- se extraen del nombre de archivo
 * (ver IdentificadorVisita) y se guardan aqui para poder filtrar "los
 * movimientos pendientes de esta visita" sin tener que volver a parsear
 * el nombre del archivo despues.
 */
@Entity
@Table(name = "auditoria_movimiento_pendiente")
public class MovimientoPendiente {

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

	@Column(name = "cantidad", nullable = false, precision = 14, scale = 4)
	private BigDecimal cantidad;

	@Column(name = "bodega_origen")
	private String bodegaOrigen;

	@Column(name = "bodega_destino")
	private String bodegaDestino;

	/** ENT, DEV o FAC -- ver TipoBodega. */
	@Column(name = "tipo_movimiento", nullable = false)
	private String tipoMovimiento;

	@Column(name = "indicador_lote", nullable = false)
	private boolean indicadorLote;

	@Column(name = "num_con")
	private String numCon;

	@Column(name = "cod_ins")
	private String codIns;

	protected MovimientoPendiente() {
		// requerido por JPA
	}

	public MovimientoPendiente(
			IdentificadorVisita visita,
			String codOrg,
			String codUsu,
			String codArt,
			BigDecimal cantidad,
			String bodegaOrigen,
			String bodegaDestino,
			String tipoMovimiento,
			boolean indicadorLote,
			String numCon,
			String codIns) {
		this.codBodVisita = visita.codBod();
		this.fechaVisita = visita.fecha();
		this.horaVisita = visita.hora();
		this.secuenciaVisita = visita.secuencia();
		this.codOrg = codOrg;
		this.codUsu = codUsu;
		this.codArt = codArt;
		this.cantidad = cantidad;
		this.bodegaOrigen = bodegaOrigen;
		this.bodegaDestino = bodegaDestino;
		this.tipoMovimiento = tipoMovimiento;
		this.indicadorLote = indicadorLote;
		this.numCon = numCon;
		this.codIns = codIns;
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

	public boolean isIndicadorLote() {
		return indicadorLote;
	}

	public String getNumCon() {
		return numCon;
	}

	public String getCodIns() {
		return codIns;
	}
}
