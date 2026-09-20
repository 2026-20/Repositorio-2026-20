package cr.co.capris.reactivos.usuario;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/**
 * Campos segun HU-047 (registro de usuarios nuevos): nombre completo, cedula, correo
 * corporativo, username, rol y empresa/filial son obligatorios. La contraseña nunca se
 * guarda en texto plano -- solo el hash (ver Usuario.passwordHash), y nunca se expone
 * en las respuestas de la API (ver UsuarioResumenDTO).
 */
@Entity
@Table(name = "usuario")
public class Usuario {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String nombreCompleto;

	private String cedula;

	private String correo;

	private String username;

	private String passwordHash;

	@Enumerated(EnumType.STRING)
	private EstadoUsuario estado;

	// EAGER a proposito: toda conversion a UsuarioResumenDTO necesita rol y empresa
	// (UsuarioController, AutenticacionController), y son relaciones simples de una
	// sola fila -- LAZY causaba LazyInitializationException fuera de una transaccion
	// (el repositorio cierra su sesion antes de que el controlador acceda a estos campos).
	@ManyToOne(fetch = FetchType.EAGER, optional = false)
	@JoinColumn(name = "rol_id")
	private Rol rol;

	@ManyToOne(fetch = FetchType.EAGER, optional = false)
	@JoinColumn(name = "empresa_id")
	private Empresa empresa;

	/** Solo aplica mientras estado == PENDIENTE_PRIMER_INGRESO (HU-044: vigencia de la clave temporal). */
	private OffsetDateTime passwordTemporalExpiraEn;

	/** HU-043: se reinicia a 0 en cada login exitoso. */
	private int intentosFallidos;

	/** HU-043: no nulo mientras la cuenta esta bloqueada por intentos fallidos. */
	private OffsetDateTime bloqueadoHasta;

	/**
	 * HU-048: cualquier JWT emitido ANTES de esta fecha se considera invalido,
	 * sin importar que no haya expirado todavia (ver JwtAuthenticationFilter).
	 * Se fija al inactivar la cuenta; null significa que nunca se revoco nada.
	 */
	private OffsetDateTime sesionesInvalidadasDesde;

	protected Usuario() {
		// requerido por JPA
	}

	public Usuario(
			String nombreCompleto,
			String cedula,
			String correo,
			String username,
			String passwordHash,
			EstadoUsuario estado,
			Rol rol,
			Empresa empresa,
			OffsetDateTime passwordTemporalExpiraEn) {
		this.nombreCompleto = nombreCompleto;
		this.cedula = cedula;
		this.correo = correo;
		this.username = username;
		this.passwordHash = passwordHash;
		this.estado = estado;
		this.rol = rol;
		this.empresa = empresa;
		this.passwordTemporalExpiraEn = passwordTemporalExpiraEn;
	}

	public Long getId() {
		return id;
	}

	public String getNombreCompleto() {
		return nombreCompleto;
	}

	public String getCedula() {
		return cedula;
	}

	public String getCorreo() {
		return correo;
	}

	public String getUsername() {
		return username;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public EstadoUsuario getEstado() {
		return estado;
	}

	public void setEstado(EstadoUsuario estado) {
		this.estado = estado;
	}

	public Rol getRol() {
		return rol;
	}

	public Empresa getEmpresa() {
		return empresa;
	}

	public OffsetDateTime getPasswordTemporalExpiraEn() {
		return passwordTemporalExpiraEn;
	}

	public int getIntentosFallidos() {
		return intentosFallidos;
	}

	public void setIntentosFallidos(int intentosFallidos) {
		this.intentosFallidos = intentosFallidos;
	}

	public OffsetDateTime getBloqueadoHasta() {
		return bloqueadoHasta;
	}

	public void setBloqueadoHasta(OffsetDateTime bloqueadoHasta) {
		this.bloqueadoHasta = bloqueadoHasta;
	}

	public OffsetDateTime getSesionesInvalidadasDesde() {
		return sesionesInvalidadasDesde;
	}

	public void setSesionesInvalidadasDesde(OffsetDateTime sesionesInvalidadasDesde) {
		this.sesionesInvalidadasDesde = sesionesInvalidadasDesde;
	}
}
