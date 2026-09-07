package cr.co.capris.reactivos.usuario;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

	Optional<Usuario> findByUsername(String username);

	// Firmas usadas por HU-047 para validar duplicados antes de crear un usuario.
	boolean existsByCedula(String cedula);

	boolean existsByCorreo(String correo);

	boolean existsByUsername(String username);
}
