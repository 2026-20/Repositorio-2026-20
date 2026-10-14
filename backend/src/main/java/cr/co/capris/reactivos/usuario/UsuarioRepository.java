package cr.co.capris.reactivos.usuario;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

	Optional<Usuario> findByUsername(String username);

	Optional<Usuario> findByCorreo(String correo);

	// Firmas usadas por HU-047 para validar duplicados antes de crear un usuario.
	boolean existsByCedula(String cedula);

	boolean existsByCorreo(String correo);

	boolean existsByUsername(String username);

	// Aislamiento multiempresa -- toda consulta de usuarios se filtra por la
	// empresa del usuario autenticado, nunca se devuelven datos de otra empresa.
	List<Usuario> findAllByEmpresaId(Long empresaId);

	Optional<Usuario> findByIdAndEmpresaId(Long id, Long empresaId);

	// HU-050: el aviso de vencimiento proximo solo aplica a cuentas activas
	// (un PENDIENTE_PRIMER_INGRESO todavia no empezo su vigencia de 30 dias,
	// ver CaducidadContrasenaService; un INACTIVO no puede iniciar sesion).
	List<Usuario> findAllByEstado(EstadoUsuario estado);
}
