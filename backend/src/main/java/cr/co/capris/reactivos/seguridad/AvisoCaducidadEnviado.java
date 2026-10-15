package cr.co.capris.reactivos.seguridad;

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
 * HU-050 criterio 5: registro de que ya se envio un aviso (5/3/1 dias) para
 * una vigencia de contraseña especifica, para no reenviarlo. Se crea a
 * traves de AvisoCaducidadContrasenaService, nunca directo por el
 * repositorio -- ver su javadoc sobre por que passwordExpiraEn forma parte
 * de la clave.
 */
@Entity
@Table(
		name = "aviso_caducidad_contrasena_enviado",
		uniqueConstraints = @UniqueConstraint(columnNames = {"usuario_id", "tipo_aviso", "password_expira_en"}))
public class AvisoCaducidadEnviado {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "usuario_id", nullable = false)
	private Long usuarioId;

	@Enumerated(EnumType.STRING)
	@Column(name = "tipo_aviso", nullable = false)
	private TipoAvisoCaducidad tipoAviso;

	@Column(name = "password_expira_en", nullable = false)
	private OffsetDateTime passwordExpiraEn;

	@Column(name = "enviado_en", nullable = false)
	private OffsetDateTime enviadoEn;

	protected AvisoCaducidadEnviado() {
		// requerido por JPA
	}

	public AvisoCaducidadEnviado(
			Long usuarioId, TipoAvisoCaducidad tipoAviso, OffsetDateTime passwordExpiraEn, OffsetDateTime enviadoEn) {
		this.usuarioId = usuarioId;
		this.tipoAviso = tipoAviso;
		this.passwordExpiraEn = passwordExpiraEn;
		this.enviadoEn = enviadoEn;
	}

	public Long getId() {
		return id;
	}

	public Long getUsuarioId() {
		return usuarioId;
	}

	public TipoAvisoCaducidad getTipoAviso() {
		return tipoAviso;
	}

	public OffsetDateTime getPasswordExpiraEn() {
		return passwordExpiraEn;
	}

	public OffsetDateTime getEnviadoEn() {
		return enviadoEn;
	}
}
