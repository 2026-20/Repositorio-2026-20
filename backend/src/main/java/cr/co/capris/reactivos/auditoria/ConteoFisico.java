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
 *
 * HU-030 define la diferencia como (fisica - teorica): negativo = faltante,
 * positivo = sobrante, cero = sin diferencia. getDiferencia() tiene que
 * calcularla en ese orden exacto -- invertido daria faltantes como
 * positivos, lo que confundiria cualquier pantalla/reporte que lo consuma.
 *
 * HU-007: a diferencia de BitacoraSeguridad/RegistroTrazabilidad (append-only
 * a proposito, son auditoria de seguridad), este SI se puede corregir -- la
 * propia HU lo pide explicito ("actualiza el registro... lo marca
 * visualmente como corregido", no "crea uno nuevo"). corregir() es la UNICA
 * forma de mutarlo despues de creado; transmitido bloquea la correccion
 * (criterio 3) -- hoy siempre queda en false, no existe todavia el envio al
 * ERP que lo pondria en true (ver HU-040/041, fuera de alcance de este
 * prototipo), pero el campo y el guard quedan listos para cuando exista.
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

	@Column(name = "corregido", nullable = false)
	private boolean corregido = false;

	@Column(name = "transmitido", nullable = false)
	private boolean transmitido = false;

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
		validarCantidadFisica(cantidadFisica);
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

	private static void validarCantidadFisica(BigDecimal cantidadFisica) {
		if (cantidadFisica == null || cantidadFisica.signum() < 0) {
			// HU-005 criterio 3 / HU-007 criterio 4: cantidad negativa se
			// rechaza tanto al registrar como al corregir. Cero SI es valido
			// (criterio 2 de HU-005: "auditado sin unidades encontradas").
			throw new IllegalArgumentException("La cantidad fisica no puede ser negativa");
		}
	}

	/**
	 * HU-007: corrige un conteo ya registrado, mientras no este transmitido
	 * (criterio 3). Aplica la misma validacion que un registro nuevo
	 * (criterio 4) y marca el registro como corregido (criterio 2).
	 */
	public void corregir(BigDecimal nuevaCantidadFisica, String nuevasObservaciones) {
		if (transmitido) {
			throw new ConteoYaTransmitidoException(
					"No se puede corregir un conteo que ya fue transmitido al ERP");
		}
		validarCantidadFisica(nuevaCantidadFisica);
		this.cantidadFisica = nuevaCantidadFisica;
		this.observaciones = nuevasObservaciones;
		this.corregido = true;
	}

	public BigDecimal getDiferencia() {
		return cantidadFisica.subtract(cantidadTeorica);
	}

	/** HU-030 criterios 2-4: clasificacion derivada del signo de getDiferencia(). */
	public TipoDiferencia getTipoDiferencia() {
		int signo = getDiferencia().signum();
		if (signo < 0) {
			return TipoDiferencia.FALTANTE;
		}
		if (signo > 0) {
			return TipoDiferencia.SOBRANTE;
		}
		return TipoDiferencia.SIN_DIFERENCIA;
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

	public boolean isCorregido() {
		return corregido;
	}

	public boolean isTransmitido() {
		return transmitido;
	}
}
