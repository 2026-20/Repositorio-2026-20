package cr.co.capris.reactivos.auditoria;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Una fila de cai_bod.xml (ver BodegaXml para el DTO de parseo). Las 6
 * entidades de este paquete se persisten de forma independiente, sin
 * relaciones JPA entre ellas (sin FK): el ERP las manda como tablas planas
 * identificadas por sus propios codigos (codBod, codArt, etc.), y todavia
 * no sabemos con certeza como el ERP espera correlacionarlas de vuelta en
 * la salida (ver estudio de auditoria 2026-10) -- forzar relaciones ahora
 * seria estructura prematura. La correlacion se hace en servicios/consultas
 * por esos codigos, no por FK.
 *
 * La clave natural es (num_con, cod_bod, tipo_bod), NO (num_con, cod_bod)
 * solo -- confirmado contra los datos de prueba reales (AuditoriaIngestaServiceIT):
 * el ERP reusa el codigo de bodega "MEPRIN" para dos buckets de movimiento
 * distintos (ENT y DEV) bajo el mismo contrato. Antes de esto el UNIQUE
 * era solo (num_con, cod_bod) y la ingesta real violaba esa restriccion
 * al llegar a la segunda fila con codBod="MEPRIN".
 *
 * codOrg/codUsu (presentes en las 6 tablas de este paquete, no solo aqui):
 * CONFIRMADO con el equipo (2026-10, contexto directo, no inferido de los
 * datos) que codUsu NO es el auditor de campo asignado a la bodega -- es
 * quien genera/exporta el lote de auditoria desde el programa del ERP
 * (en la muestra, siempre "WMOLINA"). La asignacion real de que Usuario de
 * Campo le toca cada bodega vive dentro del ERP y todavia no se recibe en
 * ningun XML de este modulo -- por eso HU-037 (cargar asignacion de rutas)
 * se resuelve por ahora con asignacion MANUAL dentro de esta app (ver
 * ResultadoVisita.asignadoAUsuarioId + VisitaController), no leyendo este
 * campo.
 */
@Entity
@Table(
		name = "auditoria_bodega",
		uniqueConstraints = @UniqueConstraint(columnNames = {"num_con", "cod_bod", "tipo_bod"}))
public class Bodega {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "cod_org", nullable = false)
	private String codOrg;

	@Column(name = "cod_usu", nullable = false)
	private String codUsu;

	@Column(name = "num_con", nullable = false)
	private String numCon;

	@Column(name = "cod_ins", nullable = false)
	private String codIns;

	@Column(name = "cod_bod", nullable = false)
	private String codBod;

	@Column(name = "des_bod")
	private String desBod;

	@Enumerated(EnumType.STRING)
	@Column(name = "tipo_bod", nullable = false)
	private TipoBodega tipoBod;

	/**
	 * HU-004: para filtrar "solo lo de mi empresa activa". SIN POBLAR
	 * todavia -- no hay forma confirmada de mapear codOrg (siempre "MED" en
	 * los datos de prueba, un solo valor, nada de donde inferir el mapeo)
	 * al id real de Empresa de este sistema. Queda null hasta que se
	 * resuelva eso; AuditoriaXmlMapper no lo setea.
	 */
	@Column(name = "empresa_id")
	private Long empresaId;

	protected Bodega() {
		// requerido por JPA
	}

	public Bodega(
			String codOrg,
			String codUsu,
			String numCon,
			String codIns,
			String codBod,
			String desBod,
			TipoBodega tipoBod) {
		this.codOrg = codOrg;
		this.codUsu = codUsu;
		this.numCon = numCon;
		this.codIns = codIns;
		this.codBod = codBod;
		this.desBod = desBod;
		this.tipoBod = tipoBod;
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

	public String getNumCon() {
		return numCon;
	}

	public String getCodIns() {
		return codIns;
	}

	public String getCodBod() {
		return codBod;
	}

	public String getDesBod() {
		return desBod;
	}

	public TipoBodega getTipoBod() {
		return tipoBod;
	}

	public Long getEmpresaId() {
		return empresaId;
	}

	public void setEmpresaId(Long empresaId) {
		this.empresaId = empresaId;
	}
}
