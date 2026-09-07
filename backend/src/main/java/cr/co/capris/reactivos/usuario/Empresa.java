package cr.co.capris.reactivos.usuario;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Empresa/filial del modelo multiempresa (HU-023, RNF-006). No existia como entidad
 * explicita en el modelo E-R original del documento de arquitectura (Figura 6) -- se
 * agrega aqui porque HU-023 depende de poder filtrar datos por empresa a nivel de query.
 */
@Entity
@Table(name = "empresa")
public class Empresa {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String nombre;

	protected Empresa() {
		// requerido por JPA
	}

	public Empresa(String nombre) {
		this.nombre = nombre;
	}

	public Long getId() {
		return id;
	}

	public String getNombre() {
		return nombre;
	}
}
