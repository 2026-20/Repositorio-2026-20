package cr.co.capris.reactivos.auditoria;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * HU-038: confirmacion de inicio de jornada de un Usuario de Campo para un
 * dia especifico. Una fila = una jornada confirmada -- si no existe fila
 * para (usuarioId, fecha), la jornada de ese dia no se ha iniciado (ver
 * JornadaService.estaIniciada(), que es lo que consulta
 * ConteoFisicoService antes de aceptar un conteo, criterio 4 de la HU).
 */
@Entity
@Table(
		name = "auditoria_jornada",
		uniqueConstraints = @UniqueConstraint(columnNames = {"usuario_id", "fecha"}))
public class Jornada {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "usuario_id", nullable = false)
	private Long usuarioId;

	@Column(name = "fecha", nullable = false)
	private LocalDate fecha;

	@Column(name = "iniciada_en", nullable = false)
	private OffsetDateTime iniciadaEn;

	protected Jornada() {
		// requerido por JPA
	}

	public Jornada(Long usuarioId, LocalDate fecha, OffsetDateTime iniciadaEn) {
		this.usuarioId = usuarioId;
		this.fecha = fecha;
		this.iniciadaEn = iniciadaEn;
	}

	public Long getId() {
		return id;
	}

	public Long getUsuarioId() {
		return usuarioId;
	}

	public LocalDate getFecha() {
		return fecha;
	}

	public OffsetDateTime getIniciadaEn() {
		return iniciadaEn;
	}
}
