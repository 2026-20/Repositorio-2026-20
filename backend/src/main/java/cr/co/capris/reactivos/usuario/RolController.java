package cr.co.capris.reactivos.usuario;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Solo lectura -- lista de roles para el formulario de alta de usuario.
 * A diferencia de EmpresaController, este endpoint SI exige sesion (no esta en la
 * lista permitAll de SecurityConfig): cualquier usuario autenticado puede verlo,
 * pero no un anonimo.
 */
@RestController
@RequestMapping("/api/roles")
public class RolController {

	private final RolRepository rolRepository;

	public RolController(RolRepository rolRepository) {
		this.rolRepository = rolRepository;
	}

	@GetMapping
	public List<RolResumenDTO> listar() {
		return rolRepository.findAll()
				.stream()
				.map(RolResumenDTO::from)
				.toList();
	}
}
