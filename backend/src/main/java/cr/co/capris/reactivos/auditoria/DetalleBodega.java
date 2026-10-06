package cr.co.capris.reactivos.auditoria;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;

/**
 * Una fila de cai_det_bod.xml (ver DetalleBodegaXml para el DTO de parseo):
 * cantidad TEORICA en sistema de un articulo en una bodega. Es la cifra
 * contra la que se compara el conteo fisico que haga el auditor.
 *
 * indicadorLote queda como boolean (a diferencia de EstadoVisita.estado):
 * a diferencia del estado de la visita, "S"/"N" es un indicador binario de
 * verdad, confirmado consistente en toda la muestra (1649 "S" + 313 "N",
 * sin ningun otro valor) -- no es un enum de dominio abierto como el
 * estado, es solo una bandera.
 *
 * La clave natural es (cod_bod, cod_art, num_con), NO (cod_bod, cod_art)
 * solo -- confirmado contra los datos de prueba reales
 * (AuditoriaIngestaServiceIT): el mismo articulo en la misma bodega puede
 * aparecer dos veces bajo DOS CONTRATOS distintos (ej. A2060000/M35883
 * bajo "11156-2017" con cantidad_minima=2, y bajo
 * "0432025114200211-00-13585" con cantidad_minima=33 -- mismo
 * cantidad_teorica=11 en ambas, es el mismo stock fisico visto desde dos
 * contratos). Antes de esto el UNIQUE era solo (cod_bod, cod_art) y 484
 * de las 1962 filas de cai_det_bod.xml se pisaban entre si en la ingesta
 * (terminaban 1477 filas en la base en vez de 1962, sin ningun error
 * logueado -- el upsert "funcionaba" silenciosamente mal).
 */
@Entity
@Table(
		name = "auditoria_detalle_bodega",
		uniqueConstraints = @UniqueConstraint(columnNames = {"cod_bod", "cod_art", "num_con"}))
public class DetalleBodega {

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

	@Column(name = "des_art")
	private String desArt;

	@Column(name = "cantidad_teorica", nullable = false, precision = 14, scale = 4)
	private BigDecimal cantidadTeorica;

	@Column(name = "indicador_lote", nullable = false)
	private boolean indicadorLote;

	@Column(name = "tipo_bod")
	private String tipoBod;

	@Column(name = "num_con")
	private String numCon;

	@Column(name = "cod_ins")
	private String codIns;

	// Se vio al menos un valor ".75" en los datos de prueba -- no es entero.
	@Column(name = "cantidad_minima", precision = 14, scale = 4)
	private BigDecimal cantidadMinima;

	protected DetalleBodega() {
		// requerido por JPA
	}

	public DetalleBodega(
			String codOrg,
			String codUsu,
			String codBod,
			String bodCliente,
			String codArt,
			String desArt,
			BigDecimal cantidadTeorica,
			boolean indicadorLote,
			String tipoBod,
			String numCon,
			String codIns,
			BigDecimal cantidadMinima) {
		this.codOrg = codOrg;
		this.codUsu = codUsu;
		this.codBod = codBod;
		this.bodCliente = bodCliente;
		this.codArt = codArt;
		this.desArt = desArt;
		this.cantidadTeorica = cantidadTeorica;
		this.indicadorLote = indicadorLote;
		this.tipoBod = tipoBod;
		this.numCon = numCon;
		this.codIns = codIns;
		this.cantidadMinima = cantidadMinima;
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

	public String getDesArt() {
		return desArt;
	}

	public BigDecimal getCantidadTeorica() {
		return cantidadTeorica;
	}

	public boolean isIndicadorLote() {
		return indicadorLote;
	}

	public String getTipoBod() {
		return tipoBod;
	}

	public String getNumCon() {
		return numCon;
	}

	public String getCodIns() {
		return codIns;
	}

	public BigDecimal getCantidadMinima() {
		return cantidadMinima;
	}
}
