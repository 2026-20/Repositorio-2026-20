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

import java.time.OffsetDateTime;

/**
 * HU-031: registro de auditoria de solo insercion (igual que
 * BitacoraSeguridad -- nadie debe editarlo ni borrarlo), pero de acciones
 * operativas de campo, no de seguridad. Se crea a traves de
 * TrazabilidadService, nunca directo por el repositorio.
 *
 * idIdempotencia: estas acciones ocurren en campo, offline-first -- el
 * registro se genera en el dispositivo (wa-sqlite/OPFS) y se sincroniza
 * despues, igual que ConteoFisico. El cliente genera este id una sola vez
 * al crear el registro localmente y lo reenvia tal cual al sincronizar,
 * para que un reintento de sincronizacion no duplique la fila.
 *
 * fecha: la hora en que la accion ocurrio en el dispositivo, no la hora en
 * que el backend la recibe -- puede ser horas antes si no habia señal
 * para sincronizar. La manda el cliente (a diferencia de
 * BitacoraSeguridad.fecha, que siempre es OffsetDateTime.now() porque esas
 * acciones de seguridad requieren estar en linea de por si).
 */
@Entity
@Table(
		name = "auditoria_trazabilidad",
		uniqueConstraints = @UniqueConstraint(columnNames = "id_idempotencia"))
public class RegistroTrazabilidad {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "id_idempotencia", nullable = false)
	private String idIdempotencia;

	@Enumerated(EnumType.STRING)
	@Column(name = "tipo_accion", nullable = false)
	private TipoAccionTrazabilidad tipoAccion;

	@Column(name = "usuario_id", nullable = false)
	private Long usuarioId;

	@Column(name = "empresa_id", nullable = false)
	private Long empresaId;

	/** Null para acciones sin bodega asociada (ej. inicio de sesion). */
	@Column(name = "cod_bod")
	private String codBod;

	@Enumerated(EnumType.STRING)
	@Column(name = "resultado", nullable = false)
	private ResultadoAccionTrazabilidad resultado;

	@Column(name = "detalle")
	private String detalle;

	@Column(name = "fecha", nullable = false)
	private OffsetDateTime fecha;

	protected RegistroTrazabilidad() {
		// requerido por JPA
	}

	public RegistroTrazabilidad(
			String idIdempotencia,
			TipoAccionTrazabilidad tipoAccion,
			Long usuarioId,
			Long empresaId,
			String codBod,
			ResultadoAccionTrazabilidad resultado,
			String detalle,
			OffsetDateTime fecha) {
		this.idIdempotencia = idIdempotencia;
		this.tipoAccion = tipoAccion;
		this.usuarioId = usuarioId;
		this.empresaId = empresaId;
		this.codBod = codBod;
		this.resultado = resultado;
		this.detalle = detalle;
		this.fecha = fecha;
	}

	public Long getId() {
		return id;
	}

	public String getIdIdempotencia() {
		return idIdempotencia;
	}

	public TipoAccionTrazabilidad getTipoAccion() {
		return tipoAccion;
	}

	public Long getUsuarioId() {
		return usuarioId;
	}

	public Long getEmpresaId() {
		return empresaId;
	}

	public String getCodBod() {
		return codBod;
	}

	public ResultadoAccionTrazabilidad getResultado() {
		return resultado;
	}

	public String getDetalle() {
		return detalle;
	}

	public OffsetDateTime getFecha() {
		return fecha;
	}
}
