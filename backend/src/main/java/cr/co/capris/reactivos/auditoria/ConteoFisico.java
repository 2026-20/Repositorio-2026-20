package cr.co.capris.reactivos.auditoria;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * HU-005: el conteo fisico que un Usuario de Campo registra para un
 * articulo (y, si aplica, un lote especifico) durante una auditoria. Es la
 * pieza que faltaba frente a auditoria_detalle_bodega/auditoria_lote_bodega
 * -- esas dos son lo que el ERP DICE que deberia haber; esta es lo que el
 * auditor encontro de verdad.
 *
 * idempotenciaKey es la pieza clave para que esto funcione offline-first
 * (HU-005 criterio 4, HU-024 criterio 4 -- ver decision de wa-sqlite+OPFS
 * del equipo): el cliente la genera una sola vez al registrar el conteo
 * localmente y la reenvia tal cual al sincronizar. Ver ConteoFisicoService
 * para el porque no hay otra forma de "clave natural" confiable aqui (un
 * mismo articulo se puede re-contar/corregir, asi que (codBod,codArt) no
 * sirve como clave unica como en las tablas de snapshot del ERP).
 *
 * cantidadTeorica queda copiada aqui (no se relee de DetalleBodega en
 * consulta) a proposito: es el valor que el usuario vio en pantalla al
 * momento de contar. Si el ERP actualiza la cantidad teorica despues, no
 * debe cambiar retroactivamente un conteo ya hecho.
 *
 * "diferencia" (HU-005: "diferencia calculada entre ambas cantidades") se
 * calcula en getDiferencia(), no se persiste -- evita que quede
 * desincronizada si algun dia se corrige cantidadFisica (ver HU-007,
 * corregir conteo) sin acordarse de recalcular una columna aparte.
 */
@Entity
@Table(name = "auditoria_conteo_fisico")
public class ConteoFisico {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "id_idempotencia", nullable = false, unique = true)
	private String idempotenciaKey;

	@Column(name = "cod_bod", nullable = false)
	private String codBod;

	@Column(name = "cod_art", nullable = false)
	private String codArt;

	/** Null si el articulo no se maneja por lote (ver DetalleBodega.indicadorLote). */
	@Column(name = "num_lote")
	private String numLote;

	@Column(name = "num_con")
	private String numCon;

	@Column(name = "cantidad_teorica", nullable = false, precision = 14, scale = 4)
	private BigDecimal cantidadTeorica;

	@Column(name = "cantidad_fisica", nullable = false, precision = 14, scale = 4)
	private BigDecimal cantidadFisica;

	@Column(name = "usuario_id", nullable = false)
	private Long usuarioId;

	@Column(name = "observaciones")
	private String observaciones;

	@Column(name = "registrado_en", nullable = false)
	private OffsetDateTime registradoEn;

	protected ConteoFisico() {
		// requerido por JPA
	}

	public ConteoFisico(
			String idempotenciaKey,
			String codBod,
			String codArt,
			String numLote,
			String numCon,
			BigDecimal cantidadTeorica,
			BigDecimal cantidadFisica,
			Long usuarioId,
			String observaciones,
			OffsetDateTime registradoEn) {
		if (cantidadFisica == null || cantidadFisica.signum() < 0) {
			// HU-005 criterio 3: cantidad negativa se rechaza. Cero SI es
			// valido (criterio 2: "auditado sin unidades encontradas").
			throw new IllegalArgumentException("La cantidad fisica no puede ser negativa");
		}
		this.idempotenciaKey = idempotenciaKey;
		this.codBod = codBod;
		this.codArt = codArt;
		this.numLote = numLote;
		this.numCon = numCon;
		this.cantidadTeorica = cantidadTeorica;
		this.cantidadFisica = cantidadFisica;
		this.usuarioId = usuarioId;
		this.observaciones = observaciones;
		this.registradoEn = registradoEn;
	}

	public BigDecimal getDiferencia() {
		return cantidadTeorica.subtract(cantidadFisica);
	}

	public Long getId() {
		return id;
	}

	public String getIdempotenciaKey() {
		return idempotenciaKey;
	}

	public String getCodBod() {
		return codBod;
	}

	public String getCodArt() {
		return codArt;
	}

	public String getNumLote() {
		return numLote;
	}

	public String getNumCon() {
		return numCon;
	}

	public BigDecimal getCantidadTeorica() {
		return cantidadTeorica;
	}

	public BigDecimal getCantidadFisica() {
		return cantidadFisica;
	}

	public Long getUsuarioId() {
		return usuarioId;
	}

	public String getObservaciones() {
		return observaciones;
	}

	public OffsetDateTime getRegistradoEn() {
		return registradoEn;
	}
}
