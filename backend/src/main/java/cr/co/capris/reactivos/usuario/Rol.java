package cr.co.capris.reactivos.usuario;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Rol de acceso (RBAC). Tabla en vez de enum fijo -- coincide con el modelo E-R
 * (Figura 6 del documento de arquitectura), que ya define ROL como tabla propia.
 * Los dos roles definidos hoy en la matriz de acceso (seccion 2.3.3): Administrador
 * y Usuario de Campo.
 */
@Entity
@Table(name = "rol")
public class Rol {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String nombre;

	protected Rol() {
		// requerido por JPA
	}

	public Rol(String nombre) {
		this.nombre = nombre;
	}

	public Long getId() {
		return id;
	}

	public String getNombre() {
		return nombre;
	}
}
