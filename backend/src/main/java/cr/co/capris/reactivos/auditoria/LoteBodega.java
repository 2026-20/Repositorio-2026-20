package cr.co.capris.reactivos.auditoria;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Una fila de cai_lot_bod.xml (ver LoteBodegaXml para el DTO de parseo):
 * cantidad y vencimiento de un lote especifico de un articulo en una
 * bodega. La suma de "cantidad" de todos los lotes de un mismo
 * (codBod, codArt) debe calzar con DetalleBodega.cantidadTeorica --
 * verificado contra los datos de prueba, sin excepciones.
 */
@Entity
@Table(
		name = "auditoria_lote_bodega",
		uniqueConstraints = @UniqueConstraint(columnNames = {"cod_bod", "cod_art", "num_lote"}))
public class LoteBodega {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "cod_org", nullable = false)
	private String codOrg;

	@Column(name = "cod_usu", nullable = false)
	private String codUsu;

	@Column(name = "cod_bod", nullable = false)
	private String codBod;

	@Column(name = "bod_cliente")
	private String bodCliente;

	@Column(name = "cod_art", nullable = false)
	private String codArt;

	@Column(name = "num_lote", nullable = false)
	private String numLote;

	@Column(name = "fecha_vencimiento")
	private LocalDate fechaVencimiento;

	@Column(name = "cantidad", nullable = false, precision = 14, scale = 4)
	private BigDecimal cantidad;

	protected LoteBodega() {
		// requerido por JPA
	}

	public LoteBodega(
			String codOrg,
			String codUsu,
			String codBod,
			String bodCliente,
			String codArt,
			String numLote,
			LocalDate fechaVencimiento,
			BigDecimal cantidad) {
		this.codOrg = codOrg;
		this.codUsu = codUsu;
		this.codBod = codBod;
		this.bodCliente = bodCliente;
		this.codArt = codArt;
		this.numLote = numLote;
		this.fechaVencimiento = fechaVencimiento;
		this.cantidad = cantidad;
	}

	public Long getId() {
		return id;
	}

	public String getCodOrg() {
		return codOrg;
	}

	public String getCodUsu() {
		return codUsu;
	}

	public String getCodBod() {
		return codBod;
	}

	public String getBodCliente() {
		return bodCliente;
	}

	public String getCodArt() {
		return codArt;
	}

	public String getNumLote() {
		return numLote;
	}

	public LocalDate getFechaVencimiento() {
		return fechaVencimiento;
	}

	public BigDecimal getCantidad() {
		return cantidad;
	}
}
