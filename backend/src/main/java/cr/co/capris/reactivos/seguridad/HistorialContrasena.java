package cr.co.capris.reactivos.seguridad;

import cr.co.capris.reactivos.usuario.Usuario;
import jakarta.persistence.*;

import java.time.OffsetDateTime;

/**
 * Historial de hashes de contraseña, para impedir la reutilización de una
 * contraseña reciente (HU-046 criterio 4: "...establecidas en la política de
 * contraseñas del sistema", que incluye historial). Infraestructura compartida
 * -- ver HistorialContrasenaService y el comentario en la migración V4.
 */
@Entity
@Table(name = "historial_contrasena")
public class HistorialContrasena {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "usuario_id")
	private Usuario usuario;

	private String passwordHash;

	private OffsetDateTime creadoEn;

	protected HistorialContrasena() {
		// requerido por JPA
	}

	public HistorialContrasena(Usuario usuario, String passwordHash, OffsetDateTime creadoEn) {
		this.usuario = usuario;
		this.passwordHash = passwordHash;
		this.creadoEn = creadoEn;
	}

	public Long getId() {
		return id;
	}

	public Usuario getUsuario() {
		return usuario;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public OffsetDateTime getCreadoEn() {
		return creadoEn;
	}
}
