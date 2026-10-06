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

import java.time.LocalDate;

/**
 * Una fila de cai_est_vis.xml (ver EstadoVisitaXml para el DTO de parseo),
 * mas el resultado de la auditoria que esta app agrega.
 *
 * "estado" queda como String (no enum) porque en los datos de prueba solo
 * se vio el valor "PEND" -- no hay forma de conocer el set completo de
 * estados posibles sin preguntarle al ERP, e inventar valores (EN_PROCESO,
 * FINALIZADA, etc.) rompería la deserializacion en seco si el ERP manda
 * algo que no imaginamos.
 *
 * SUPUESTO sobre la salida (ver estudio de auditoria 2026-10, no confirmado
 * con el ERP): descripcionAjusteResultado + aprobacionTipo1..4 son los
 * campos que esta app completa con el resultado de la visita, y se asume
 * que el XML de salida reutiliza este mismo esquema con esos campos ya
 * llenos. Si el formato real de salida es distinto, el cambio queda en el
 * (futuro) exportador, no en esta entidad.
 *
 * estadoApp / asignadoAUsuarioId (HU-024, HU-008): a diferencia de los
 * campos anteriores, estos SI son un enum cerrado -- los gestiona esta
 * app, no el ERP, asi que no hay riesgo de que llegue un valor que no se
 * conozca (ver EstadoVisitaApp).
 */
@Entity
@Table(
		name = "auditoria_resultado_visita",
		uniqueConstraints = @UniqueConstraint(columnNames = {"num_con", "cod_bod"}))
public class ResultadoVisita {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "cod_org", nullable = false)
	private String codOrg;

	@Column(name = "cod_usu", nullable = false)
	private String codUsu;

	/** Tal como llega del ERP -- ver javadoc de la clase sobre por que no es enum. */
	@Column(name = "estado", nullable = false)
	private String estado;

	@Column(name = "des_estado")
	private String desEstado;

	@Column(name = "cod_bod", nullable = false)
	private String codBod;

	@Column(name = "lic_pub")
	private String licPub;

	@Column(name = "cod_ins", nullable = false)
	private String codIns;

	@Column(name = "cod_cli")
	private String codCli;

	@Column(name = "num_con", nullable = false)
	private String numCon;

	@Column(name = "obj_con")
	private String objCon;

	// Resultado de la auditoria -- ver SUPUESTO en el javadoc de la clase.
	@Column(name = "descripcion_ajuste_resultado")
	private String descripcionAjusteResultado;

	@Column(name = "aprobacion_tipo_1")
	private String aprobacionTipo1;

	@Column(name = "aprobacion_tipo_2")
	private String aprobacionTipo2;

	@Column(name = "aprobacion_tipo_3")
	private String aprobacionTipo3;

	@Column(name = "aprobacion_tipo_4")
	private String aprobacionTipo4;

	// HU-024/HU-008: estado de avance gestionado por esta app (NO es lo
	// mismo que "estado", que refleja tal cual lo que manda el ERP -- ver
	// javadoc de la clase). PENDIENTE por defecto en toda fila nueva.
	@Enumerated(EnumType.STRING)
	@Column(name = "estado_app", nullable = false)
	private EstadoVisitaApp estadoApp = EstadoVisitaApp.PENDIENTE;

	/**
	 * HU-037: asignacion MANUAL de un Administrador (ver VisitaController),
	 * stopgap mientras el ERP no manda la asignacion real -- ver SUPUESTO en
	 * el javadoc de Bodega sobre codUsu.
	 */
	@Column(name = "asignado_a_usuario_id")
	private Long asignadoAUsuarioId;

	/** HU-037 criterio 4 ("ruta del dia"): fecha para la que se asigno la visita. */
	@Column(name = "fecha_asignada")
	private LocalDate fechaAsignada;

	protected ResultadoVisita() {
		// requerido por JPA
	}

	public ResultadoVisita(
			String codOrg,
			String codUsu,
			String estado,
			String desEstado,
			String codBod,
			String licPub,
			String codIns,
			String codCli,
			String numCon,
			String objCon) {
		this.codOrg = codOrg;
		this.codUsu = codUsu;
		this.estado = estado;
		this.desEstado = desEstado;
		this.codBod = codBod;
		this.licPub = licPub;
		this.codIns = codIns;
		this.codCli = codCli;
		this.numCon = numCon;
		this.objCon = objCon;
	}

	/**
	 * Actualiza los campos que vienen del ERP (estado, licPub, etc.) con los
	 * de un snapshot mas reciente -- pero NO toca descripcionAjusteResultado,
	 * aprobacionTipo1..4, estadoApp ni asignadoAUsuarioId (esos 4 ultimos son
	 * estado de la app, no del ERP). Si el ERP reenvia el snapshot de la
	 * visita mientras el resultado de la auditoria ya quedo registrado en
	 * esta app, reingestarlo no debe borrar ese resultado (ver AuditoriaIngestaService).
	 */
	public void actualizarDatosDelErp(ResultadoVisita masReciente) {
		this.codOrg = masReciente.codOrg;
		this.codUsu = masReciente.codUsu;
		this.estado = masReciente.estado;
		this.desEstado = masReciente.desEstado;
		this.licPub = masReciente.licPub;
		this.codIns = masReciente.codIns;
		this.codCli = masReciente.codCli;
		this.objCon = masReciente.objCon;
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

	public String getEstado() {
		return estado;
	}

	public void setEstado(String estado) {
		this.estado = estado;
	}

	public String getDesEstado() {
		return desEstado;
	}

	public String getCodBod() {
		return codBod;
	}

	public String getLicPub() {
		return licPub;
	}

	public String getCodIns() {
		return codIns;
	}

	public String getCodCli() {
		return codCli;
	}

	public String getNumCon() {
		return numCon;
	}

	public String getObjCon() {
		return objCon;
	}

	public String getDescripcionAjusteResultado() {
		return descripcionAjusteResultado;
	}

	public void setDescripcionAjusteResultado(String descripcionAjusteResultado) {
		this.descripcionAjusteResultado = descripcionAjusteResultado;
	}

	public String getAprobacionTipo1() {
		return aprobacionTipo1;
	}

	public void setAprobacionTipo1(String aprobacionTipo1) {
		this.aprobacionTipo1 = aprobacionTipo1;
	}

	public String getAprobacionTipo2() {
		return aprobacionTipo2;
	}

	public void setAprobacionTipo2(String aprobacionTipo2) {
		this.aprobacionTipo2 = aprobacionTipo2;
	}

	public String getAprobacionTipo3() {
		return aprobacionTipo3;
	}

	public void setAprobacionTipo3(String aprobacionTipo3) {
		this.aprobacionTipo3 = aprobacionTipo3;
	}

	public String getAprobacionTipo4() {
		return aprobacionTipo4;
	}

	public void setAprobacionTipo4(String aprobacionTipo4) {
		this.aprobacionTipo4 = aprobacionTipo4;
	}

	public EstadoVisitaApp getEstadoApp() {
		return estadoApp;
	}

	public void setEstadoApp(EstadoVisitaApp estadoApp) {
		this.estadoApp = estadoApp;
	}

	public Long getAsignadoAUsuarioId() {
		return asignadoAUsuarioId;
	}

	public void setAsignadoAUsuarioId(Long asignadoAUsuarioId) {
		this.asignadoAUsuarioId = asignadoAUsuarioId;
	}

	public LocalDate getFechaAsignada() {
		return fechaAsignada;
	}

	/** HU-037: asigna esta visita a un Usuario de Campo para una fecha (la "ruta del dia"). */
	public void asignar(Long usuarioId, LocalDate fecha) {
		this.asignadoAUsuarioId = usuarioId;
		this.fechaAsignada = fecha;
	}
}
