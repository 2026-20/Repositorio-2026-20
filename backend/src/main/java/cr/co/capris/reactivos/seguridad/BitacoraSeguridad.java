package cr.co.capris.reactivos.seguridad;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/**
 * Registro de auditoria, de solo insercion por convencion (nadie debe editarlo ni
 * borrarlo -- es un requisito de seguridad del sistema: la bitacora tiene que ser
 * append-only para servir como evidencia confiable). Se crea a traves de
 * BitacoraSeguridadService, nunca directo por el repositorio.
 */
@Entity
@Table(name = "bitacora_seguridad")
public class BitacoraSeguridad {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String username;

	private Long usuarioId;

	@Enumerated(EnumType.STRING)
	private TipoEventoSeguridad tipoEvento;

	private String detalle;

	private OffsetDateTime fecha;

	protected BitacoraSeguridad() {
		// requerido por JPA
	}

	BitacoraSeguridad(String username, Long usuarioId, TipoEventoSeguridad tipoEvento, String detalle,
			OffsetDateTime fecha) {
		this.username = username;
		this.usuarioId = usuarioId;
		this.tipoEvento = tipoEvento;
		this.detalle = detalle;
		this.fecha = fecha;
	}

	public Long getId() {
		return id;
	}

	public String getUsername() {
		return username;
	}

	public Long getUsuarioId() {
		return usuarioId;
	}

	public TipoEventoSeguridad getTipoEvento() {
		return tipoEvento;
	}

	public String getDetalle() {
		return detalle;
	}

	public OffsetDateTime getFecha() {
		return fecha;
	}
}
