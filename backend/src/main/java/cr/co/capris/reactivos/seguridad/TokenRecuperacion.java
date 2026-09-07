package cr.co.capris.reactivos.seguridad;

import cr.co.capris.reactivos.usuario.Usuario;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/**
 * Tabla de apoyo para HU-046 (recuperacion de contraseña olvidada). Esta clase solo
 * modela el dato -- generar el token, enviarlo por correo, validar el limite de 3
 * intentos y el vencimiento de 15 minutos es responsabilidad de quien implemente esa HU.
 */
@Entity
@Table(name = "token_recuperacion")
public class TokenRecuperacion {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "usuario_id")
	private Usuario usuario;

	private String token;

	private OffsetDateTime creadoEn;

	private OffsetDateTime expiraEn;

	private boolean usado;

	protected TokenRecuperacion() {
		// requerido por JPA
	}

	public TokenRecuperacion(Usuario usuario, String token, OffsetDateTime creadoEn, OffsetDateTime expiraEn) {
		this.usuario = usuario;
		this.token = token;
		this.creadoEn = creadoEn;
		this.expiraEn = expiraEn;
		this.usado = false;
	}

	public Long getId() {
		return id;
	}

	public Usuario getUsuario() {
		return usuario;
	}

	public String getToken() {
		return token;
	}

	public OffsetDateTime getCreadoEn() {
		return creadoEn;
	}

	public OffsetDateTime getExpiraEn() {
		return expiraEn;
	}

	public boolean isUsado() {
		return usado;
	}

	public void setUsado(boolean usado) {
		this.usado = usado;
	}
}
